import { createParamDecorator, ExecutionContext, SetMetadata } from '@nestjs/common';
import type { Role } from '../generated/prisma/client.js';
import type { AppRequest } from './types.js';

export const IS_PUBLIC_KEY = 'isPublic';
/** Excluye la ruta del JwtAuthGuard global */
export const Public = () => SetMetadata(IS_PUBLIC_KEY, true);

export const ROLES_KEY = 'roles';
/** Rol mínimo en el workspace de la ruta (ver WorkspaceRoleGuard) */
export const Roles = (...roles: Role[]) => SetMetadata(ROLES_KEY, roles);

export const CurrentUser = createParamDecorator((_: unknown, ctx: ExecutionContext) => {
  return ctx.switchToHttp().getRequest<AppRequest>().user!;
});

export const CurrentMembership = createParamDecorator((_: unknown, ctx: ExecutionContext) => {
  return ctx.switchToHttp().getRequest<AppRequest>().membership!;
});
