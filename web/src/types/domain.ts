// Espejo del modelo de Prisma que tendrá la API. Las fechas viajan como ISO string.

export type Role = 'ADMIN' | 'MEMBER'

export interface User {
  id: string
  name: string
  email: string
  avatarColor: string
}

export interface Workspace {
  id: string
  name: string
}

export interface Membership {
  userId: string
  workspaceId: string
  role: Role
}

export interface Board {
  id: string
  workspaceId: string
  title: string
  createdAt: string
}

export interface Column {
  id: string
  boardId: string
  title: string
  position: number
}

export interface Label {
  id: string
  boardId: string
  name: string
  color: LabelColor
}

export type LabelColor = 'teal' | 'amber' | 'rose' | 'violet' | 'lime' | 'slate'

export interface Card {
  id: string
  columnId: string
  title: string
  description: string
  position: number
  /** Concurrencia optimista: el PATCH envía la versión conocida; si no coincide → 409 */
  version: number
  assigneeId: string | null
  dueDate: string | null
  labelIds: string[]
  deletedAt: string | null
  createdAt: string
}

export interface Comment {
  id: string
  cardId: string
  authorId: string
  body: string
  createdAt: string
}

/** Lo que devuelve GET /boards/:id: el tablero con todo lo necesario para pintarlo */
export interface BoardSnapshot {
  board: Board
  columns: Column[]
  cards: Card[]
  labels: Label[]
  members: User[]
}
