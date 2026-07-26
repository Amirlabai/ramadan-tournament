import { useEffect, useRef, useState } from 'react';

/** Minimum skeleton visibility so shimmer is perceptible on fast responses. */
export const SKELETON_MIN_MS = 200;

export interface UseMinSkeletonTimeOptions {
  /** When set, skeleton hides immediately (no min-hold). */
  error?: boolean | string | null;
  minMs?: number;
}

/** Ms left to hold skeleton before content. Exported for tests. */
export function remainingSkeletonHoldMs(
  shownAt: number,
  now: number,
  minMs: number,
): number {
  return Math.max(0, minMs - (now - shownAt));
}

/**
 * Shows layout skeleton while loading; holds at least minMs after load finishes
 * so the (slow) shimmer is visible. Error skips hold. Reduced motion skips hold
 * (shimmer already off in CSS).
 */
export function useMinSkeletonTime(
  loading: boolean,
  options: UseMinSkeletonTimeOptions = {},
): boolean {
  const { error = false, minMs = SKELETON_MIN_MS } = options;
  const hasError = Boolean(error);
  const wantSkeleton = loading && !hasError;

  const [visible, setVisible] = useState(wantSkeleton);
  const shownAtRef = useRef<number | null>(wantSkeleton ? Date.now() : null);
  const prevWantRef = useRef(wantSkeleton);
  const hideTimerRef = useRef<number | null>(null);

  useEffect(() => {
    const prevWant = prevWantRef.current;
    prevWantRef.current = wantSkeleton;

    if (hideTimerRef.current !== null) {
      window.clearTimeout(hideTimerRef.current);
      hideTimerRef.current = null;
    }

    if (wantSkeleton) {
      if (!prevWant) {
        shownAtRef.current = Date.now();
      }
      setVisible(true);
      return;
    }

    if (hasError) {
      shownAtRef.current = null;
      setVisible(false);
      return;
    }

    if (
      typeof window !== 'undefined' &&
      window.matchMedia('(prefers-reduced-motion: reduce)').matches
    ) {
      shownAtRef.current = null;
      setVisible(false);
      return;
    }

    const shownAt = shownAtRef.current;
    if (shownAt === null) {
      setVisible(false);
      return;
    }

    const remaining = remainingSkeletonHoldMs(shownAt, Date.now(), minMs);
    hideTimerRef.current = window.setTimeout(() => {
      hideTimerRef.current = null;
      shownAtRef.current = null;
      setVisible(false);
    }, remaining);

    return () => {
      if (hideTimerRef.current !== null) {
        window.clearTimeout(hideTimerRef.current);
        hideTimerRef.current = null;
      }
    };
  }, [wantSkeleton, hasError, minMs]);

  return visible;
}
