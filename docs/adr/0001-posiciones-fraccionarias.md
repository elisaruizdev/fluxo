# ADR 0001 — Orden de listas y tarjetas con `position: Float`

- **Estado:** aceptado
- **Fecha:** 2026-10-17

## Contexto

Las tarjetas y las listas se reordenan con drag and drop. Si el orden se guarda como índice entero (0, 1, 2…), mover un elemento obliga a reescribir todos los que hay detrás: N updates por movimiento, más conflictos entre usuarios y más eventos en tiempo real.

## Decisión

Cada `Column` y `Card` tiene `position: Float`. Al mover un elemento se calcula **solo su** nueva posición como el punto medio entre sus vecinos (`web/src/utils/position.ts`):

| Destino           | Posición                 |
| ----------------- | ------------------------ |
| Lista vacía       | `1024`                   |
| Al principio      | `next / 2`               |
| Al final          | `prev + 1024`            |
| Entre `a` y `b`   | `(a + b) / 2`            |

Cuando el hueco entre dos vecinos baja de `1e-6` (unas 30 inserciones seguidas en el mismo sitio con Float64), el **servidor** reindexa la lista completa (`1024, 2048, …`) en una transacción y emite un único evento de reordenación.

## Consecuencias

- ✅ Un movimiento = un `PATCH` de una fila.
- ✅ Encaja con la concurrencia optimista por `version` (ADR 0002): solo cambia la tarjeta movida.
- ⚠️ Hace falta el reindexado ocasional; se cubre con tests.
- Alternativa descartada por ahora: *fractional indexing* con strings (p. ej. `fractional-indexing`), que nunca se agota pero es menos legible al depurar. Se puede migrar sin tocar la API si hiciera falta.
