/** Misma lógica que web/src/utils/position.ts (ADR 0001) */
export const POSITION_STEP = 1024;
export const MIN_GAP = 1e-6;

export const tooClose = (a: number | undefined, b: number | undefined) =>
  a !== undefined && b !== undefined && Math.abs(b - a) < MIN_GAP;
