import { describe, expect, it, vi, beforeEach } from 'vitest';
import {
  buildPreregAlertHtmlForTest,
  buildVerificationEmailHtmlForTest,
  buildPasswordResetEmailHtmlForTest,
} from './emailService';

vi.mock('../config/tournamentBranding', () => ({
  tournamentBranding: { displayNameHe: 'גביע העולם אדיגה 2026', sitePublicUrl: 'https://example.com' },
  profileUrl: () => 'https://example.com/profile',
  adminUrl: () => 'https://example.com/admin',
  resetPasswordUrl: (token: string) => `https://example.com/reset-password?token=${encodeURIComponent(token)}`,
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

  it('password reset HTML uses tournament name and reset URL', () => {
    const resetUrl = 'https://example.com/reset-password?token=abc123';
    const html = buildPasswordResetEmailHtmlForTest(resetUrl, 'ישראל');
    expect(html).toContain('גביע העולם אדיגה 2026');
    expect(html).toContain(resetUrl);
    expect(html).not.toContain('רמדאן');
  });

  it('password reset HTML escapes displayName', () => {
    const html = buildPasswordResetEmailHtmlForTest('https://example.com/reset', '<script>alert(1)</script>');
    expect(html).not.toContain('<script>');
    expect(html).toContain('&lt;script&gt;');
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
