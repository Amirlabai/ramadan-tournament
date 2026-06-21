import type { ReactNode } from 'react'
import { Link, useLocation } from 'react-router-dom'
import { BitDonateLink } from './BitDonateLink'
import SEO from './SEO'
import type { BreadcrumbItem } from '../config/seoConfig'
import { siteBrandLabel, siteHomePath } from '../utils/tournamentPaths'
import '../pages/LegalPage.css'

interface LegalPageLayoutProps {
  children: ReactNode
  breadcrumbs?: BreadcrumbItem[]
}

const LegalPageLayout = ({ children, breadcrumbs }: LegalPageLayoutProps) => {
  const { pathname } = useLocation()
  const homePath = siteHomePath()
  const brandLabel = siteBrandLabel()

  const crumbs: BreadcrumbItem[] = (breadcrumbs ?? [
    { name: 'דף הבית', path: homePath },
    { name: 'דף משפטי', path: pathname },
  ]).map((crumb, index) =>
    index === 0 && (crumb.path === '/' || crumb.path === homePath)
      ? { ...crumb, path: homePath }
      : crumb
  )

  return (
    <div className="legal-page-shell">
      <SEO pathname={pathname} breadcrumbs={crumbs} />
      <a href="#legal-main" className="legal-skip-link">
        דלג לתוכן
      </a>
      <header className="legal-page-header">
        <div className="container">
          <Link to={homePath} className="legal-page-brand">
            {brandLabel}
          </Link>
          <Link to={homePath} className="legal-page-home-link">
            חזרה לאתר
          </Link>
        </div>
      </header>
      <main id="legal-main" className="legal-page-main" tabIndex={-1}>
        <div className="container">{children}</div>
      </main>
      <footer className="legal-page-footer">
        <div className="container">
          <nav className="legal-page-footer-nav" aria-label="קישורים משפטיים">
            <Link to="/about" className="legal-page-footer-link">
              אודות
            </Link>
            <Link to="/accessibility" className="legal-page-footer-link">
              נגישות
            </Link>
            <Link to="/privacy" className="legal-page-footer-link">
              פרטיות
            </Link>
            <Link to="/terms" className="legal-page-footer-link">
              תנאים
            </Link>
          </nav>
          <p className="mt-2 mb-0">
            Amir Labai ·{' '}
            <a href="mailto:amirlabay+WC@gmail.com">amirlabay+WC@gmail.com</a>
            {' · '}
            <BitDonateLink />
          </p>
        </div>
      </footer>
    </div>
  )
}

export default LegalPageLayout
