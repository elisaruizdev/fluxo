import type { Board, Card, Column, Comment, Label, Membership, Session, User } from '@/types/domain'
import * as seed from './seed'
import { ApiError, type FluxoApi, type RealtimeEvent } from './types'

/**
 * "Servidor" dentro del navegador: persiste en localStorage (compartido entre pestañas)
 * y emite eventos por BroadcastChannel que, como un socket.broadcast, no llegan
 * a la pestaña que los envía. Abre dos pestañas para ver el "tiempo real".
 */
const STORAGE_KEY = 'fluxo:mock-db:v2'
const CURRENT_USER_ID = 'u1'
const LATENCY_MS = Number(import.meta.env.VITE_MOCK_LATENCY_MS ?? 250)
const FAIL_RATE = Number(import.meta.env.VITE_MOCK_FAIL_RATE ?? 0)

interface Db {
  workspaces: { id: string; name: string }[]
  memberships: Membership[]
  boards: Board[]
  columns: Column[]
  cards: Card[]
  labels: Label[]
  users: User[]
  comments: Comment[]
}

export const realtimeChannel =
  typeof BroadcastChannel !== 'undefined' ? new BroadcastChannel('fluxo:realtime') : null

function freshDb(): Db {
  return structuredClone({
    workspaces: seed.workspaces,
    memberships: seed.memberships,
    boards: seed.boards,
    columns: seed.columns,
    cards: seed.cards,
    labels: seed.labels,
    users: seed.users,
    comments: seed.comments,
  })
}

let memoryDb: Db | null = null

// Se relee en cada petición porque otra pestaña puede haber escrito
function read(): Db {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (raw) return JSON.parse(raw) as Db
  } catch {
    /* almacenamiento no disponible: seguimos en memoria */
  }
  return (memoryDb ??= freshDb())
}

function write(db: Db) {
  memoryDb = db
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(db))
  } catch {
    /* noop */
  }
}

function emit(event: RealtimeEvent) {
  realtimeChannel?.postMessage(event)
}

async function respond<T>(fn: () => T, { mutation = false } = {}): Promise<T> {
  await new Promise((r) => setTimeout(r, LATENCY_MS * (0.5 + Math.random())))
  if (mutation && Math.random() < FAIL_RATE) throw new ApiError(500, 'Error simulado del servidor')
  return structuredClone(fn())
}

const uid = (prefix: string) => `${prefix}_${crypto.randomUUID().slice(0, 8)}`

function findCard(db: Db, cardId: string) {
  const card = db.cards.find((c) => c.id === cardId && !c.deletedAt)
  if (!card) throw new ApiError(404, 'La tarjeta no existe')
  return card
}

// Sin backend no hay contraseñas: cualquier login entra como el usuario u1
const mockSession = (): Session => ({ accessToken: 'mock', user: read().users.find((u) => u.id === CURRENT_USER_ID)! })

export const mockApi: FluxoApi = {
  register: () => respond(mockSession),
  login: () => respond(mockSession),
  refresh: () => respond(mockSession),
  logout: () => respond(() => undefined),

  listWorkspaces: () =>
    respond(() => {
      const db = read()
      return db.memberships
        .filter((m) => m.userId === CURRENT_USER_ID)
        .map((m) => ({ ...db.workspaces.find((w) => w.id === m.workspaceId)!, role: m.role }))
    }),

  listBoards: (workspaceId) => respond(() => read().boards.filter((b) => b.workspaceId === workspaceId)),

  createBoard: (workspaceId, title) =>
    respond(
      () => {
        const db = read()
        const board: Board = { id: uid('board'), workspaceId, title, createdAt: new Date().toISOString() }
        db.boards.push(board)
        ;['Pendiente', 'En curso', 'Hecho'].forEach((t, i) =>
          db.columns.push({ id: uid('col'), boardId: board.id, title: t, position: (i + 1) * 1024 }),
        )
        write(db)
        return board
      },
      { mutation: true },
    ),

  getBoard: (boardId) =>
    respond(() => {
      const db = read()
      const board = db.boards.find((b) => b.id === boardId)
      if (!board) throw new ApiError(404, 'El tablero no existe')
      const columns = db.columns.filter((c) => c.boardId === boardId)
      const columnIds = new Set(columns.map((c) => c.id))
      return {
        board,
        columns,
        cards: db.cards.filter((c) => columnIds.has(c.columnId) && !c.deletedAt),
        labels: db.labels.filter((l) => l.boardId === boardId),
        members: db.memberships
          .filter((m) => m.workspaceId === board.workspaceId)
          .map((m) => ({ ...db.users.find((u) => u.id === m.userId)!, role: m.role })),
      }
    }),

  createColumn: (boardId, title, position) =>
    respond(
      () => {
        const db = read()
        const column: Column = { id: uid('col'), boardId, title, position }
        db.columns.push(column)
        write(db)
        emit({ type: 'column.created', column })
        return column
      },
      { mutation: true },
    ),

  createCard: (columnId, title, position) =>
    respond(
      () => {
        const db = read()
        const card: Card = {
          id: uid('card'),
          columnId,
          title,
          description: '',
          position,
          version: 1,
          assigneeId: null,
          dueDate: null,
          labelIds: [],
          deletedAt: null,
          createdAt: new Date().toISOString(),
        }
        db.cards.push(card)
        write(db)
        emit({ type: 'card.upserted', card })
        return card
      },
      { mutation: true },
    ),

  updateCard: (cardId, version, patch) =>
    respond(
      () => {
        const db = read()
        const card = findCard(db, cardId)
        if (card.version !== version) throw new ApiError(409, 'Otra persona modificó la tarjeta')
        Object.assign(card, patch, { version: card.version + 1 })
        write(db)
        emit({ type: 'card.upserted', card })
        return card
      },
      { mutation: true },
    ),

  deleteCard: (cardId) =>
    respond(
      () => {
        const db = read()
        findCard(db, cardId).deletedAt = new Date().toISOString() // soft delete
        write(db)
        emit({ type: 'card.deleted', cardId })
      },
      { mutation: true },
    ),

  listComments: (cardId) => respond(() => read().comments.filter((c) => c.cardId === cardId)),

  addComment: (cardId, body) =>
    respond(
      () => {
        const db = read()
        const comment: Comment = {
          id: uid('cmt'),
          cardId,
          authorId: CURRENT_USER_ID,
          body,
          createdAt: new Date().toISOString(),
        }
        db.comments.push(comment)
        write(db)
        emit({ type: 'comment.created', comment })
        return comment
      },
      { mutation: true },
    ),
}

export function resetMockDb() {
  write(freshDb())
}
