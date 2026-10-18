import { expect, test, type Page } from '@playwright/test'

const column = (page: Page, name: string) => page.getByRole('region', { name })

async function register(page: Page) {
  const id = `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`
  const user = { name: `E2E ${id}`, email: `e2e-${id}@fluxo.dev`, password: 'password123' }
  await page.goto('/registro')
  await page.getByLabel('Nombre').fill(user.name)
  await page.getByLabel('Email').fill(user.email)
  await page.getByLabel(/Contraseña/).fill(user.password)
  await page.getByRole('button', { name: 'Crear cuenta' }).click()
  await expect(page.getByRole('heading', { name: `Workspace de ${user.name}` })).toBeVisible()
  return user
}

test('flujo completo: registro, tablero, tarjetas, drag and drop y persistencia', async ({ page }) => {
  await register(page)

  // Crear un tablero: trae las listas por defecto
  await page.getByRole('button', { name: '+ Nuevo tablero' }).click()
  await page.getByPlaceholder('Nombre del tablero').fill('Demo E2E')
  await page.getByPlaceholder('Nombre del tablero').press('Enter')
  await expect(page.getByRole('heading', { name: 'Demo E2E' })).toBeVisible()
  await expect(column(page, 'Pendiente')).toBeVisible()

  // Crear dos tarjetas
  const todo = column(page, 'Pendiente')
  await todo.getByRole('button', { name: '+ Añadir tarjeta' }).click()
  for (const title of ['Primera', 'Segunda']) {
    await todo.getByPlaceholder('Título de la tarjeta').fill(title)
    await todo.getByPlaceholder('Título de la tarjeta').press('Enter')
    await expect(todo.getByRole('link', { name: title })).toBeVisible()
  }

  // Arrastrar "Primera" a "En curso" (lista vacía)
  const doing = column(page, 'En curso')
  await todo.getByRole('link', { name: 'Primera' }).dragTo(doing.locator('.flex-col.gap-2'))
  await expect(doing.getByRole('link', { name: 'Primera' })).toBeVisible()

  // Editar en el modal: etiqueta, asignación y comentario
  await doing.getByRole('link', { name: 'Primera' }).click()
  const dialog = page.getByRole('dialog')
  await dialog.getByRole('button', { name: 'Backend' }).click()
  await dialog.getByPlaceholder('Escribe un comentario…').fill('Guardado en Postgres')
  await dialog.getByRole('button', { name: 'Enviar' }).click()
  await expect(dialog.getByText('Guardado en Postgres')).toBeVisible()
  await page.keyboard.press('Escape')

  // Recargar: el access token se perdió (vivía en memoria) y se recupera con la cookie;
  // todo lo anterior viene ahora de la base de datos
  await page.waitForLoadState('networkidle')
  await page.reload()
  await expect(column(page, 'En curso').getByRole('link', { name: /Primera/ }).getByText('Backend')).toBeVisible()
  await expect(column(page, 'Pendiente').getByRole('link', { name: 'Segunda' })).toBeVisible()

  await column(page, 'En curso').getByRole('link', { name: /Primera/ }).click()
  await expect(page.getByRole('dialog').getByText('Guardado en Postgres')).toBeVisible()
})

test('las rutas privadas redirigen al login y vuelven después de entrar', async ({ page, browser }) => {
  const user = await register(page)
  await page.getByRole('button', { name: '+ Nuevo tablero' }).click()
  await page.getByPlaceholder('Nombre del tablero').fill('Privado')
  await page.getByPlaceholder('Nombre del tablero').press('Enter')
  await expect(page.getByRole('heading', { name: 'Privado' })).toBeVisible()
  const boardUrl = new URL(page.url()).pathname

  // Otro navegador, sin cookie: al login, con la ruta guardada
  const anon = await (await browser.newContext()).newPage()
  await anon.goto(boardUrl)
  await expect(anon).toHaveURL(/\/login\?redirect=/)
  await anon.getByLabel('Email').fill(user.email)
  await anon.getByLabel('Contraseña').fill(user.password)
  await anon.getByRole('button', { name: 'Entrar' }).click()
  await expect(anon.getByRole('heading', { name: 'Privado' })).toBeVisible()
})

test('logout cierra la sesión de verdad', async ({ page }) => {
  await register(page)
  await page.getByRole('button', { name: 'Salir' }).click()
  await expect(page).toHaveURL(/\/login/)
  await page.goto('/')
  await expect(page).toHaveURL(/\/login/) // la cookie ya no sirve: el refresh fue revocado
})

test('credenciales incorrectas muestran un error', async ({ page }) => {
  await page.goto('/login')
  await page.getByLabel('Email').fill('nadie@fluxo.dev')
  await page.getByLabel('Contraseña').fill('incorrecta')
  await page.getByRole('button', { name: 'Entrar' }).click()
  await expect(page.getByRole('alert')).toHaveText('Email o contraseña incorrectos')
})
