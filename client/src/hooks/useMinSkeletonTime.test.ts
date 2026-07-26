import { describe, expect, it } from 'vitest';
import {
  remainingSkeletonHoldMs,
  SKELETON_MIN_MS,
} from './useMinSkeletonTime';

describe('remainingSkeletonHoldMs', () => {
  it('holds full minMs when skeleton just shown', () => {
    const shownAt = 1_000;
    expect(remainingSkeletonHoldMs(shownAt, shownAt, SKELETON_MIN_MS)).toBe(
      SKELETON_MIN_MS,
    );
  });

  it('counts down while skeleton has been visible', () => {
    const shownAt = 1_000;
    expect(remainingSkeletonHoldMs(shownAt, shownAt + 80, SKELETON_MIN_MS)).toBe(
      SKELETON_MIN_MS - 80,
    );
  });

  it('returns 0 once min hold elapsed', () => {
    const shownAt = 1_000;
    expect(
      remainingSkeletonHoldMs(shownAt, shownAt + SKELETON_MIN_MS, SKELETON_MIN_MS),
    ).toBe(0);
    expect(
      remainingSkeletonHoldMs(shownAt, shownAt + SKELETON_MIN_MS + 50, SKELETON_MIN_MS),
    ).toBe(0);
  });

  it('defaults to 200ms min hold', () => {
    expect(SKELETON_MIN_MS).toBe(200);
  });
});
