import { useEffect, useRef } from 'react';
import { useLocation } from 'react-router-dom';
import { setAnalyticsEnabled, trackEvent } from '../utils/analytics';

function recordPageView(pathname: string): void {
  trackEvent('page_view', {
    category: 'browse',
    path: pathname,
  });
}

export function useAnalyticsTracking(consent: 'accepted' | 'essential' | null): void {
  const location = useLocation();
  const lastTrackedPath = useRef<string | null>(null);

  useEffect(() => {
    const accepted = consent === 'accepted';
    setAnalyticsEnabled(accepted);

    if (!accepted) return;
    if (lastTrackedPath.current === location.pathname) return;

    recordPageView(location.pathname);
    lastTrackedPath.current = location.pathname;
  }, [consent, location.pathname]);
}
