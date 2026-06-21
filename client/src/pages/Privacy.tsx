import LegalPageLayout from '../components/LegalPageLayout'
import { ContactDonateNote } from '../components/BitDonateLink'

const Privacy = () => (
  <LegalPageLayout
    breadcrumbs={[
      { name: 'דף הבית', path: '/' },
      { name: 'מדיניות פרטיות', path: '/privacy' },
    ]}
  >
    <h2>מדיניות פרטיות</h2>
    <p>עודכן: מאי 2026</p>

    <h3>איזה מידע נאסף</h3>
    <ul>
      <li>פרטי חשבון (שם, דוא&quot;ל) בעת הרשמה או התחברות</li>
      <li>נתוני שימוש אנונימיים באתר (רק לאחר אישור עוגיות אנליטיקה)</li>
      <li>תגובות אנונימיות במשחקים (ללא חובת הרשמה)</li>
    </ul>

    <h3 id="cookies">עוגיות (Cookies)</h3>
    <p>
      עוגיות חיוניות נדרשות לתפעול האתר (למשל העדפת טורניר, התחברות). עוגיות אנליטיקה
      (Vercel Analytics) מופעלות רק לאחר לחיצה על &quot;מאשר/ת הכל&quot; בבאנר העוגיות.
      ניתן לבחור &quot;חיוניות בלבד&quot; ולמנוע אנליטיקה.
    </p>

    <h3>שיתוף מידע</h3>
    <p>
      איננו מוכרים מידע אישי. נתונים עשויים להישמר אצל ספקי אירוח (Vercel, Render) לצורך
      תפעול האתר בלבד.
    </p>

    <h3>יצירת קשר</h3>
    <p>
      לבקשות מחיקה או עדכון מידע:{' '}
      <a href="mailto:amirlabay+WC@gmail.com">amirlabay+WC@gmail.com</a>
    </p>
    <ContactDonateNote />
  </LegalPageLayout>
)

export default Privacy
