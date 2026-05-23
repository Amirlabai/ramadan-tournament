import type { ReactElement } from 'react'
import { renderToString } from 'react-dom/server'
import { StaticRouter } from 'react-router-dom'
import { HelmetProvider } from 'react-helmet-async'
import About from './pages/About'
import Accessibility from './pages/Accessibility'
import Privacy from './pages/Privacy'
import Terms from './pages/Terms'
import { getRouteSeo } from './config/seoConfig'

const LEGAL_ROUTES: Record<string, () => ReactElement> = {
  '/about': () => <About />,
  '/accessibility': () => <Accessibility />,
  '/privacy': () => <Privacy />,
  '/terms': () => <Terms />,
}

export async function prerender(data: { url: string }) {
  const url = new URL(data.url, 'http://localhost')
  const pathname = url.pathname.replace(/\/$/, '') || '/'
  const Page = LEGAL_ROUTES[pathname]

  if (!Page) {
    return { html: '' }
  }

  const helmetContext: { helmet?: unknown } = {}
  const html = renderToString(
    <HelmetProvider context={helmetContext as object}>
      <StaticRouter location={pathname}>
        <Page />
      </StaticRouter>
    </HelmetProvider>
  )

  const meta = getRouteSeo(pathname)
  const title = `${meta.title} | טורניר קיץ 2026`

  return {
    html,
    head: {
      lang: 'he',
      title,
      elements: new Set([
        { type: 'meta', props: { name: 'description', content: meta.description } },
      ]),
    },
  }
}
