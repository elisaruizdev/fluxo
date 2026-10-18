import { defineConfig } from 'prisma/config';

// La CLI de Prisma no lee .env por sí sola; Node 24 sabe hacerlo sin dotenv
try {
  process.loadEnvFile();
} catch {
  /* sin .env: se usan las variables del entorno (Docker, CI) */
}

export default defineConfig({
  schema: 'prisma/schema.prisma',
  migrations: { path: 'prisma/migrations' },
  datasource: { url: process.env.DATABASE_URL ?? '' },
});
