import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { Request, Response } from 'express';

const mockVerifyIdToken = vi.fn();
const mockFindOne = vi.fn();
const mockDeleteById = vi.fn();
const mockSave = vi.fn();
const mockUserConstructor = vi.fn();

vi.mock('google-auth-library', () => ({
  OAuth2Client: vi.fn().mockImplementation(() => ({
    verifyIdToken: mockVerifyIdToken,
  })),
}));

vi.mock('../models/User', () => ({
  User: Object.assign(mockUserConstructor, {
    findOne: mockFindOne,
    deleteById: mockDeleteById,
  }),
}));

vi.mock('../services/TeamRosterService', () => ({
  TeamRosterService: { findTeamWithPlayersById: vi.fn().mockResolvedValue(null) },
}));

vi.mock('../services/RegistrationService', () => ({
  RegistrationService: { getSummary: vi.fn().mockResolvedValue(null) },
}));

vi.mock('../services/emailService', () => ({
  sendVerificationEmail: vi.fn().mockResolvedValue(undefined),
}));

vi.mock('../services/AuthRateLimitService', () => ({
  AuthRateLimitService: { recordFailedVerifyEmail: vi.fn() },
}));

vi.mock('../utils/authCookie', () => ({
  setAuthCookie: vi.fn(),
  authJsonBody: (user: unknown, token: string) => ({ user, token }),
  clearAuthCookie: vi.fn(),
}));

