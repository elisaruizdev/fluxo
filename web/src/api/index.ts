import { httpApi } from './http'
import { mockApi } from './mock'
import type { FluxoApi } from './types'

/** VITE_API_MODE=mock → datos falsos en el navegador (tests E2E del frontend, demo sin backend) */
export const isMockMode = import.meta.env.VITE_API_MODE === 'mock'

export const api: FluxoApi = isMockMode ? mockApi : httpApi

export * from './types'
