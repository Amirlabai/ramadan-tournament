import { describe, expect, it, vi, beforeEach } from 'vitest';
import { prismaUserToIUser } from './userMapper';

const mockUpdate = vi.fn();

vi.mock('../lib/prisma', () => ({
  prisma: {
    user: {
      update: (...args: unknown[]) => mockUpdate(...args),
    },
  },
}));

describe('userMapper save', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockUpdate.mockImplementation(({ data }: { data: Record<string, unknown> }) => ({
      id: 'user-1',
      username: null,
      email: 'user@example.com',
      password: 'hash',
      googleId: null,
      displayName: 'Test',
      avatarUrl: null,
      googlePictureUrl: null,
      role: 'user',
      activeDivision: null,
      isVerified: true,
      verificationToken: data.verificationToken ?? null,
      verificationTokenExpires: data.verificationTokenExpires ?? null,
      passwordResetToken: data.passwordResetToken ?? null,
      passwordResetExpires: data.passwordResetExpires ?? null,
      tokenVersion: data.tokenVersion ?? 0,
      mappedPlayerInfo: null,
      playerProfile: null,
      pendingTeamRequest: null,
      createdAt: new Date(),
      updatedAt: new Date(),
    }));
  });

  it('writes null to clear password reset fields after successful reset', async () => {
    const user = prismaUserToIUser({
      id: 'user-1',
      username: null,
      email: 'user@example.com',
      password: 'hash',
      googleId: null,
      displayName: 'Test',
      avatarUrl: null,
      googlePictureUrl: null,
      role: 'user',
      activeDivision: null,
      isVerified: true,
      verificationToken: null,
      verificationTokenExpires: null,
      passwordResetToken: 'abc123',
      passwordResetExpires: new Date(),
      tokenVersion: 0,
      mappedPlayerInfo: null,
      playerProfile: null,
      pendingTeamRequest: null,
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    user.passwordResetToken = null;
    user.passwordResetExpires = null;
    user.tokenVersion = 1;
    await user.save();

    expect(mockUpdate).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          passwordResetToken: null,
          passwordResetExpires: null,
          tokenVersion: 1,
        }),
      })
    );
  });
});
