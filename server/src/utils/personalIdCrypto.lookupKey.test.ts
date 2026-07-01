import { describe, expect, it, vi } from 'vitest';

vi.mock('../config/env', () => ({
  config: { personalIdKey: '' },
}));

import { storedPersonalIdLookupKey } from './personalIdCrypto';

describe('storedPersonalIdLookupKey without PERSONAL_ID_KEY', () => {
  it('returns legacy plaintext digits for cache warm pre-migration', () => {
    expect(storedPersonalIdLookupKey('305347338')).toBe('305347338');
  });
});
