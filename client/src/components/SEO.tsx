import { Helmet } from 'react-helmet-async'
import { useLocation } from 'react-router-dom'
import {
  getSiteUrl,
  getRouteSeo,
  canonicalUrl,
  organizationJsonLd,
  webSiteJsonLd,
  webApplicationJsonLd,
  sportsEventJsonLd,
  breadcrumbJsonLd,
  formatDocumentTitle,
  type BreadcrumbItem,
} from '../config/seoConfig'

interface SEOProps {
  title?: string
  description?: string
  keywords?: string
  image?: string
  url?: string
  type?: string
  pathname?: string
  breadcrumbs?: BreadcrumbItem[]
  noindex?: boolean
}

function normalizePathname(path: string): string {
  return path.replace(/\/$/, '') || '/'
}

const SEO = ({
  title,
  description,
  keywords,
  image,
  url,
  type = 'website',
  pathname,
  breadcrumbs,
  noindex = false,
}: SEOProps) => {
  const location = useLocation()
  const resolvedPathname = pathname ?? normalizePathname(location.pathname)
  const routeMeta = getRouteSeo(resolvedPathname)
  const resolvedTitle = title ?? routeMeta.title
  const resolvedDescription = description ?? routeMeta.description
  const resolvedKeywords = keywords ?? routeMeta.keywords
  const siteUrl = getSiteUrl()
  const canonical = url ?? canonicalUrl(resolvedPathname)
  const ogImage = image ?? `${siteUrl}/og-image.jpg`
  const fullTitle = formatDocumentTitle(resolvedTitle, routeMeta.branded)

  const jsonLdBlocks: object[] = [
    organizationJsonLd(),
    webSiteJsonLd(),
    webApplicationJsonLd(),
  ]
  if (resolvedPathname === '/') {
    jsonLdBlocks.push(sportsEventJsonLd())
  }
  if (breadcrumbs && breadcrumbs.length > 0) {
    jsonLdBlocks.push(breadcrumbJsonLd(breadcrumbs))
  }

  return (
    <Helmet>
      <html lang="he" dir="rtl" />
      <title>{fullTitle}</title>
      <meta name="description" content={resolvedDescription} />
      <meta name="keywords" content={resolvedKeywords} />
      <link rel="canonical" href={canonical} />
      {noindex && <meta name="robots" content="noindex, nofollow" />}

      <meta property="og:type" content={type} />
      <meta property="og:url" content={canonical} />
      <meta property="og:title" content={fullTitle} />
      <meta property="og:description" content={resolvedDescription} />
      <meta property="og:image" content={ogImage} />
      <meta property="og:locale" content="he_IL" />

      <meta name="twitter:card" content="summary_large_image" />
      <meta name="twitter:url" content={canonical} />
      <meta name="twitter:title" content={fullTitle} />
      <meta name="twitter:description" content={resolvedDescription} />
      <meta name="twitter:image" content={ogImage} />

      <link rel="icon" type="image/x-icon" href="/tab-logo.ico" />
      <link rel="apple-touch-icon" href="/apple-touch-icon.png" />

      {jsonLdBlocks.map((block, i) => (
        <script key={i} type="application/ld+json">
          {JSON.stringify(block)}
        </script>
      ))}
    </Helmet>
  )
}

export default SEO
