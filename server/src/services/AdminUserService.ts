import { UserRole } from '@prisma/client';
import { prisma } from '../lib/prisma';
import { sanitizeSearchQuery } from '../utils/sanitizeSearchQuery';

export class AdminUserService {
  static async searchUsers(query: string, limit = 20) {
    const q = sanitizeSearchQuery(query);
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

    if (role === UserRole.admin && target.role !== UserRole.admin) {
      console.info(
        `[audit] admin role granted: actor=${actorId} target=${targetUserId} at=${new Date().toISOString()}`
      );
    }

    if (target.role === UserRole.admin && role === UserRole.user) {
      console.info(
        `[audit] admin role revoked: actor=${actorId} target=${targetUserId} at=${new Date().toISOString()}`
      );
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
