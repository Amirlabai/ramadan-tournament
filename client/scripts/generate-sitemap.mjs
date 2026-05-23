import { writeFileSync } from 'fs'
import { join, dirname } from 'path'
import { fileURLToPath } from 'url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const publicDir = join(__dirname, '..', 'public')

const siteUrl = (
  process.env.VITE_SITE_URL || 'https://ramadan-tournament-client.vercel.app'
).replace(/\/$/, '')

const paths = [
  '/',
  '/teams',
  '/schedule',
  '/stats',
  '/mvps',
  '/archive',
  '/girls',
  '/teams-girls',
  '/news-girls',
  '/archive-girls',
  '/player-zone',
  '/about',
  '/accessibility',
  '/privacy',
  '/terms',
]

const today = new Date().toISOString().slice(0, 10)

const urls = paths
  .map(
    (p) => `  <url>
    <loc>${siteUrl}${p === '/' ? '/' : p}</loc>
    <lastmod>${today}</lastmod>
    <changefreq>${p === '/' || p.includes('schedule') ? 'daily' : 'weekly'}</changefreq>
    <priority>${p === '/' ? '1.0' : p.startsWith('/about') || p.startsWith('/privacy') || p.startsWith('/terms') || p === '/accessibility' ? '0.5' : '0.8'}</priority>
  </url>`
  )
  .join('\n')

const xml = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${urls}
</urlset>
`

writeFileSync(join(publicDir, 'sitemap.xml'), xml, 'utf8')
console.log(`Wrote sitemap.xml (${paths.length} URLs) → ${siteUrl}`)
