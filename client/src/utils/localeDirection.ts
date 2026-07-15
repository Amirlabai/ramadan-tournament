/**
 * Bottom-nav direction from the device/browser language preference.
 * Site shell stays `lang="he" dir="rtl"`; only the mobile bottom bar flips.
 *
 * Mobile Safari / Chrome / Instagram WebView all expose `navigator.language`
 * (and usually `navigator.languages`). Primary `en*` → LTR (Home leftmost);
 * otherwise RTL (Hebrew start side).
 */
export function getPrimaryBrowserLanguage(): string {
  if (typeof navigator === 'undefined') return 'he';
  const list = navigator.languages?.length
    ? navigator.languages
    : navigator.language
      ? [navigator.language]
      : [];
  return (list[0] || 'he').toLowerCase();
}

/** True when the primary browser/device language looks English (en, en-US, …). */
export function prefersEnglishUi(): boolean {
  return getPrimaryBrowserLanguage().startsWith('en');
}
