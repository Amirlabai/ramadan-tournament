import LegalPageLayout from '../components/LegalPageLayout'
import { ContactDonateNote } from '../components/BitDonateLink'

const About = () => (
  <LegalPageLayout
    breadcrumbs={[
      { name: 'דף הבית', path: '/' },
      { name: 'אודות', path: '/about' },
    ]}
  >
    <h2>אודות הטורניר</h2>
    <p>
      טורניר קיץ 2026 בכפר כמא הוא טורניר כדורגל בחסות מרכז הצעירים. האתר מציג תוצאות,
      לוח משחקים, סטטיסטיקות, ארכיון עונות ועדכוני חדשות — לטורניר הבנים ולטורניר
      הבנות (מערכת נקודות).
    </p>
    <h3>מפעיל האתר</h3>
    <p>
      Amir Labai
      <br />
      דוא&quot;ל:{' '}
      <a href="mailto:amirlabay+WC@gmail.com">amirlabay+WC@gmail.com</a>
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
