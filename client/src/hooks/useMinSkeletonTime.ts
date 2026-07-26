import { useEffect, useRef, useState } from 'react';

/** Forced skeleton flash before content (also min hold once skeleton is shown). */
export const SKELETON_MIN_MS = 200;

/** Loading circle stage before layout skeleton (while still fetching). */
export const SPINNER_MS = 1000;

export type PageLoadPhase = false | 'spinner' | 'skeleton';

export interface UseMinSkeletonTimeOptions {
  /** When set, preload/skeleton hide immediately (no min-hold). */
  error?: boolean | string | null;
  minMs?: number;
  spinnerMs?: number;
}

/** Pure stage picker from session elapsed ms. Exported for tests. */
export function phaseForElapsed(
  elapsed: number,
  spinnerMs: number,
): Exclude<PageLoadPhase, false> {
  if (elapsed < spinnerMs) return 'spinner';
  return 'skeleton';
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
 * Staged initial load UI: spinner → skeleton while loading.
 * When data arrives, always force skeleton for minMs before content
 * (even if the fetch finished during the spinner).
 * Error skips immediately. Reduced motion still forces skeleton (shimmer off in CSS).
 */
export function useMinSkeletonTime(
  loading: boolean,
  options: UseMinSkeletonTimeOptions = {},
): PageLoadPhase {
  const {
    error = false,
    minMs = SKELETON_MIN_MS,
    spinnerMs = SPINNER_MS,
  } = options;
  const hasError = Boolean(error);
  const wantLoad = loading && !hasError;

  const [phase, setPhase] = useState<PageLoadPhase>(() =>
    wantLoad ? 'spinner' : false,
  );

  const phaseRef = useRef(phase);
  phaseRef.current = phase;

  /** Wall-clock start of the current load session (survives Strict Mode effect re-runs). */
  const sessionStartRef = useRef<number | null>(wantLoad ? Date.now() : null);
  const skeletonShownAtRef = useRef<number | null>(null);
  const hideTimerRef = useRef<number | null>(null);

  useEffect(() => {
    if (hideTimerRef.current !== null) {
      window.clearTimeout(hideTimerRef.current);
      hideTimerRef.current = null;
    }

    if (hasError) {
      sessionStartRef.current = null;
      skeletonShownAtRef.current = null;
      phaseRef.current = false;
      setPhase(false);
      return;
    }

    if (wantLoad) {
      if (sessionStartRef.current === null) {
        sessionStartRef.current = Date.now();
        skeletonShownAtRef.current = null;
      }

      const start = sessionStartRef.current;
      let cancelled = false;
      const timers: number[] = [];

      const apply = () => {
        if (cancelled) return;
        const next = phaseForElapsed(Date.now() - start, spinnerMs);
        if (next === 'skeleton' && skeletonShownAtRef.current === null) {
          skeletonShownAtRef.current = Date.now();
        }
        if (phaseRef.current !== next) {
          phaseRef.current = next;
          setPhase(next);
        }
      };

      apply();
      const toSkeleton = Math.max(0, spinnerMs - (Date.now() - start));
      timers.push(window.setTimeout(apply, toSkeleton));

      return () => {
        cancelled = true;
        for (const id of timers) window.clearTimeout(id);
      };
    }

    // Loading finished: end the fetch session
    sessionStartRef.current = null;

    // Force skeleton before content (even if fetch finished during spinner).
    // Reduced motion: still show static skeleton; CSS disables shimmer.
    if (phaseRef.current !== 'skeleton') {
      skeletonShownAtRef.current = Date.now();
      phaseRef.current = 'skeleton';
      setPhase('skeleton');
    }

    const shownAt = skeletonShownAtRef.current ?? Date.now();
    skeletonShownAtRef.current = shownAt;

    const remaining = remainingSkeletonHoldMs(shownAt, Date.now(), minMs);
    hideTimerRef.current = window.setTimeout(() => {
      hideTimerRef.current = null;
      skeletonShownAtRef.current = null;
      phaseRef.current = false;
      setPhase(false);
    }, remaining);

    return () => {
      if (hideTimerRef.current !== null) {
        window.clearTimeout(hideTimerRef.current);
        hideTimerRef.current = null;
      }
    };
  }, [wantLoad, hasError, minMs, spinnerMs]);

  return phase;
}
