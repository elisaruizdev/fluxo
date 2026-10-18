import { createPinia, setActivePinia } from 'pinia'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { ApiError } from '@/api/types'
import type { BoardSnapshot, Card } from '@/types/domain'

const snapshot = (): BoardSnapshot => ({
  board: { id: 'b1', workspaceId: 'w1', title: 'Test', createdAt: '' },
  columns: [
    { id: 'todo', boardId: 'b1', title: 'Todo', position: 1024 },
    { id: 'done', boardId: 'b1', title: 'Done', position: 2048 },
  ],
  cards: [card('a', 'todo', 1024), card('b', 'todo', 2048), card('c', 'done', 1024)],
  labels: [],
  members: [],
})

function card(id: string, columnId: string, position: number, extra: Partial<Card> = {}): Card {
  return {
    id,
    columnId,
    title: id,
    description: '',
    position,
    version: 1,
    assigneeId: null,
    dueDate: null,
    labelIds: [],
    deletedAt: null,
    createdAt: '',
    ...extra,
  }
}

const api = vi.hoisted(() => ({
  getBoard: vi.fn(),
  updateCard: vi.fn(),
}))

vi.mock('@/api', async () => ({ ...(await import('@/api/types')), api }))

const { useBoardStore } = await import('./board')

/** Servidor falso: aplica el patch y sube la versión, como la API real */
function serverEcho() {
  const store = useBoardStore()
  const server: Record<string, Card> = Object.fromEntries(snapshot().cards.map((c) => [c.id, c]))
  api.updateCard.mockImplementation(async (id: string, version: number, patch: Partial<Card>) => {
    const current = server[id]!
    if (current.version !== version) throw new ApiError(409, 'conflict', { current })
    server[id] = { ...current, ...patch, version: version + 1 }
    return server[id]
  })
  return { store, server }
}

describe('board store', () => {
  beforeEach(async () => {
    vi.clearAllMocks()
    setActivePinia(createPinia())
    api.getBoard.mockResolvedValue(snapshot())
    await useBoardStore().loadBoard('b1')
  })

  it('agrupa y ordena las tarjetas por columna', () => {
    const store = useBoardStore()
    expect(store.cardsByColumn.todo!.map((c) => c.id)).toEqual(['a', 'b'])
    expect(store.cardsByColumn.done!.map((c) => c.id)).toEqual(['c'])
  })

  it('mueve una tarjeta con la posición del punto medio y guarda la nueva versión', async () => {
    const { store } = serverEcho()

    const pending = store.moveCard('b', 'done', 0)
    expect(store.cardsByColumn.done!.map((c) => c.id)).toEqual(['b', 'c'])
    expect(store.cards.b!.position).toBe(512)

    await pending
    expect(api.updateCard).toHaveBeenCalledWith('b', 1, { columnId: 'done', position: 512 })
    expect(store.cards.b!.version).toBe(2)
  })

  it('revierte el movimiento si el servidor responde con error', async () => {
    const store = useBoardStore()
    api.updateCard.mockRejectedValue(new ApiError(500, 'boom'))

    await store.moveCard('a', 'done', 1)
    expect(store.cards.a).toMatchObject({ columnId: 'todo', position: 1024 })
  })

  it('en un 409 muestra la versión del servidor que viene en `current`', async () => {
    const store = useBoardStore()
    const current = card('a', 'done', 9999, { title: 'Editada por otra persona', version: 5 })
    api.updateCard.mockRejectedValue(new ApiError(409, 'conflict', { current }))

    await store.updateCard('a', { title: 'Mi cambio' })
    expect(store.cards.a).toEqual(current)
    expect(api.getBoard).toHaveBeenCalledTimes(1) // sin recargar todo el tablero
  })

  it('dos cambios seguidos de la misma tarjeta salen en serie y con la versión correcta', async () => {
    const { store } = serverEcho()

    const first = store.moveCard('a', 'done', 0)
    const second = store.updateCard('a', { title: 'Renombrada' })
    await Promise.all([first, second])

    expect(api.updateCard).toHaveBeenNthCalledWith(1, 'a', 1, expect.anything())
    expect(api.updateCard).toHaveBeenNthCalledWith(2, 'a', 2, { title: 'Renombrada' })
    expect(store.cards.a).toMatchObject({ columnId: 'done', title: 'Renombrada', version: 3 })
  })

  it('recarga el tablero si el servidor reindexó la lista', async () => {
    const store = useBoardStore()
    api.updateCard.mockResolvedValue({ ...card('a', 'done', 1024, { version: 2 }), columnReindexed: true })

    await store.moveCard('a', 'done', 0)
    await vi.waitFor(() => expect(api.getBoard).toHaveBeenCalledTimes(2))
  })

  it('ignora eventos remotos con una versión más antigua', () => {
    const store = useBoardStore()
    store.cards.a!.version = 3
    store.applyRemote({ type: 'card.upserted', card: { ...card('a', 'done', 1), version: 2 } })
    expect(store.cards.a!.columnId).toBe('todo')
  })
})
