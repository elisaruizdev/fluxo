import { Controller, Get } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { SkipThrottle } from '@nestjs/throttler';
import { HealthCheck, HealthCheckService, HealthIndicatorService } from '@nestjs/terminus';
import { Redis } from 'ioredis';
import { Public } from '../common/decorators.js';
import { PrismaService } from '../prisma/prisma.service.js';
import { InjectRedis } from '../redis/redis.module.js';

const TIMEOUT_MS = 1500;

/** Una dependencia lenta cuenta como caída: un healthcheck nunca debe quedarse colgado */
function withTimeout<T>(promise: Promise<T>) {
  return Promise.race([
    promise,
    new Promise<never>((_, reject) => setTimeout(() => reject(new Error(`timeout ${TIMEOUT_MS}ms`)), TIMEOUT_MS)),
  ]);
}

// Públicos y sin rate limit: los consultan Docker y el balanceador cada pocos segundos
@ApiTags('health')
@Public()
@SkipThrottle()
@Controller('health')
export class HealthController {
  constructor(
    private readonly health: HealthCheckService,
    private readonly indicators: HealthIndicatorService,
    private readonly prisma: PrismaService,
    @InjectRedis() private readonly redis: Redis,
  ) {}

  /** Liveness: ¿el proceso responde? No mira dependencias (si Postgres cae, reiniciar la API no ayuda) */
  @Get()
  live() {
    return { status: 'ok', uptime: Math.round(process.uptime()) };
  }

  /** Readiness: ¿puede atender peticiones? 200 si Postgres y Redis responden, 503 si no */
  @Get('ready')
  @HealthCheck()
  ready() {
    return this.health.check([
      () => this.check('database', () => this.prisma.$queryRaw`SELECT 1`),
      () => this.check('redis', () => this.redis.ping()),
    ]);
  }

  private async check(key: string, probe: () => Promise<unknown>) {
    const indicator = this.indicators.check(key);
    try {
      await withTimeout(probe());
      return indicator.up();
    } catch (e) {
      return indicator.down({ message: e instanceof Error ? e.message : String(e) });
    }
  }
}
