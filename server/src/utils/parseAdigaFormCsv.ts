import { parse } from 'csv-parse/sync';
import {
  findPersonalIdCandidates,
  parseCaptainBirthYear,
  parseFormIdentityField,
  validateBirthYearOnly,
  validateFormIdentity,
  validatePersonalIdOnly,
} from './parseFormIdentityField';

export type FormPreregRole = 'captain' | 'goalkeeper' | 'player';

export type FormPreregFullEntry = {
  name: string;
  email?: string;
  personalId: string;
  birthYear: number;
  teamName: string;
  role: FormPreregRole;
};

export type FormPreregPartialEntry = {
  name: string;
  email?: string;
  personalId?: string;
  birthYear?: number;
  adminMissing: 'personal_id' | 'birth_year';
  teamName: string;
  role: FormPreregRole;
};

export type FormPreregReportRow = {
  teamName: string;
  name: string;
  role: FormPreregRole;
  raw?: string;
  reason: string;
};

export type FormPreregParseResult = {
  full: FormPreregFullEntry[];
  partial: FormPreregPartialEntry[];
  report: FormPreregReportRow[];
};

function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}

function fullKey(personalId: string, birthYear: number): string {
  return `${personalId}:${birthYear}`;
}

function entryEmail(role: FormPreregRole, teamEmail: string): string | undefined {
  if (role !== 'captain' || !teamEmail.trim()) return undefined;
  return normalizeEmail(teamEmail);
}

function processPerson(
  ctx: {
    teamName: string;
    teamEmail: string;
    name: string;
    role: FormPreregRole;
    idRaw: string;
    birthRaw?: string;
    combinedRaw?: string;
  },
  full: FormPreregFullEntry[],
  partial: FormPreregPartialEntry[],
  report: FormPreregReportRow[],
  seenFull: Set<string>
): void {
  const { teamName, teamEmail, name, role } = ctx;
  const email = entryEmail(role, teamEmail);

  if (ctx.combinedRaw !== undefined) {
    const parsed = parseFormIdentityField(ctx.combinedRaw);
    if (!parsed) {
      if (ctx.combinedRaw.trim()) {
        report.push({ teamName, name, role, raw: ctx.combinedRaw, reason: 'unparseable' });
      }
      return;
    }

    if (parsed.partial === 'missing_birth_year' && parsed.personalId) {
      const v = validatePersonalIdOnly(parsed.personalId);
      if (!v.ok) {
        report.push({ teamName, name, role, raw: ctx.combinedRaw, reason: v.reason });
        return;
      }
      partial.push({
        name,
        ...(email ? { email } : {}),
        personalId: v.personalId,
        adminMissing: 'birth_year',
        teamName,
        role,
      });
      return;
    }

    if (parsed.partial === 'missing_id' && parsed.birthYear != null) {
      const v = validateBirthYearOnly(parsed.birthYear);
      if (!v.ok) {
        report.push({ teamName, name, role, raw: ctx.combinedRaw, reason: v.reason });
        return;
      }
      partial.push({
        name,
        ...(email ? { email } : {}),
        birthYear: v.birthYear,
        adminMissing: 'personal_id',
        teamName,
        role,
      });
      return;
    }

    if (parsed.personalId && parsed.birthYear != null) {
      const v = validateFormIdentity(parsed.personalId, parsed.birthYear);
      if (!v.ok) {
        report.push({ teamName, name, role, raw: ctx.combinedRaw, reason: v.reason });
        return;
      }
      const key = fullKey(v.personalId, v.birthYear);
      if (seenFull.has(key)) {
        report.push({ teamName, name, role, raw: ctx.combinedRaw, reason: 'duplicate' });
        return;
      }
      seenFull.add(key);
      full.push({
        name,
        ...(email ? { email } : {}),
        personalId: v.personalId,
        birthYear: v.birthYear,
        teamName,
        role,
      });
    }
    return;
  }

  const birthYear = ctx.birthRaw ? parseCaptainBirthYear(ctx.birthRaw) : null;
  const idCandidates = ctx.idRaw.trim() ? parseFormIdentityField(ctx.idRaw) : null;
  const personalIdFromCol =
    idCandidates?.personalId ??
    (ctx.idRaw.trim() ? findPersonalIdCandidates(ctx.idRaw)[0] : undefined) ??
    null;

  if (!personalIdFromCol && birthYear == null) {
    if (ctx.idRaw.trim() || ctx.birthRaw?.trim()) {
      report.push({
        teamName,
        name,
        role,
        raw: `${ctx.idRaw} | ${ctx.birthRaw ?? ''}`,
        reason: 'unparseable',
      });
    }
    return;
  }

  if (personalIdFromCol && birthYear == null) {
    const v = validatePersonalIdOnly(personalIdFromCol);
    if (!v.ok) {
      report.push({ teamName, name, role, reason: v.reason });
      return;
    }
    partial.push({
      name,
      ...(email ? { email } : {}),
      personalId: v.personalId,
      adminMissing: 'birth_year',
      teamName,
      role,
    });
    return;
  }

  if (!personalIdFromCol && birthYear != null) {
    const v = validateBirthYearOnly(birthYear);
    if (!v.ok) {
      report.push({ teamName, name, role, reason: v.reason });
      return;
    }
    partial.push({
      name,
      ...(email ? { email } : {}),
      birthYear: v.birthYear,
      adminMissing: 'personal_id',
      teamName,
      role,
    });
    return;
  }

  if (personalIdFromCol && birthYear != null) {
    const v = validateFormIdentity(personalIdFromCol, birthYear);
    if (!v.ok) {
      report.push({ teamName, name, role, reason: v.reason });
      return;
    }
    const key = fullKey(v.personalId, v.birthYear);
    if (seenFull.has(key)) {
      report.push({ teamName, name, role, reason: 'duplicate' });
      return;
    }
    seenFull.add(key);
    full.push({
      name,
      ...(email ? { email } : {}),
      personalId: v.personalId,
      birthYear: v.birthYear,
      teamName,
      role,
    });
  }
}

