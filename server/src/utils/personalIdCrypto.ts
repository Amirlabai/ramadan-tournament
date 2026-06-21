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

/** Values to match in personalIdEnc (encrypted + legacy plaintext until migrated). */
export function personalIdLookupValues(plain: string): string[] {
  const normalized = plain.trim();
  if (!normalized) return [];
  if (!config.personalIdKey) return [normalized];
  const enc = encryptPersonalId(normalized);
  const values = [enc];
  if (process.env.PERSONAL_ID_MIGRATION_DONE !== '1' && process.env.PERSONAL_ID_MIGRATION_DONE !== 'true') {
    values.push(normalized);
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
