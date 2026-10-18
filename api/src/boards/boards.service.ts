import { Injectable } from '@nestjs/common';
import { ActivityService } from '../activity/activity.service.js';
import { toCardDto, cardInclude } from '../cards/card.mapper.js';
import { POSITION_STEP } from '../common/position.js';
import { PrismaService } from '../prisma/prisma.service.js';
import type { CreateBoardDto, CreateColumnDto, UpdateBoardDto, UpdateColumnDto } from './dto.js';

// Un tablero nuevo no empieza vacío: tres listas y unas etiquetas básicas
const DEFAULT_COLUMNS = ['Pendiente', 'En curso', 'Hecho'];
const DEFAULT_LABELS = [
  { name: 'Prioridad', color: 'rose' },
  { name: 'Frontend', color: 'teal' },
  { name: 'Backend', color: 'violet' },
  { name: 'Bug', color: 'amber' },
];

@Injectable()
export class BoardsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly activity: ActivityService,
  ) {}

  list(workspaceId: string) {
    return this.prisma.board.findMany({ where: { workspaceId }, orderBy: { createdAt: 'asc' } });
  }

  create(workspaceId: string, actorId: string, dto: CreateBoardDto) {
    return this.prisma.$transaction(async (tx) => {
      const board = await tx.board.create({
        data: {
          workspaceId,
          title: dto.title,
          columns: { create: DEFAULT_COLUMNS.map((title, i) => ({ title, position: (i + 1) * POSITION_STEP })) },
          labels: { create: DEFAULT_LABELS },
        },
      });
      await this.activity.log(
        {
          workspaceId,
          actorId,
          action: 'board.created',
          entityType: 'board',
          entityId: board.id,
          payload: { title: board.title },
        },
        tx,
      );
      return board;
    });
  }

  /** Todo lo necesario para pintar un tablero en una sola petición */
  async snapshot(boardId: string) {
    const board = await this.prisma.board.findUniqueOrThrow({ where: { id: boardId } });
    const [columns, cards, labels, memberships] = await Promise.all([
      this.prisma.column.findMany({ where: { boardId }, orderBy: { position: 'asc' } }),
      this.prisma.card.findMany({
        where: { deletedAt: null, column: { boardId } },
        include: cardInclude,
        orderBy: { position: 'asc' },
      }),
      this.prisma.label.findMany({ where: { boardId }, orderBy: { name: 'asc' } }),
      this.prisma.membership.findMany({
        where: { workspaceId: board.workspaceId },
        select: { role: true, user: { select: { id: true, name: true, email: true, avatarColor: true } } },
      }),
    ]);
    return {
      board,
      columns,
      cards: cards.map(toCardDto),
      labels,
      members: memberships.map(({ user, role }) => ({ ...user, role })),
    };
  }

  update(boardId: string, dto: UpdateBoardDto) {
    return this.prisma.board.update({ where: { id: boardId }, data: { title: dto.title } });
  }

  async remove(boardId: string) {
    await this.prisma.board.delete({ where: { id: boardId } });
  }

  async createColumn(boardId: string, workspaceId: string, actorId: string, dto: CreateColumnDto) {
    const position = dto.position ?? (await this.lastColumnPosition(boardId)) + POSITION_STEP;
    return this.prisma.$transaction(async (tx) => {
      const column = await tx.column.create({ data: { boardId, title: dto.title, position } });
      await this.activity.log(
        {
          workspaceId,
          actorId,
          action: 'column.created',
          entityType: 'column',
          entityId: column.id,
          payload: { title: column.title },
        },
        tx,
      );
      return column;
    });
  }

  updateColumn(columnId: string, dto: UpdateColumnDto) {
    return this.prisma.column.update({ where: { id: columnId }, data: dto });
  }

  async removeColumn(columnId: string) {
    await this.prisma.column.delete({ where: { id: columnId } });
  }

  private async lastColumnPosition(boardId: string) {
    const last = await this.prisma.column.findFirst({ where: { boardId }, orderBy: { position: 'desc' } });
    return last?.position ?? 0;
  }
}
