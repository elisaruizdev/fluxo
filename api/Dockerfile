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

FROM build AS prune
RUN npm prune --omit=dev

FROM node:24-alpine AS runtime
WORKDIR /app
ENV NODE_ENV=production
COPY --from=prune --chown=node:node /app/package.json ./
COPY --from=prune --chown=node:node /app/node_modules ./node_modules
COPY --from=prune --chown=node:node /app/dist ./dist
# Nunca como root dentro del contenedor
USER node
EXPOSE 3000
HEALTHCHECK --interval=15s --timeout=3s --start-period=10s \
  CMD wget -qO- http://127.0.0.1:3000/api/health || exit 1
CMD ["node", "dist/main.js"]
