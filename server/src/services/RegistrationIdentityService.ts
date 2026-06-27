import { Division, SeasonRegistrationStatus } from '@prisma/client';
import { prisma } from '../lib/prisma';
import { InvoiceRateLimitService, MAX_INVOICE_ATTEMPTS } from './InvoiceRateLimitService';
import { SeasonService } from './SeasonService';
import { INVOICE_ALERT_NOT_MATCHING } from '../utils/invoiceSimilarity';
import {
  encryptPersonalIdForStorage,
  identitiesMatch,
  maskPersonalId,
  normalizePersonalId,
  parseBirthYear,
} from '../utils/personalIdValidation';

const identitySelectFields = {
  status: true,
  invoiceAlert: true,
  userPersonalIdEnc: true,
  userBirthYear: true,
  userPersonalIdMasked: true,
  adminPersonalIdEnc: true,
  adminBirthYear: true,
} as const;

async function assertIdentityUniqueInSeason(
  seasonId: string,
  personalIdEnc: string,
  birthYear: number,
  excludeUserId?: string
): Promise<void> {
  const other = await prisma.seasonRegistration.findFirst({
    where: {
      seasonId,
      ...(excludeUserId ? { userId: { not: excludeUserId } } : {}),
      OR: [
        { adminPersonalIdEnc: personalIdEnc, adminBirthYear: birthYear },
        { userPersonalIdEnc: personalIdEnc, userBirthYear: birthYear },
      ],
    },
    select: { userId: true },
  });
  if (other) {
    throw new Error('תעודת זהות זו כבר נרשמה למשתמש אחר בעונה זו');
  }
}

export async function getIdentityMatchState(userId: string, seasonId: string) {
  const reg = await prisma.seasonRegistration.findUnique({
    where: { userId_seasonId: { userId, seasonId } },
    select: identitySelectFields,
  });

  const hasUserSubmission = !!(reg?.userPersonalIdEnc && reg.userBirthYear != null);
  const hasAdminAssignment = !!(reg?.adminPersonalIdEnc && reg.adminBirthYear != null);
  const matched = identitiesMatch(
    reg?.userPersonalIdEnc,
    reg?.userBirthYear,
    reg?.adminPersonalIdEnc,
    reg?.adminBirthYear
  );

  if (
    reg?.status === SeasonRegistrationStatus.active &&
    !reg.invoiceAlert &&
    hasUserSubmission
  ) {
    return {
      submittedIdentityMasked: reg.userPersonalIdMasked ?? null,
      submittedBirthYear: reg.userBirthYear ?? null,
      assignedBirthYear: reg.adminBirthYear ?? reg.userBirthYear ?? null,
      identityMatched: true,
      hasAdminAssignment,
      hasUserSubmission,
    };
  }

  const identityMatched =
    hasAdminAssignment && hasUserSubmission && matched && !reg?.invoiceAlert;

  return {
    submittedIdentityMasked: reg?.userPersonalIdMasked ?? null,
    submittedBirthYear: reg?.userBirthYear ?? null,
    assignedBirthYear: reg?.adminBirthYear ?? null,
    identityMatched,
    hasAdminAssignment,
    hasUserSubmission,
  };
}

export async function assertMatchedIdentityForApproval(
  userId: string,
  seasonId: string
): Promise<void> {
  const reg = await prisma.seasonRegistration.findUnique({
    where: { userId_seasonId: { userId, seasonId } },
  });
  if (reg?.invoiceAlert) {
    throw new Error(reg.invoiceAlert);
  }
  if (reg?.status === SeasonRegistrationStatus.active && !reg.invoiceAlert) {
    return;
  }

  const state = await getIdentityMatchState(userId, seasonId);

  if (!state.hasAdminAssignment) {
    throw new Error('המנהל טרם רשם תעודת זהות');
  }
  if (!state.hasUserSubmission) {
    throw new Error('המשתמש לא הזין תעודת זהות בפרופיל');
  }
  if (!state.identityMatched) {
    throw new Error('תעודת הזהות או שנת הלידה אינם תואמים');
  }
}

