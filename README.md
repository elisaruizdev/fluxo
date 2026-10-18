# Fluxo

[![CI](https://github.com/elisaruizdev/fluxo/actions/workflows/ci.yml/badge.svg)](https://github.com/elisaruizdev/fluxo/actions/workflows/ci.yml)

Gestor de tareas estilo kanban, fullstack y dockerizado.

> En construcción. Paso actual: **4 — Docker Compose completo y CI**.

## Estructura

```
fluxo/
├── web/                 # Vue 3 + Vite + TypeScript + Pinia + Tailwind
├── api/                 # NestJS + TypeScript + Prisma (Redis y BullMQ en el paso 5)
├── docs/adr/            # Decisiones de arquitectura
├── docker-compose.yml
└── .github/workflows/   # CI con GitHub Actions
```

## Desarrollo local

La forma más sencilla: base de datos y API en Docker, frontend con recarga en caliente.

```bash
cp .env.example .env                      # y rellena JWT_ACCESS_SECRET
docker compose up -d postgres redis migrate api
cd web && npm install && npm run dev      # http://localhost:5173 (Vite redirige /api a :3000)
```

Sin backend (datos de prueba en el navegador): `VITE_API_MODE=mock npm run dev`.

Para desarrollar también la API fuera de Docker:

```bash
docker compose up -d postgres redis
cd api && npm install && cp .env.example .env   # rellena JWT_ACCESS_SECRET
npm run db:migrate && npm run start:dev         # http://localhost:3000/api, docs en /api/docs
```

## Con Docker

```bash
cp .env.example .env          # y rellena JWT_ACCESS_SECRET (openssl rand -base64 48)
docker compose up -d --build --wait
# web → http://localhost:8080   api → http://localhost:3000/api/health/ready
```

| Servicio | Qué hace | Healthcheck |
| --- | --- | --- |
| `postgres` | Base de datos (volumen `pgdata`) | `pg_isready` |
| `redis` | Caché, pub/sub y colas (volumen `redisdata`) | `redis-cli ping` |
| `migrate` | Aplica las migraciones de Prisma y termina | — (la API espera a que acabe con éxito) |
| `api` | NestJS · imagen de ~384 MB | `/api/health/ready`: Postgres y Redis |
| `web` | Nginx con el build de Vue · imagen de ~93 MB | `/healthz` |

La API expone dos sondas: `/api/health` (*liveness*: el proceso responde) y `/api/health/ready` (*readiness*: puede atender peticiones porque llega a Postgres y Redis; 503 si no).

## Hoja de ruta

1. [x] Frontend con datos falsos (tablero, listas, tarjetas, drag and drop)
2. [x] API: auth y workspaces, migraciones y tests
3. [x] Boards y cards (position + version) integrados con el frontend
4. [x] Docker Compose completo y CI
5. [ ] Tiempo real (Redis pub/sub, BullMQ) y despliegue
6. [ ] Pulido: diagrama de arquitectura, capturas, prueba de carga con k6

## API

| Método | Ruta | Acceso |
| ------ | ---- | ------ |
| POST | `/api/auth/register` · `/login` | Público (10 req/min) |
| POST | `/api/auth/refresh` · `/logout` | Cookie `fluxo_rt` |
| GET | `/api/auth/me` | Autenticado |
| GET/POST | `/api/workspaces` | Autenticado |
| GET | `/api/workspaces/:id` · `/members` · `/activity` | Miembro |
| PATCH/DELETE | `/api/workspaces/:id` | ADMIN |
| POST/PATCH | `/api/workspaces/:id/members[/:userId]` | ADMIN |
| DELETE | `/api/workspaces/:id/members/:userId` | ADMIN, o uno mismo |
| GET/POST | `/api/workspaces/:id/boards` | Miembro |
| GET/PATCH | `/api/boards/:id` (GET = tablero completo) | Miembro |
| DELETE | `/api/boards/:id` · `/api/columns/:id` | ADMIN |
| POST | `/api/boards/:id/columns` · `/api/columns/:id/cards` | Miembro |
| PATCH | `/api/cards/:id` (envía `version`; 409 si no coincide) | Miembro |
| DELETE | `/api/cards/:id` (borrado lógico) | Miembro |
| GET/POST | `/api/cards/:id/comments` | Miembro |

Documentación interactiva (OpenAPI) en `/api/docs` fuera de producción.

## Tests

```bash
cd web && npm run test:run                         # unitarios (Vitest)
cd web && npm run test:e2e                         # E2E del frontend con la API simulada
cd web && npm run test:e2e:fullstack               # E2E de punta a punta (requiere docker compose up)
cd api && npm test                                 # unitarios
cd api && npm run test:e2e                         # integración con Postgres real (Testcontainers → requiere Docker)
TEST_DATABASE_URL=postgresql://... npm run test:e2e   # …o contra una BD que ya tengas
```

## CI

Cada push y cada pull request ejecutan [`.github/workflows/ci.yml`](.github/workflows/ci.yml):

1. **API**: lint, formato, tests unitarios, build e integración con Testcontainers (Postgres y Redis reales).
2. **Web**: type-check, tests unitarios, build y E2E con la API simulada.
3. **Full stack** (si los dos anteriores pasan): `docker compose up --wait` y E2E de punta a punta a través de Nginx. El resumen del job muestra el tamaño de las imágenes.

## Problemas conocidos (desarrollo local)

- **Los tests de integración se quedan colgados al arrancar.** Testcontainers usa un *lock file* compartido (`%TEMP%/testcontainers-node-*.lock`). Si una ejecución anterior se cortó a medias, puede quedar un proceso `vitest` huérfano que lo retiene. Ciérralo (Administrador de tareas → `node.exe` con `vitest`) y vuelve a lanzar.
- **Las primeras peticiones tras `docker compose up` tardan segundos.** Es el arranque en frío de Node y del compilador de consultas de Prisma (WebAssembly). Desaparece tras unas pocas peticiones.
- **`getaddrinfo EAI_AGAIN postgres` esporádico en Docker Desktop.** El DNS interno de Docker a veces falla con muchas conexiones nuevas a la vez. Es del entorno local, no de la app; el frontend ofrece reintentar.

## Decisiones de arquitectura

- [ADR 0001 — Posiciones fraccionarias](docs/adr/0001-posiciones-fraccionarias.md)
- [ADR 0002 — Concurrencia optimista con `version`](docs/adr/0002-concurrencia-optimista-version.md)
- [ADR 0003 — Refresh tokens rotativos](docs/adr/0003-refresh-tokens-rotativos.md)
- [ADR 0004 — RBAC por workspace](docs/adr/0004-rbac-por-workspace.md)
