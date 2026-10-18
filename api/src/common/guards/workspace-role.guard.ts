import { CanActivate, ExecutionContext, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { isUUID } from 'class-validator';
import type { Role } from '../../generated/prisma/client.js';
import { PrismaService } from '../../prisma/prisma.service.js';
import { ROLES_KEY } from '../decorators.js';
import type { AppRequest } from '../types.js';

const RANK: Record<Role, number> = { MEMBER: 1, ADMIN: 2 };

export const hasRole = (actual: Role, required: Role[]) =>
  required.length === 0 || required.some((r) => RANK[actual] >= RANK[r]);

/**
 * Resuelve la membresía del usuario en el workspace de la ruta (:workspaceId)
 * y la deja en req.membership. Sin @Roles basta con ser miembro.
 *
 * Si no eres miembro responde 404, no 403: así no se revela qué workspaces existen.
 */
@Injectable()
export class WorkspaceRoleGuard implements CanActivate {
  constructor(
    private readonly prisma: PrismaService,
    private readonly reflector: Reflector,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const req = context.switchToHttp().getRequest<AppRequest>();
    const workspaceId = req.params.workspaceId;
    if (!req.user) return false;
    // Los guards corren antes que los pipes: validamos aquí para no mandar basura a Postgres
    if (typeof workspaceId !== 'string' || !isUUID(workspaceId)) throw new NotFoundException('Workspace no encontrado');

    const membership = await this.prisma.membership.findUnique({
      where: { userId_workspaceId: { userId: req.user.id, workspaceId } },
    });
    if (!membership) throw new NotFoundException('Workspace no encontrado');

    const required = this.reflector.getAllAndOverride<Role[] | undefined>(ROLES_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (!hasRole(membership.role, required ?? [])) {
      throw new ForbiddenException('No tienes permisos suficientes en este workspace');
    }

    req.membership = membership;
    return true;
  }
}
