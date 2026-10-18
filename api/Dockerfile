# syntax=docker/dockerfile:1

FROM node:24-alpine AS deps
# Prisma necesita OpenSSL para detectar la plataforma de su motor de migraciones
RUN apk add --no-cache openssl
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci

FROM deps AS build
COPY . .
# Incluye `prisma generate`: el cliente generado se compila dentro de dist/
RUN npm run build

# --- Contenedor de un solo uso: aplica las migraciones pendientes y termina ---
FROM deps AS migrate
COPY prisma ./prisma
COPY prisma.config.ts ./
CMD ["npx", "prisma", "migrate", "deploy"]

# --- Solo las dependencias de producción, instaladas desde cero (node_modules: de ~446 MB a ~100 MB) ---
# Una etapa propia en vez de `npm prune` sobre la de build:
# - solo depende del lockfile, así que Docker la reutiliza de caché mientras no cambien las dependencias;
# - borrar paquetes de una capa anterior obliga a overlayfs a copiarlos antes (en Docker Desktop, minutos).
FROM node:24-alpine AS prod-deps
WORKDIR /app
COPY package.json package-lock.json ./
# --omit=optional: @prisma/client declara `prisma` y `typescript` como peers *opcionales*; npm los marca
#   "devOptional" y `--omit=dev` a secas los instala. El CLI de Prisma arrastra Studio (con React),
#   el motor de migraciones… Nada de eso se usa en runtime.
# --ignore-scripts: ningún paquete de producción necesita compilar nada (argon2 trae binarios para musl).
# El find: el cliente trae compiladores de consultas para 5 bases de datos y solo usamos PostgreSQL.
RUN npm ci --omit=dev --omit=optional --ignore-scripts \
 && npm cache clean --force \
 && find node_modules/@prisma/client/runtime \
      \( -name '*.mysql.*' -o -name '*.sqlite.*' -o -name '*.sqlserver.*' -o -name '*.cockroachdb.*' \) -delete

FROM node:24-alpine AS runtime
WORKDIR /app
ENV NODE_ENV=production
COPY --from=prod-deps --chown=node:node /app/package.json ./
COPY --from=prod-deps --chown=node:node /app/node_modules ./node_modules
COPY --from=build --chown=node:node /app/dist ./dist
# Nunca como root dentro del contenedor
USER node
EXPOSE 3000
# Readiness: la API solo está "healthy" si llega a Postgres y Redis
HEALTHCHECK --interval=15s --timeout=3s --start-period=10s \
  CMD wget -qO- http://127.0.0.1:3000/api/health/ready || exit 1
CMD ["node", "dist/main.js"]
