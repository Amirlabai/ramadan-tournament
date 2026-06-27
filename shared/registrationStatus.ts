/** SeasonRegistrationStatus values (Prisma enum) → Hebrew display labels. */
export const SEASON_REGISTRATION_STATUS_LABELS: Record<string, string> = {
  none: 'שלב 1: הזן תעודת זהות ושנת לידה או המתן שהמנהל ירשום',
  join_pending: 'בקשה בתהליך',
  awaiting_identity: 'ממתין לאישור מנהל (הזנת זהות)',
  identity_assigned: 'המנהל רשם את פרטיך — הזן את אותם פרטים בדיוק להפעלה',
  active: 'רישום פעיל — ניתן לשלוח בקשת הצטרפות או הקמת קבוצה',
  archived: 'עונה בארכיון',
};

export function getRegistrationStatusLabel(status: string): string {
  return SEASON_REGISTRATION_STATUS_LABELS[status] ?? status;
}
