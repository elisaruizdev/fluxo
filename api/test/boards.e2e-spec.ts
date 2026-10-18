import type { INestApplication } from '@nestjs/common';
import request from 'supertest';
import type { App } from 'supertest/types.js';
import type { PrismaService } from '../src/prisma/prisma.service.js';
import { createTestApp, registerUser, resetDb } from './utils.js';

type TestUser = Awaited<ReturnType<typeof registerUser>>;
interface Card {
  id: string;
  columnId: string;
  position: number;
  version: number;
  labelIds: string[];
  columnReindexed?: boolean;
}

describe('Boards, columnas y tarjetas (integración)', () => {
  let app: INestApplication<App>;
  let prisma: PrismaService;
  let admin: TestUser;
  let member: TestUser;
  let outsider: TestUser;
  let workspaceId: string;
  let boardId: string;
  let columns: { id: string; title: string }[];

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

  const createCard = async (columnId: string, title: string, position?: number) =>
    (await as(member).post(`/columns/${columnId}/cards`, { title, position }).expect(201)).body as Card;

  beforeAll(async () => {
    ({ app, prisma } = await createTestApp());
  });

  beforeEach(async () => {
    await resetDb(prisma);
    [admin, member, outsider] = await Promise.all([
      registerUser(app, 'admin'),
      registerUser(app, 'member'),
      registerUser(app, 'outsider'),
    ]);
    workspaceId = (await as(admin).post('/workspaces', { name: 'Equipo' }).expect(201)).body.id;
    await as(admin).post(`/workspaces/${workspaceId}/members`, { email: member.email }).expect(201);

    boardId = (await as(member).post(`/workspaces/${workspaceId}/boards`, { title: 'Lanzamiento' }).expect(201)).body
      .id;
    columns = (await as(member).get(`/boards/${boardId}`).expect(200)).body.columns;
  });

  afterAll(() => app.close());

  describe('Boards', () => {
    it('un tablero nuevo trae listas y etiquetas por defecto', async () => {
      const snap = (await as(member).get(`/boards/${boardId}`).expect(200)).body;
      expect(snap.board.title).toBe('Lanzamiento');
      expect(snap.columns.map((c: { title: string }) => c.title)).toEqual(['Pendiente', 'En curso', 'Hecho']);
      expect(snap.labels.length).toBeGreaterThan(0);
      expect(snap.members.map((m: { id: string }) => m.id).sort()).toEqual([admin.id, member.id].sort());
      expect(snap.members[0]).not.toHaveProperty('passwordHash');
    });

    it('lista los tableros del workspace', async () => {
      const res = await as(member).get(`/workspaces/${workspaceId}/boards`).expect(200);
      expect(res.body).toEqual([expect.objectContaining({ id: boardId })]);
    });

    it('quien no es miembro recibe 404 en el tablero y en todo lo que cuelga de él', async () => {
      const card = await createCard(columns[0]!.id, 'Secreta');
      await as(outsider).get(`/boards/${boardId}`).expect(404);
      await as(outsider).post(`/boards/${boardId}/columns`, { title: 'X' }).expect(404);
      await as(outsider).post(`/columns/${columns[0]!.id}/cards`, { title: 'X' }).expect(404);
      await as(outsider).patch(`/cards/${card.id}`, { version: 1, title: 'X' }).expect(404);
      await as(outsider).get(`/cards/${card.id}/comments`).expect(404);
    });

    it('solo un ADMIN puede borrar tableros y listas', async () => {
      await as(member).delete(`/columns/${columns[0]!.id}`).expect(403);
      await as(member).delete(`/boards/${boardId}`).expect(403);
      await as(admin).delete(`/columns/${columns[0]!.id}`).expect(204);
      await as(admin).delete(`/boards/${boardId}`).expect(204);
      await as(member).get(`/boards/${boardId}`).expect(404);
    });

    it('crea listas al final por defecto', async () => {
      const res = await as(member).post(`/boards/${boardId}/columns`, { title: 'Revisión' }).expect(201);
      expect(res.body.position).toBe(4096);
    });
  });

  describe('Tarjetas', () => {
    it('se crean al final de la lista con version 1', async () => {
      const a = await createCard(columns[0]!.id, 'A');
      const b = await createCard(columns[0]!.id, 'B');
      expect([a.position, b.position]).toEqual([1024, 2048]);
      expect(a.version).toBe(1);
    });

    it('PATCH incrementa la versión y aplica los cambios', async () => {
      const card = await createCard(columns[0]!.id, 'A');
      const res = await as(member)
        .patch(`/cards/${card.id}`, {
          version: 1,
          title: 'A editada',
          description: 'Detalles',
          assigneeId: admin.id,
          dueDate: '2026-12-01T12:00:00.000Z',
        })
        .expect(200);
      expect(res.body).toMatchObject({
        title: 'A editada',
        description: 'Detalles',
        assigneeId: admin.id,
        dueDate: '2026-12-01T12:00:00.000Z',
        version: 2,
      });

      const cleared = await as(member).patch(`/cards/${card.id}`, { version: 2, assigneeId: null, dueDate: null });
      expect(cleared.body).toMatchObject({ assigneeId: null, dueDate: null, version: 3 });
    });

    it('responde 409 con la tarjeta actual si la versión no coincide', async () => {
      const card = await createCard(columns[0]!.id, 'Original');
      // Dos personas cargan la tarjeta con version 1…
      await as(admin).patch(`/cards/${card.id}`, { version: 1, title: 'Cambio de admin' }).expect(200);
      // …y la segunda en guardar ya no tiene la versión buena
      const res = await as(member).patch(`/cards/${card.id}`, { version: 1, title: 'Cambio de member' }).expect(409);

      expect(res.body.current).toMatchObject({ id: card.id, title: 'Cambio de admin', version: 2 });
      const stored = await prisma.card.findUniqueOrThrow({ where: { id: card.id } });
      expect(stored.title).toBe('Cambio de admin');
    });

    it('de dos PATCH simultáneos con la misma versión, solo uno gana', async () => {
      const card = await createCard(columns[0]!.id, 'Carrera');
      const results = await Promise.all([
        as(admin).patch(`/cards/${card.id}`, { version: 1, title: 'A' }),
        as(member).patch(`/cards/${card.id}`, { version: 1, title: 'B' }),
      ]);
      expect(results.map((r) => r.status).sort((a, b) => a - b)).toEqual([200, 409]);
      expect((await prisma.card.findUniqueOrThrow({ where: { id: card.id } })).version).toBe(2);
    });

    it('mueve una tarjeta a otra lista del mismo tablero', async () => {
      const card = await createCard(columns[0]!.id, 'Mover');
      const res = await as(member)
        .patch(`/cards/${card.id}`, { version: 1, columnId: columns[2]!.id, position: 512 })
        .expect(200);
      expect(res.body).toMatchObject({ columnId: columns[2]!.id, position: 512, version: 2, columnReindexed: false });
    });

    it('no deja mover a una lista de otro tablero ni usar etiquetas o personas ajenas', async () => {
      const card = await createCard(columns[0]!.id, 'Validar');
      const otherBoard = (await as(admin).post(`/workspaces/${workspaceId}/boards`, { title: 'Otro' })).body.id;
      const other = (await as(admin).get(`/boards/${otherBoard}`)).body;

      await as(member).patch(`/cards/${card.id}`, { version: 1, columnId: other.columns[0].id }).expect(400);
      await as(member)
        .patch(`/cards/${card.id}`, { version: 1, labelIds: [other.labels[0].id] })
        .expect(400);
      await as(member).patch(`/cards/${card.id}`, { version: 1, assigneeId: outsider.id }).expect(400);
      // Ningún intento fallido ha cambiado la versión
      expect((await prisma.card.findUniqueOrThrow({ where: { id: card.id } })).version).toBe(1);
    });

    it('reemplaza las etiquetas de la tarjeta', async () => {
      const card = await createCard(columns[0]!.id, 'Etiquetas');
      const labels: { id: string }[] = (await as(member).get(`/boards/${boardId}`)).body.labels;

      const one = await as(member).patch(`/cards/${card.id}`, { version: 1, labelIds: [labels[0]!.id, labels[1]!.id] });
      expect(one.body.labelIds.sort()).toEqual([labels[0]!.id, labels[1]!.id].sort());
      const two = await as(member).patch(`/cards/${card.id}`, { version: 2, labelIds: [labels[2]!.id] });
      expect(two.body.labelIds).toEqual([labels[2]!.id]);
    });

    it('rechaza poner a null campos obligatorios', async () => {
      const card = await createCard(columns[0]!.id, 'Null');
      await as(member).patch(`/cards/${card.id}`, { version: 1, title: null }).expect(400);
      await as(member).patch(`/cards/${card.id}`, { title: 'Sin versión' }).expect(400);
    });

    it('reindexa la lista cuando el hueco entre posiciones se agota', async () => {
      const a = await createCard(columns[0]!.id, 'A', 1000);
      const b = await createCard(columns[0]!.id, 'B', 1000.0000001); // pegada a A
      const c = await createCard(columns[0]!.id, 'C', 5000);

      // Mover C justo entre A y B (punto medio de un hueco ya agotado)
      const res = await as(member)
        .patch(`/cards/${c.id}`, { version: 1, position: (a.position + b.position) / 2 })
        .expect(200);
      expect(res.body.columnReindexed).toBe(true);

      const snap = (await as(member).get(`/boards/${boardId}`)).body;
      const inColumn = (snap.cards as Card[]).filter((k) => k.columnId === columns[0]!.id);
      // Mismo orden (A, C, B) y posiciones limpias; las versiones de A y B no cambian
      expect(inColumn.map((k) => [k.id, k.position])).toEqual([
        [a.id, 1024],
        [c.id, 2048],
        [b.id, 3072],
      ]);
      expect(inColumn.find((k) => k.id === a.id)!.version).toBe(1);
    });

    it('el borrado es lógico: la fila sigue en BD pero la API no la ve', async () => {
      const card = await createCard(columns[0]!.id, 'Borrar');
      await as(member).delete(`/cards/${card.id}`).expect(204);

      await as(member).patch(`/cards/${card.id}`, { version: 2, title: 'X' }).expect(404);
      const snap = (await as(member).get(`/boards/${boardId}`)).body;
      expect(snap.cards).toHaveLength(0);
      expect((await prisma.card.findUniqueOrThrow({ where: { id: card.id } })).deletedAt).not.toBeNull();
    });
  });

  describe('Comentarios', () => {
    it('crea y lista comentarios en orden', async () => {
      const card = await createCard(columns[0]!.id, 'Con comentarios');
      await as(member).post(`/cards/${card.id}/comments`, { body: 'Primero' }).expect(201);
      await as(admin).post(`/cards/${card.id}/comments`, { body: 'Segundo' }).expect(201);
      await as(admin).post(`/cards/${card.id}/comments`, { body: '   ' }).expect(400);

      const res = await as(member).get(`/cards/${card.id}/comments`).expect(200);
      expect(res.body.map((c: { body: string; authorId: string }) => [c.body, c.authorId])).toEqual([
        ['Primero', member.id],
        ['Segundo', admin.id],
      ]);
    });
  });

  it('todo queda en el historial del workspace', async () => {
    const card = await createCard(columns[0]!.id, 'Historial');
    await as(member).patch(`/cards/${card.id}`, { version: 1, columnId: columns[1]!.id, position: 100 });
    await as(member).post(`/cards/${card.id}/comments`, { body: 'Hola' });

    const actions = (await as(admin).get(`/workspaces/${workspaceId}/activity`)).body.map(
      (a: { action: string }) => a.action,
    );
    expect(actions.slice(0, 4)).toEqual(['comment.created', 'card.moved', 'card.created', 'board.created']);
  });
});
