import { Response } from 'express';
import { Division, SquadRole } from '@prisma/client';
import { AuthRequest } from '../middleware/auth';
import { getRequestDivision, TournamentRequest } from '../middleware/tournamentDivision';
import { RegistrationService } from '../services/RegistrationService';
import type { JoinRequestOptions } from '../services/RegistrationService';
import { parsePositiveTeamId } from '../utils/inputValidation';
import { isUuid } from '../utils/sanitizeSearchQuery';
import { AnalyticsService } from '../services/AnalyticsService';
import { IdentitySubmissionError } from '../services/RegistrationIdentityService';

const logRegistrationEvent = (
  eventName: string,
  properties?: Record<string, unknown>
) => {
  AnalyticsService.log({
    eventName,
    category: 'registration',
    source: 'server',
    properties,
  });
};

function logIdentityOutcome(division: Division, error: unknown): void {
  if (error instanceof IdentitySubmissionError) {
    if (error.analyticsCode === 'rate_limited') {
      logRegistrationEvent('identity_rate_limited', { division });
      return;
    }
    if (error.analyticsCode === 'mismatch') {
      logRegistrationEvent('identity_mismatch', { division });
      return;
    }
    if (error.analyticsCode === 'validation') {
      logRegistrationEvent('identity_validation_failed', { division });
    }
    return;
  }
  if (error instanceof Error) {
    logRegistrationEvent('identity_submit_failed', { division, reason: 'rejected' });
  }
}

function divisionFromQuery(req: TournamentRequest): Division {
  const q = req.query.division as string | undefined;
  if (q === 'girls') return Division.girls;
  return getRequestDivision(req);
}

export const getRegistrationStatus = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const division = divisionFromQuery(req as TournamentRequest);
    const summary = await RegistrationService.getSummary(req.userId!, division);
    res.json(summary);
  } catch (error) {
    const message = error instanceof Error ? error.message : 'שגיאה בשרת';
    res.status(400).json({ error: message });
  }
};

export const verifyIdentity = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { personalId, birthYear } = req.body as {
      personalId?: string;
      birthYear?: string | number;
    };
    const division = divisionFromQuery(req as TournamentRequest);

    if (
      !personalId?.trim() ||
      birthYear === undefined ||
      birthYear === null ||
      String(birthYear).trim() === ''
    ) {
      res.status(400).json({ error: 'תעודת זהות ושנת לידה נדרשים' });
      return;
    }

    await RegistrationService.submitUserIdentity(
      req.userId!,
      personalId.trim(),
      birthYear,
      division
    );
    const summary = await RegistrationService.getSummary(req.userId!, division);
    if (summary.invoiceAlert) {
      logRegistrationEvent('identity_mismatch', { division });
    } else {
      logRegistrationEvent('identity_submitted', { division, status: summary.status });
    }
    res.json({ message: 'פרטי הזהות נשמרו בהצלחה', registration: summary });
  } catch (error) {
    logIdentityOutcome(divisionFromQuery(req as TournamentRequest), error);
    const message = error instanceof Error ? error.message : 'שגיאה בשרת';
    res.status(400).json({ error: message });
  }
};

export const cancelRegistrationRequest = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const division = divisionFromQuery(req as TournamentRequest);
    const summary = await RegistrationService.cancelPendingRegistrationRequest(
      req.userId!,
      division
    );
    res.json({ message: 'הבקשה בוטלה', registration: summary });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'שגיאה בשרת';
    res.status(400).json({ error: message });
  }
};

export const submitTeamCreation = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { teamName, description } = req.body as { teamName?: string; description?: string };
    const division = divisionFromQuery(req as TournamentRequest);
    const request = await RegistrationService.submitTeamCreation(
      req.userId!,
      division,
      String(teamName ?? ''),
      String(description ?? '')
    );
    logRegistrationEvent('team_creation_submitted', { division });
    res.json({ message: 'בקשת הקמת קבוצה נשלחה', request });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'שגיאה בשרת';
    res.status(400).json({ error: message });
  }
};

