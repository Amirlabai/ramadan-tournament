/** Operator contact — Bit donate phone via VITE_BIT_DONATE_PHONE in client/.env */
export const BIT_DONATE_PHONE = (
  import.meta.env.VITE_BIT_DONATE_PHONE as string | undefined
)?.trim() ?? ''

export function bitDonateTelHref(phone: string): string {
  const digits = phone.replace(/\D/g, '')
  if (digits.startsWith('0') && digits.length === 10) {
    return `tel:+972${digits.slice(1)}`
  }
  if (digits.startsWith('972')) {
    return `tel:+${digits}`
  }
  return `tel:${digits}`
}
