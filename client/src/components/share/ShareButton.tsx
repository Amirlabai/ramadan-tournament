import { useEffect, useRef, useState, type ReactNode } from 'react';
import { flushSync } from 'react-dom';
import {
  dropCachedShareImage,
  getCachedShareImage,
  isUsableShareFile,
  renderShareImage,
  setCachedShareImage,
  sharePreparedImage,
} from '../../utils/shareImage';
import {
  buildShareCacheKey,
  stringifyShareSnapshot,
  type ShareSnapshot,
} from '../../utils/shareSnapshot';
import { trackEvent } from '../../utils/analytics';
import { ShareFrame } from './ShareFrame';
import './share.css';

type ShareButtonProps<T> = {
  filename: string;
  title: string;
  text: string;
  /**
   * JSON-comparable metadata of everything that affects the PNG face.
   * Combined with prepare() payload into a canonical snapshot key.
   */
  snapshot: ShareSnapshot;
  className?: string;
  prepare?: () => Promise<T>;
  /**
   * Must render only from `prepared` (freeze live page props inside prepare).
   * Do not close over state that can change mid-capture.
   */
  renderContent: (prepared: T | null) => ReactNode;
};

type SharePhase = 'idle' | 'rendering' | 'ready' | 'error';

function shareKind(snapshot: ShareSnapshot): string {
  const kind = snapshot.kind;
  return typeof kind === 'string' && kind.length > 0 ? kind : 'unknown';
}

