import type { Session } from '@/types/domain'
import { ApiError, type FluxoApi } from './types'

const BASE_URL = import.meta.env.VITE_API_URL ?? '/api'

/**
 * El access token vive SOLO en memoria (una variable de módulo): un XSS no puede
 * leerlo de localStorage porque nunca está ahí. Al recargar la página se pierde,
 * y se recupera con el refresh token de la cookie httpOnly.
 */
let accessToken: string | null = null
let onUnauthorized: (() => void) | null = null

export function setAccessToken(token: string | null) {
  accessToken = token
}

/** Lo llama el store de auth: qué hacer si la sesión caduca del todo */
export function setUnauthorizedHandler(handler: () => void) {
  onUnauthorized = handler
}

async function parse(res: Response) {
  if (res.status === 204) return undefined
  const data = await res.json().catch(() => ({}))
  if (!res.ok) throw new ApiError(res.status, data.message ?? res.statusText, data)
  return data
}

let refreshing: Promise<Session | null> | null = null

/**
 * Single-flight: si diez peticiones reciben 401 a la vez, se hace UN refresh y todas lo esperan.
 * Entre pestañas, la Web Locks API los pone en fila: el servidor rota el token en cada uso y
 * vería dos usos del mismo como un robo (ADR 0003).
 */
export function refreshSession(): Promise<Session | null> {
  refreshing ??= withCrossTabLock(async () => {
    const res = await fetch(`${BASE_URL}/auth/refresh`, { method: 'POST', credentials: 'include' })
    const session = res.ok ? ((await res.json()) as Session) : null
    accessToken = session?.accessToken ?? null
    return session
  }).finally(() => {
    refreshing = null
  })
  return refreshing
}

function withCrossTabLock<T>(fn: () => Promise<T>): Promise<T> {
  return typeof navigator !== 'undefined' && navigator.locks
    ? navigator.locks.request('fluxo:refresh', fn)
    : fn()
}

interface RequestOptions {
  method?: 'GET' | 'POST' | 'PATCH' | 'DELETE'
  body?: unknown
}

export async function request<T>(path: string, { method = 'GET', body }: RequestOptions = {}, retry = true): Promise<T> {
  const res = await fetch(`${BASE_URL}${path}`, {
    method,
    credentials: 'include',
    headers: {
      ...(body !== undefined && { 'Content-Type': 'application/json' }),
      ...(accessToken && { Authorization: `Bearer ${accessToken}` }),
    },
    body: body === undefined ? undefined : JSON.stringify(body),
  })

  // Access token caducado: renovar una vez y repetir la petición
  if (res.status === 401 && retry && !path.startsWith('/auth/')) {
    const session = await refreshSession()
    if (session) return request<T>(path, { method, body }, false)
    onUnauthorized?.()
  }

  return parse(res) as Promise<T>
}

async function startSession(path: string, body: object): Promise<Session> {
  const session = await request<Session>(path, { method: 'POST', body })
  accessToken = session.accessToken
  return session
}

export const httpApi: FluxoApi = {
  register: (email, name, password) => startSession('/auth/register', { email, name, password }),
  login: (email, password) => startSession('/auth/login', { email, password }),
  refresh: refreshSession,
  logout: async () => {
    await request('/auth/logout', { method: 'POST' })
    accessToken = null
  },

  listWorkspaces: () => request('/workspaces'),
  listBoards: (workspaceId) => request(`/workspaces/${workspaceId}/boards`),
  createBoard: (workspaceId, title) => request(`/workspaces/${workspaceId}/boards`, { method: 'POST', body: { title } }),
  getBoard: (boardId) => request(`/boards/${boardId}`),
  createColumn: (boardId, title, position) =>
    request(`/boards/${boardId}/columns`, { method: 'POST', body: { title, position } }),
  createCard: (columnId, title, position) =>
    request(`/columns/${columnId}/cards`, { method: 'POST', body: { title, position } }),
  updateCard: (cardId, version, patch) => request(`/cards/${cardId}`, { method: 'PATCH', body: { ...patch, version } }),
  deleteCard: (cardId) => request(`/cards/${cardId}`, { method: 'DELETE' }),
  listComments: (cardId) => request(`/cards/${cardId}/comments`),
  addComment: (cardId, body) => request(`/cards/${cardId}/comments`, { method: 'POST', body: { body } }),
}
