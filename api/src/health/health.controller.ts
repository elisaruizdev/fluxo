import { Controller, Get } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { SkipThrottle } from '@nestjs/throttler';
import { Public } from '../common/decorators.js';

// Pública y sin rate limit: la consultan Docker y el balanceador cada pocos segundos
@ApiTags('health')
@Public()
@SkipThrottle()
@Controller('health')
export class HealthController {
  // En el paso 4 comprobará también Postgres y Redis (@nestjs/terminus)
  @Get()
  check() {
    return { status: 'ok', uptime: Math.round(process.uptime()) };
  }
}
