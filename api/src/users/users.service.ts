import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service.js';

/** Campos que se pueden devolver al cliente: nunca passwordHash */
export const publicUserSelect = {
  id: true,
  email: true,
  name: true,
  avatarColor: true,
  createdAt: true,
} as const;

const AVATAR_COLORS = ['#0d9488', '#d97706', '#7c3aed', '#e11d48', '#2563eb', '#65a30d'];

@Injectable()
export class UsersService {
  constructor(private readonly prisma: PrismaService) {}

  findByEmail(email: string) {
    return this.prisma.user.findUnique({ where: { email: email.toLowerCase() } });
  }

  findPublicById(id: string) {
    return this.prisma.user.findUnique({ where: { id }, select: publicUserSelect });
  }

  randomAvatarColor() {
    return AVATAR_COLORS[Math.floor(Math.random() * AVATAR_COLORS.length)]!;
  }
}
