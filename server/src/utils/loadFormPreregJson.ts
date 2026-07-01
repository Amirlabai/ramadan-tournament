import fs from 'fs';
import type {
  FormPreregFullEntry,
  FormPreregPartialEntry,
  FormPreregRole,
} from './parseAdigaFormCsv';

type JsonFile = {
  entries?: unknown[];
  full?: unknown[];
  partial?: unknown[];
};

function isFormPreregRole(role: unknown): role is FormPreregRole {
  return role === 'captain' || role === 'goalkeeper' || role === 'player';
}

function isFullEntry(value: unknown): value is FormPreregFullEntry {
  if (!value || typeof value !== 'object') return false;
  const o = value as Record<string, unknown>;
  return (
    typeof o.name === 'string' &&
    typeof o.personalId === 'string' &&
    typeof o.birthYear === 'number' &&
    typeof o.teamName === 'string' &&
    isFormPreregRole(o.role)
  );
}

function isPartialEntry(value: unknown): value is FormPreregPartialEntry {
  if (!value || typeof value !== 'object') return false;
  const o = value as Record<string, unknown>;
  return (
    typeof o.name === 'string' &&
    typeof o.teamName === 'string' &&
    isFormPreregRole(o.role) &&
    (o.adminMissing === 'personal_id' || o.adminMissing === 'birth_year')
  );
}

function validateEntries<T>(
  raw: unknown[],
  guard: (value: unknown) => value is T,
  label: string
): T[] {
  const valid: T[] = [];
  for (let i = 0; i < raw.length; i++) {
    const row = raw[i];
    if (guard(row)) {
      valid.push(row);
    } else {
      console.warn(`[loadFormPreregJson] skip invalid ${label} row index ${i}`);
    }
  }
  return valid;
}

function readJsonEntries(filePath: string, label: string): unknown[] {
  const raw = JSON.parse(fs.readFileSync(filePath, 'utf-8')) as JsonFile;
  if (Array.isArray(raw.entries)) return raw.entries;
  if (Array.isArray(raw.full)) return raw.full;
  if (Array.isArray(raw.partial)) return raw.partial;
  console.warn(`[loadFormPreregJson] no entry array in ${filePath} (${label})`);
  return [];
}

/** Load full + partial prereg rows from parse:prereg JSON dumps. */
export function loadFormPreregFromJson(
  fullPath: string,
  partialPath?: string
): { full: FormPreregFullEntry[]; partial: FormPreregPartialEntry[]; report: [] } {
  const full = validateEntries(
    readJsonEntries(fullPath, 'full'),
    isFullEntry,
    'full'
  );
  let partial: FormPreregPartialEntry[] = [];
  if (partialPath && fs.existsSync(partialPath)) {
    partial = validateEntries(
      readJsonEntries(partialPath, 'partial'),
      isPartialEntry,
      'partial'
    );
  }
  return { full, partial, report: [] };
}

export const DEFAULT_PREREG_JSON = {
  full: 'data/preregistration/adiga-form-entries.json',
  partial: 'data/preregistration/adiga-form-partial.json',
};
