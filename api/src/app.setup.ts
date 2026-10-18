import type { INestApplication } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import cookieParser from 'cookie-parser';
import type { Env } from './config/env.js';
import { REFRESH_COOKIE } from './auth/auth.controller.js';

/** Configuración compartida por main.ts y los tests de integración */
export function setupApp(app: INestApplication) {
  const config = app.get<ConfigService<Env, true>>(ConfigService);

  app.setGlobalPrefix('api');
  app.use(cookieParser());
  app.enableCors({ origin: config.get('WEB_ORIGIN', { infer: true }), credentials: true });
  app.enableShutdownHooks();

  if (config.get('NODE_ENV', { infer: true }) !== 'production') {
    const document = SwaggerModule.createDocument(
      app,
      new DocumentBuilder()
        .setTitle('Fluxo API')
        .setVersion('0.1.0')
        .addBearerAuth()
        .addCookieAuth(REFRESH_COOKIE)
        .build(),
    );
    SwaggerModule.setup('api/docs', app, document);
  }

  return app;
}
