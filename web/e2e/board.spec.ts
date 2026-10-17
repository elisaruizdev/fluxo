import { expect, test } from '@playwright/test'

test.beforeEach(async ({ page }) => {
  await page.goto('/')
  await page.evaluate(() => localStorage.clear())
  await page.goto('/b/b1')
})

const column = (page: import('@playwright/test').Page, name: string) => page.getByRole('region', { name })

test('muestra las listas del tablero con sus tarjetas', async ({ page }) => {
  await expect(page.getByRole('heading', { name: 'Lanzamiento v1' })).toBeVisible()
  await expect(column(page, 'En curso').getByText('Drag and drop entre listas')).toBeVisible()
})

test('mueve una tarjeta a otra lista arrastrándola', async ({ page }) => {
  const card = page.getByText('Modelo Prisma inicial')
  await card.dragTo(column(page, 'En revisión').getByText('El scroll horizontal se corta en móvil'))
  await expect(column(page, 'En revisión').getByText('Modelo Prisma inicial')).toBeVisible()

  // El cambio se persistió en el "servidor": sobrevive a una recarga
  await page.waitForTimeout(800)
  await page.reload()
  await expect(column(page, 'En revisión').getByText('Modelo Prisma inicial')).toBeVisible()
})

test('crea una tarjeta y la edita en el modal', async ({ page }) => {
  const todo = column(page, 'Pendiente')
  await todo.getByRole('button', { name: '+ Añadir tarjeta' }).click()
  await todo.getByPlaceholder('Título de la tarjeta').fill('Escribir ADR de position')
  await todo.getByPlaceholder('Título de la tarjeta').press('Enter')

  await todo.getByRole('link', { name: 'Escribir ADR de position' }).click()
  const dialog = page.getByRole('dialog')
  await dialog.getByRole('button', { name: 'Backend' }).click()
  await dialog.getByPlaceholder('Escribe un comentario…').fill('Lo dejo para el paso 3')
  await dialog.getByRole('button', { name: 'Enviar' }).click()
  await expect(dialog.getByText('Lo dejo para el paso 3')).toBeVisible()

  await page.keyboard.press('Escape')
  await expect(dialog).toBeHidden()
  await expect(todo.getByRole('link', { name: /Escribir ADR de position/ }).getByText('Backend')).toBeVisible()
})

test('sincroniza los cambios con otra pestaña', async ({ page, context }) => {
  const other = await context.newPage()
  await other.goto('/b/b1')
  await expect(other.getByText('Healthchecks en docker-compose')).toBeVisible()

  await page.getByText('Healthchecks en docker-compose').dragTo(column(page, 'Hecho').getByText('Configurar Vite + Tailwind'))
  await expect(column(other, 'Hecho').getByText('Healthchecks en docker-compose')).toBeVisible()
})
