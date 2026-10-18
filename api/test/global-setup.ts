import { PostgreSqlContainer, type StartedPostgreSqlContainer } from '@testcontainers/postgresql';
import { execSync } from 'node:child_process';
import type { TestProject } from 'vitest/node';

declare module 'vitest' {
  export interface ProvidedContext {
    databaseUrl: string;
  }
}

/**
 * Una base de datos real para toda la suite:
 * - por defecto, un Postgres desechable con Testcontainers (requiere Docker);
 * - o la que indiques en TEST_DATABASE_URL (útil en CI con un service container).
 */
export default async function setup(project: TestProject) {
  let container: StartedPostgreSqlContainer | undefined;
  let url = process.env.TEST_DATABASE_URL;

  if (!url) {
    container = await new PostgreSqlContainer('postgres:17-alpine').start();
    url = container.getConnectionUri();
  }

  // Las mismas migraciones que en producción, no un `db push`
  execSync('npx prisma migrate deploy', { env: { ...process.env, DATABASE_URL: url }, stdio: 'pipe' });
  project.provide('databaseUrl', url);

  return async () => {
    await container?.stop();
  };
}
