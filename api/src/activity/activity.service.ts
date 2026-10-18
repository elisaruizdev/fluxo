import { Injectable } from '@nestjs/common';
import type { Prisma } from '../generated/prisma/client.js';
import { PrismaService } from '../prisma/prisma.service.js';

export interface ActivityEntry {
  workspaceId: string;
  actorId: string;
  action: string;
  entityType: 'workspace' | 'membership' | 'board' | 'column' | 'card' | 'comment';
  entityId: string;
  payload?: Prisma.InputJsonValue;
}

type Tx = Prisma.TransactionClient;

@Injectable()
export class ActivityService {
  constructor(private readonly prisma: PrismaService) {}

  /** Acepta la transacción en curso para que el log y el cambio se guarden juntos o no se guarden */
  log(entry: ActivityEntry, tx: Tx = this.prisma) {
    return tx.activityLog.create({ data: { ...entry, payload: entry.payload ?? {} } });
  }

  list(workspaceId: string, take = 50) {
    return this.prisma.activityLog.findMany({
      where: { workspaceId },
      orderBy: { createdAt: 'desc' },
      take,
      include: { actor: { select: { id: true, name: true, avatarColor: true } } },
    });
  }
}
