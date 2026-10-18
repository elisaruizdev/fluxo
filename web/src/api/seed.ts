import type { Board, Card, Column, Comment, Label, Membership, User } from '@/types/domain'

const now = new Date()
const daysFromNow = (d: number) => new Date(now.getTime() + d * 86_400_000).toISOString()

export const users: User[] = [
  { id: 'u1', name: 'Elisa Ruiz', email: 'elisa@fluxo.dev', avatarColor: '#0d9488' },
  { id: 'u2', name: 'Marco Vidal', email: 'marco@fluxo.dev', avatarColor: '#d97706' },
  { id: 'u3', name: 'Nora Prieto', email: 'nora@fluxo.dev', avatarColor: '#7c3aed' },
  { id: 'u4', name: 'Iker Sanz', email: 'iker@fluxo.dev', avatarColor: '#e11d48' },
]

export const workspaces = [{ id: 'w1', name: 'Estudio Fluxo' }]

export const memberships: Membership[] = [
  { userId: 'u1', workspaceId: 'w1', role: 'ADMIN' },
  { userId: 'u2', workspaceId: 'w1', role: 'MEMBER' },
  { userId: 'u3', workspaceId: 'w1', role: 'MEMBER' },
  { userId: 'u4', workspaceId: 'w1', role: 'MEMBER' },
]

export const boards: Board[] = [
  { id: 'b1', workspaceId: 'w1', title: 'Lanzamiento v1', createdAt: daysFromNow(-20) },
  { id: 'b2', workspaceId: 'w1', title: 'Contenido y marketing', createdAt: daysFromNow(-8) },
]

export const columns: Column[] = [
  { id: 'c1', boardId: 'b1', title: 'Pendiente', position: 1024 },
  { id: 'c2', boardId: 'b1', title: 'En curso', position: 2048 },
  { id: 'c3', boardId: 'b1', title: 'En revisión', position: 3072 },
  { id: 'c4', boardId: 'b1', title: 'Hecho', position: 4096 },
  { id: 'c5', boardId: 'b2', title: 'Ideas', position: 1024 },
  { id: 'c6', boardId: 'b2', title: 'Redactando', position: 2048 },
  { id: 'c7', boardId: 'b2', title: 'Publicado', position: 3072 },
]

export const labels: Label[] = [
  { id: 'l1', boardId: 'b1', name: 'Frontend', color: 'teal' },
  { id: 'l2', boardId: 'b1', name: 'Backend', color: 'violet' },
  { id: 'l3', boardId: 'b1', name: 'Bug', color: 'rose' },
  { id: 'l4', boardId: 'b1', name: 'Infra', color: 'amber' },
  { id: 'l5', boardId: 'b2', name: 'Blog', color: 'lime' },
  { id: 'l6', boardId: 'b2', name: 'Redes', color: 'slate' },
]

let seq = 0
function card(columnId: string, title: string, extra: Partial<Card> = {}): Card {
  seq++
  return {
    id: `k${seq}`,
    columnId,
    title,
    description: '',
    position: 1024 * seq,
    version: 1,
    assigneeId: null,
    dueDate: null,
    labelIds: [],
    deletedAt: null,
    createdAt: daysFromNow(-10 + seq / 4),
    ...extra,
  }
}

export const cards: Card[] = [
  card('c1', 'Diseñar el modal de tarjeta', { labelIds: ['l1'], assigneeId: 'u3', dueDate: daysFromNow(3) }),
  card('c1', 'Endpoint de refresh token rotativo', {
    labelIds: ['l2'],
    assigneeId: 'u1',
    description: 'Guardar el hash del token, invalidar el anterior en cada uso y detectar reutilización.',
  }),
  card('c1', 'Healthchecks en docker-compose', { labelIds: ['l4'] }),
  card('c2', 'Drag and drop entre listas', { labelIds: ['l1'], assigneeId: 'u1', dueDate: daysFromNow(1) }),
  card('c2', 'Modelo Prisma inicial', { labelIds: ['l2'], assigneeId: 'u2' }),
  card('c3', 'El scroll horizontal se corta en móvil', { labelIds: ['l1', 'l3'], assigneeId: 'u4', dueDate: daysFromNow(-1) }),
  card('c4', 'Configurar Vite + Tailwind', { labelIds: ['l1'], assigneeId: 'u1' }),
  card('c4', 'Elegir nombre e identidad visual'),
  card('c5', 'Post: por qué position es Float', { labelIds: ['l5'], assigneeId: 'u1' }),
  card('c5', 'Hilo con la demo en tiempo real', { labelIds: ['l6'] }),
  card('c6', 'Guía de despliegue en Fly.io', { labelIds: ['l5'], assigneeId: 'u2', dueDate: daysFromNow(6) }),
]

export const comments: Comment[] = [
  { id: 'm1', cardId: 'k4', authorId: 'u2', body: '¿Usamos vue-draggable-plus o @formkit/drag-and-drop?', createdAt: daysFromNow(-2) },
  { id: 'm2', cardId: 'k4', authorId: 'u1', body: 'vue-draggable-plus: soporta grupos entre listas y v-model.', createdAt: daysFromNow(-1) },
]
