/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_API_URL?: string
  /** 'mock' → datos falsos en el navegador, sin backend */
  readonly VITE_API_MODE?: 'mock' | 'http'
  readonly VITE_MOCK_LATENCY_MS?: string
  /** 0..1: probabilidad de que una mutación falle, para ver el rollback */
  readonly VITE_MOCK_FAIL_RATE?: string
}
