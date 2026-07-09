import type { ReactElement } from 'react'
import { renderToString } from 'react-dom/server'
import { StaticRouter } from 'react-router-dom'
import { HelmetProvider } from 'react-helmet-async'
import About from './pages/About'
import Accessibility from './pages/Accessibility'
import Privacy from './pages/Privacy'
import Terms from './pages/Terms'
import TournamentRules from './pages/TournamentRules'
import {
  getRouteSeo,
  canonicalUrl,
  getSiteUrl,
  PUBLIC_SITEMAP_PATHS,
  LEGAL_PRERENDER_PATHS,
  NOINDEX_PATHS,
  NOINDEX_CANONICAL_PATHS,
} from './config/seoConfig'

const LEGAL_ROUTES: Record<string, () => ReactElement> = {
  '/about': () => <About />,
  '/accessibility': () => <Accessibility />,
  '/privacy': () => <Privacy />,
  '/terms': () => <Terms />,
  '/rules': () => <TournamentRules />,
}

const LEGAL_ROUTE_SET = new Set<string>(LEGAL_PRERENDER_PATHS)
const PUBLIC_HEAD_ONLY = new Set<string>(
  PUBLIC_SITEMAP_PATHS.filter((p) => p !== '/' && !LEGAL_ROUTE_SET.has(p))
)
const NOINDEX_ROUTE_SET = new Set<string>(NOINDEX_PATHS)

type HeadElement = { type: string; props: Record<string, string> }

function buildSeoHead(pathname: string, options?: { noindex?: boolean }) {
  const meta = getRouteSeo(pathname)
  const title =
    meta.title.includes('טורניר') || meta.title.includes('מונדיאל')
      ? meta.title
      : `${meta.title} | מונדיאל קיץ 2026`
  const canonical = canonicalUrl(pathname)
  const siteUrl = getSiteUrl()
  const elements = new Set<HeadElement>([
    { type: 'meta', props: { name: 'description', content: meta.description } },
    { type: 'link', props: { rel: 'canonical', href: canonical } },
    { type: 'meta', props: { property: 'og:url', content: canonical } },
    { type: 'meta', props: { property: 'og:title', content: title } },
    { type: 'meta', props: { property: 'og:description', content: meta.description } },
    { type: 'meta', props: { property: 'og:image', content: `${siteUrl}/og-image.jpg` } },
  ])
  if (options?.noindex) {
    elements.add({ type: 'meta', props: { name: 'robots', content: 'noindex, nofollow' } })
  }
  return { lang: 'he' as const, title, elements }
}

export async function prerender(data: { url: string }) {
  const url = new URL(data.url, 'http://localhost')
  const pathname = url.pathname.replace(/\/$/, '') || '/'

  if (NOINDEX_ROUTE_SET.has(pathname)) {
    const canonicalPath = NOINDEX_CANONICAL_PATHS[pathname] ?? pathname
    return { html: '', head: buildSeoHead(canonicalPath, { noindex: true }) }
  }

  const Page = LEGAL_ROUTES[pathname]
  if (Page) {
    const helmetContext: { helmet?: unknown } = {}
    const html = renderToString(
      <HelmetProvider context={helmetContext as object}>
        <StaticRouter location={pathname}>
          <Page />
        </StaticRouter>
      </HelmetProvider>
    )
    return { html, head: buildSeoHead(pathname) }
  }

  if (pathname === '/') {
    return {
      html: '',
      head: buildSeoHead('/'),
      links: new Set(Object.keys(LEGAL_ROUTES)),
    }
  }

  if (PUBLIC_HEAD_ONLY.has(pathname)) {
    return { html: '', head: buildSeoHead(pathname) }
  }

  return { html: '' }
}
