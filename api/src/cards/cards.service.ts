import { BadRequestException, ConflictException, Injectable } from '@nestjs/common';
import { ActivityService } from '../activity/activity.service.js';
import { POSITION_STEP, tooClose } from '../common/position.js';
import type { Membership, Prisma } from '../generated/prisma/client.js';
import { PrismaService } from '../prisma/prisma.service.js';
import { cardInclude, toCardDto } from './card.mapper.js';
import type { CreateCardDto, UpdateCardDto } from './dto.js';

type Tx = Prisma.TransactionClient;

@Injectable()
export class CardsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly activity: ActivityService,
  ) {}

  async create(columnId: string, actor: Membership, dto: CreateCardDto) {
    return this.prisma.$transaction(async (tx) => {
      const position = dto.position ?? (await this.lastPosition(tx, columnId)) + POSITION_STEP;
      const card = await tx.card.create({ data: { columnId, title: dto.title, position }, include: cardInclude });
      await this.log(tx, actor, 'card.created', card.id, { title: card.title, columnId });
      return toCardDto(card);
    });
  }

  /**
   * Actualización con concurrencia optimista: el UPDATE solo se aplica si la versión
   * sigue siendo la que conocía el cliente. Si alguien se adelantó → 409 con la tarjeta actual.
   */
  async update(cardId: string, actor: Membership, dto: UpdateCardDto) {
    const { version, labelIds, dueDate, ...fields } = dto;

    return this.prisma.$transaction(async (tx) => {
      const before = await tx.card.findFirstOrThrow({
        where: { id: cardId, deletedAt: null },
        select: { columnId: true, position: true, column: { select: { boardId: true } } },
      });
      const boardId = before.column.boardId;
      await this.assertReferencesBelongToBoard(tx, boardId, actor.workspaceId, dto);

      const { count } = await tx.card.updateMany({
        where: { id: cardId, version, deletedAt: null },
        data: {
          ...fields,
          ...(dueDate !== undefined && { dueDate: dueDate === null ? null : new Date(dueDate) }),
          version: { increment: 1 },
        },
      });
      if (count === 0) {
        const current = await tx.card.findUniqueOrThrow({ where: { id: cardId }, include: cardInclude });
        throw new ConflictException({
          message: 'La tarjeta ha cambiado desde que la cargaste',
          current: toCardDto(current),
        });
      }

      if (labelIds) {
        await tx.cardLabel.deleteMany({ where: { cardId } });
        await tx.cardLabel.createMany({ data: [...new Set(labelIds)].map((labelId) => ({ cardId, labelId })) });
      }

      const moved = dto.columnId !== undefined || dto.position !== undefined;
      const card = await tx.card.findUniqueOrThrow({ where: { id: cardId }, include: cardInclude });
      const columnReindexed = moved ? await this.reindexIfNeeded(tx, card.columnId, card.id, card.position) : false;

      await this.log(
        tx,
        actor,
        moved ? 'card.moved' : 'card.updated',
        cardId,
        moved
          ? { fromColumnId: before.columnId, toColumnId: card.columnId }
          : { fields: Object.keys(dto).filter((k) => k !== 'version') },
      );

      // Si se reindexó, el cliente debe recargar las posiciones de esa lista
      const result = toCardDto(
        columnReindexed ? await tx.card.findUniqueOrThrow({ where: { id: cardId }, include: cardInclude }) : card,
      );
      return { ...result, columnReindexed };
    });
  }

  /** Soft delete: la fila se queda (para el historial) pero la API deja de verla */
  async remove(cardId: string, actor: Membership) {
    await this.prisma.$transaction(async (tx) => {
      await tx.card.update({ where: { id: cardId }, data: { deletedAt: new Date(), version: { increment: 1 } } });
      await this.log(tx, actor, 'card.deleted', cardId);
    });
  }

  /** El cliente podría mandar ids de otro tablero u otro workspace: no confiamos en él */
  private async assertReferencesBelongToBoard(tx: Tx, boardId: string, workspaceId: string, dto: UpdateCardDto) {
    if (dto.columnId) {
      const column = await tx.column.findFirst({ where: { id: dto.columnId, boardId } });
      if (!column) throw new BadRequestException('La lista de destino no pertenece a este tablero');
    }
    if (dto.assigneeId) {
      const member = await tx.membership.findUnique({
        where: { userId_workspaceId: { userId: dto.assigneeId, workspaceId } },
      });
      if (!member) throw new BadRequestException('Solo se puede asignar a miembros del workspace');
    }
    if (dto.labelIds?.length) {
      const unique = [...new Set(dto.labelIds)];
      const found = await tx.label.count({ where: { id: { in: unique }, boardId } });
      if (found !== unique.length) throw new BadRequestException('Alguna etiqueta no pertenece a este tablero');
    }
  }

  /**
   * Si la nueva posición quedó pegada a un vecino (hueco < MIN_GAP), reparte toda la lista
   * de nuevo (1024, 2048…) en una sola sentencia. No cambia `version`: el orden relativo se conserva.
   */
  private async reindexIfNeeded(tx: Tx, columnId: string, cardId: string, position: number) {
    const neighbours = { columnId, deletedAt: null, id: { not: cardId } };
    const [prev, next] = await Promise.all([
      tx.card.findFirst({ where: { ...neighbours, position: { lte: position } }, orderBy: { position: 'desc' } }),
      tx.card.findFirst({ where: { ...neighbours, position: { gte: position } }, orderBy: { position: 'asc' } }),
    ]);
    if (!tooClose(prev?.position, position) && !tooClose(position, next?.position)) return false;

    await tx.$executeRaw`
      WITH ordered AS (
        SELECT id, ROW_NUMBER() OVER (ORDER BY position, id) * ${POSITION_STEP}::float8 AS pos
        FROM cards WHERE column_id = ${columnId}::uuid AND deleted_at IS NULL
      )
      UPDATE cards SET position = ordered.pos FROM ordered WHERE cards.id = ordered.id`;
    return true;
  }

  private async lastPosition(tx: Tx, columnId: string) {
    const last = await tx.card.findFirst({ where: { columnId, deletedAt: null }, orderBy: { position: 'desc' } });
    return last?.position ?? 0;
  }

  private log(tx: Tx, actor: Membership, action: string, cardId: string, payload?: Prisma.InputJsonValue) {
    return this.activity.log(
      { workspaceId: actor.workspaceId, actorId: actor.userId, action, entityType: 'card', entityId: cardId, payload },
      tx,
    );
  }
}
