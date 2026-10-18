import type { Board, BoardSnapshot, Card, Column, Comment, Session, Workspace } from '@/types/domain'

export class ApiError extends Error {
  readonly status: number
  /** Body completo del error (p. ej. `current` en un 409) */
  readonly data: Record<string, unknown>

  constructor(status: number, message: string, data: Record<string, unknown> = {}) {
    super(message)
    this.name = 'ApiError'
    this.status = status
    this.data = data
  }
}

export type CardPatch = Partial<Pick<Card, 'title' | 'description' | 'assigneeId' | 'dueDate' | 'labelIds'>>

export interface CardMove {
  columnId: string
  position: number
}

/** El PATCH avisa si el servidor tuvo que reindexar la lista (ADR 0001) */
export type SavedCard = Card & { columnReindexed?: boolean }

/** Contrato que cumplen tanto el mock como el cliente HTTP */
export interface FluxoApi {
  register(email: string, name: string, password: string): Promise<Session>
  login(email: string, password: string): Promise<Session>
  /** Usa la cookie httpOnly; devuelve null si no hay sesión */
  refresh(): Promise<Session | null>
  logout(): Promise<void>

  listWorkspaces(): Promise<Workspace[]>
  listBoards(workspaceId: string): Promise<Board[]>
  createBoard(workspaceId: string, title: string): Promise<Board>
  getBoard(boardId: string): Promise<BoardSnapshot>
  createColumn(boardId: string, title: string, position: number): Promise<Column>
  createCard(columnId: string, title: string, position: number): Promise<Card>
  /** `version` es la que conoce el cliente; si no coincide con la del servidor → 409 con `current` */
  updateCard(cardId: string, version: number, patch: CardPatch | CardMove): Promise<SavedCard>
  deleteCard(cardId: string): Promise<void>
  listComments(cardId: string): Promise<Comment[]>
  addComment(cardId: string, body: string): Promise<Comment>
}

/** Eventos que el servidor emitirá por WebSocket (paso 5) */
export type RealtimeEvent =
  | { type: 'card.upserted'; card: Card }
  | { type: 'card.deleted'; cardId: string }
  | { type: 'column.created'; column: Column }
  | { type: 'comment.created'; comment: Comment }
