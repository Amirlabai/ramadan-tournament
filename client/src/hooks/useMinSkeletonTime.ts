import { useEffect, useRef, useState } from 'react';

/** Minimum skeleton visibility so shimmer is perceptible on fast/cached responses. */
export const SKELETON_MIN_MS = 550;

export interface UseMinSkeletonTimeOptions {
  /** When set, skeleton hides immediately (no min-hold). */
  error?: boolean | string | null;
  minMs?: number;
}

function prefersReducedMotion(): boolean {
  if (typeof window === 'undefined') return false;
  return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
}

/**
 * Keeps skeleton visible at least minMs after loading finishes, unless error or
 * reduced motion — so failed fast fetches show alerts without delay.
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

    if (hasError || prefersReducedMotion()) {
      shownAtRef.current = null;
      setVisible(false);
      return;
    }

    const shownAt = shownAtRef.current;
    if (shownAt === null) {
      setVisible(false);
      return;
    }

    const remaining = Math.max(0, minMs - (Date.now() - shownAt));
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
