import type { ReactNode } from 'react'
import { Link, useLocation } from 'react-router-dom'
import SEO from './SEO'
import type { BreadcrumbItem } from '../config/seoConfig'
import '../pages/LegalPage.css'

interface LegalPageLayoutProps {
  children: ReactNode
  breadcrumbs?: BreadcrumbItem[]
}

const LegalPageLayout = ({ children, breadcrumbs }: LegalPageLayoutProps) => {
  const { pathname } = useLocation()
  const crumbs: BreadcrumbItem[] = breadcrumbs ?? [
    { name: 'דף הבית', path: '/' },
    { name: 'דף משפטי', path: pathname },
  ]

  return (
    <div className="legal-page-shell">
      <SEO pathname={pathname} breadcrumbs={crumbs} />
      <a href="#legal-main" className="legal-skip-link">
        דלג לתוכן
      </a>
      <header className="legal-page-header">
        <div className="container">
          <Link to="/" className="legal-page-brand">
            טורניר קיץ 2026
          </Link>
          <Link to="/" className="legal-page-home-link">
            חזרה לאתר
          </Link>
        </div>
      </header>
      <main id="legal-main" className="legal-page-main" tabIndex={-1}>
        <div className="container">{children}</div>
      </main>
      <footer className="legal-page-footer">
        <div className="container">
          <nav aria-label="קישורים משפטיים">
            <Link to="/about" className="me-3">
              אודות
            </Link>
            <Link to="/accessibility" className="me-3">
              נגישות
            </Link>
            <Link to="/privacy" className="me-3">
              פרטיות
            </Link>
            <Link to="/terms">תנאים</Link>
          </nav>
          <p className="mt-2 mb-0">Amir Labay · summertournament@gmail.com</p>
        </div>
      </footer>
    </div>
  )
}

export default LegalPageLayout