export function ShareButton<T = never>({
  filename,
  title,
  text,
  snapshot,
  className,
  prepare,
  renderContent,
}: ShareButtonProps<T>) {
  const frameRef = useRef<HTMLDivElement>(null);
  const mountedRef = useRef(true);
  const inFlightRef = useRef(false);
  const generationRef = useRef(0);
  const snapshotJsonRef = useRef('');
  const snapshotJson = stringifyShareSnapshot(snapshot);
  snapshotJsonRef.current = snapshotJson;

  const [phase, setPhase] = useState<SharePhase>('idle');
  const [prepared, setPrepared] = useState<T | null>(null);
  const [frameMounted, setFrameMounted] = useState(false);

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
      generationRef.current += 1;
      inFlightRef.current = false;
    };
  }, []);

  // Snapshot changed — invalidate generation so in-flight captures are ignored.
  useEffect(() => {
    generationRef.current += 1;
    setPrepared(null);
    setFrameMounted(false);
    if (!inFlightRef.current) setPhase('idle');
  }, [snapshotJson]);

  const isCurrent = (generation: number, clickSnapshotJson: string) =>
    mountedRef.current &&
    generation === generationRef.current &&
    clickSnapshotJson === snapshotJsonRef.current;

  const keepFile = (file: File, fullKey: string, nextPhase: SharePhase) => {
    if (!isUsableShareFile(file)) {
      dropCachedShareImage(fullKey);
      setPhase('error');
      setFrameMounted(false);
      return;
    }
    setCachedShareImage(fullKey, file);
    setPhase(nextPhase);
    setFrameMounted(false);
  };

  const shareFile = async (
    file: File,
    fullKey: string,
    generation: number,
    clickSnapshotJson: string,
    kind: string,
    cached: boolean
  ) => {
    if (!isUsableShareFile(file)) {
      dropCachedShareImage(fullKey);
      setFrameMounted(false);
      throw new Error('Share image file is missing or empty');
    }
    const result = await sharePreparedImage(file, { filename, title, text });
    if (!isCurrent(generation, clickSnapshotJson)) return;
    // Skip `ready` (NotAllowedError → second tap) so one intent is not two completes.
    if (result !== 'ready') {
      trackEvent('share_result', {
        category: 'interaction',
        properties: { kind, result, cached },
      });
    }
    if (result === 'ready' || result === 'cancelled') {
      keepFile(file, fullKey, 'ready');
      return;
    }
    keepFile(file, fullKey, 'idle');
  };

  const renderAndShare = async (
    nextPrepared: T | null,
    fullKey: string,
    generation: number,
    clickSnapshotJson: string,
    kind: string,
    setStage: (stage: 'render' | 'share') => void
  ) => {
    flushSync(() => {
      setPrepared(nextPrepared);
      setFrameMounted(true);
    });
    if (!isCurrent(generation, clickSnapshotJson)) return;

    const frame = frameRef.current;
    if (!frame) throw new Error('Share frame did not mount');

    setStage('render');
    const file = await renderShareImage(frame, filename);
    if (!isCurrent(generation, clickSnapshotJson)) return;
    if (!isUsableShareFile(file)) {
      throw new Error('Share image render produced an empty file');
    }

    setStage('share');
    await shareFile(file, fullKey, generation, clickSnapshotJson, kind, false);
  };

  const handleClick = async () => {
    if (inFlightRef.current) return;

    const generation = generationRef.current;
    const clickSnapshotJson = snapshotJsonRef.current;
    const clickSnapshot = snapshot;
    const kind = shareKind(clickSnapshot);

    trackEvent('share_click', {
      category: 'interaction',
      properties: { kind },
    });

    inFlightRef.current = true;
    setPhase('rendering');
    let fullKey: string | null = null;
    let stage: 'cache' | 'render' | 'share' = 'render';

    try {
      const nextPrepared = prepare ? await prepare() : null;
      if (!isCurrent(generation, clickSnapshotJson)) return;

      fullKey = buildShareCacheKey(clickSnapshot, nextPrepared);
      const cached = getCachedShareImage(fullKey) ?? null;

      if (cached) {
        try {
          stage = 'cache';
          await shareFile(cached, fullKey, generation, clickSnapshotJson, kind, true);
          return;
        } catch (cacheShareError) {
          console.warn('Cached share failed; regenerating:', cacheShareError);
          if (!isCurrent(generation, clickSnapshotJson)) return;
          dropCachedShareImage(fullKey);
          setFrameMounted(false);
        }
      }

      await renderAndShare(
        nextPrepared,
        fullKey,
        generation,
        clickSnapshotJson,
        kind,
        (next) => {
          stage = next;
        }
      );
    } catch (error) {
      console.error('Share image failed:', error);
      if (!isCurrent(generation, clickSnapshotJson)) return;
      trackEvent('share_error', {
        category: 'interaction',
        properties: { kind, stage },
      });
      if (fullKey) dropCachedShareImage(fullKey);
      setFrameMounted(false);
      setPhase('error');
    } finally {
      inFlightRef.current = false;
      if (mountedRef.current && generation !== generationRef.current) {
        setPhase('idle');
        setFrameMounted(false);
      }
    }
  };

  const label =
    phase === 'rendering'
      ? 'מכין תמונה…'
      : phase === 'ready'
        ? 'שיתוף'
        : phase === 'error'
          ? 'נסה שוב'
          : 'שתף';

  return (
    <>
      <button
        type="button"
        className={['share-button', className].filter(Boolean).join(' ')}
        onClick={handleClick}
        disabled={phase === 'rendering'}
        aria-label={`${label} כתמונה`}
        aria-busy={phase === 'rendering'}
      >
        <i
          className={`bi ${
            phase === 'rendering'
              ? 'bi-arrow-repeat share-button__spinner'
              : 'bi-share share-button__icon-desktop'
          }`}
          aria-hidden="true"
        />
        {phase !== 'rendering' ? (
          <i className="bi bi-send share-button__icon-mobile" aria-hidden="true" />
        ) : null}
        <span>{label}</span>
      </button>
      <span className="visually-hidden" role="status" aria-live="polite">
        {phase === 'rendering'
          ? 'מכין תמונה לשיתוף'
          : phase === 'ready'
            ? 'התמונה מוכנה. לחץ שוב כדי לפתוח את מסך השיתוף'
            : phase === 'error'
              ? 'לא ניתן להכין את התמונה. אפשר לנסות שוב'
              : ''}
      </span>
      {frameMounted ? (
        <ShareFrame ref={frameRef}>{renderContent(prepared)}</ShareFrame>
      ) : null}
    </>
  );
}
