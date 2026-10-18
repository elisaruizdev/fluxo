export interface Env {
  NODE_ENV: 'development' | 'test' | 'production';
  PORT: number;
  WEB_ORIGIN: string;
  DATABASE_URL: string;
  REDIS_URL: string;
  JWT_ACCESS_SECRET: string;
  /** Segundos de vida del access token */
  JWT_ACCESS_TTL: number;
  REFRESH_TOKEN_TTL_DAYS: number;
}

/**
 * Falla al arrancar si falta algo: mejor un crash claro en el deploy
 * que un 500 misterioso en la primera petición.
 */
export function validateEnv(raw: Record<string, unknown>): Env {
  const errors: string[] = [];

  const str = (key: string, fallback?: string) => {
    const value = raw[key] ?? fallback;
    if (typeof value !== 'string' || value === '') errors.push(`${key} es obligatoria`);
    return typeof value === 'string' ? value : '';
  };
  const int = (key: string, fallback: number) => {
    const value = Number(raw[key] ?? fallback);
    if (!Number.isInteger(value) || value <= 0) errors.push(`${key} debe ser un entero positivo`);
    return value;
  };

  const env: Env = {
    NODE_ENV: str('NODE_ENV', 'development') as Env['NODE_ENV'],
    PORT: int('PORT', 3000),
    WEB_ORIGIN: str('WEB_ORIGIN', 'http://localhost:5173'),
    DATABASE_URL: str('DATABASE_URL'),
    REDIS_URL: str('REDIS_URL', 'redis://localhost:6379'),
    JWT_ACCESS_SECRET: str('JWT_ACCESS_SECRET'),
    JWT_ACCESS_TTL: int('JWT_ACCESS_TTL', 900),
    REFRESH_TOKEN_TTL_DAYS: int('REFRESH_TOKEN_TTL_DAYS', 30),
  };

  if (!['development', 'test', 'production'].includes(env.NODE_ENV)) errors.push('NODE_ENV no válido');
  if (env.JWT_ACCESS_SECRET.length < 32) errors.push('JWT_ACCESS_SECRET debe tener al menos 32 caracteres');

  if (errors.length) throw new Error(`Configuración inválida:\n - ${errors.join('\n - ')}`);
  return env;
}
