import { describe, expect, it, vi, beforeEach } from 'vitest';
import {
  buildPreregAlertHtmlForTest,
  buildVerificationEmailHtmlForTest,
} from './emailService';

vi.mock('../config/tournamentBranding', () => ({
  tournamentBranding: { displayNameHe: 'גביע העולם אדיגה 2026', sitePublicUrl: 'https://example.com' },
  profileUrl: () => 'https://example.com/profile',
  adminUrl: () => 'https://example.com/admin',
}));

describe('email branding', () => {
  it('verification HTML uses tournament name and not Ramadan', () => {
    const html = buildVerificationEmailHtmlForTest('123456', 'ישראל');
    expect(html).toContain('גביע העולם אדיגה 2026');
    expect(html).not.toContain('רמדאן');
    expect(html).not.toContain("נצ'מאז");
  });

  it('admin-gap email lists missing field without digits', () => {
    const html = buildPreregAlertHtmlForTest('ישראל', {
      type: 'admin_missing',
      field: 'birth_year',
    });
    expect(html).toContain('שנת לידה');
    expect(html).not.toMatch(/\d{9}/);
    expect(html).not.toContain('רמדאן');
  });
});

describe('submitUserIdentity prereg integration', () => {
  beforeEach(() => {
    vi.resetModules();
  });

  it('exports sendAdminGapIdentityEmail', async () => {
    const mod = await import('./emailService');
    expect(typeof mod.sendAdminGapIdentityEmail).toBe('function');
  });
});
