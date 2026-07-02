import { Link } from 'react-router-dom'
import LegalPageLayout from '../components/LegalPageLayout'
import { ContactDonateNote } from '../components/BitDonateLink'
import { PRIVACY_CONTACT_EMAIL, SITE_OPERATOR_NAME } from '../config/contactConfig'

const About = () => (
  <LegalPageLayout
    breadcrumbs={[
      { name: 'דף הבית', path: '/' },
      { name: 'אודות', path: '/about' },
    ]}
  >
    <h2>אודות הטורניר</h2>
    <p>עודכן: יולי 2026</p>
    <p>
      מונדיאל קיץ 2026 בכפר כמא הוא טורניר כדורגל בחסות מרכז הצעירים. האתר מציג תוצאות,
      לוח משחקים, סטטיסטיקות, ארכיון עונות ועדכוני חדשות — לטורניר הבנים ולטורניר
      הבנות (מערכת נקודות).
    </p>
    <p>
      האתר מעבד נתוני רישום ופרטי זהות לפי{' '}
      <Link to="/privacy">מדיניות הפרטיות</Link>.
    </p>
    <h3>מפעיל האתר</h3>
    <p>
      {SITE_OPERATOR_NAME} — מפעיל האתר ואחראי פרטיות.
      <br />
      דוא&quot;ל:{' '}
      <a href={`mailto:${PRIVACY_CONTACT_EMAIL}`}>{PRIVACY_CONTACT_EMAIL}</a>
    </p>
    <ContactDonateNote />
    <h3>טורניר בנות</h3>
    <p>
      ניתן לעבור לטורניר הבנות דרך מתג הטורניר בדף הבית או בכתובת{' '}
      <a href="/girls">/girls</a>.
    </p>
  </LegalPageLayout>
)

export default About
