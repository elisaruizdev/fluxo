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

function card(id: string, columnId: string, position: number): Card {
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
  }
}

const api = vi.hoisted(() => ({
  getBoard: vi.fn(),
  updateCard: vi.fn(),
}))

vi.mock('@/api', async () => ({ ...(await import('@/api/types')), api }))

const { useBoardStore } = await import('./board')

describe('board store', () => {
  beforeEach(async () => {
    setActivePinia(createPinia())
    api.getBoard.mockResolvedValue(snapshot())
    await useBoardStore().loadBoard('b1')
  })

  it('agrupa y ordena las tarjetas por columna', () => {
    const store = useBoardStore()
    expect(store.cardsByColumn.todo!.map((c) => c.id)).toEqual(['a', 'b'])
    expect(store.cardsByColumn.done!.map((c) => c.id)).toEqual(['c'])
  })

  it('mueve una tarjeta entre columnas con la posición del punto medio y guarda la nueva versión', async () => {
    const store = useBoardStore()
    api.updateCard.mockImplementation(async (id, version, patch) => ({ ...store.cards[id], ...patch, version: version + 1 }))

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

  it('ignora eventos remotos con una versión más antigua', () => {
    const store = useBoardStore()
    store.cards.a!.version = 3
    store.applyRemote({ type: 'card.upserted', card: { ...card('a', 'done', 1), version: 2 } })
    expect(store.cards.a!.columnId).toBe('todo')
  })
})
