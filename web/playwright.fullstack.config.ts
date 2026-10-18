import { defineConfig, devices } from '@playwright/test'

/**
 * E2E de punta a punta contra el stack real (navegador → Nginx → API → Postgres).
 * Requiere `docker compose up` en la raíz del repo. Ejecutar con: npm run test:e2e:fullstack
 */
export default defineConfig({
  testDir: './e2e-fullstack',
  // De uno en uno: todos comparten el mismo stack (y en local, la misma máquina)
  workers: 1,
  reporter: process.env.CI ? 'github' : 'list',
  // Contra un stack recién levantado las primeras peticiones son lentas (JIT de Node y Prisma
  // compilando su WebAssembly): 5 s por defecto se quedan cortos, sobre todo en CI
  expect: { timeout: 15_000 },
  use: {
    baseURL: process.env.FULLSTACK_URL ?? 'http://localhost:8080',
    trace: 'retain-on-failure',
  },
  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }],
})
