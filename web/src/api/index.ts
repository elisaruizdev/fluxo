import { mockApi } from './mock'
import type { FluxoApi } from './types'

// En el paso 3 aquí se elegirá el cliente HTTP real según import.meta.env
export const api: FluxoApi = mockApi

export * from './types'