vi.mock('../config/env', () => ({
  config: {
    jwtSecret: 'test-secret',
    corsOrigins: ['https://example.com'],
  },
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
  return { body } as Request;
}

function googlePayload(email: string, sub = 'google-sub-1', emailVerified = true) {
  return {
    email,
    sub,
    name: 'Test User',
    picture: 'https://example.com/photo.jpg',
    email_verified: emailVerified,
  };
}

describe('auth account linking', () => {
  beforeEach(async () => {
    vi.clearAllMocks();
    vi.resetModules();
    mockDeleteById.mockResolvedValue(true);
    mockVerifyIdToken.mockResolvedValue({
      getPayload: () => googlePayload('john.doe@gmail.com'),
    });
    mockUserConstructor.mockImplementation((data: Record<string, unknown>) => ({
      ...data,
      id: undefined,
      save: mockSave.mockImplementation(async function (this: Record<string, unknown>) {
        return { ...this, id: 'new-user-id' };
      }),
    }));
  });

  describe('googleLogin', () => {
    it('links googleId to a verified email/password user', async () => {
      const existing = {
        id: 'user-1',
        email: 'johndoe@gmail.com',
        password: 'hashed',
        googleId: undefined,
        isVerified: true,
        displayName: 'Existing',
        role: 'User',
        save: vi.fn().mockResolvedValue(undefined),
      };
      mockFindOne
        .mockResolvedValueOnce(null)
        .mockResolvedValueOnce(existing);

      const { googleLogin } = await import('../controllers/authController');
      const res = mockRes();
      await googleLogin(mockReq({ token: 'valid-token' }), res);

      expect(res.statusCode).toBe(200);
      expect(existing.googleId).toBe('google-sub-1');
      expect(existing.save).toHaveBeenCalled();
      expect(mockDeleteById).not.toHaveBeenCalled();
    });

    it('removes unverified email squat and creates a Google user', async () => {
      const squatter = {
        id: 'squatter-1',
        email: 'johndoe@gmail.com',
        password: 'hashed',
        googleId: undefined,
        isVerified: false,
      };
      mockFindOne
        .mockResolvedValueOnce(null)
        .mockResolvedValueOnce(squatter);
      mockSave.mockResolvedValue({
        id: 'new-id',
        email: 'johndoe@gmail.com',
        googleId: 'google-sub-1',
        isVerified: true,
        displayName: 'Test User',
        role: 'User',
      });

      const { googleLogin } = await import('../controllers/authController');
      const res = mockRes();
      await googleLogin(mockReq({ token: 'valid-token' }), res);

      expect(mockDeleteById).toHaveBeenCalledWith('squatter-1');
      expect(mockUserConstructor).toHaveBeenCalledWith(
        expect.objectContaining({
          email: 'johndoe@gmail.com',
          googleId: 'google-sub-1',
          isVerified: true,
        }),
      );
      expect(res.statusCode).toBe(200);
    });

    it('rejects Google token when email is not verified by Google', async () => {
      mockVerifyIdToken.mockResolvedValue({
        getPayload: () => googlePayload('john.doe@gmail.com', 'google-sub-1', false),
      });

      const { googleLogin } = await import('../controllers/authController');
      const res = mockRes();
      await googleLogin(mockReq({ token: 'valid-token' }), res);

      expect(res.statusCode).toBe(400);
      expect(res.body).toEqual({ error: 'Google email is not verified' });
      expect(mockFindOne).not.toHaveBeenCalled();
    });

    it('rejects Google token when email_verified is omitted', async () => {
      mockVerifyIdToken.mockResolvedValue({
        getPayload: () => ({
          email: 'john.doe@gmail.com',
          sub: 'google-sub-1',
          name: 'Test User',
        }),
      });

      const { googleLogin } = await import('../controllers/authController');
      const res = mockRes();
      await googleLogin(mockReq({ token: 'valid-token' }), res);

      expect(res.statusCode).toBe(400);
      expect(res.body).toEqual({ error: 'Google email is not verified' });
    });

    it('returns 409 when unverified squat cannot be deleted', async () => {
      mockDeleteById.mockResolvedValue(false);
      mockFindOne
        .mockResolvedValueOnce(null)
        .mockResolvedValueOnce({
          id: 'squatter-1',
          email: 'johndoe@gmail.com',
          isVerified: false,
          googleId: undefined,
        });

      const { googleLogin } = await import('../controllers/authController');
      const res = mockRes();
      await googleLogin(mockReq({ token: 'valid-token' }), res);

      expect(res.statusCode).toBe(409);
      expect(mockUserConstructor).not.toHaveBeenCalled();
    });

    it('creates a verified user for a new Google sign-in', async () => {
      mockFindOne.mockResolvedValue(null);
      mockSave.mockResolvedValue({
        id: 'new-id',
        email: 'johndoe@gmail.com',
        googleId: 'google-sub-1',
        isVerified: true,
        displayName: 'Test User',
        role: 'User',
      });

      const { googleLogin } = await import('../controllers/authController');
      const res = mockRes();
      await googleLogin(mockReq({ token: 'valid-token' }), res);

      expect(res.statusCode).toBe(200);
      expect(mockUserConstructor).toHaveBeenCalledWith(
        expect.objectContaining({
          email: 'johndoe@gmail.com',
          googleId: 'google-sub-1',
          isVerified: true,
        }),
      );
    });

    it('finds user by googleId without creating a duplicate', async () => {
      const existing = {
        id: 'user-google',
        email: 'johndoe@gmail.com',
        googleId: 'google-sub-1',
        isVerified: true,
        displayName: 'Google User',
        role: 'User',
        save: vi.fn(),
      };
      mockFindOne.mockResolvedValueOnce(existing);

      const { googleLogin } = await import('../controllers/authController');
      const res = mockRes();
      await googleLogin(mockReq({ token: 'valid-token' }), res);

      expect(res.statusCode).toBe(200);
      expect(mockFindOne).toHaveBeenCalledTimes(1);
      expect(mockUserConstructor).not.toHaveBeenCalled();
    });
  });

  describe('register', () => {
    it('rejects registration when email belongs to a Google-linked account', async () => {
      mockFindOne.mockResolvedValue({
        id: 'user-google',
        email: 'johndoe@gmail.com',
        googleId: 'google-sub-1',
      });

      const { register } = await import('../controllers/authController');
      const res = mockRes();
      await register(
        mockReq({
          email: 'john.doe@gmail.com',
          password: 'secret12',
          displayName: 'Someone',
        }),
        res,
      );

      expect(res.statusCode).toBe(400);
      expect(res.body).toMatchObject({
        error: expect.stringContaining('Google'),
        useGoogle: true,
      });
      expect(mockUserConstructor).not.toHaveBeenCalled();
    });

    it('rejects duplicate email/password registration', async () => {
      mockFindOne.mockResolvedValue({
        id: 'user-1',
        email: 'user@example.com',
        googleId: undefined,
      });

      const { register } = await import('../controllers/authController');
      const res = mockRes();
      await register(
        mockReq({
          email: 'user@example.com',
          password: 'secret12',
          displayName: 'Someone',
        }),
        res,
      );

      expect(res.statusCode).toBe(400);
      expect(res.body).toEqual({ error: 'Email is already registered' });
    });
  });
});
