export const PRIVACY_CONTACT_EMAIL = 'amirlabay+WC@gmail.com'
export const SITE_OPERATOR_NAME = 'Amir Labai'

export const DONATE_PAGE_URL = '/donate.html'
export const PAYBOX_DONATE_URL = 'https://links.payboxapp.com/YQXzMoMq93b'
export const BIT_DONATE_URL =
  'https://www.bitpay.co.il/app/me/8069B5AA-810B-BEBB-28BC-8910660065621C8A'
export const DONATE_LABEL = 'תתרמו לאתר'

/** Google Form — health declaration + parental consent (boys tournament). */
export const HEALTH_DECLARATION_FORM_URL = 'https://forms.gle/YNVWz5JUF4BrvRyd7'

/** Boys sidebar photo-docs buttons: one entry → one button; empty → none. */
export type MediaDocsSponsor = {
  /** Shown as: תיעוד תמונות בחסות {name} */
  name: string
  /** External folder / album URL (opens in a new tab). */
  url: string
}

export const MEDIA_DOCS_SPONSORS: MediaDocsSponsor[] = [
  {
    name: 'יוסף שמסי',
    url: 'https://www.dropbox.com/scl/fo/ik6h4ns21d5ku05xecrg4/AKcHoyI4D7G8IchCNlI5BNQ?rlkey=e7i8sakzd5akwptjuxdnt1wau&st=v32ykez6&dl=0',
  },
  {
    name: 'אסא נאש',
    url: 'https://photos.app.goo.gl/iyK2K7cpWG2dKGTk8',
  },
]

export function mediaDocsNavLabel(name: string): string {
  return `תיעוד תמונות בחסות ${name}`
}
