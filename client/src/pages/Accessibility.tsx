import { useState, type FormEvent } from 'react'
import { Link } from 'react-router-dom'
import LegalPageLayout from '../components/LegalPageLayout'
import { ContactDonateNote } from '../components/BitDonateLink'
import { PRIVACY_CONTACT_EMAIL, SITE_OPERATOR_NAME } from '../config/contactConfig'
import { siteHomePath } from '../utils/tournamentPaths'
import './Accessibility.css'
import BigBossLegalNote from '../components/BigBossLegalNote'

const Accessibility = () => {
  const [submitted, setSubmitted] = useState(false)
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [message, setMessage] = useState('')

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault()
    const subject = encodeURIComponent('דיווח על בעיית נגישות - מונדיאל קיץ 2026')
    const body = encodeURIComponent(`שם: ${name}\nדוא"ל: ${email}\n\n${message}`)
    window.location.href = `mailto:${PRIVACY_CONTACT_EMAIL}?subject=${subject}&body=${body}`
    setSubmitted(true)
  }

  return (
    <LegalPageLayout
      breadcrumbs={[
        { name: 'דף הבית', path: siteHomePath() },
        { name: 'נגישות', path: '/accessibility' },
      ]}
    >
      <h2 className="mb-4 fw-bold">הצהרת נגישות</h2>
      <BigBossLegalNote>
        אפילו צווי הבוס כפופים לנגישות. משחק התפקידים אינו משנה את מחויבות האתר
        לתקן הישראלי ולשימוש שוויוני.
      </BigBossLegalNote>

      <section className="mb-4">
        <h3>רמת התאמה</h3>
        <p>
          אתר זה שואף לעמוד בדרישות תקן ישראלי ת&quot;י 5568 לנגישות תכנים באינטרנט,
          המבוסס על הנחיות WCAG 2.1 ברמה AA.
        </p>
        <p>
          <strong>תאריך ביקורת נגישות אחרונה:</strong> יולי 2026
        </p>
      </section>

      <section className="mb-4">
        <h3>מגבלות ידועות</h3>
        <ul>
          <li>ווידג׳ט התחברות Google (נשלט על ידי ספק חיצוני)</li>
          <li>ספריות Bootstrap ו-Font Awesome מ-CDN</li>
          <li>תרשימי התרעות מוצגים כתמונה חזותית עם תיאור טקסטואלי</li>
        </ul>
      </section>

      <section className="mb-4">
        <h3>ניגודיות וצבעים</h3>
        <p>
          בפינה התחתונה של המסך מופיע סרגל התאמות נגישות. ניתן להפעיל{' '}
          <strong>ניגודיות גבוהה</strong> (רקע לבן, טקסט שחור, מסגרות ברורות)
          או לחזור לצבעי ברירת המחדל. ההעדפה נשמרת בדפדפן.
        </p>
        <p>
          אם במערכת ההפעלה מוגדרת העדפת ניגודיות מוגברת (
          <code>prefers-contrast: more</code>
          ), האתר יתאים את עצמו אוטומטית בביקור ראשון, אלא אם בחרתם צבעים רגילים
          במפורש.
        </p>
      </section>

      <section className="mb-4">
        <h3>ניווט במובייל</h3>
        <p>
          בתצוגת מובייל ניתן לפתוח את תפריט הניווט בצד ימין באמצעות ידית הגרירה. מעבר
          בין עמודי הטורניר האפשרי גם במחווה החלקה אופקית על אזור התוכן הראשי (ללא
          מעגליות בקצוות הרשימה). מחווה זו אינה נדרשת לשימוש באתר. כל העמודים נגישים
          דרך התפריט והקישורים.
        </p>
      </section>

      <section className="mb-4">
        <h3>רכז נגישות</h3>
        <ul className="list-unstyled">
          <li>
            <strong>שם:</strong> {SITE_OPERATOR_NAME}
          </li>
          <li>
            <strong>דוא&quot;ל:</strong>{' '}
            <a href={`mailto:${PRIVACY_CONTACT_EMAIL}`}>{PRIVACY_CONTACT_EMAIL}</a>
          </li>
          <li>
            <strong>טלפון:</strong> פנייה בדוא&quot;ל בלבד (ראו כתובת למעלה)
          </li>
        </ul>
        <ContactDonateNote />
        <p className="text-muted">
          אנו מתחייבים לטפל בפניות נגישות בתוך 5 ימי עסקים ממועד קבלת הפנייה.
        </p>
      </section>

      <section className="mb-4">
        <h3>דיווח על בעיית נגישות</h3>
        {submitted ? (
          <div className="alert alert-success" role="alert">
            תודה. נפתחה אפליקציית דוא&quot;ל לשליחת הפנייה. אם לא נפתחה, שלחו דוא&quot;ל
            לכתובת הרכז.
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="accessibility-report-form" noValidate>
            <div className="mb-3">
              <label htmlFor="a11y-name" className="form-label">
                שם מלא
              </label>
              <input
                type="text"
                id="a11y-name"
                name="name"
                className="form-control"
                value={name}
                onChange={(e) => setName(e.target.value)}
                autoComplete="name"
                required
                aria-required="true"
              />
            </div>
            <div className="mb-3">
              <label htmlFor="a11y-email" className="form-label">
                דוא&quot;ל
              </label>
              <input
                type="email"
                id="a11y-email"
                name="email"
                className="form-control"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                autoComplete="email"
                required
                aria-required="true"
              />
            </div>
            <div className="mb-3">
              <label htmlFor="a11y-message" className="form-label">
                תיאור הבעיה
              </label>
              <textarea
                id="a11y-message"
                name="message"
                className="form-control"
                rows={5}
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                required
                aria-required="true"
              />
            </div>
            <p className="small text-muted mb-3">
              השם וכתובת הדוא&quot;ל בטופס זה נשלחים אלינו בדוא&quot;ל לצורך טיפול בפנייה.
              ראו <Link to="/privacy#contact">מדיניות הפרטיות</Link>.
            </p>
            <button type="submit" className="btn btn-theme-green">
              שלח דיווח
            </button>
          </form>
        )}
      </section>
    </LegalPageLayout>
  )
}

export default Accessibility
