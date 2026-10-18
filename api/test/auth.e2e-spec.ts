import type { INestApplication } from '@nestjs/common';
import request from 'supertest';
import type { App } from 'supertest/types.js';
import { hashToken } from '../src/auth/refresh-token.service.js';
import type { PrismaService } from '../src/prisma/prisma.service.js';
import { createTestApp, refreshCookie, registerUser, resetDb } from './utils.js';

describe('Auth (integración)', () => {
  let app: INestApplication<App>;
  let prisma: PrismaService;
  const http = () => request(app.getHttpServer());

  beforeAll(async () => {
    ({ app, prisma } = await createTestApp());
  });
  beforeEach(() => resetDb(prisma));
  afterAll(() => app.close());

  describe('POST /auth/register', () => {
    it('crea el usuario, su workspace personal como ADMIN y abre sesión', async () => {
      const res = await http()
        .post('/api/auth/register')
        .send({ email: 'Nora@Test.dev ', name: 'Nora', password: 'password123' })
        .expect(201);

      expect(res.body.user).toMatchObject({ email: 'nora@test.dev', name: 'Nora' });
      expect(res.body.user).not.toHaveProperty('passwordHash');
      expect(res.body.accessToken).toEqual(expect.any(String));

      const cookie = ([] as string[]).concat(res.headers['set-cookie'] ?? []).join(';');
      expect(cookie).toMatch(/fluxo_rt=.+HttpOnly/i);
      expect(cookie).toMatch(/Path=\/api\/auth/);

      const memberships = await prisma.membership.findMany({ where: { userId: res.body.user.id } });
      expect(memberships).toEqual([expect.objectContaining({ role: 'ADMIN' })]);
    });

    it('guarda la contraseña con argon2 y el refresh token solo como hash', async () => {
      const user = await registerUser(app, 'hashes');
      const row = await prisma.user.findUniqueOrThrow({ where: { id: user.id } });
      expect(row.passwordHash).toMatch(/^\$argon2id\$/);

      const raw = user.cookie.split('=')[1]!;
      const tokens = await prisma.refreshToken.findMany({ where: { userId: user.id } });
      expect(tokens).toHaveLength(1);
      expect(tokens[0]!.tokenHash).toBe(hashToken(raw));
      expect(tokens[0]!.tokenHash).not.toBe(raw);
    });

    it('rechaza emails duplicados con 409', async () => {
      await registerUser(app, 'dup');
      await http()
        .post('/api/auth/register')
        .send({ email: 'dup@test.dev', name: 'x', password: 'password123' })
        .expect(409);
    });

    it('valida el body y rechaza campos desconocidos', async () => {
      const res = await http()
        .post('/api/auth/register')
        .send({ email: 'no-es-email', name: 'x', password: 'corta', isAdmin: true })
        .expect(400);
      expect(res.body.message).toEqual(
        expect.arrayContaining(['property isAdmin should not exist', 'email must be an email']),
      );
    });
  });

  describe('POST /auth/login', () => {
    it('devuelve 401 con credenciales incorrectas sin decir cuál falla', async () => {
      await registerUser(app, 'login');
      const wrongPass = await http()
        .post('/api/auth/login')
        .send({ email: 'login@test.dev', password: 'nope-nope' })
        .expect(401);
      const wrongEmail = await http()
        .post('/api/auth/login')
        .send({ email: 'nadie@test.dev', password: 'nope-nope' })
        .expect(401);
      expect(wrongPass.body.message).toBe(wrongEmail.body.message);
    });

    it('abre sesión con credenciales correctas', async () => {
      await registerUser(app, 'ok');
      const res = await http()
        .post('/api/auth/login')
        .send({ email: 'ok@test.dev', password: 'password123' })
        .expect(200);
      await http().get('/api/auth/me').set('Authorization', `Bearer ${res.body.accessToken}`).expect(200);
    });
  });

  describe('GET /auth/me', () => {
    it('exige un access token válido', async () => {
      await http().get('/api/auth/me').expect(401);
      await http().get('/api/auth/me').set('Authorization', 'Bearer basura').expect(401);
    });
  });

  describe('POST /auth/refresh (rotación)', () => {
    it('cambia el refresh token en cada uso y revoca el anterior', async () => {
      const user = await registerUser(app);
      const res = await http().post('/api/auth/refresh').set('Cookie', user.cookie).expect(200);

      const next = refreshCookie(res);
      expect(next).not.toBe(user.cookie);
      await http().get('/api/auth/me').set('Authorization', `Bearer ${res.body.accessToken}`).expect(200);

      const old = await prisma.refreshToken.findUniqueOrThrow({
        where: { tokenHash: hashToken(user.cookie.split('=')[1]!) },
      });
      expect(old.revokedAt).not.toBeNull();
      expect(old.replacedById).not.toBeNull();
    });

    it('si se reutiliza un token ya rotado, revoca toda la familia', async () => {
      const user = await registerUser(app);
      const rotated = await http().post('/api/auth/refresh').set('Cookie', user.cookie).expect(200);
      const legit = refreshCookie(rotated);

      // Un atacante usa el token robado (el viejo)...
      await http().post('/api/auth/refresh').set('Cookie', user.cookie).expect(401);
      // ...y la persona legítima también pierde la sesión: hay que volver a hacer login
      await http().post('/api/auth/refresh').set('Cookie', legit).expect(401);

      const active = await prisma.refreshToken.count({ where: { userId: user.id, revokedAt: null } });
      expect(active).toBe(0);
    });

    it('no afecta a otras sesiones del mismo usuario', async () => {
      const user = await registerUser(app, 'twodevices');
      const other = await http()
        .post('/api/auth/login')
        .send({ email: 'twodevices@test.dev', password: 'password123' })
        .expect(200);

      await http().post('/api/auth/refresh').set('Cookie', user.cookie).expect(200);
      await http().post('/api/auth/refresh').set('Cookie', user.cookie).expect(401); // reutilización en el dispositivo 1

      await http().post('/api/auth/refresh').set('Cookie', refreshCookie(other)).expect(200);
    });

    it('rechaza tokens caducados', async () => {
      const user = await registerUser(app);
      await prisma.refreshToken.updateMany({
        where: { userId: user.id },
        data: { expiresAt: new Date(Date.now() - 1000) },
      });
      await http().post('/api/auth/refresh').set('Cookie', user.cookie).expect(401);
    });

    it('solo una de dos peticiones simultáneas con el mismo token tiene éxito', async () => {
      const user = await registerUser(app);
      const results = await Promise.all([
        http().post('/api/auth/refresh').set('Cookie', user.cookie),
        http().post('/api/auth/refresh').set('Cookie', user.cookie),
      ]);
      expect(results.map((r) => r.status).sort((a, b) => a - b)).toEqual([200, 401]);
    });
  });

  describe('POST /auth/logout', () => {
    it('revoca la sesión y borra la cookie', async () => {
      const user = await registerUser(app);
      const res = await http().post('/api/auth/logout').set('Cookie', user.cookie).expect(204);
      expect(([] as string[]).concat(res.headers['set-cookie'] ?? []).join(';')).toMatch(/fluxo_rt=;/);
      await http().post('/api/auth/refresh').set('Cookie', user.cookie).expect(401);
    });
  });
});
