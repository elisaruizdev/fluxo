# Fluxo

Gestor de tareas estilo kanban, fullstack y dockerizado.

> En construcción. Paso actual: **1 — frontend con datos de prueba**.

## Estructura

```
fluxo/
├── web/                 # Vue 3 + Vite + TypeScript + Pinia + Tailwind
├── api/                 # NestJS + TypeScript (Prisma, Redis y BullMQ en próximos pasos)
├── docker-compose.yml
└── .github/workflows/   # CI (paso 4)
```

## Desarrollo local

```bash
# Frontend (http://localhost:5173)
cd web && npm install && npm run dev

# API (http://localhost:3000/api/health)
cd api && npm install && npm run start:dev
```

## Con Docker

```bash
cp .env.example .env
docker compose up --build
# web → http://localhost:8080   api → http://localhost:3000/api/health
```

## Hoja de ruta

1. [x] Frontend con datos falsos (tablero, listas, tarjetas, drag and drop)
2. [ ] API: auth y workspaces, migraciones y tests
3. [ ] Boards y cards (position + version) integrados con el frontend
4. [ ] Docker Compose completo y CI
5. [ ] Tiempo real (Redis pub/sub, BullMQ) y despliegue
6. [ ] Pulido: diagrama de arquitectura, capturas, prueba de carga con k6
