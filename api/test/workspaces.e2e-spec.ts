import type { INestApplication } from '@nestjs/common';
import request from 'supertest';
import type { App } from 'supertest/types.js';
import type { PrismaService } from '../src/prisma/prisma.service.js';
import { createTestApp, registerUser, resetDb } from './utils.js';

type TestUser = Awaited<ReturnType<typeof registerUser>>;

describe('Workspaces y RBAC (integración)', () => {
  let app: INestApplication<App>;
  let prisma: PrismaService;
  let admin: TestUser;
  let member: TestUser;
  let outsider: TestUser;
  let workspaceId: string;

  const as = (user: TestUser) => {
    const agent = request(app.getHttpServer());
    const auth = { Authorization: `Bearer ${user.token}` };
    return {
      get: (url: string) => agent.get(`/api${url}`).set(auth),
      post: (url: string, body?: object) => agent.post(`/api${url}`).set(auth).send(body),
      patch: (url: string, body?: object) => agent.patch(`/api${url}`).set(auth).send(body),
      delete: (url: string) => agent.delete(`/api${url}`).set(auth),
    };
  };

  beforeAll(async () => {
    ({ app, prisma } = await createTestApp());
  });

  beforeEach(async () => {
    await resetDb(prisma);
    [admin, member, outsider] = await Promise.all([registerUser(app, 'admin'), registerUser(app, 'member'), registerUser(app, 'outsider')]);
    const ws = await as(admin).post('/workspaces', { name: 'Equipo' }).expect(201);
    workspaceId = ws.body.id;
    await as(admin).post(`/workspaces/${workspaceId}/members`, { email: member.email }).expect(201);
  });

  afterAll(() => app.close());

  it('lista solo los workspaces de los que eres miembro, con tu rol', async () => {
    const res = await as(member).get('/workspaces').expect(200);
    expect(res.body).toEqual(
      expect.arrayContaining([expect.objectContaining({ id: workspaceId, name: 'Equipo', role: 'MEMBER' })]),
    );
    const outsiderList = await as(outsider).get('/workspaces').expect(200);
    expect(outsiderList.body.map((w: { id: string }) => w.id)).not.toContain(workspaceId);
  });

  it('responde 404 (no 403) a quien no es miembro, para no revelar que existe', async () => {
    await as(outsider).get(`/workspaces/${workspaceId}`).expect(404);
    await as(outsider).patch(`/workspaces/${workspaceId}`, { name: 'Hackeado' }).expect(404);
    await as(outsider).get(`/workspaces/not-a-uuid`).expect(404);
  });

  it('un MEMBER puede leer pero no administrar', async () => {
    await as(member).get(`/workspaces/${workspaceId}`).expect(200);
    await as(member).get(`/workspaces/${workspaceId}/members`).expect(200);
    await as(member).patch(`/workspaces/${workspaceId}`, { name: 'Nuevo' }).expect(403);
    await as(member).post(`/workspaces/${workspaceId}/members`, { email: outsider.email }).expect(403);
    await as(member).delete(`/workspaces/${workspaceId}`).expect(403);
  });

  it('un ADMIN puede renombrar, gestionar roles y borrar', async () => {
    await as(admin).patch(`/workspaces/${workspaceId}`, { name: 'Renombrado' }).expect(200);
    const promoted = await as(admin).patch(`/workspaces/${workspaceId}/members/${member.id}`, { role: 'ADMIN' }).expect(200);
    expect(promoted.body.role).toBe('ADMIN');

    // Ahora el antiguo MEMBER ya puede administrar
    await as(member).patch(`/workspaces/${workspaceId}`, { name: 'Otra vez' }).expect(200);

    await as(admin).delete(`/workspaces/${workspaceId}`).expect(204);
    await as(admin).get(`/workspaces/${workspaceId}`).expect(404);
  });

  it('añadir dos veces al mismo miembro da 409 y a un email desconocido 404', async () => {
    await as(admin).post(`/workspaces/${workspaceId}/members`, { email: member.email }).expect(409);
    await as(admin).post(`/workspaces/${workspaceId}/members`, { email: 'nadie@test.dev' }).expect(404);
  });

  it('nunca deja un workspace sin ADMIN', async () => {
    await as(admin).patch(`/workspaces/${workspaceId}/members/${admin.id}`, { role: 'MEMBER' }).expect(409);
    await as(admin).delete(`/workspaces/${workspaceId}/members/${admin.id}`).expect(409);
  });

  it('un MEMBER puede salir, pero no expulsar a otros', async () => {
    await as(admin).post(`/workspaces/${workspaceId}/members`, { email: outsider.email }).expect(201);
    await as(member).delete(`/workspaces/${workspaceId}/members/${outsider.id}`).expect(403);
    await as(member).delete(`/workspaces/${workspaceId}/members/${member.id}`).expect(204);
    await as(member).get(`/workspaces/${workspaceId}`).expect(404);
  });

  it('registra el historial de actividad', async () => {
    await as(admin).patch(`/workspaces/${workspaceId}/members/${member.id}`, { role: 'ADMIN' }).expect(200);
    const res = await as(member).get(`/workspaces/${workspaceId}/activity`).expect(200);
    expect(res.body.map((a: { action: string }) => a.action)).toEqual(['member.role_changed', 'member.added', 'workspace.created']);
    expect(res.body[0].payload).toEqual({ from: 'MEMBER', to: 'ADMIN' });
  });
});
