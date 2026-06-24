import { Response } from 'express';
import { UserRole } from '@prisma/client';
import { AuthRequest } from '../middleware/auth';
import { AdminUserService } from '../services/AdminUserService';
import { isUuid } from '../utils/sanitizeSearchQuery';

export const searchAdminUsers = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const q = String(req.query.q ?? '');
    const users = await AdminUserService.searchUsers(q);
    res.json(users);
  } catch (error) {
    const message = error instanceof Error ? error.message : 'שגיאה בשרת';
    res.status(400).json({ error: message });
  }
};

export const setAdminUserRole = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { role } = req.body as { role?: string };
    if (role !== UserRole.admin && role !== UserRole.user) {
      res.status(400).json({ error: 'תפקיד חייב להיות admin או user' });
      return;
    }

    const targetId = req.params.id;
    if (!isUuid(targetId)) {
      res.status(400).json({ error: 'מזהה משתמש לא תקין' });
      return;
    }

    const user = await AdminUserService.setUserRole(
      req.userId!,
      targetId,
      role as UserRole
    );
    res.json({
      message: 'תפקיד המשתמש עודכן. המשתמש צריך להתחבר מחדש כדי שהשינוי ייכנס לתוקף.',
      user,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'שגיאה בשרת';
    res.status(400).json({ error: message });
  }
};
