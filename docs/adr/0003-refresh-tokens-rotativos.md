# ADR 0003 — Refresh tokens opacos, hasheados y rotativos

- **Estado:** aceptado
- **Fecha:** 2026-10-18

## Contexto

Un access token JWT de vida corta (15 min) no se puede revocar, así que necesitamos un refresh token de vida larga para renovarlo. Ese token es la credencial más valiosa: si se roba, da acceso durante semanas.

## Decisión

1. **Opaco, no JWT:** 32 bytes aleatorios (`randomBytes`). No contiene datos y solo el servidor sabe si es válido.
2. **Hasheado en BD con SHA-256.** Un volcado de la tabla no permite usar los tokens. No se usa argon2/bcrypt porque esos hashes lentos existen para contraseñas de baja entropía; un valor de 256 bits no se puede atacar por fuerza bruta, y SHA-256 permite buscarlo por índice único.
3. **Rotación en cada uso.** `POST /auth/refresh` revoca el token recibido y entrega uno nuevo de la misma **familia** (`familyId` = un login).
4. **Detección de reutilización.** Si llega un token ya revocado, alguien tiene una copia: se revoca **toda la familia** y ambas partes deben volver a hacer login. Las demás sesiones del usuario no se tocan.
5. **Atomicidad.** La revocación es un `updateMany … WHERE revoked_at IS NULL`: de dos peticiones simultáneas con el mismo token, solo una gana.
6. **Transporte:** cookie `httpOnly`, `SameSite=Strict`, `Secure` en producción y `Path=/api/auth`. El access token va en el body y el frontend lo guarda **en memoria**, nunca en `localStorage`.

## Consecuencias

- ✅ Un robo de token se detecta en cuanto lo usan el atacante o la víctima.
- ✅ El logout es real: revoca la familia en BD.
- ⚠️ Dos pestañas que refrescan a la vez: la segunda recibe 401. El frontend debe hacer *single-flight* del refresh (una sola petición compartida), o coordinar las pestañas con `BroadcastChannel`.
- ⚠️ La tabla crece: hará falta un job (BullMQ, paso 5) que purgue los tokens caducados.