function syncIdentityAlertAfterAdminAssign(
  reg: {
    userPersonalIdEnc: string | null;
    userBirthYear: number | null;
  } | null,
  adminPersonalIdEnc: string,
  adminBirthYear: number
): string | null {
  if (!reg?.userPersonalIdEnc || reg.userBirthYear == null) {
    return null;
  }
  return identitiesMatch(
    reg.userPersonalIdEnc,
    reg.userBirthYear,
    adminPersonalIdEnc,
    adminBirthYear
  )
    ? null
    : INVOICE_ALERT_NOT_MATCHING;
}

export async function tryFinalizeIdentityMatch(
  userId: string,
  seasonId: string,
  division: Division,
  lockActiveDivision: (userId: string, division: Division) => Promise<void>
): Promise<boolean> {
  const reg = await prisma.seasonRegistration.findUnique({
    where: { userId_seasonId: { userId, seasonId } },
    select: identitySelectFields,
  });

  if (!reg?.userPersonalIdEnc || reg.userBirthYear == null) {
    return false;
  }
  if (!reg.adminPersonalIdEnc || reg.adminBirthYear == null) {
    return false;
  }

  const now = new Date();

  if (
    !identitiesMatch(
      reg.userPersonalIdEnc,
      reg.userBirthYear,
      reg.adminPersonalIdEnc,
      reg.adminBirthYear
    )
  ) {
    await prisma.seasonRegistration.upsert({
      where: { userId_seasonId: { userId, seasonId } },
      create: {
        userId,
        seasonId,
        division,
        status: SeasonRegistrationStatus.invoice_assigned,
        invoiceAlert: INVOICE_ALERT_NOT_MATCHING,
      },
      update: {
        invoiceAlert: INVOICE_ALERT_NOT_MATCHING,
        status: SeasonRegistrationStatus.invoice_assigned,
      },
    });
    return false;
  }

  await prisma.seasonRegistration.upsert({
    where: { userId_seasonId: { userId, seasonId } },
    create: {
      userId,
      seasonId,
      division,
      status: SeasonRegistrationStatus.active,
      redeemedAt: now,
      invoiceAlert: null,
    },
    update: {
      status: SeasonRegistrationStatus.active,
      redeemedAt: now,
      invoiceAlert: null,
      division,
    },
  });

  await lockActiveDivision(userId, division);
  return true;
}

export function needsIdentityWorkflowAction(
  status: SeasonRegistrationStatus,
  invoiceAlert: string | null,
  identityMatched: boolean
): boolean {
  if (identityMatched) {
    return false;
  }
  if (status === SeasonRegistrationStatus.active && !invoiceAlert) {
    return false;
  }
  return true;
}

export function hasAdminIdentityOnReg(reg: {
  adminPersonalIdEnc: string | null;
  adminBirthYear: number | null;
} | null): boolean {
  return !!(reg?.adminPersonalIdEnc && reg.adminBirthYear != null);
}

async function recordIdentityAttemptFailure(
  userId: string,
  seasonId: string,
  reason: string
): Promise<never> {
  const attempts = await InvoiceRateLimitService.recordFailedAttempt(userId, seasonId);
  if (attempts >= MAX_INVOICE_ATTEMPTS) {
    throw new Error('נחסמת עד מחר בשל ניסיונות רבים. נסה שוב מחר.');
  }
  const remaining = MAX_INVOICE_ATTEMPTS - attempts;
  throw new Error(`${reason} נותרו ${remaining} ניסיונים היום.`);
}

