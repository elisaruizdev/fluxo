import { defineStore } from 'pinia'
import { computed, ref, shallowRef } from 'vue'
import { api, ApiError, type CardPatch, type RealtimeEvent, type SavedCard } from '@/api'
import { useOptimisticMutation } from '@/composables/useOptimisticMutation'
import { useToasts } from '@/composables/useToasts'
import type { Board, Card, Column, Label, Member } from '@/types/domain'
import { createKeyedQueue } from '@/utils/keyedQueue'
import { byPosition, positionAt } from '@/utils/position'

/**
 * Setup store: el cuerpo funciona como un `<script setup>`.
 * ref → state, computed → getters, funciones → actions.
 */
export const useBoardStore = defineStore('board', () => {
  const { push: toast } = useToasts()

  const board = shallowRef<Board | null>(null)
  const columns = ref<Column[]>([])
  // Normalizado por id: actualizar una tarjeta es O(1) y no duplica datos
  const cards = ref<Record<string, Card>>({})
  const labels = ref<Label[]>([])
  const members = ref<Member[]>([])
  const loading = ref(false)
  const error = shallowRef<unknown>(null)

  const sortedColumns = computed(() => [...columns.value].sort(byPosition))

  const cardsByColumn = computed(() => {
    const map: Record<string, Card[]> = {}
    for (const col of columns.value) map[col.id] = []
    for (const card of Object.values(cards.value)) map[card.columnId]?.push(card)
    for (const list of Object.values(map)) list.sort(byPosition)
    return map
  })

  const labelById = computed(() => Object.fromEntries(labels.value.map((l) => [l.id, l])))
  const memberById = computed(() => Object.fromEntries(members.value.map((m) => [m.id, m])))

  async function loadBoard(boardId: string, { silent = false } = {}) {
    if (!silent) loading.value = true
    error.value = null
    try {
      const snap = await api.getBoard(boardId)
      board.value = snap.board
      columns.value = snap.columns
      cards.value = Object.fromEntries(snap.cards.map((c) => [c.id, c]))
      labels.value = snap.labels
      members.value = snap.members
    } catch (e) {
      error.value = e
      board.value = null
    } finally {
      loading.value = false
    }
  }

  const refresh = () => (board.value ? loadBoard(board.value.id, { silent: true }) : Promise.resolve())

  // --- Escrituras sobre tarjetas: en cola por tarjeta y con la versión del momento de enviar ---

  const queue = createKeyedQueue()
  /** Cambios de cada tarjeta que aún esperan respuesta */
  const pending: Record<string, number> = {}

  function sendUpdate(cardId: string, payload: CardPatch | { columnId: string; position: number }) {
    pending[cardId] = (pending[cardId] ?? 0) + 1
    return queue
      .run(cardId, async () => {
        const saved = await api.updateCard(cardId, cards.value[cardId]!.version, payload)
        // La versión se actualiza DENTRO de la tarea: la siguiente de la cola ya sale con ella
        const local = cards.value[cardId]
        if (local) local.version = saved.version
        return saved
      })
      .finally(() => pending[cardId]!--)
  }

  function reconcile({ columnReindexed, ...saved }: SavedCard) {
    const local = cards.value[saved.id]
    if (!local) return
    // Si hay más cambios de esta tarjeta en camino, no pisamos su estado optimista: solo la versión
    if (pending[saved.id]) local.version = saved.version
    else cards.value[saved.id] = saved
    if (columnReindexed) void refresh()
  }

  function handleError(e: unknown, cardId?: string) {
    if (e instanceof ApiError && e.status === 409 && cardId) {
      const current = e.data.current as Card | undefined
      if (current) cards.value[cardId] = current
      else void refresh()
      toast('Otra persona cambió esta tarjeta antes que tú: ahora ves su versión.', 'error')
    } else if (e instanceof ApiError && e.status === 404 && cardId) {
      delete cards.value[cardId]
      toast('Esa tarjeta ya no existe.', 'error')
    } else {
      toast('No se pudo guardar el cambio. Se ha revertido.', 'error')
    }
  }

  const move = useOptimisticMutation({
    apply: (cardId: string, columnId: string, position: number) => {
      const card = cards.value[cardId]!
      const before = { columnId: card.columnId, position: card.position }
      Object.assign(card, { columnId, position })
      return () => Object.assign(card, before)
    },
    request: (cardId: string, columnId: string, position: number) => sendUpdate(cardId, { columnId, position }),
    onSuccess: reconcile,
    onError: (e, cardId) => handleError(e, cardId),
  })

  function moveCard(cardId: string, toColumnId: string, toIndex: number) {
    const siblings = (cardsByColumn.value[toColumnId] ?? []).filter((c) => c.id !== cardId)
    return move.mutate(cardId, toColumnId, positionAt(siblings, toIndex))
  }

  const patch = useOptimisticMutation({
    apply: (cardId: string, changes: CardPatch) => {
      const card = cards.value[cardId]!
      const before = Object.fromEntries(Object.keys(changes).map((k) => [k, card[k as keyof Card]]))
      Object.assign(card, changes)
      return () => Object.assign(card, before)
    },
    request: sendUpdate,
    onSuccess: reconcile,
    onError: (e, cardId) => handleError(e, cardId),
  })

  async function addCard(columnId: string, title: string) {
    const list = cardsByColumn.value[columnId] ?? []
    const position = positionAt(list, list.length)
    // Id temporal para pintarla ya; se sustituye por la del servidor
    const tempId = `temp_${crypto.randomUUID()}`
    cards.value[tempId] = {
      id: tempId,
      columnId,
      title,
      description: '',
      position,
      version: 0,
      assigneeId: null,
      dueDate: null,
      labelIds: [],
      deletedAt: null,
      createdAt: new Date().toISOString(),
    }
    try {
      const saved = await api.createCard(columnId, title, position)
      delete cards.value[tempId]
      cards.value[saved.id] = saved
    } catch (e) {
      delete cards.value[tempId]
      handleError(e)
    }
  }

  async function removeCard(cardId: string) {
    const backup = cards.value[cardId]
    delete cards.value[cardId]
    try {
      await queue.run(cardId, () => api.deleteCard(cardId))
    } catch (e) {
      if (backup) cards.value[cardId] = backup
      handleError(e)
    }
  }

  async function addColumn(title: string) {
    if (!board.value) return
    const position = positionAt(sortedColumns.value, sortedColumns.value.length)
    try {
      columns.value.push(await api.createColumn(board.value.id, title, position))
    } catch (e) {
      handleError(e)
    }
  }

  /** Eventos de otras personas (en modo mock, otras pestañas; WebSocket en el paso 5) */
  function applyRemote(event: RealtimeEvent) {
    switch (event.type) {
      case 'card.upserted': {
        const local = cards.value[event.card.id]
        const belongsHere = local || columns.value.some((c) => c.id === event.card.columnId)
        if (belongsHere && (!local || event.card.version >= local.version)) cards.value[event.card.id] = event.card
        break
      }
      case 'card.deleted':
        delete cards.value[event.cardId]
        break
      case 'column.created':
        if (event.column.boardId === board.value?.id && !columns.value.some((c) => c.id === event.column.id))
          columns.value.push(event.column)
        break
      case 'comment.created':
        break // lo gestiona el modal de la tarjeta
    }
  }

  return {
    board,
    columns,
    cards,
    labels,
    members,
    loading,
    error,
    sortedColumns,
    cardsByColumn,
    labelById,
    memberById,
    loadBoard,
    moveCard,
    updateCard: patch.mutate,
    addCard,
    removeCard,
    addColumn,
    applyRemote,
  }
})
