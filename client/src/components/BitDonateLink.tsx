import { BIT_DONATE_PHONE, bitDonateTelHref } from '../config/contactConfig'

export function BitDonateLink({ className }: { className?: string }) {
  if (!BIT_DONATE_PHONE) return null
  return (
    <a href={bitDonateTelHref(BIT_DONATE_PHONE)} className={className}>
      תרומה ביט
    </a>
  )
}

export function ContactDonateNote({ className }: { className?: string }) {
  if (!BIT_DONATE_PHONE) return null
  return (
    <p className={className}>
      נשמח לתרומה — <BitDonateLink />
    </p>
  )
}
