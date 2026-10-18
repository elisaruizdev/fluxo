# ADR 0004 — Permisos resueltos siempre a nivel de workspace

- **Estado:** aceptado
- **Fecha:** 2026-10-18

## Contexto

Hay que decidir dónde viven los permisos: por tablero, por tarjeta o por workspace. Más granularidad da más flexibilidad, pero también más consultas, más casos límite y más agujeros posibles.

## Decisión

El único sitio donde se guarda un rol es `Membership (userId, workspaceId, role)`. Todo recurso (board, column, card, comment) pertenece a un workspace, y el acceso se resuelve subiendo hasta él.

Las piezas de NestJS:

| Pieza                | Responsabilidad                                                                 |
| -------------------- | ------------------------------------------------------------------------------- |
| `JwtAuthGuard`       | Global. ¿Quién eres? Rellena `req.user`. Se desactiva con `@Public()`.          |
| `WorkspaceRoleGuard` | ¿Eres miembro de `:workspaceId`? Rellena `req.membership` y comprueba `@Roles`. |
| `@Roles('ADMIN')`    | Rol mínimo (jerarquía `ADMIN > MEMBER`).                                        |

Reglas:

- **No miembro → 404**, no 403, para no revelar qué workspaces existen.
- Un workspace **nunca se queda sin ADMIN** (409 al degradar o quitar al último).
- Los guards se ejecutan **antes** que los pipes, así que el guard valida el formato UUID por su cuenta.

## Consecuencias

- ✅ Una sola consulta indexada por petición y un único punto que auditar.
- ✅ Seguro por defecto: una ruta nueva exige autenticación salvo que se marque `@Public()`.
- ⚠️ Las rutas de boards y cards (paso 3) tendrán que resolver primero su `workspaceId`. Lo hará un guard específico que lo obtenga del recurso, en vez de repetir la lógica en cada servicio.
