export type AuthPlatform = 'ios' | 'android' | 'desktop';

export type AuthDiagnostics = {
  platform: AuthPlatform;
  standalone: boolean;
};

export function getAuthPlatform(): AuthPlatform {
  if (typeof navigator === 'undefined') return 'desktop';
  const ua = navigator.userAgent;
  if (/iPhone|iPad|iPod/i.test(ua)) return 'ios';
  if (/Android/i.test(ua)) return 'android';
  return 'desktop';
}

export function isStandalonePwa(): boolean {
  if (typeof window === 'undefined') return false;
  return window.matchMedia('(display-mode: standalone)').matches;
}

export function getAuthDiagnostics(): AuthDiagnostics {
  return {
    platform: getAuthPlatform(),
    standalone: isStandalonePwa(),
  };
}