function parseCaptainId(raw: string): string | null {
  const candidates = findPersonalIdCandidates(raw);
  return candidates[0] ?? null;
}

export function parseAdigaFormCsvRecords(rows: Record<string, string>[]): FormPreregParseResult {
  const full: FormPreregFullEntry[] = [];
  const partial: FormPreregPartialEntry[] = [];
  const report: FormPreregReportRow[] = [];
  const seenFull = new Set<string>();

  for (const row of rows) {
    const teamName = (row['שם קבוצה'] || '').trim();
    const teamEmail = (row['מייל קבוצה'] || '').trim();
    const captainName = (row['ראש קבוצה שם מלא'] || '').trim();
    const captainIdRaw = (row['מס ת"ז ראש קבוצה'] || row['מס ת""ז ראש קבוצה'] || '').trim();
    const captainBirthRaw = (row['שנת לידה ראש קבוצה'] || '').trim();

    if (captainName) {
      if (captainBirthRaw) {
        const captainId = parseCaptainId(captainIdRaw) ?? captainIdRaw;
        processPerson(
          {
            teamName,
            teamEmail,
            name: captainName,
            role: 'captain',
            idRaw: captainId,
            birthRaw: captainBirthRaw,
          },
          full,
          partial,
          report,
          seenFull
        );
      } else if (captainIdRaw) {
        processPerson(
          {
            teamName,
            teamEmail,
            name: captainName,
            role: 'captain',
            idRaw: '',
            combinedRaw: captainIdRaw,
          },
          full,
          partial,
          report,
          seenFull
        );
      }
    }

    const gkName = (row['שם שוער'] || '').trim();
    const gkCombined = (row['מס ת"ז שוער ושנת לידה'] || row['מס ת""ז שוער ושנת לידה'] || '').trim();
    if (gkName && gkCombined) {
      processPerson(
        { teamName, teamEmail, name: gkName, role: 'goalkeeper', idRaw: '', combinedRaw: gkCombined },
        full,
        partial,
        report,
        seenFull
      );
    }

    for (let n = 1; n <= 12; n++) {
      const name = (row[`שם שחקן ${n}`] || row[`שם שחקן ${n} `] || '').trim();
      const combined =
        (row[`מס ת"ז שחקן ${n} ושנת לידה`] ||
          row[`מס ת""ז שחקן ${n} ושנת לידה`] ||
          row[`מס ת"ז שחקן ${n} ושנת לידה `] ||
          '').trim();
      if (name && combined) {
        processPerson(
          { teamName, teamEmail, name, role: 'player', idRaw: '', combinedRaw: combined },
          full,
          partial,
          report,
          seenFull
        );
      }
    }
  }

  return { full, partial, report };
}

export function parseAdigaFormCsvContent(content: string): FormPreregParseResult {
  const rows = parse(content, {
    columns: true,
    skip_empty_lines: true,
    relax_column_count: true,
    bom: true,
  }) as Record<string, string>[];
  return parseAdigaFormCsvRecords(rows);
}
