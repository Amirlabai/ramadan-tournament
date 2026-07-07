import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { Request, Response } from 'express';
import crypto from 'crypto';

const mockFindOne = vi.fn();
const mockSave = vi.fn();
const mockSendPasswordResetEmail = vi.fn();
const mockClearAuthCookie = vi.fn();

vi.mock('../models/User', () => ({
  User: {
    findOne: mockFindOne,
  },
}));

vi.mock('../services/emailService', () => ({
  sendVerificationEmail: vi.fn(),
  sendPasswordResetEmail: mockSendPasswordResetEmail,
}));

vi.mock('../services/TeamRosterService', () => ({
  TeamRosterService: { findTeamWithPlayersById: vi.fn().mockResolvedValue(null) },
}));

vi.mock('../services/RegistrationService', () => ({
  RegistrationService: { getSummary: vi.fn().mockResolvedValue(null) },
}));

vi.mock('../services/AuthRateLimitService', () => ({
  AuthRateLimitService: { recordFailedVerifyEmail: vi.fn() },
}));

vi.mock('../utils/authCookie', () => ({
  setAuthCookie: vi.fn(),
  authJsonBody: (user: unknown, token: string) => ({ user, token }),
  clearAuthCookie: mockClearAuthCookie,
}));

vi.mock('../config/env', () => ({
  config: { jwtSecret: 'test-secret' },
}));

vi.mock('../config/tournamentBranding', () => ({
  tournamentBranding: { displayNameHe: 'גביע העולם אדיגה 2026', sitePublicUrl: 'https://example.com' },
  resetPasswordUrl: (token: string) => `https://example.com/reset-password?token=${encodeURIComponent(token)}`,
}));

vi.mock('../services/AnalyticsService', () => ({
  AnalyticsService: { log: vi.fn() },
}));

function mockRes(): Response {
  const res = {
    statusCode: 200,
    body: undefined as unknown,
    status(code: number) {
      this.statusCode = code;
      return this;
    },
    json(payload: unknown) {
      this.body = payload;
      return this;
    },
  };
  return res as unknown as Response;
}

function mockReq(body: Record<string, unknown> = {}): Request {
  return { body, headers: {} } as Request;
}

function hashToken(raw: string): string {
  return crypto.createHash('sha256').update(raw).digest('hex');
}

describe('password reset', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.resetModules();
    mockSave.mockResolvedValue(undefined);
    mockSendPasswordResetEmail.mockResolvedValue(undefined);
  });

  describe('requestPasswordReset', () => {
    it('returns generic success for unknown email without sending mail', async () => {
      mockFindOne.mockReturnValue({
        select: () => Promise.resolve(null),
      });

      const { requestPasswordReset } = await import('./authController');
      const res = mockRes();
      await requestPasswordReset(mockReq({ email: 'missing@example.com' }), res);

      expect(res.statusCode).toBe(200);
      expect((res.body as { message: string }).message).toContain('אם קיים חשבון');
      expect(mockSendPasswordResetEmail).not.toHaveBeenCalled();
    });

    it('returns generic success for Google-only user without sending mail', async () => {
      mockFindOne.mockReturnValue({
        select: () =>
          Promise.resolve({
            email: 'google@example.com',
            displayName: 'Google User',
            googleId: 'g-1',
            password: undefined,
            save: mockSave,
          }),
      });

      const { requestPasswordReset } = await import('./authController');
      const res = mockRes();
      await requestPasswordReset(mockReq({ email: 'google@example.com' }), res);

      expect(res.statusCode).toBe(200);
      expect(mockSendPasswordResetEmail).not.toHaveBeenCalled();
      expect(mockSave).not.toHaveBeenCalled();
    });

    it('sends reset email for password account', async () => {
      const user = {
        email: 'user@example.com',
        displayName: 'Test User',
        password: '$2a$10$hashed',
        save: mockSave,
      };
      mockFindOne.mockReturnValue({
        select: () => Promise.resolve(user),
      });

      const { requestPasswordReset } = await import('./authController');
      const res = mockRes();
      await requestPasswordReset(mockReq({ email: 'user@example.com' }), res);

      expect(res.statusCode).toBe(200);
      expect(mockSave).toHaveBeenCalled();
      expect(user.passwordResetToken).toMatch(/^[a-f0-9]{64}$/);
      expect(user.passwordResetExpires).toBeInstanceOf(Date);
      expect(mockSendPasswordResetEmail).toHaveBeenCalledWith(
        'user@example.com',
        expect.stringContaining('https://example.com/reset-password?token='),
        'Test User'
      );
    });

    it('returns 500 when email send fails', async () => {
      const user = {
        email: 'user@example.com',
        displayName: 'Test User',
        password: '$2a$10$hashed',
        save: mockSave,
      };
      mockFindOne.mockReturnValue({
        select: () => Promise.resolve(user),
      });
      mockSendPasswordResetEmail.mockRejectedValue(new Error('SMTP down'));

      const { requestPasswordReset } = await import('./authController');
      const res = mockRes();
      await requestPasswordReset(mockReq({ email: 'user@example.com' }), res);

      expect(res.statusCode).toBe(500);
      expect((res.body as { error: string }).error).toContain('שליחת האימייל נכשלה');
      expect(mockSave).not.toHaveBeenCalled();
      expect(user.passwordResetToken).toBeUndefined();
    });
  });

  describe('resetPassword', () => {
    it('rejects invalid token', async () => {
      mockFindOne.mockResolvedValue(null);

      const { resetPassword } = await import('./authController');
      const res = mockRes();
      await resetPassword(mockReq({ token: 'bad-token', password: 'newpass1' }), res);

      expect(res.statusCode).toBe(400);
      expect((res.body as { error: string }).error).toContain('קישור האיפוס');
    });

    it('rejects expired token when findOne returns null', async () => {
      const rawToken = 'expired-token';
      mockFindOne.mockImplementation(async (query: Record<string, unknown>) => {
        expect(query.passwordResetToken).toBe(hashToken(rawToken));
        expect(query.passwordResetExpiresAfter).toBeInstanceOf(Date);
        return null;
      });

      const { resetPassword } = await import('./authController');
      const res = mockRes();
      await resetPassword(mockReq({ token: rawToken, password: 'newpass1' }), res);

      expect(res.statusCode).toBe(400);
      expect((res.body as { error: string }).error).toContain('קישור האיפוס');
    });

    it('updates password, clears reset fields, bumps tokenVersion, and clears cookie', async () => {
      const rawToken = 'valid-raw-token';
      const user = {
        password: 'old-hash',
        passwordResetToken: hashToken(rawToken),
        passwordResetExpires: new Date(Date.now() + 60_000),
        tokenVersion: 0,
        save: mockSave,
      };
      mockFindOne.mockResolvedValue(user);

      const { resetPassword } = await import('./authController');
      const res = mockRes();
      await resetPassword(mockReq({ token: rawToken, password: 'newpass1' }), res);

      expect(res.statusCode).toBe(200);
      expect(user.password).not.toBe('old-hash');
      expect(user.passwordResetToken).toBeNull();
      expect(user.passwordResetExpires).toBeNull();
      expect(user.tokenVersion).toBe(1);
      expect(mockSave).toHaveBeenCalled();
      expect(mockClearAuthCookie).toHaveBeenCalledWith(res);
    });

    it('rejects short password', async () => {
      const { resetPassword } = await import('./authController');
      const res = mockRes();
      await resetPassword(mockReq({ token: 'tok', password: '123' }), res);

      expect(res.statusCode).toBe(400);
      expect(mockFindOne).not.toHaveBeenCalled();
    });
  });
});
