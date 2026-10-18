import { defineConfig, devices } from '@playwright/test'

/**
 * E2E de punta a punta contra el stack real (navegador → Nginx → API → Postgres).
 * Requiere `docker compose up` en la raíz del repo. Ejecutar con: npm run test:e2e:fullstack
 */
export default defineConfig({
  testDir: './e2e-fullstack',
  reporter: process.env.CI ? 'github' : 'list',
  use: {
    baseURL: process.env.FULLSTACK_URL ?? 'http://localhost:8080',
    trace: 'retain-on-failure',
  },
  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }],
})
