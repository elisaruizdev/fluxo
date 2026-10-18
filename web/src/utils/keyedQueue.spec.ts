import { describe, expect, it } from 'vitest'
import { createKeyedQueue } from './keyedQueue'

const deferred = () => {
  let resolve!: () => void
  let reject!: (e: unknown) => void
  const promise = new Promise<void>((res, rej) => ((resolve = res), (reject = rej)))
  return { promise, resolve, reject }
}

describe('createKeyedQueue', () => {
  it('ejecuta en serie las tareas con la misma clave', async () => {
    const queue = createKeyedQueue()
    const log: string[] = []
    const first = deferred()

    const a = queue.run('card', async () => {
      log.push('a:start')
      await first.promise
      log.push('a:end')
    })
    const b = queue.run('card', async () => void log.push('b'))

    await new Promise((r) => setTimeout(r)) // dejar correr todas las microtasks pendientes
    expect(log).toEqual(['a:start'])
    first.resolve()
    await Promise.all([a, b])
    expect(log).toEqual(['a:start', 'a:end', 'b'])
  })

  it('no bloquea claves distintas', async () => {
    const queue = createKeyedQueue()
    const blocker = deferred()
    void queue.run('x', () => blocker.promise)
    await expect(queue.run('y', async () => 'listo')).resolves.toBe('listo')
    blocker.resolve()
  })

  it('sigue con la siguiente aunque la anterior falle, y se vacía al terminar', async () => {
    const queue = createKeyedQueue()
    const failing = queue.run('card', () => Promise.reject(new Error('500')))
    const next = queue.run('card', async () => 'ok')

    await expect(failing).rejects.toThrow('500')
    await expect(next).resolves.toBe('ok')
    await new Promise((r) => setTimeout(r))
    expect(queue.isBusy('card')).toBe(false)
  })
})
