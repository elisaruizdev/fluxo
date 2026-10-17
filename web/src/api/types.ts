import type { Board, BoardSnapshot, Card, Column, Comment } from '@/types/domain'

export class ApiError extends Error {
  readonly status: number

  constructor(status: number, message: string) {
    super(message)
    this.name = 'ApiError'
    this.status = status
  }
}

export type CardPatch = Partial<Pick<Card, 'title' | 'description' | 'assigneeId' | 'dueDate' | 'labelIds'>>

export interface CardMove {
  columnId: string
  position: number
}

/** Contrato que cumplirán tanto el mock como el cliente HTTP real (paso 3) */
export interface FluxoApi {
  listBoards(): Promise<Board[]>
  getBoard(boardId: string): Promise<BoardSnapshot>
  createColumn(boardId: string, title: string, position: number): Promise<Column>
  createCard(columnId: string, title: string, position: number): Promise<Card>
  /** `version` es la que conoce el cliente; si no coincide con la del servidor → 409 */
  updateCard(cardId: string, version: number, patch: CardPatch | CardMove): Promise<Card>
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