export const submitJoinRequest = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const teamId = parsePositiveTeamId(req.params.id);
    const division = divisionFromQuery(req as TournamentRequest);
    const body = req.body as {
      memberId?: number | string;
      playerProfile?: JoinRequestOptions['playerProfile'];
    };
    const memberId =
      body.memberId != null && String(body.memberId).trim() !== ''
        ? Number(body.memberId)
        : undefined;
    const request = await RegistrationService.submitJoinRequest(req.userId!, division, teamId, {
      memberId: Number.isInteger(memberId) && memberId! > 0 ? memberId : undefined,
      playerProfile: body.playerProfile,
    });
    logRegistrationEvent('join_request_submitted', { division, teamId });
    res.json({ message: 'בקשת הצטרפות נשלחה', request });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'שגיאה בשרת';
    res.status(400).json({ error: message });
  }
};

export const submitTransferRequest = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { toTeamId } = req.body as { toTeamId?: number | string };
    if (toTeamId === undefined || toTeamId === null || String(toTeamId).trim() === '') {
      res.status(400).json({ error: 'יעד העברה נדרש' });
      return;
    }
    const teamId = parsePositiveTeamId(toTeamId);
    const division = divisionFromQuery(req as TournamentRequest);
    const request = await RegistrationService.submitTransfer(
      req.userId!,
      division,
      teamId
    );
    res.json({ message: 'בקשת העברה נשלחה', request });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'שגיאה בשרת';
    res.status(400).json({ error: message });
  }
};

export const listOwnerJoinRequests = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const teamId = parsePositiveTeamId(req.params.id);
    const division = divisionFromQuery(req as TournamentRequest);
    const rows = await RegistrationService.listPendingJoinsForOwner(
      req.userId!,
      teamId,
      division
    );
    res.json(rows);
  } catch (error) {
    const message = error instanceof Error ? error.message : 'שגיאה בשרת';
    res.status(400).json({ error: message });
  }
};

export const listAvailableTeams = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const division = divisionFromQuery(req as TournamentRequest);
    const teams = await RegistrationService.listAvailableTeams(division);
    res.json(teams);
  } catch (error) {
    const message = error instanceof Error ? error.message : 'שגיאה בשרת';
    res.status(400).json({ error: message });
  }
};

export const ownerReviewJoin = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { requestId, approve } = req.body as { requestId?: string; approve?: boolean };
    if (!requestId || !isUuid(requestId)) {
      res.status(400).json({ error: 'מזהה בקשה לא תקין' });
      return;
    }
    await RegistrationService.ownerReviewJoin(req.userId!, requestId, approve === true);
    res.json({ message: approve ? 'הבקשה אושרה על ידי הבעלים' : 'הבקשה נדחתה' });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'שגיאה בשרת';
    res.status(400).json({ error: message });
  }
};

export const setSquadRoles = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const teamId = parsePositiveTeamId(req.params.id);
    const { roles } = req.body as { roles?: { memberId: number; squadRole: string | null }[] };
    const division = divisionFromQuery(req as TournamentRequest);
    const parsed = (roles ?? []).map((r) => ({
      memberId: r.memberId,
      squadRole:
        r.squadRole && (Object.values(SquadRole) as string[]).includes(r.squadRole)
          ? (r.squadRole as SquadRole)
          : null,
    }));
    await RegistrationService.setSquadRoles(req.userId!, teamId, division, parsed);
    res.json({ message: 'תפקידי הסגל עודכנו' });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'שגיאה בשרת';
    res.status(400).json({ error: message });
  }
};

export const addSelfToRoster = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const teamId = parsePositiveTeamId(req.params.id);
    const division = divisionFromQuery(req as TournamentRequest);
    const memberId = await RegistrationService.addOwnerToRoster(req.userId!, teamId, division);
    res.json({ message: 'נוספת לסגל בהצלחה', memberId });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'שגיאה בשרת';
    res.status(400).json({ error: message });
  }
};
