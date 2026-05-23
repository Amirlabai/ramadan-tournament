import LegalPageLayout from '../components/LegalPageLayout'

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
      Amir Labay
      <br />
      דוא&quot;ל:{' '}
      <a href="mailto:summertournament@gmail.com">summertournament@gmail.com</a>
    </p>
    <h3>טורניר בנות</h3>
    <p>
      ניתן לעבור לטורניר הבנות דרך מתג הטורניר בדף הבית או בכתובת{' '}
      <a href="/girls">/girls</a>.
    </p>
  </LegalPageLayout>
)

export default About
