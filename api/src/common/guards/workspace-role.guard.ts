import { CanActivate, ExecutionContext, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { isUUID } from 'class-validator';
import type { Role } from '../../generated/prisma/client.js';
import { PrismaService } from '../../prisma/prisma.service.js';
import { ROLES_KEY, WORKSPACE_SOURCE_KEY, type WorkspaceSource } from '../decorators.js';
import type { AppRequest } from '../types.js';

const RANK: Record<Role, number> = { MEMBER: 1, ADMIN: 2 };

export const hasRole = (actual: Role, required: Role[]) =>
  required.length === 0 || required.some((r) => RANK[actual] >= RANK[r]);

const PARAM: Record<WorkspaceSource, string> = {
  workspace: 'workspaceId',
  board: 'boardId',
  column: 'columnId',
  card: 'cardId',
};

/**
 * Resuelve el workspace del recurso de la ruta (por defecto :workspaceId; con
 * @WorkspaceFrom('card') sube desde :cardId → columna → tablero → workspace),
 * busca la membresía del usuario y la deja en req.membership. Sin @Roles basta con ser miembro.
 *
 * Si no eres miembro, o el recurso no existe, responde 404 (no 403): así no se revela qué existe.
 */
@Injectable()
export class WorkspaceRoleGuard implements CanActivate {
  constructor(
    private readonly prisma: PrismaService,
    private readonly reflector: Reflector,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const req = context.switchToHttp().getRequest<AppRequest>();
    if (!req.user) return false;

    const targets = [context.getHandler(), context.getClass()];
    const source =
      this.reflector.getAllAndOverride<WorkspaceSource | undefined>(WORKSPACE_SOURCE_KEY, targets) ?? 'workspace';
    const id = req.params[PARAM[source]];

    // Los guards corren antes que los pipes: validamos aquí para no mandar basura a Postgres
    if (typeof id !== 'string' || !isUUID(id)) throw new NotFoundException('Recurso no encontrado');

    const workspaceId = await this.resolveWorkspaceId(source, id);
    if (!workspaceId) throw new NotFoundException('Recurso no encontrado');

    const membership = await this.prisma.membership.findUnique({
      where: { userId_workspaceId: { userId: req.user.id, workspaceId } },
    });
    if (!membership) throw new NotFoundException('Recurso no encontrado');

    const required = this.reflector.getAllAndOverride<Role[] | undefined>(ROLES_KEY, targets);
    if (!hasRole(membership.role, required ?? [])) {
      throw new ForbiddenException('No tienes permisos suficientes en este workspace');
    }

    req.membership = membership;
    return true;
  }

  private async resolveWorkspaceId(source: WorkspaceSource, id: string): Promise<string | undefined> {
    switch (source) {
      case 'workspace':
        return id;
      case 'board':
        return (await this.prisma.board.findUnique({ where: { id }, select: { workspaceId: true } }))?.workspaceId;
      case 'column':
        return (
          await this.prisma.column.findUnique({ where: { id }, select: { board: { select: { workspaceId: true } } } })
        )?.board.workspaceId;
      case 'card':
        return (
          await this.prisma.card.findFirst({
            where: { id, deletedAt: null }, // las tarjetas borradas (soft delete) no existen para la API
            select: { column: { select: { board: { select: { workspaceId: true } } } } },
          })
        )?.column.board.workspaceId;
    }
  }
}
