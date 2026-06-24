/** Build a UTC Date for a Jerusalem wall-clock date + time (HH:MM). */
export function jerusalemDateTime(dateStr: string, timeStr: string): Date {
  const [year, month, day] = dateStr.split('-').map(Number);
  const [hour, minute] = timeStr.split(':').map(Number);
  const targetTime = Date.UTC(year, month - 1, day, hour, minute);
  let estimated = new Date(targetTime);

  for (let i = 0; i < 4; i++) {
    const parts = new Intl.DateTimeFormat('en-US', {
      timeZone: 'Asia/Jerusalem',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      hour12: false,
    }).formatToParts(estimated);
    const p = (t: string) => parts.find((x) => x.type === t)?.value;
    const jY = Number(p('year'));
    const jM = Number(p('month'));
    const jD = Number(p('day'));
    const jH = Number(p('hour'));
    const jMin = Number(p('minute'));
    const actualInJerusalem = Date.UTC(jY, jM - 1, jD, jH, jMin);
    const diff = actualInJerusalem - targetTime;
    if (diff === 0) break;
    estimated = new Date(estimated.getTime() - diff);
  }

  return estimated;
}

/** Add calendar days to YYYY-MM-DD (local date math, no timezone). */
export function addDaysToDateString(dateStr: string, days: number): string {
  const [y, m, d] = dateStr.split('-').map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d + days));
  const yy = dt.getUTCFullYear();
  const mm = String(dt.getUTCMonth() + 1).padStart(2, '0');
  const dd = String(dt.getUTCDate()).padStart(2, '0');
  return `${yy}-${mm}-${dd}`;
}
