import type { Request } from 'express';
import type { Membership } from '../generated/prisma/client.js';

export interface AuthUser {
  id: string;
  email: string;
}

export interface AccessTokenPayload {
  sub: string;
  email: string;
}

/** Lo que los guards van añadiendo a la petición */
export interface AppRequest extends Request {
  user?: AuthUser;
  membership?: Membership;
}
