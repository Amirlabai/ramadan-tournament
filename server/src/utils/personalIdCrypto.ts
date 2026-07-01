import crypto from 'crypto';
import { config } from '../config/env';

function getKey(): Buffer {
  const raw = config.personalIdKey;
  if (!raw) {
    throw new Error('PERSONAL_ID_KEY is required for personal ID encryption');
  }
  const key = Buffer.from(raw, 'base64');
  if (key.length !== 32) {
    throw new Error('PERSONAL_ID_KEY must be 32 bytes (base64-encoded)');
  }
  return key;
}

function ivSubkey(key: Buffer): Buffer {
  return crypto.createHmac('sha256', key).update('rt:pid-iv').digest();
}

/** Deterministic AES-256-GCM — same plaintext yields same ciphertext for DB lookup. */
export function encryptPersonalId(plain: string): string {
  const normalized = plain.trim();
  if (!normalized) return '';
  if (!config.personalIdKey) return normalized;

  const key = getKey();
  const iv = crypto.createHmac('sha256', ivSubkey(key)).update(normalized).digest().subarray(0, 12);
  const cipher = crypto.createCipheriv('aes-256-gcm', key, iv);
  const enc = Buffer.concat([cipher.update(normalized, 'utf8'), cipher.final()]);
  const tag = cipher.getAuthTag();
  return `v1:${Buffer.concat([iv, tag, enc]).toString('base64url')}`;
}

export function isEncryptedPersonalId(value: string): boolean {
  return value.startsWith('v1:');
}

/** Legacy rows stored digits in *_enc columns before PERSONAL_ID_KEY was set. */
export function isLegacyPlaintextPersonalId(value: string): boolean {
  const trimmed = value.trim();
  if (!trimmed || isEncryptedPersonalId(trimmed)) return false;
  return /^\d{5,9}$/.test(trimmed);
}

export type ReEncryptStoredPersonalIdResult =
  | { action: 'skip'; value: null }
  | { action: 'unchanged'; value: string }
  | { action: 'migrate'; value: string };

/** Re-encrypt a stored column value; skips null, v1:, and non-ID shapes. */
export function reEncryptStoredPersonalId(
  value: string | null | undefined
): ReEncryptStoredPersonalIdResult {
  if (!value?.trim()) return { action: 'skip', value: null };
  const trimmed = value.trim();
  if (isEncryptedPersonalId(trimmed)) return { action: 'unchanged', value: trimmed };
  if (!isLegacyPlaintextPersonalId(trimmed)) return { action: 'skip', value: null };
  if (!config.personalIdKey) {
    throw new Error('PERSONAL_ID_KEY is required to migrate legacy plaintext personal IDs');
  }
  return { action: 'migrate', value: encryptPersonalId(trimmed) };
}

/** Normalize a DB-stored personal ID for cache / lookup keys (legacy plaintext → v1 when key set). */
export function storedPersonalIdLookupKey(stored: string): string {
  const trimmed = stored.trim();
  if (!trimmed) return trimmed;
  if (isEncryptedPersonalId(trimmed)) return trimmed;
  if (isLegacyPlaintextPersonalId(trimmed)) {
    if (!config.personalIdKey) return trimmed;
    return encryptPersonalId(trimmed);
  }
  return trimmed;
}

function migrationDone(): boolean {
  return (
    process.env.PERSONAL_ID_MIGRATION_DONE === '1' ||
    process.env.PERSONAL_ID_MIGRATION_DONE === 'true'
  );
}

/** Values to match in personalIdEnc (encrypted + legacy plaintext until migrated). */
export function personalIdLookupValues(plain: string): string[] {
  const digits = plain.trim().split('.')[0].replace(/\D/g, '');
  if (!digits) return [];

  const strictNine = /^\d{9}$/.test(digits);
  const legacyShape = /^\d{5,9}$/.test(digits);
  if (migrationDone() ? !strictNine : !legacyShape) {
    return [];
  }

  if (!config.personalIdKey) return [digits];

  const values: string[] = [];
  if (strictNine) {
    values.push(encryptPersonalId(digits));
  }
  if (!migrationDone()) {
    values.push(digits);
  }
  return [...new Set(values)];
}

export function encryptPersonalIdIfNeeded(value: string | undefined): string | undefined {
  if (!value?.trim()) return undefined;
  if (isEncryptedPersonalId(value)) return value;
  return encryptPersonalId(value);
}

if (require.main === module) {
  process.env.PERSONAL_ID_KEY = process.env.PERSONAL_ID_KEY || Buffer.alloc(32, 7).toString('base64');
  const sample = '123456789';
  const enc = encryptPersonalId(sample);
  if (enc !== encryptPersonalId(sample)) throw new Error('encryptPersonalId must be deterministic');
  if (!isEncryptedPersonalId(enc)) throw new Error('expected v1 prefix');
  console.log('personalIdCrypto self-check ok');
}
