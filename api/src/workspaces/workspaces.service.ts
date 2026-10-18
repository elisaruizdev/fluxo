import { ConflictException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { ActivityService } from '../activity/activity.service.js';
import type { Membership, Prisma, Role } from '../generated/prisma/client.js';
import { PrismaService } from '../prisma/prisma.service.js';
import { publicUserSelect } from '../users/users.service.js';
import type { AddMemberDto, CreateWorkspaceDto, UpdateWorkspaceDto } from './dto.js';

@Injectable()
export class WorkspacesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly activity: ActivityService,
  ) {}

  async listForUser(userId: string) {
    const memberships = await this.prisma.membership.findMany({
      where: { userId },
      include: { workspace: true },
      orderBy: { createdAt: 'asc' },
    });
    return memberships.map(({ workspace, role }) => ({ ...workspace, role }));
  }

  create(userId: string, dto: CreateWorkspaceDto) {
    return this.prisma.$transaction(async (tx) => {
      const workspace = await tx.workspace.create({
        data: { name: dto.name, memberships: { create: { userId, role: 'ADMIN' } } },
      });
      await this.activity.log(
        {
          workspaceId: workspace.id,
          actorId: userId,
          action: 'workspace.created',
          entityType: 'workspace',
          entityId: workspace.id,
        },
        tx,
      );
      return { ...workspace, role: 'ADMIN' as Role };
    });
  }

  async get(membership: Membership) {
    const workspace = await this.prisma.workspace.findUniqueOrThrow({ where: { id: membership.workspaceId } });
    return { ...workspace, role: membership.role };
  }

  update(workspaceId: string, actorId: string, dto: UpdateWorkspaceDto) {
    return this.prisma.$transaction(async (tx) => {
      const workspace = await tx.workspace.update({ where: { id: workspaceId }, data: { name: dto.name } });
      await this.activity.log(
        {
          workspaceId,
          actorId,
          action: 'workspace.renamed',
          entityType: 'workspace',
          entityId: workspaceId,
          payload: { name: dto.name },
        },
        tx,
      );
      return workspace;
    });
  }

  async remove(workspaceId: string) {
    await this.prisma.workspace.delete({ where: { id: workspaceId } });
  }

  listMembers(workspaceId: string) {
    return this.prisma.membership.findMany({
      where: { workspaceId },
      select: { role: true, createdAt: true, user: { select: publicUserSelect } },
      orderBy: { createdAt: 'asc' },
    });
  }

  async addMember(workspaceId: string, actorId: string, dto: AddMemberDto) {
    const user = await this.prisma.user.findUnique({ where: { email: dto.email } });
    if (!user) throw new NotFoundException('No hay ningún usuario con ese email');

    // Si ya es miembro, la clave compuesta (userId, workspaceId) da P2002 → 409 en el filtro global
    return this.prisma.$transaction(async (tx) => {
      const membership = await tx.membership.create({
        data: { workspaceId, userId: user.id, role: dto.role ?? 'MEMBER' },
        select: { role: true, createdAt: true, user: { select: publicUserSelect } },
      });
      await this.activity.log(
        {
          workspaceId,
          actorId,
          action: 'member.added',
          entityType: 'membership',
          entityId: user.id,
          payload: { role: membership.role },
        },
        tx,
      );
      return membership;
    });
  }

  updateMemberRole(workspaceId: string, actorId: string, userId: string, role: Role) {
    return this.prisma.$transaction(async (tx) => {
      const current = await this.findMember(tx, workspaceId, userId);
      if (current.role === 'ADMIN' && role !== 'ADMIN') await this.assertNotLastAdmin(tx, workspaceId);

      const membership = await tx.membership.update({
        where: { userId_workspaceId: { userId, workspaceId } },
        data: { role },
        select: { role: true, createdAt: true, user: { select: publicUserSelect } },
      });
      await this.activity.log(
        {
          workspaceId,
          actorId,
          action: 'member.role_changed',
          entityType: 'membership',
          entityId: userId,
          payload: { from: current.role, to: role },
        },
        tx,
      );
      return membership;
    });
  }

  /** Un ADMIN puede quitar a cualquiera; un MEMBER solo puede salir él mismo */
  removeMember(workspaceId: string, actor: Membership, userId: string) {
    if (actor.role !== 'ADMIN' && actor.userId !== userId) {
      throw new ForbiddenException('Solo un ADMIN puede quitar a otros miembros');
    }
    return this.prisma.$transaction(async (tx) => {
      const current = await this.findMember(tx, workspaceId, userId);
      if (current.role === 'ADMIN') await this.assertNotLastAdmin(tx, workspaceId);

      await tx.membership.delete({ where: { userId_workspaceId: { userId, workspaceId } } });
      await this.activity.log(
        { workspaceId, actorId: actor.userId, action: 'member.removed', entityType: 'membership', entityId: userId },
        tx,
      );
    });
  }

  private async findMember(tx: Prisma.TransactionClient, workspaceId: string, userId: string) {
    const membership = await tx.membership.findUnique({ where: { userId_workspaceId: { userId, workspaceId } } });
    if (!membership) throw new NotFoundException('Esa persona no es miembro del workspace');
    return membership;
  }

  /** Un workspace nunca puede quedarse sin nadie que lo administre */
  private async assertNotLastAdmin(tx: Prisma.TransactionClient, workspaceId: string) {
    const admins = await tx.membership.count({ where: { workspaceId, role: 'ADMIN' } });
    if (admins <= 1) throw new ConflictException('El workspace necesita al menos un ADMIN');
  }
}
