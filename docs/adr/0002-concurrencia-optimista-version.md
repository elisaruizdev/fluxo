# ADR 0002 — Concurrencia optimista con `Card.version`

- **Estado:** aceptado e implementado
- **Fecha:** 2026-10-18

## Contexto

Varias personas editan el mismo tablero a la vez. Sin control, gana la última escritura: si A cambia el título mientras B mueve la tarjeta con datos viejos, B pisa el cambio de A sin enterarse (*lost update*).

## Decisión

`Card` tiene `version Int @default(1)`. Cada `PATCH /cards/:id` envía la versión que conoce el cliente y el servidor actualiza de forma condicional:

```sql
UPDATE cards SET ..., version = version + 1 WHERE id = $1 AND version = $2
```

Si no se actualiza ninguna fila, responde **409 Conflict** con la tarjeta actual en `current` (`api/src/cards/cards.service.ts`). El frontend deshace su cambio optimista y muestra directamente esa versión, sin recargar el tablero (`web/src/stores/board.ts`).

## Consecuencias

- ✅ Sin bloqueos en la BD (frente a `SELECT … FOR UPDATE`): escala bien con lecturas frecuentes.
- ✅ Los eventos en tiempo real llevan la versión, así que el cliente descarta los que lleguen desordenados.
- ✅ Dos cambios propios muy seguidos sobre la misma tarjeta no chocan entre sí: el cliente pone en cola las peticiones de cada tarjeta (`web/src/utils/keyedQueue.ts`) y cada una sale con la versión que devolvió la anterior.
- ℹ️ El reindexado de posiciones (ADR 0001) no incrementa `version`: no cambia el orden relativo y no debe provocar 409 a nadie.
