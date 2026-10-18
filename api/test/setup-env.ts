import { inject } from 'vitest';

/**
 * Se ejecuta antes de importar cada fichero de test. Tiene que ser aquí y no dentro de createTestApp():
 * ConfigModule.forRoot() valida y fija la configuración en cuanto se IMPORTA app.module.ts.
 * Si las variables llegan después, la app usaría las de api/.env… es decir, tu base de datos de desarrollo.
 */
process.env.NODE_ENV = 'test';
process.env.DATABASE_URL = inject('databaseUrl');
process.env.REDIS_URL = inject('redisUrl');
process.env.JWT_ACCESS_SECRET = 'test-secret-with-at-least-32-characters!!';