export async function assignAdminIdentity(
  adminId: string,
  userId: string,
  seasonId: string,
  personalId: string,
  birthYearInput: string | number,
  lockActiveDivision: (userId: string, division: Division) => Promise<void>
): Promise<{ updated: boolean; adminMessage?: string }> {
  void adminId;
  const season = await prisma.season.findUniqueOrThrow({ where: { id: seasonId } });
  const user = await prisma.user.findUniqueOrThrow({ where: { id: userId } });

  if (user.activeDivision && user.activeDivision !== season.division) {
    throw new Error('לא ניתן לרשום זהות לטורניר שונה מהצד שנבחר על ידי המשתמש');
  }

  const normalized = normalizePersonalId(personalId);
  const birthYear = parseBirthYear(birthYearInput);
  const personalIdEnc = encryptPersonalIdForStorage(normalized);

  await assertIdentityUniqueInSeason(seasonId, personalIdEnc, birthYear, userId);

  const existing = await prisma.seasonRegistration.findUnique({
    where: { userId_seasonId: { userId, seasonId } },
    select: identitySelectFields,
  });

  const invoiceAlert = syncIdentityAlertAfterAdminAssign(existing, personalIdEnc, birthYear);
  const hadAdmin = !!(existing?.adminPersonalIdEnc && existing.adminBirthYear != null);

  await prisma.seasonRegistration.upsert({
    where: { userId_seasonId: { userId, seasonId } },
    create: {
      userId,
      seasonId,
      division: season.division,
      status: SeasonRegistrationStatus.invoice_assigned,
      adminPersonalIdEnc: personalIdEnc,
      adminBirthYear: birthYear,
      invoiceAlert,
    },
    update: {
      adminPersonalIdEnc: personalIdEnc,
      adminBirthYear: birthYear,
      status: SeasonRegistrationStatus.invoice_assigned,
      division: season.division,
      invoiceAlert,
    },
  });

  if (!user.activeDivision) {
    await prisma.user.update({
      where: { id: userId },
      data: { activeDivision: season.division },
    });
  }

  const activated = await tryFinalizeIdentityMatch(
    userId,
    seasonId,
    season.division,
    lockActiveDivision
  );

  let adminMessage: string;
  if (activated) {
    adminMessage = 'תעודת הזהות תואמת — הרישום הופעל.';
  } else if (invoiceAlert) {
    adminMessage =
      'תעודת הזהות נרשמה. המשתמש יראה התראה בפרופיל — הפרטים לא תואמים למה שהזין.';
  } else if (hadAdmin) {
    adminMessage = 'תעודת הזהות עודכנה. המשתמש מזין את אותם פרטים בפרופיל.';
  } else {
    adminMessage = 'תעודת הזהות נרשמה. המשתמש מזין את אותם פרטים בפרופיל להפעלה.';
  }

  return { updated: hadAdmin, adminMessage };
}

