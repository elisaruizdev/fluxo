import type { INestApplication } from '@nestjs/common';
import { Redis } from 'ioredis';
import request from 'supertest';
import type { App } from 'supertest/types.js';
import { REDIS } from '../src/redis/redis.module.js';
import { createTestApp } from './utils.js';

describe('Health', () => {
  describe('con todas las dependencias disponibles', () => {
    let app: INestApplication<App>;
    beforeAll(async () => {
      ({ app } = await createTestApp());
    });
    afterAll(() => app.close());

    it('GET /api/health (liveness) es público y responde 200', async () => {
      const res = await request(app.getHttpServer()).get('/api/health').expect(200);
      expect(res.body).toMatchObject({ status: 'ok' });
    });

    it('GET /api/health/ready (readiness) comprueba Postgres y Redis', async () => {
      const res = await request(app.getHttpServer()).get('/api/health/ready').expect(200);
      expect(res.body.info).toEqual({ database: { status: 'up' }, redis: { status: 'up' } });
    });
  });

  describe('con Redis caído', () => {
    let app: INestApplication<App>;
    let deadRedis: Redis;

    beforeAll(async () => {
      // Un puerto donde no escucha nadie: cada ping falla al instante
      deadRedis = new Redis('redis://127.0.0.1:1', {
        lazyConnect: true,
        maxRetriesPerRequest: 0,
        retryStrategy: () => null,
      });
      deadRedis.on('error', () => undefined);
      ({ app } = await createTestApp((b) => b.overrideProvider(REDIS).useValue(deadRedis)));
    });
    afterAll(async () => {
      await app.close();
      deadRedis.disconnect();
    });

    it('readiness responde 503 indicando qué falla, pero liveness sigue en 200', async () => {
      const res = await request(app.getHttpServer()).get('/api/health/ready').expect(503);
      expect(res.body.details.redis).toMatchObject({ status: 'down' });
      expect(res.body.details.database).toEqual({ status: 'up' });

      await request(app.getHttpServer()).get('/api/health').expect(200);
    });
  });
});
