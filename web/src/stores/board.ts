import { defineStore } from 'pinia'
import { computed, ref, shallowRef } from 'vue'
import { api, ApiError, type CardPatch, type RealtimeEvent } from '@/api'
import { useOptimisticMutation } from '@/composables/useOptimisticMutation'
import { useToasts } from '@/composables/useToasts'
import type { Board, Card, Column, Label, User } from '@/types/domain'
import { byPosition, positionAt } from '@/utils/position'

/**
 * Setup store: el cuerpo funciona como un `<script setup>`.
 * ref → state, computed → getters, funciones → actions.
 */
export const useBoardStore = defineStore('board', () => {
  const { push: toast } = useToasts()

  const boards = ref<Board[]>([])
  const board = shallowRef<Board | null>(null)
  const columns = ref<Column[]>([])
  // Normalizado por id: actualizar una tarjeta es O(1) y no duplica datos
  const cards = ref<Record<string, Card>>({})
  const labels = ref<Label[]>([])
  const members = ref<User[]>([])
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

  async function fetchBoards() {
    boards.value = await api.listBoards()
  }

  async function loadBoard(boardId: string) {
    loading.value = true
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

  function handleError(e: unknown) {
    if (e instanceof ApiError && e.status === 409) {
      toast('Alguien cambió esta tarjeta antes que tú. Recargando el tablero…', 'error')
      if (board.value) void loadBoard(board.value.id)
    } else {
      toast('No se pudo guardar el cambio. Se ha revertido.', 'error')
    }
  }

  // Sustituye la tarjeta por la versión del servidor (trae la nueva `version`)
  const reconcile = (saved: Card) => {
    cards.value[saved.id] = saved
  }

  const move = useOptimisticMutation({
    apply: (cardId: string, toColumnId: string, toIndex: number) => {
      const card = cards.value[cardId]!
      const before = { columnId: card.columnId, position: card.position }
      const siblings = (cardsByColumn.value[toColumnId] ?? []).filter((c) => c.id !== cardId)
      card.columnId = toColumnId
      card.position = positionAt(siblings, toIndex)
      return () => Object.assign(card, before)
    },
    request: (cardId: string) => {
      const { version, columnId, position } = cards.value[cardId]!
      return api.updateCard(cardId, version, { columnId, position })
    },
    onSuccess: reconcile,
    onError: handleError,
  })

  const patch = useOptimisticMutation({
    apply: (cardId: string, changes: CardPatch) => {
      const card = cards.value[cardId]!
      const before = Object.fromEntries(Object.keys(changes).map((k) => [k, card[k as keyof Card]]))
      Object.assign(card, changes)
      return () => Object.assign(card, before)
    },
    request: (cardId: string, changes: CardPatch) => api.updateCard(cardId, cards.value[cardId]!.version, changes),
    onSuccess: reconcile,
    onError: handleError,
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
      await api.deleteCard(cardId)
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

  /** Eventos de otras personas (otras pestañas, de momento) */
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
    boards,
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
    fetchBoards,
    loadBoard,
    moveCard: move.mutate,
    updateCard: patch.mutate,
    addCard,
    removeCard,
    addColumn,
    applyRemote,
  }
})
