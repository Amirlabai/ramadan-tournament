import type { ReactNode } from 'react';
import './Skeleton.css';

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
  const rootClass = ['page-skeleton-loading', className].filter(Boolean).join(' ');

  return (
    <div className={rootClass} role="status" aria-live="polite">
      <span className="visually-hidden">{label}</span>
      {children}
    </div>
  );
}