export async function submitUserIdentity(
  userId: string,
  personalId: string,
  birthYearInput: string | number,
  division: Division,
  deps: {
    assertDivisionAccess: (userId: string, division: Division) => Promise<void>;
    lockActiveDivision: (userId: string, division: Division) => Promise<void>;
  }
): Promise<void> {
  const season = await SeasonService.getActiveSeasonForDivision(division);
  await deps.assertDivisionAccess(userId, division);

  if (await InvoiceRateLimitService.isLocked(userId, season.id)) {
    throw new Error('נחסמת עד מחר בשל ניסיונות רבים. נסה שוב מחר.');
  }

  let normalized: string;
  let birthYear: number;
  try {
    normalized = normalizePersonalId(personalId);
    birthYear = parseBirthYear(birthYearInput);
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'פרטים לא תקינים';
    return recordIdentityAttemptFailure(userId, season.id, msg);
  }

  const personalIdEnc = encryptPersonalIdForStorage(normalized);
  const personalIdMasked = maskPersonalId(normalized);

  const reg = await prisma.seasonRegistration.findUnique({
    where: { userId_seasonId: { userId, seasonId: season.id } },
    select: identitySelectFields,
  });

  const correctingMismatch =
    reg?.status === SeasonRegistrationStatus.active && !!reg.invoiceAlert;

  if (reg?.status === SeasonRegistrationStatus.active && !correctingMismatch) {
    throw new Error('הרישום כבר פעיל לעונה זו');
  }

  if (!correctingMismatch) {
    const onRoster = await prisma.player.findFirst({
      where: { userId, seasonId: season.id, active: true },
    });
    if (onRoster) {
      throw new Error('אתה כבר רשום בסגל לעונה זו');
    }

    const ownedTeam = await prisma.team.findFirst({
      where: { seasonId: season.id, ownerUserId: userId },
    });
    if (ownedTeam) {
      throw new Error('אתה כבר בעל קבוצה לעונה זו');
    }
  }

  try {
    await assertIdentityUniqueInSeason(season.id, personalIdEnc, birthYear, userId);
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'תעודת זהות לא תקינה';
    return recordIdentityAttemptFailure(userId, season.id, msg);
  }

  const hasAdminAssignment = !!(reg?.adminPersonalIdEnc && reg.adminBirthYear != null);
  const now = new Date();

  if (!correctingMismatch && !hasAdminAssignment) {
    await prisma.seasonRegistration.upsert({
      where: { userId_seasonId: { userId, seasonId: season.id } },
      create: {
        userId,
        seasonId: season.id,
        division: season.division,
        status: SeasonRegistrationStatus.awaiting_invoice,
        userPersonalIdEnc: personalIdEnc,
        userBirthYear: birthYear,
        userPersonalIdMasked: personalIdMasked,
        invoiceAlert: null,
      },
      update: {
        status: SeasonRegistrationStatus.awaiting_invoice,
        userPersonalIdEnc: personalIdEnc,
        userBirthYear: birthYear,
        userPersonalIdMasked: personalIdMasked,
        invoiceAlert: null,
        division: season.division,
      },
    });
    await InvoiceRateLimitService.clearAttempts(userId, season.id);
    return;
  }

  const adminEnc = reg?.adminPersonalIdEnc ?? null;
  const adminYear = reg?.adminBirthYear ?? null;

  if (!adminEnc || adminYear == null) {
    throw new Error('ממתין שהמנהל ירשום את תעודת הזהות — פנה למנהל');
  }

  const matches = identitiesMatch(personalIdEnc, birthYear, adminEnc, adminYear);

  if (!matches) {
    await prisma.seasonRegistration.upsert({
      where: { userId_seasonId: { userId, seasonId: season.id } },
      create: {
        userId,
        seasonId: season.id,
        division: season.division,
        status: SeasonRegistrationStatus.invoice_assigned,
        userPersonalIdEnc: personalIdEnc,
        userBirthYear: birthYear,
        userPersonalIdMasked: personalIdMasked,
        invoiceAlert: INVOICE_ALERT_NOT_MATCHING,
      },
      update: {
        status: SeasonRegistrationStatus.invoice_assigned,
        userPersonalIdEnc: personalIdEnc,
        userBirthYear: birthYear,
        userPersonalIdMasked: personalIdMasked,
        invoiceAlert: INVOICE_ALERT_NOT_MATCHING,
        division: season.division,
      },
    });
    return recordIdentityAttemptFailure(userId, season.id, INVOICE_ALERT_NOT_MATCHING);
  }

  await prisma.seasonRegistration.upsert({
    where: { userId_seasonId: { userId, seasonId: season.id } },
    create: {
      userId,
      seasonId: season.id,
      division: season.division,
      status: SeasonRegistrationStatus.active,
      userPersonalIdEnc: personalIdEnc,
      userBirthYear: birthYear,
      userPersonalIdMasked: personalIdMasked,
      adminPersonalIdEnc: adminEnc,
      adminBirthYear: adminYear,
      redeemedAt: now,
      invoiceAlert: null,
    },
    update: {
      status: SeasonRegistrationStatus.active,
      userPersonalIdEnc: personalIdEnc,
      userBirthYear: birthYear,
      userPersonalIdMasked: personalIdMasked,
      redeemedAt: now,
      division: season.division,
      invoiceAlert: null,
    },
  });

  await deps.lockActiveDivision(userId, division);
  await InvoiceRateLimitService.clearAttempts(userId, season.id);
}
