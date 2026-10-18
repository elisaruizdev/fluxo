import type { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import type { App } from 'supertest/types.js';
import { inject } from 'vitest';
import { AppModule } from '../src/app.module.js';
import { setupApp } from '../src/app.setup.js';
import { PrismaService } from '../src/prisma/prisma.service.js';

export async function createTestApp() {
  process.env.NODE_ENV = 'test';
  process.env.DATABASE_URL = inject('databaseUrl');
  process.env.JWT_ACCESS_SECRET = 'test-secret-with-at-least-32-characters!!';

  const moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile();
  const app: INestApplication<App> = setupApp(moduleRef.createNestApplication());
  await app.init();
  return { app, prisma: app.get(PrismaService) };
}

/** Deja la BD vacía entre tests sin tener que recrearla */
export async function resetDb(prisma: PrismaService) {
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
