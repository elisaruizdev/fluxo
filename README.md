# Fluxo

Gestor de tareas estilo kanban, fullstack y dockerizado.

> En construcción. Paso actual: **2 — API: auth y workspaces**.

## Estructura

```
fluxo/
├── web/                 # Vue 3 + Vite + TypeScript + Pinia + Tailwind
├── api/                 # NestJS + TypeScript + Prisma (Redis y BullMQ en el paso 5)
├── docs/adr/            # Decisiones de arquitectura
├── docker-compose.yml
└── .github/workflows/   # CI (paso 4)
```

## Desarrollo local

```bash
# Frontend (http://localhost:5173)
cd web && npm install && npm run dev

# API (http://localhost:3000/api, docs en /api/docs)
cd api && npm install
cp .env.example .env          # y rellena JWT_ACCESS_SECRET
npm run db:migrate            # necesita un Postgres en DATABASE_URL
npm run start:dev
```

## Con Docker

```bash
cp .env.example .env
docker compose up --build
# web → http://localhost:8080   api → http://localhost:3000/api/health
```

## Hoja de ruta

1. [x] Frontend con datos falsos (tablero, listas, tarjetas, drag and drop)
2. [x] API: auth y workspaces, migraciones y tests
3. [ ] Boards y cards (position + version) integrados con el frontend
4. [ ] Docker Compose completo y CI
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

Documentación interactiva (OpenAPI) en `/api/docs` fuera de producción.

## Tests

```bash
cd web && npm run test:run && npm run test:e2e   # Vitest + Playwright
cd api && npm test                                 # unitarios
cd api && npm run test:e2e                         # integración con Postgres real (Testcontainers → requiere Docker)
TEST_DATABASE_URL=postgresql://... npm run test:e2e   # …o contra una BD que ya tengas
```

## Decisiones de arquitectura

- [ADR 0001 — Posiciones fraccionarias](docs/adr/0001-posiciones-fraccionarias.md)
- [ADR 0002 — Concurrencia optimista con `version`](docs/adr/0002-concurrencia-optimista-version.md)
- [ADR 0003 — Refresh tokens rotativos](docs/adr/0003-refresh-tokens-rotativos.md)
- [ADR 0004 — RBAC por workspace](docs/adr/0004-rbac-por-workspace.md)
