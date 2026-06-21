import LegalPageLayout from '../components/LegalPageLayout'
import { ContactDonateNote } from '../components/BitDonateLink'

const Terms = () => (
  <LegalPageLayout
    breadcrumbs={[
      { name: 'דף הבית', path: '/' },
      { name: 'תנאי שימוש', path: '/terms' },
    ]}
  >
    <h2>תנאי שימוש</h2>
    <p>עודכן: מאי 2026</p>

    <h3>שימוש באתר</h3>
    <p>
      השימוש באתר מיועד לצפייה במידע על הטורניר, הרשמה לפי הכללים, והשארת תגובות
      אנונימיות בהתאם לכללי הקהילה. אסור לפרסם תוכן פוגעני, מטעה או בלתי חוקי.
    </p>

    <h3>חשבונות משתמש</h3>
    <p>
      אתם אחראים לשמירה על סודיות פרטי ההתחברות. מנהל המערכת רשאי להשעות חשבונות
      המפרים את הכללים.
    </p>

    <h3>קניין רוחני</h3>
    <p>
      לוגואים, תמונות ותוכן הטורניר שייכים לבעליהם. אין להעתיק ללא אישור.
    </p>

    <h3>הגבלת אחריות</h3>
    <p>
      האתר מסופק &quot;כמות שהוא&quot;. איננו מתחייבים לזמינות רציפה או לדיוק מוחלט של
      כל הנתונים בזמן אמת.
    </p>

    <h3>יצירת קשר</h3>
    <p>
      <a href="mailto:amirlabay+WC@gmail.com">amirlabay+WC@gmail.com</a>
    </p>
    <ContactDonateNote />
  </LegalPageLayout>
)

export default Terms
