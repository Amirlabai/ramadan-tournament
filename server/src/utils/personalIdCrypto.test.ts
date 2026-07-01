import { afterEach, beforeEach, describe, expect, it } from 'vitest';

describe('personalIdCrypto migration helpers', () => {
  const sampleKey = Buffer.alloc(32, 9).toString('base64');

  beforeEach(() => {
    process.env.PERSONAL_ID_KEY = sampleKey;
  });

  afterEach(() => {
    delete process.env.PERSONAL_ID_KEY;
    delete process.env.PERSONAL_ID_MIGRATION_DONE;
  });

  it('detects legacy plaintext IDs', async () => {
    const { isLegacyPlaintextPersonalId, isEncryptedPersonalId } = await import('./personalIdCrypto');
    expect(isLegacyPlaintextPersonalId('305347338')).toBe(true);
    expect(isLegacyPlaintextPersonalId('12345')).toBe(true);
    expect(isLegacyPlaintextPersonalId('v1:abc')).toBe(false);
    expect(isEncryptedPersonalId('v1:abc')).toBe(true);
    expect(isLegacyPlaintextPersonalId('not-an-id')).toBe(false);
  });

  it('reEncryptStoredPersonalId migrates plaintext to v1', async () => {
    const { reEncryptStoredPersonalId, isEncryptedPersonalId } = await import('./personalIdCrypto');
    const result = reEncryptStoredPersonalId('305347338');
    expect(result.action).toBe('migrate');
    if (result.action === 'migrate') {
      expect(isEncryptedPersonalId(result.value)).toBe(true);
      expect(reEncryptStoredPersonalId(result.value).action).toBe('unchanged');
    }
  });

  it('storedPersonalIdLookupKey normalizes legacy values when key is set', async () => {
    const { storedPersonalIdLookupKey, encryptPersonalId } = await import('./personalIdCrypto');
    expect(storedPersonalIdLookupKey('305347338')).toBe(encryptPersonalId('305347338'));
    const enc = encryptPersonalId('302841119');
    expect(storedPersonalIdLookupKey(enc)).toBe(enc);
  });
});
