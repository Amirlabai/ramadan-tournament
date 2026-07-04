import type { ReactNode } from 'react';

interface PageSkeletonStatusProps {
  label: string;
  children: ReactNode;
  className?: string;
}

/** Mirrors PageLoading: role="status" + aria-live; no aria-busy (same as spinner fallback). */
export default function PageSkeletonStatus({
  label,
  children,
  className = '',
}: PageSkeletonStatusProps) {
  return (
    <div className={className} role="status" aria-live="polite">
      <span className="visually-hidden">{label}</span>
      {children}
    </div>
  );
}
