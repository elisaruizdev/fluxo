import { Controller, Get } from '@nestjs/common';

@Controller('health')
export class HealthController {
  // En el paso 2 comprobará también Postgres y Redis (@nestjs/terminus)
  @Get()
  check() {
    return { status: 'ok', uptime: Math.round(process.uptime()) };
  }
}
