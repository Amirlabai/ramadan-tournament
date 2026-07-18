import { Response } from 'express';
import { Division } from '@prisma/client';
import { AuthRequest } from '../middleware/auth';
import { RegistrationService } from '../services/RegistrationService';
import { parsePositiveTeamId } from '../utils/inputValidation';
import { isUuid } from '../utils/sanitizeSearchQuery';

function parseDivisionParam(raw: unknown): Division {
  if (raw === 'girls') return Division.girls;
  if (raw === 'boys' || raw === undefined || raw === null || raw === '') {
    return Division.boys;
  }
  throw new Error('חטיבה לא תקינה');
}

function rejectInvalidUuid(res: Response, label: string): boolean {
  res.status(400).json({ error: `${label} לא תקין` });
  return false;
}

function requireUuid(res: Response, value: string | undefined, label: string): value is string {
  if (!value || !isUuid(value)) {
    rejectInvalidUuid(res, label);
    return false;
  }
  return true;
}

export const searchIdentityUsers = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const seasonId = req.query.seasonId as string | undefined;
    const q = (req.query.q as string) || '';
    if (!seasonId || !isUuid(seasonId)) {
      res.status(400).json({ error: 'seasonId לא תקין' });
      return;
    }
    const users = await RegistrationService.searchUsersForIdentity(seasonId, q);
    res.json({ users });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'שגיאה בשרת';
    res.status(400).json({ error: message });
  }
};

export const listWorkflowQueues = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const seasonId = req.query.seasonId as string | undefined;
    if (seasonId && !isUuid(seasonId)) {
      res.status(400).json({ error: 'seasonId לא תקין' });
      return;
    }
    const data = await RegistrationService.listPendingWorkflows(seasonId);
    res.json(data);
  } catch (error) {
    const message = error instanceof Error ? error.message : 'שגיאה בשרת';
    res.status(400).json({ error: message });
  }
};

export const getWorkflowPendingCount = async (_req: AuthRequest, res: Response): Promise<void> => {
  try {
    const data = await RegistrationService.countPendingAdminActions();
    res.json(data);
  } catch (error) {
    const message = error instanceof Error ? error.message : 'שגיאה בשרת';
    res.status(400).json({ error: message });
  }
};

export const assignUserIdentity = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { userId, seasonId, personalId, birthYear } = req.body as {
      userId?: string;
      seasonId?: string;
      personalId?: string;
      birthYear?: string | number;
    };
    if (
      !userId ||
      !seasonId ||
      !personalId?.trim() ||
      birthYear === undefined ||
      birthYear === null ||
      String(birthYear).trim() === ''
    ) {
      res.status(400).json({ error: 'userId, seasonId, תעודת זהות ושנת לידה נדרשים' });
      return;
    }
    if (!requireUuid(res, userId, 'userId') || !requireUuid(res, seasonId, 'seasonId')) {
      return;
    }
    const result = await RegistrationService.assignAdminIdentity(
      req.userId!,
      userId,
      seasonId,
      personalId.trim(),
      birthYear
    );
    res.json({
      message: result.adminMessage ?? 'תעודת הזהות נרשמה.',
      updated: result.updated,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'שגיאה בשרת';
    res.status(400).json({ error: message });
  }
};

export const reviewCreationRequest = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    if (!requireUuid(res, req.params.id, 'מזהה בקשה')) {
      return;
    }
    const { approve } = req.body as { approve?: boolean };
    const team = await RegistrationService.approveTeamCreation(req.params.id, approve === true);
    res.json({
      message: approve ? 'הקבוצה נוצרה' : 'הבקשה נדחתה',
      team,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'שגיאה בשרת';
    res.status(400).json({ error: message });
  }
};

export const reviewJoinRequest = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    if (!requireUuid(res, req.params.id, 'מזהה בקשה')) {
      return;
    }
    const { approve } = req.body as { approve?: boolean };
    await RegistrationService.adminReviewJoin(req.params.id, req.userId!, approve === true);
    res.json({ message: approve ? 'השחקן נוסף לסגל' : 'הבקשה נדחתה' });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'שגיאה בשרת';
    res.status(400).json({ error: message });
  }
};

export const reviewTransferRequest = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    if (!requireUuid(res, req.params.id, 'מזהה בקשה')) {
      return;
    }
    const { approve } = req.body as { approve?: boolean };
    await RegistrationService.adminReviewTransfer(req.params.id, req.userId!, approve === true);
    res.json({ message: approve ? 'ההעברה בוצעה' : 'הבקשה נדחתה' });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'שגיאה בשרת';
    res.status(400).json({ error: message });
  }
};

export const listCaptainCandidates = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const teamId = parsePositiveTeamId(req.params.teamId);
    const division = parseDivisionParam(req.query.division);
    const data = await RegistrationService.listCaptainCandidates(teamId, division);
    res.json(data);
  } catch (error) {
    const message = error instanceof Error ? error.message : 'שגיאה בשרת';
    res.status(400).json({ error: message });
  }
};

export const setTeamCaptain = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const teamId = parsePositiveTeamId(req.params.teamId);
    const division = parseDivisionParam(
      (req.body as { division?: unknown })?.division ?? req.query.division
    );
    const rawMemberId = (req.body as { memberId?: string | number })?.memberId;
    if (rawMemberId === undefined || rawMemberId === null || String(rawMemberId).trim() === '') {
      res.status(400).json({ error: 'יש לבחור שחקן' });
      return;
    }
    const memberId = Number.parseInt(String(rawMemberId).trim(), 10);
    if (!Number.isInteger(memberId) || memberId < 1) {
      res.status(400).json({ error: 'מזהה שחקן לא תקין' });
      return;
    }
    const result = await RegistrationService.adminSetCaptain(teamId, division, memberId);
    res.json(result);
  } catch (error) {
    const message = error instanceof Error ? error.message : 'שגיאה בשרת';
    res.status(400).json({ error: message });
  }
};
