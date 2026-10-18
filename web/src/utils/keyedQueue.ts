/**
 * Ejecuta las tareas con la misma clave de una en una, en orden de llegada.
 * Tareas con claves distintas siguen yendo en paralelo.
 *
 * Para tarjetas: si mueves la misma dos veces muy rápido, el segundo PATCH espera al primero
 * y sale ya con la `version` nueva, en vez de chocar con un 409 contra uno mismo (ADR 0002).
 */
export function createKeyedQueue() {
  const tails = new Map<string, Promise<unknown>>()

  function run<T>(key: string, task: () => Promise<T>): Promise<T> {
    const previous = tails.get(key) ?? Promise.resolve()
    // Si la anterior falla, esta se ejecuta igual: cada tarea gestiona su propio error
    const current = previous.catch(() => undefined).then(task)
    tails.set(key, current)
    void current
      .catch(() => undefined)
      .finally(() => {
        if (tails.get(key) === current) tails.delete(key)
      })
    return current
  }

  /** ¿Hay tareas en cola o en curso para esta clave? */
  const isBusy = (key: string) => tails.has(key)

  return { run, isBusy }
}
