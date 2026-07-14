import { DONATE_LABEL, DONATE_PAGE_URL } from '../config/contactConfig'

const donateLinkProps = {
  href: DONATE_PAGE_URL,
  target: '_blank' as const,
  rel: 'noopener noreferrer',
}

export function BitDonateLink({ className }: { className?: string }) {
  const classes = ['buy-coffee-link', className].filter(Boolean).join(' ')
  return (
    <a {...donateLinkProps} className={classes}>
      {DONATE_LABEL}
    </a>
  )
}

export function ContactDonateNote({ className }: { className?: string }) {
  return (
    <p className={['buy-coffee-note', className].filter(Boolean).join(' ')}>
      <BitDonateLink />
    </p>
  )
}
