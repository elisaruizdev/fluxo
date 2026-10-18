import {
  Body,
  Controller,
  Get,
  Headers,
  HttpCode,
  NotFoundException,
  Post,
  Req,
  Res,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { ApiBearerAuth, ApiCookieAuth, ApiTags } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import type { CookieOptions, Request, Response } from 'express';
import { CurrentUser, Public } from '../common/decorators.js';
import type { AuthUser } from '../common/types.js';
import type { Env } from '../config/env.js';
import { UsersService } from '../users/users.service.js';
import { AuthService, type Session } from './auth.service.js';
import { LoginDto, RegisterDto } from './dto.js';
import { RefreshTokenService } from './refresh-token.service.js';

export const REFRESH_COOKIE = 'fluxo_rt';

// Límite más estricto que el global: frena fuerza bruta contra el login
const AUTH_THROTTLE = { default: { limit: 10, ttl: 60_000 } };

@ApiTags('auth')
@Controller('auth')
export class AuthController {
  private readonly cookieOptions: CookieOptions;

  constructor(
    private readonly auth: AuthService,
    private readonly users: UsersService,
    refreshTokens: RefreshTokenService,
    config: ConfigService<Env, true>,
  ) {
    // httpOnly: el JS de la página no puede leerla (a salvo de XSS).
    // path: el navegador solo la envía a /api/auth, no en cada petición.
    this.cookieOptions = {
      httpOnly: true,
      secure: config.get('NODE_ENV', { infer: true }) === 'production',
      sameSite: 'strict',
      path: '/api/auth',
      maxAge: refreshTokens.maxAgeMs,
    };
  }

  @Public()
  @Throttle(AUTH_THROTTLE)
  @Post('register')
  async register(
    @Body() dto: RegisterDto,
    @Headers('user-agent') ua: string,
    @Res({ passthrough: true }) res: Response,
  ) {
    return this.respond(await this.auth.register(dto, ua), res);
  }

  @Public()
  @Throttle(AUTH_THROTTLE)
  @HttpCode(200)
  @Post('login')
  async login(@Body() dto: LoginDto, @Headers('user-agent') ua: string, @Res({ passthrough: true }) res: Response) {
    return this.respond(await this.auth.login(dto, ua), res);
  }

  @Public()
  @ApiCookieAuth(REFRESH_COOKIE)
  @HttpCode(200)
  @Post('refresh')
  async refresh(@Req() req: Request, @Headers('user-agent') ua: string, @Res({ passthrough: true }) res: Response) {
    const raw = req.cookies?.[REFRESH_COOKIE] as string | undefined;
    if (!raw) throw new UnauthorizedException('Falta el refresh token');
    try {
      return this.respond(await this.auth.refresh(raw, ua), res);
    } catch (e) {
      res.clearCookie(REFRESH_COOKIE, { ...this.cookieOptions, maxAge: undefined });
      throw e;
    }
  }

  @Public()
  @HttpCode(204)
  @Post('logout')
  async logout(@Req() req: Request, @Res({ passthrough: true }) res: Response) {
    const raw = req.cookies?.[REFRESH_COOKIE] as string | undefined;
    if (raw) await this.auth.logout(raw);
    res.clearCookie(REFRESH_COOKIE, { ...this.cookieOptions, maxAge: undefined });
  }

  @ApiBearerAuth()
  @Get('me')
  async me(@CurrentUser() user: AuthUser) {
    const found = await this.users.findPublicById(user.id);
    if (!found) throw new NotFoundException();
    return found;
  }

  /** El refresh token va en cookie; el access token en el body (el front lo guarda en memoria) */
  private respond({ refreshToken, ...session }: Session, res: Response) {
    res.cookie(REFRESH_COOKIE, refreshToken, this.cookieOptions);
    return session;
  }
}
