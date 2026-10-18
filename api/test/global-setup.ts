import { PostgreSqlContainer, type StartedPostgreSqlContainer } from '@testcontainers/postgresql';
import { RedisContainer, type StartedRedisContainer } from '@testcontainers/redis';
import { execSync } from 'node:child_process';
import type { TestProject } from 'vitest/node';

declare module 'vitest' {
  export interface ProvidedContext {
    databaseUrl: string;
    redisUrl: string;
  }
}

/**
 * Dependencias reales para toda la suite:
 * - por defecto, Postgres y Redis desechables con Testcontainers (requiere Docker);
 * - o los que indiques en TEST_DATABASE_URL / TEST_REDIS_URL (p. ej. service containers de CI).
 */
export default async function setup(project: TestProject) {
  let databaseUrl = process.env.TEST_DATABASE_URL;
  let redisUrl = process.env.TEST_REDIS_URL;

  // Se arrancan en paralelo: cada contenedor tarda unos segundos
  const [postgres, redis] = await Promise.all([
    databaseUrl ? undefined : new PostgreSqlContainer('postgres:17-alpine').start(),
    redisUrl ? undefined : new RedisContainer('redis:7-alpine').start(),
  ]);
  databaseUrl ??= (postgres as StartedPostgreSqlContainer).getConnectionUri();
  redisUrl ??= (redis as StartedRedisContainer).getConnectionUrl();

  // Las mismas migraciones que en producción, no un `db push`
  execSync('npx prisma migrate deploy', { env: { ...process.env, DATABASE_URL: databaseUrl }, stdio: 'pipe' });
  project.provide('databaseUrl', databaseUrl);
  project.provide('redisUrl', redisUrl);

  return async () => {
    await Promise.all([postgres?.stop(), redis?.stop()]);
  };
}
