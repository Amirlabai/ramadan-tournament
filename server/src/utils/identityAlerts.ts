export const IDENTITY_ALERT_NOT_MATCHING =
  'תעודת הזהות או שנת הלידה לא תואמים. נסה שוב או פנה למנהל.';

/** @deprecated use IDENTITY_ALERT_NOT_MATCHING */
export const INVOICE_ALERT_NOT_MATCHING = IDENTITY_ALERT_NOT_MATCHING;

const PREREG_FIELD_LABEL: Record<'personal_id' | 'birth_year', string> = {
  personal_id: 'מספר תעודת זהות',
  birth_year: 'שנת לידה',
};

/** Profile `invoiceAlert` when form prereg is incomplete or single-field mismatch. */
export function preregIdentityProfileAlert(
  kind: 'admin_missing' | 'field_mismatch',
  field: 'personal_id' | 'birth_year'
): string {
  const label = PREREG_FIELD_LABEL[field];
  if (kind === 'admin_missing') {
    return `בצד הניהול חסר/ה ${label} בטופס ההרשמה. בדקו את המייל או פנו למנהל.`;
  }
  return `${label} לא תואם/ת לטופס ההרשמה. בדקו את המייל או נסו שוב.`;
}
