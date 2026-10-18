import { Global, Inject, Logger, Module, OnApplicationShutdown } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Redis } from 'ioredis';
import type { Env } from '../config/env.js';

export const REDIS = Symbol('REDIS');
/** Inyecta el cliente compartido: `constructor(@InjectRedis() redis: Redis)` */
export const InjectRedis = () => Inject(REDIS);

/**
 * Un cliente Redis para toda la app (provider con token propio, no una clase).
 * En el paso 5 lo usarán el pub/sub del tiempo real y BullMQ.
 */
@Global()
@Module({
  providers: [
    {
      provide: REDIS,
      inject: [ConfigService],
      useFactory: (config: ConfigService<Env, true>) => {
        const logger = new Logger('Redis');
        const client = new Redis(config.get('REDIS_URL', { infer: true }), {
          // Si Redis cae, las órdenes fallan rápido en vez de quedarse esperando en cola
          maxRetriesPerRequest: 1,
          lazyConnect: true,
        });
        // Sin este listener, un Redis caído tumbaría el proceso con un 'Unhandled error event'
        client.on('error', (err: Error) => logger.warn(`Redis no disponible: ${err.message}`));
        client.connect().catch(() => undefined); // reintenta solo; el readiness lo reflejará
        return client;
      },
    },
  ],
  exports: [REDIS],
})
export class RedisModule implements OnApplicationShutdown {
  constructor(@InjectRedis() private readonly redis: Redis) {}

  async onApplicationShutdown() {
    await this.redis.quit().catch(() => this.redis.disconnect());
  }
}
