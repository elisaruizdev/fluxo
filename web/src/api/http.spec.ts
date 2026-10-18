import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { httpApi, request, setAccessToken, setUnauthorizedHandler } from './http'
import { ApiError } from './types'

const json = (status: number, body: unknown) =>
  new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } })

describe('cliente HTTP', () => {
  const fetchMock = vi.fn<typeof fetch>()

  beforeEach(() => {
    vi.stubGlobal('fetch', fetchMock)
    setAccessToken(null)
  })
  afterEach(() => {
    vi.unstubAllGlobals()
    fetchMock.mockReset()
  })

  const authHeader = (call: number) => (fetchMock.mock.calls[call]![1]!.headers as Record<string, string>).Authorization

  it('envía el access token y las cookies', async () => {
    setAccessToken('t1')
    fetchMock.mockResolvedValueOnce(json(200, []))
    await request('/workspaces')
    expect(authHeader(0)).toBe('Bearer t1')
    expect(fetchMock.mock.calls[0]![1]!.credentials).toBe('include')
  })

  it('con un 401 renueva el token y repite la petición una vez', async () => {
    setAccessToken('caducado')
    fetchMock
      .mockResolvedValueOnce(json(401, { message: 'expired' }))
      .mockResolvedValueOnce(json(200, { accessToken: 'nuevo', user: { id: 'u1' } }))
      .mockResolvedValueOnce(json(200, ['ok']))

    await expect(request('/workspaces')).resolves.toEqual(['ok'])
    expect(fetchMock.mock.calls[1]![0]).toBe('/api/auth/refresh')
    expect(authHeader(2)).toBe('Bearer nuevo')
  })

  it('diez 401 a la vez provocan un único refresh (single-flight)', async () => {
    setAccessToken('caducado')
    fetchMock.mockImplementation(async (url, init) => {
      if (url === '/api/auth/refresh') return json(200, { accessToken: 'nuevo', user: { id: 'u1' } })
      const auth = (init!.headers as Record<string, string>).Authorization
      return auth === 'Bearer nuevo' ? json(200, 'ok') : json(401, {})
    })

    await Promise.all(Array.from({ length: 10 }, () => request('/boards/x')))
    const refreshes = fetchMock.mock.calls.filter(([url]) => url === '/api/auth/refresh')
    expect(refreshes).toHaveLength(1)
  })

  it('si el refresh también falla, avisa de que la sesión ha caducado', async () => {
    const onUnauthorized = vi.fn()
    setUnauthorizedHandler(onUnauthorized)
    fetchMock.mockResolvedValueOnce(json(401, {})).mockResolvedValueOnce(json(401, {})).mockResolvedValue(json(401, {}))

    await expect(request('/workspaces')).rejects.toBeInstanceOf(ApiError)
    expect(onUnauthorized).toHaveBeenCalledOnce()
  })

  it('convierte los errores en ApiError conservando el body (p. ej. `current` en un 409)', async () => {
    fetchMock.mockResolvedValueOnce(json(409, { message: 'conflict', current: { id: 'c1', version: 3 } }))
    const error = await httpApi.updateCard('c1', 1, { title: 'x' }).catch((e: unknown) => e)
    expect(error).toBeInstanceOf(ApiError)
    expect(error).toMatchObject({ status: 409, data: { current: { id: 'c1', version: 3 } } })
  })

  it('el PATCH de una tarjeta envía la versión conocida junto al cambio', async () => {
    fetchMock.mockResolvedValueOnce(json(200, {}))
    await httpApi.updateCard('c1', 4, { columnId: 'col', position: 512 })
    expect(JSON.parse(fetchMock.mock.calls[0]![1]!.body as string)).toEqual({ columnId: 'col', position: 512, version: 4 })
  })
})
