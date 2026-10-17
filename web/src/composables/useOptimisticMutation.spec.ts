import { describe, expect, it, vi } from 'vitest'
import { ref } from 'vue'
import { useOptimisticMutation } from './useOptimisticMutation'

function setup(request: () => Promise<string>) {
  const title = ref('antes')
  const onSuccess = vi.fn()
  const onError = vi.fn()
  const m = useOptimisticMutation({
    apply: (next: string) => {
      const prev = title.value
      title.value = next
      return () => (title.value = prev)
    },
    request,
    onSuccess,
    onError,
  })
  return { title, onSuccess, onError, ...m }
}

describe('useOptimisticMutation', () => {
  it('aplica el cambio antes de que responda el servidor', async () => {
    let resolve!: (v: string) => void
    const { title, mutate, isPending, onSuccess } = setup(() => new Promise((r) => (resolve = r)))

    const promise = mutate('después')
    expect(title.value).toBe('después')
    expect(isPending.value).toBe(true)

    resolve('ok')
    await promise
    expect(isPending.value).toBe(false)
    expect(onSuccess).toHaveBeenCalledWith('ok', 'después')
  })

  it('hace rollback si la petición falla', async () => {
    const boom = new Error('500')
    const { title, mutate, error, onError } = setup(() => Promise.reject(boom))

    await mutate('después')
    expect(title.value).toBe('antes')
    expect(error.value).toBe(boom)
    expect(onError).toHaveBeenCalledWith(boom, 'después')
  })
})
