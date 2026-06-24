import { UserRole } from '@prisma/client';
import { prisma } from '../lib/prisma';

export class AdminUserService {
  static async searchUsers(query: string, limit = 20) {
    const q = query.trim().slice(0, 100).replace(/[%_\\]/g, '');
    if (q.length < 2) {
      return [];
    }

    return prisma.user.findMany({
      where: {
        OR: [
          { email: { contains: q, mode: 'insensitive' } },
          { displayName: { contains: q, mode: 'insensitive' } },
          { username: { contains: q, mode: 'insensitive' } },
        ],
      },
      take: limit,
      orderBy: { displayName: 'asc' },
      select: {
        id: true,
        displayName: true,
        email: true,
        username: true,
        role: true,
      },
    });
  }

  static async setUserRole(actorId: string, targetUserId: string, role: UserRole) {
    if (role !== UserRole.admin && role !== UserRole.user) {
      throw new Error('תפקיד לא חוקי');
    }

    const target = await prisma.user.findUnique({ where: { id: targetUserId } });
    if (!target) {
      throw new Error('משתמש לא נמצא');
    }

    if (actorId === targetUserId && role !== UserRole.admin) {
      throw new Error('לא ניתן להסיר הרשאת מנהל מעצמך');
    }

    if (target.role === UserRole.admin && role === UserRole.user) {
      const adminCount = await prisma.user.count({ where: { role: UserRole.admin } });
      if (adminCount <= 1) {
        throw new Error('לא ניתן להסיר את המנהל האחרון במערכת');
      }
    }

    return prisma.user.update({
      where: { id: targetUserId },
      data: { role },
      select: {
        id: true,
        displayName: true,
        email: true,
        username: true,
        role: true,
      },
    });
  }
}
