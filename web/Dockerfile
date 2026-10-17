# syntax=docker/dockerfile:1

# --- Etapa 1: dependencias (capa cacheada mientras no cambie el lockfile) ---
FROM node:24-alpine AS deps
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci

# --- Etapa 2: build de producción ---
FROM deps AS build
COPY . .
# Las VITE_* se incrustan en el bundle en tiempo de build, no en runtime
ARG VITE_API_URL=/api
ENV VITE_API_URL=$VITE_API_URL
RUN npm run build

# --- Etapa 3: solo los estáticos servidos por Nginx (~50 MB frente a ~1 GB de la etapa build) ---
FROM nginx:1.29-alpine AS runtime
COPY nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=build /app/dist /usr/share/nginx/html
EXPOSE 80
HEALTHCHECK --interval=30s --timeout=3s CMD wget -qO- http://127.0.0.1/healthz || exit 1
