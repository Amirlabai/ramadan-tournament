import { beforeEach, describe, expect, it, vi } from 'vitest';

const assertProductionConfirmed = vi.fn();

vi.mock('../../prisma/seedHelpers', () => ({
  assertProductionConfirmed,
}));

vi.mock('../lib/prisma', () => ({
  prisma: {
    user: {
      findMany: vi.fn().mockResolvedValue([]),
    },
    $disconnect: vi.fn(),
  },
}));

describe('runMigrateUserEmails', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.resetModules();
  });

  it('passes argv array (not boolean) to assertProductionConfirmed', async () => {
    const { runMigrateUserEmails } = await import('./migrate-normalize-user-emails');
    await runMigrateUserEmails(['--yes']);
    expect(assertProductionConfirmed).toHaveBeenCalledWith(['--yes']);
  });

  it('skips production guard on dry-run', async () => {
    const { runMigrateUserEmails } = await import('./migrate-normalize-user-emails');
    await runMigrateUserEmails(['--dry-run']);
    expect(assertProductionConfirmed).not.toHaveBeenCalled();
  });
});
