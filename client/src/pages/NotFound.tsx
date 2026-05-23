import { Link } from 'react-router-dom'
import LegalPageLayout from '../components/LegalPageLayout'
import SEO from '../components/SEO'

const NotFound = () => (
  <LegalPageLayout
    breadcrumbs={[
      { name: 'דף הבית', path: '/' },
      { name: 'לא נמצא', path: '/404' },
    ]}
  >
    <SEO pathname="/404" noindex title="הדף לא נמצא" />
    <h2>הדף לא נמצא</h2>
    <p>הכתובת שביקשתם אינה קיימת באתר.</p>
    <Link to="/" className="btn btn-theme-green">
      חזרה לדף הבית
    </Link>
  </LegalPageLayout>
)

export default NotFound
