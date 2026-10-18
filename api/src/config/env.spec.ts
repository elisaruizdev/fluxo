import { validateEnv } from './env.js';

const valid = {
  DATABASE_URL: 'postgresql://x',
  JWT_ACCESS_SECRET: 'a'.repeat(32),
};

describe('validateEnv', () => {
  it('aplica valores por defecto y convierte números', () => {
    expect(validateEnv({ ...valid, PORT: '4000' })).toMatchObject({
      PORT: 4000,
      JWT_ACCESS_TTL: 900,
      NODE_ENV: 'development',
    });
  });

  it('falla al arrancar si falta algo o el secreto es corto', () => {
    expect(() => validateEnv({})).toThrow(/DATABASE_URL es obligatoria/);
    expect(() => validateEnv({ ...valid, JWT_ACCESS_SECRET: 'corto' })).toThrow(/al menos 32/);
  });
});
