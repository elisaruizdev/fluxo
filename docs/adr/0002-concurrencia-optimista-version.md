# ADR 0002 — Concurrencia optimista con `Card.version`

- **Estado:** aceptado (se implementa en el paso 3)
- **Fecha:** 2026-10-18

## Contexto

Varias personas editan el mismo tablero a la vez. Sin control, gana la última escritura: si A cambia el título mientras B mueve la tarjeta con datos viejos, B pisa el cambio de A sin enterarse (*lost update*).

## Decisión

`Card` tiene `version Int @default(1)`. Cada `PATCH /cards/:id` envía la versión que conoce el cliente y el servidor actualiza de forma condicional:

```sql
UPDATE cards SET ..., version = version + 1 WHERE id = $1 AND version = $2
```

Si no se actualiza ninguna fila, responde **409 Conflict** con la tarjeta actual. El frontend hace rollback de su cambio optimista y muestra la versión buena (ya implementado contra el mock en `web/src/stores/board.ts`).

## Consecuencias

- ✅ Sin bloqueos en la BD (frente a `SELECT … FOR UPDATE`): escala bien con lecturas frecuentes.
- ✅ Los eventos en tiempo real llevan la versión, así que el cliente descarta los que lleguen desordenados.
- ⚠️ Dos cambios propios muy seguidos sobre la misma tarjeta pueden chocar entre sí. Se resolverá serializando las peticiones por tarjeta en el cliente.
