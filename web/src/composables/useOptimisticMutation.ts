import { computed, ref, shallowRef } from 'vue'

export interface OptimisticOptions<TArgs extends unknown[], TResult> {
  /** Aplica el cambio en local al instante y devuelve la función que lo deshace */
  apply: (...args: TArgs) => () => void
  /** La petición real al servidor */
  request: (...args: TArgs) => Promise<TResult>
  /** Reconciliar con la respuesta (p. ej. guardar la nueva `version`) */
  onSuccess?: (result: TResult, ...args: TArgs) => void
  onError?: (error: unknown, ...args: TArgs) => void
}

/**
 * Patrón de actualización optimista: la UI cambia antes de que responda
 * el servidor y, si falla, se ejecuta el rollback.
 */
export function useOptimisticMutation<TArgs extends unknown[], TResult>(
  options: OptimisticOptions<TArgs, TResult>,
) {
  const inFlight = ref(0)
  const error = shallowRef<unknown>(null)

  async function mutate(...args: TArgs): Promise<TResult | undefined> {
    const rollback = options.apply(...args)
    inFlight.value++
    error.value = null
    try {
      const result = await options.request(...args)
      options.onSuccess?.(result, ...args)
      return result
    } catch (e) {
      rollback()
      error.value = e
      options.onError?.(e, ...args)
      return undefined
    } finally {
      inFlight.value--
    }
  }

  return { mutate, isPending: computed(() => inFlight.value > 0), error }
}
