import { DONATE_PAGE_URL } from '../config/contactConfig'

const donateLinkProps = {
  href: DONATE_PAGE_URL,
  target: '_blank' as const,
  rel: 'noopener noreferrer',
}

export function BitDonateLink({ className }: { className?: string }) {
  return (
    <a {...donateLinkProps} className={className}>
      תרומה
    </a>
  )
}

export function ContactDonateNote({ className }: { className?: string }) {
  return (
    <p className={className}>
      נשמח לתרומה — <BitDonateLink />
    </p>
  )
}
