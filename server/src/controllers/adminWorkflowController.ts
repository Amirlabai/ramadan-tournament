import { Response } from 'express';
import { AuthRequest } from '../middleware/auth';
import { RegistrationService } from '../services/RegistrationService';
import { INVOICE_CODE_MAX_LEN } from '../utils/inputValidation';
import { isUuid } from '../utils/sanitizeSearchQuery';

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

export const searchInvoiceUsers = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const seasonId = req.query.seasonId as string | undefined;
    const q = (req.query.q as string) || '';
    if (!seasonId || !isUuid(seasonId)) {
      res.status(400).json({ error: 'seasonId לא תקין' });
      return;
    }
    const users = await RegistrationService.searchUsersForInvoice(seasonId, q);
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

export const assignUserInvoice = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { userId, seasonId, invoiceNumber } = req.body as {
      userId?: string;
      seasonId?: string;
      invoiceNumber?: string;
    };
    if (!userId || !seasonId || !invoiceNumber?.trim()) {
      res.status(400).json({ error: 'userId, seasonId ומספר חשבונית נדרשים' });
      return;
    }
    if (!requireUuid(res, userId, 'userId') || !requireUuid(res, seasonId, 'seasonId')) {
      return;
    }
    const codeStr = invoiceNumber.trim();
    if (codeStr.length > INVOICE_CODE_MAX_LEN) {
      res.status(400).json({ error: 'מספר חשבונית ארוך מדי' });
      return;
    }
    const result = await RegistrationService.assignInvoice(
      req.userId!,
      userId,
      seasonId,
      codeStr
    );
    res.json({
      message:
        result.adminMessage ??
        (result.updated
          ? 'מספר החשבונית עודכן. המשתמש מזין את המספר המתוקן בפרופיל.'
          : 'מספר החשבונית הוקצה. המשתמש מזין את אותו מספר בפרופיל להפעלה.'),
      invoiceNumber: result.invoiceNumber,
      updated: result.updated,
      verifyOnly: result.verifyOnly ?? false,
      match: result.match,
      userAlertSet: result.userAlertSet ?? false,
      similarToUser: result.similarToUser,
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
