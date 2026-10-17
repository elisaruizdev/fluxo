/**
 * Posiciones fraccionarias: al mover un elemento solo se reescribe SU position,
 * calculada como el punto medio entre sus vecinos. Ver ADR 0001.
 */
export const POSITION_STEP = 1024
/** Por debajo de este hueco la precisión de Float empieza a ser un problema */
export const MIN_GAP = 1e-6

export function positionBetween(prev: number | undefined, next: number | undefined): number {
  if (prev === undefined && next === undefined) return POSITION_STEP
  if (prev === undefined) return next! / 2
  if (next === undefined) return prev + POSITION_STEP
  return (prev + next) / 2
}

/** Posición para insertar en `index` dentro de una lista ya ordenada (sin el elemento movido) */
export function positionAt(sorted: readonly { position: number }[], index: number): number {
  return positionBetween(sorted[index - 1]?.position, sorted[index]?.position)
}

export function needsReindex(sorted: readonly { position: number }[]): boolean {
  for (let i = 1; i < sorted.length; i++) {
    if (sorted[i]!.position - sorted[i - 1]!.position < MIN_GAP) return true
  }
  return false
}

/** Reparte de nuevo las posiciones con huecos uniformes, conservando el orden */
export function reindex<T extends { position: number }>(sorted: readonly T[]): T[] {
  return sorted.map((item, i) => ({ ...item, position: (i + 1) * POSITION_STEP }))
}

export const byPosition = (a: { position: number }, b: { position: number }) => a.position - b.position
