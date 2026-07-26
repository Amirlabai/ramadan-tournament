import { describe, expect, it } from 'vitest';
import {
  phaseForElapsed,
  remainingSkeletonHoldMs,
  SKELETON_MIN_MS,
  SPINNER_MS,
} from './useMinSkeletonTime';

describe('phaseForElapsed', () => {
  it('returns spinner before spinnerMs', () => {
    expect(phaseForElapsed(0, SPINNER_MS)).toBe('spinner');
    expect(phaseForElapsed(SPINNER_MS - 1, SPINNER_MS)).toBe('spinner');
  });

  it('returns skeleton at and after spinnerMs', () => {
    expect(phaseForElapsed(SPINNER_MS, SPINNER_MS)).toBe('skeleton');
    expect(phaseForElapsed(SPINNER_MS + 500, SPINNER_MS)).toBe('skeleton');
  });
});

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

  it('defaults match forced 200ms flash', () => {
    expect(SKELETON_MIN_MS).toBe(200);
  });
});
