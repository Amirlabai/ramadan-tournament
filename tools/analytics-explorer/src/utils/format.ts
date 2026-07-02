export function formatDuration(ms: number): string {
  if (ms < 1000) return `${ms}ms`;
  const sec = Math.round(ms / 1000);
  if (sec < 60) return `${sec}s`;
  const min = Math.floor(sec / 60);
  const remSec = sec % 60;
  if (min < 60) return remSec > 0 ? `${min}m ${remSec}s` : `${min}m`;
  const hr = Math.floor(min / 60);
  const remMin = min % 60;
  return remMin > 0 ? `${hr}h ${remMin}m` : `${hr}h`;
}

export function formatMedShort(dwell: { median: number; sampleCount: number }): string {
  if (dwell.sampleCount === 0) return '';
  return `med ${formatDuration(dwell.median)}`;
}

export function defaultDateRange(): { from: string; to: string } {
  const to = new Date();
  const from = new Date(to.getTime() - 7 * 24 * 60 * 60 * 1000);
  return {
    from: from.toISOString().slice(0, 10),
    to: to.toISOString().slice(0, 10),
  };
}

export function toIsoEndOfDay(dateStr: string): string {
  return new Date(`${dateStr}T23:59:59.999Z`).toISOString();
}

export function toIsoStartOfDay(dateStr: string): string {
  return new Date(`${dateStr}T00:00:00.000Z`).toISOString();
}
