import { ConflictException, Injectable, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import * as argon2 from 'argon2';
import { ActivityService } from '../activity/activity.service.js';
import type { AccessTokenPayload } from '../common/types.js';
import { PrismaService } from '../prisma/prisma.service.js';
import { publicUserSelect, UsersService } from '../users/users.service.js';
import type { LoginDto, RegisterDto } from './dto.js';
import { RefreshTokenService } from './refresh-token.service.js';

export interface Session {
  accessToken: string;
  refreshToken: string;
  user: { id: string; email: string; name: string; avatarColor: string };
}

@Injectable()
export class AuthService {
  // Hash de relleno: login con email inexistente tarda lo mismo que con uno real (evita enumerar usuarios)
  private readonly dummyHash = argon2.hash('fluxo-timing-safe-dummy');

  constructor(
    private readonly prisma: PrismaService,
    private readonly users: UsersService,
    private readonly refreshTokens: RefreshTokenService,
    private readonly jwt: JwtService,
    private readonly activity: ActivityService,
  ) {}

  async register(dto: RegisterDto, userAgent?: string): Promise<Session> {
    if (await this.users.findByEmail(dto.email)) throw new ConflictException('Ese email ya está registrado');
    const passwordHash = await argon2.hash(dto.password);

    // Usuario + workspace personal + membresía ADMIN, todo o nada
    const user = await this.prisma.$transaction(async (tx) => {
      const user = await tx.user.create({
        data: { email: dto.email, name: dto.name, passwordHash, avatarColor: this.users.randomAvatarColor() },
        select: publicUserSelect,
      });
      const workspace = await tx.workspace.create({
        data: { name: `Workspace de ${dto.name}`, memberships: { create: { userId: user.id, role: 'ADMIN' } } },
      });
      await this.activity.log(
        {
          workspaceId: workspace.id,
          actorId: user.id,
          action: 'workspace.created',
          entityType: 'workspace',
          entityId: workspace.id,
        },
        tx,
      );
      return user;
    });

    return this.createSession(user, userAgent);
  }

  async login(dto: LoginDto, userAgent?: string): Promise<Session> {
    const user = await this.users.findByEmail(dto.email);
    const valid = await argon2.verify(user?.passwordHash ?? (await this.dummyHash), dto.password);
    if (!user || !valid) throw new UnauthorizedException('Email o contraseña incorrectos');

    const { passwordHash: _, ...publicUser } = user;
    return this.createSession(publicUser, userAgent);
  }

  async refresh(rawRefreshToken: string, userAgent?: string): Promise<Session> {
    const { userId, raw } = await this.refreshTokens.rotate(rawRefreshToken, userAgent);
    const user = await this.users.findPublicById(userId);
    if (!user) throw new UnauthorizedException();
    return { accessToken: await this.signAccess(user), refreshToken: raw, user };
  }

  logout(rawRefreshToken: string) {
    return this.refreshTokens.revokeFamilyOf(rawRefreshToken);
  }

  private async createSession(user: Session['user'], userAgent?: string): Promise<Session> {
    const { raw } = await this.refreshTokens.issue(user.id, { userAgent });
    return { accessToken: await this.signAccess(user), refreshToken: raw, user };
  }

  private signAccess(user: { id: string; email: string }) {
    const payload: AccessTokenPayload = { sub: user.id, email: user.email };
    return this.jwt.signAsync(payload);
  }
}
