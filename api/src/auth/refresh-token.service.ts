import { Injectable, Logger, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createHash, randomBytes, randomUUID } from 'node:crypto';
import type { Env } from '../config/env.js';
import type { Prisma } from '../generated/prisma/client.js';
import { PrismaService } from '../prisma/prisma.service.js';

/**
 * El refresh token es un valor aleatorio opaco (no un JWT). En BD solo se guarda su SHA-256:
 * con 256 bits de entropía no hace falta un hash lento como argon2 (ver ADR 0003).
 */
export const hashToken = (raw: string) => createHash('sha256').update(raw).digest('hex');

type Tx = Prisma.TransactionClient;

@Injectable()
export class RefreshTokenService {
  private readonly logger = new Logger(RefreshTokenService.name);
  private readonly ttlMs: number;

  constructor(
    private readonly prisma: PrismaService,
    config: ConfigService<Env, true>,
  ) {
    this.ttlMs = config.get('REFRESH_TOKEN_TTL_DAYS', { infer: true }) * 86_400_000;
  }

  get maxAgeMs() {
    return this.ttlMs;
  }

  /** Crea un token nuevo. Sin familyId empieza una familia (= una sesión de login) */
  async issue(userId: string, opts: { familyId?: string; userAgent?: string } = {}, tx: Tx = this.prisma) {
    const raw = randomBytes(32).toString('base64url');
    const record = await tx.refreshToken.create({
      data: {
        userId,
        tokenHash: hashToken(raw),
        familyId: opts.familyId ?? randomUUID(),
        expiresAt: new Date(Date.now() + this.ttlMs),
        userAgent: opts.userAgent?.slice(0, 255),
      },
    });
    return { raw, record };
  }

  /**
   * Rotación: cada refresh token sirve UNA vez. Si llega uno ya usado, alguien lo ha
   * robado (o lo está reutilizando): se revoca toda su familia y ambos tienen que volver a hacer login.
   */
  async rotate(raw: string, userAgent?: string) {
    const current = await this.prisma.refreshToken.findUnique({ where: { tokenHash: hashToken(raw) } });
    if (!current) throw new UnauthorizedException('Refresh token inválido');

    if (current.revokedAt) {
      this.logger.warn(
        { familyId: current.familyId, userId: current.userId },
        'Reutilización de refresh token detectada',
      );
      await this.revokeFamily(current.familyId);
      throw new UnauthorizedException('Refresh token reutilizado: sesión revocada');
    }
    if (current.expiresAt < new Date()) throw new UnauthorizedException('Refresh token caducado');

    return this.prisma.$transaction(async (tx) => {
      // updateMany con revokedAt: null es atómico: si dos peticiones llegan a la vez, solo una gana
      const { count } = await tx.refreshToken.updateMany({
        where: { id: current.id, revokedAt: null },
        data: { revokedAt: new Date() },
      });
      if (count === 0) throw new UnauthorizedException('Refresh token ya utilizado');

      const next = await this.issue(current.userId, { familyId: current.familyId, userAgent }, tx);
      await tx.refreshToken.update({ where: { id: current.id }, data: { replacedById: next.record.id } });
      return { userId: current.userId, raw: next.raw };
    });
  }

  async revokeFamilyOf(raw: string) {
    const token = await this.prisma.refreshToken.findUnique({ where: { tokenHash: hashToken(raw) } });
    if (token) await this.revokeFamily(token.familyId);
  }

  private revokeFamily(familyId: string) {
    return this.prisma.refreshToken.updateMany({
      where: { familyId, revokedAt: null },
      data: { revokedAt: new Date() },
    });
  }
}
