import type { INestApplication } from '@nestjs/common';
import { Test, type TestingModuleBuilder } from '@nestjs/testing';
import request from 'supertest';
import type { App } from 'supertest/types.js';
import { inject } from 'vitest';
import { AppModule } from '../src/app.module.js';
import { setupApp } from '../src/app.setup.js';
import { PrismaService } from '../src/prisma/prisma.service.js';

/** `override` permite sustituir providers (p. ej. un Redis caído) antes de compilar el módulo */
export async function createTestApp(override: (builder: TestingModuleBuilder) => TestingModuleBuilder = (b) => b) {
  const moduleRef = await override(Test.createTestingModule({ imports: [AppModule] })).compile();
  const app: INestApplication<App> = setupApp(moduleRef.createNestApplication());
  await app.init();
  return { app, prisma: app.get(PrismaService) };
}

/** Deja la BD vacía entre tests sin tener que recrearla */
export async function resetDb(prisma: PrismaService) {
  // Red de seguridad: TRUNCATE solo sobre la BD que preparó global-setup, nunca sobre otra
  const expected = new URL(inject('databaseUrl')).pathname.slice(1);
  const [{ db }] = await prisma.$queryRaw<{ db: string }[]>`SELECT current_database() AS db`;
  if (db !== expected) {
    throw new Error(
      `resetDb: conectada a "${db}" en vez de a la BD de tests "${expected}". Abortado para no borrar datos.`,
    );
  }
  const tables = await prisma.$queryRaw<{ tablename: string }[]>`
    SELECT tablename FROM pg_tables WHERE schemaname = 'public' AND tablename <> '_prisma_migrations'`;
  const list = tables.map((t) => `"${t.tablename}"`).join(', ');
  await prisma.$executeRawUnsafe(`TRUNCATE ${list} RESTART IDENTITY CASCADE`);
}

let counter = 0;

/** Registra un usuario y devuelve su access token y la cookie de refresh */
export async function registerUser(app: INestApplication<App>, name = `user${++counter}`) {
  const res = await request(app.getHttpServer())
    .post('/api/auth/register')
    .send({ email: `${name}@test.dev`, name, password: 'password123' })
    .expect(201);

  return {
    id: res.body.user.id as string,
    email: res.body.user.email as string,
    token: res.body.accessToken as string,
    cookie: refreshCookie(res),
  };
}

export function refreshCookie(res: request.Response) {
  const cookies = ([] as string[]).concat(res.headers['set-cookie'] ?? []);
  return cookies.find((c) => c.startsWith('fluxo_rt='))!.split(';')[0]!;
}
