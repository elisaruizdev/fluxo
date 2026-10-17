import { describe, expect, it } from 'vitest'
import { MIN_GAP, needsReindex, positionAt, positionBetween, reindex } from './position'

describe('positionBetween', () => {
  it('usa el paso base en una lista vacía', () => {
    expect(positionBetween(undefined, undefined)).toBe(1024)
  })

  it('inserta al principio, al final y en medio', () => {
    expect(positionBetween(undefined, 1024)).toBe(512)
    expect(positionBetween(1024, undefined)).toBe(2048)
    expect(positionBetween(1024, 2048)).toBe(1536)
  })
})

describe('positionAt', () => {
  const list = [{ position: 1024 }, { position: 2048 }, { position: 3072 }]

  it('calcula la posición según el índice de destino', () => {
    expect(positionAt(list, 0)).toBe(512)
    expect(positionAt(list, 1)).toBe(1536)
    expect(positionAt(list, 3)).toBe(4096)
  })
})

describe('reindexado', () => {
  it('detecta cuando el hueco se agota tras muchas inserciones en el mismo sitio', () => {
    let prev = 1024
    const next = 2048
    let moves = 0
    while (next - prev >= MIN_GAP) {
      prev = positionBetween(prev, next)
      moves++
    }
    // Con Float64 y MIN_GAP=1e-6 caben ~30 inserciones seguidas en el mismo hueco
    expect(moves).toBeGreaterThan(25)
    expect(needsReindex([{ position: prev }, { position: next }])).toBe(true)
  })

  it('reparte posiciones uniformes conservando el orden', () => {
    const items = [{ id: 'a', position: 1 }, { id: 'b', position: 1.0000001 }]
    expect(reindex(items)).toEqual([
      { id: 'a', position: 1024 },
      { id: 'b', position: 2048 },
    ])
  })
})
