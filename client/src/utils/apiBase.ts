/** API host prefix — empty string = same-origin `/api` (dev proxy or Vercel rewrite). */
export function apiBaseUrl(): string {
  if (import.meta.env.DEV) return '';
  if (
    import.meta.env.VITE_API_SAME_ORIGIN === 'true' ||
    import.meta.env.VITE_API_SAME_ORIGIN === '1'
  ) {
    return '';
  }
  const url = import.meta.env.VITE_API_URL;
  if (typeof url === 'string' && url.length > 0) return url;
  // Unset VITE_API_URL in prod = same-origin proxy (intentional; matches VITE_API_SAME_ORIGIN).
  return '';
}
