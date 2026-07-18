import { useEffect, useRef, useState, type ReactNode } from 'react';
import { flushSync } from 'react-dom';
import { renderShareImage, sharePreparedImage } from '../../utils/shareImage';
import { ShareFrame } from './ShareFrame';
import './share.css';

type ShareButtonProps<T> = {
  filename: string;
  title: string;
  text: string;
  className?: string;
  prepare?: () => Promise<T>;
  renderContent: (prepared: T | null) => ReactNode;
};

type SharePhase = 'idle' | 'rendering' | 'ready' | 'error';

export function ShareButton<T = never>({
  filename,
  title,
  text,
  className,
  prepare,
  renderContent,
}: ShareButtonProps<T>) {
  const frameRef = useRef<HTMLDivElement>(null);
  const mountedRef = useRef(true);
  const [phase, setPhase] = useState<SharePhase>('idle');
  const [prepared, setPrepared] = useState<T | null>(null);
  const [preparedFile, setPreparedFile] = useState<File | null>(null);
  const [frameMounted, setFrameMounted] = useState(false);

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
    };
  }, []);

  const reset = () => {
    setPhase('idle');
    setPreparedFile(null);
    setFrameMounted(false);
  };

  const keepReady = (file: File) => {
    setPreparedFile(file);
    setPhase('ready');
    setFrameMounted(false);
  };

  const shareFile = async (file: File) => {
    const result = await sharePreparedImage(file, { filename, title, text });
    if (!mountedRef.current) return;
    // Keep the rendered file on iOS activation loss and on sheet dismiss so
    // a second tap can share without re-rendering.
    if (result === 'ready' || result === 'cancelled') {
      keepReady(file);
      return;
    }
    reset();
  };

  const handleClick = async () => {
    if (phase === 'rendering') return;

    if (phase === 'ready' && preparedFile) {
      try {
        await shareFile(preparedFile);
      } catch (error) {
        console.error('Share image failed:', error);
        if (mountedRef.current) setPhase('error');
      }
      return;
    }

    setPhase('rendering');
    try {
      const nextPrepared = prepare ? await prepare() : null;
      if (!mountedRef.current) return;

      flushSync(() => {
        setPrepared(nextPrepared);
        setFrameMounted(true);
      });
      const frame = frameRef.current;
      if (!frame) throw new Error('Share frame did not mount');

      const file = await renderShareImage(frame, filename);
      if (!mountedRef.current) return;

      flushSync(() => setPreparedFile(file));
      await shareFile(file);
    } catch (error) {
      console.error('Share image failed:', error);
      if (!mountedRef.current) return;
      setPhase('error');
      setFrameMounted(false);
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
