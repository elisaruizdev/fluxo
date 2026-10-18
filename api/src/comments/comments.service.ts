import { Injectable } from '@nestjs/common';
import { ActivityService } from '../activity/activity.service.js';
import type { Membership } from '../generated/prisma/client.js';
import { PrismaService } from '../prisma/prisma.service.js';

@Injectable()
export class CommentsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly activity: ActivityService,
  ) {}

  list(cardId: string) {
    return this.prisma.comment.findMany({ where: { cardId }, orderBy: { createdAt: 'asc' } });
  }

  create(cardId: string, actor: Membership, body: string) {
    return this.prisma.$transaction(async (tx) => {
      const comment = await tx.comment.create({ data: { cardId, authorId: actor.userId, body } });
      await this.activity.log(
        {
          workspaceId: actor.workspaceId,
          actorId: actor.userId,
          action: 'comment.created',
          entityType: 'comment',
          entityId: comment.id,
          payload: { cardId },
        },
        tx,
      );
      return comment;
    });
  }
}
