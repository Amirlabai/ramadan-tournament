import { beforeEach, describe, expect, it, vi } from 'vitest';

const { mockTransaction, mockExecuteRaw, mockAggregate } = vi.hoisted(() => ({
  mockTransaction: vi.fn(),
  mockExecuteRaw: vi.fn(),
  mockAggregate: vi.fn(),
}));

vi.mock('../lib/prisma', () => ({
  prisma: {
    $transaction: (fn: (tx: unknown) => Promise<number>) => mockTransaction(fn),
  },
}));

import { getNextMemberId } from './registrationHelpers';

describe('getNextMemberId', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockExecuteRaw.mockResolvedValue(undefined);
    mockAggregate.mockResolvedValue({ _max: { memberId: 120 } });
    mockTransaction.mockImplementation(async (fn: (tx: unknown) => Promise<number>) =>
      fn({
        $executeRaw: mockExecuteRaw,
        player: { aggregate: mockAggregate },
      })
    );
  });

  it('allocates under advisory lock inside a transaction', async () => {
    const id = await getNextMemberId();

    expect(mockTransaction).toHaveBeenCalledTimes(1);
    expect(mockExecuteRaw).toHaveBeenCalled();
    expect(id).toBe(121);
  });
});
