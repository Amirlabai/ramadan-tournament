import { writeFileSync, readFileSync } from 'fs'
import { join, dirname } from 'path'
import { fileURLToPath } from 'url'
import dotenv from 'dotenv'

const legalPrerenderPaths = JSON.parse(
  readFileSync(join(dirname(fileURLToPath(import.meta.url)), '..', 'src', 'config', 'legal-prerender-paths.json'), 'utf8')
)
const LEGAL_SITEMAP_PATHS = new Set(legalPrerenderPaths)

const __dirname = dirname(fileURLToPath(import.meta.url))
dotenv.config({ path: join(__dirname, '..', '.env') })

let siteUrl = (process.env.VITE_SITE_URL || '').replace(/\/$/, '')
if (!siteUrl || /localhost|127\.0\.0\.1/i.test(siteUrl)) {
  dotenv.config({ path: join(__dirname, '..', '.env.production'), override: true })
  siteUrl = (process.env.VITE_SITE_URL || '').replace(/\/$/, '')
}
if (!siteUrl) {
  siteUrl = 'https://ramadan-tournament-client.vercel.app'
}
if (/localhost|127\.0\.0\.1/i.test(siteUrl) && process.env.ALLOW_LOCAL_SITEMAP !== '1') {
  console.error(
    'Refusing to write sitemap/robots with localhost URL. Set VITE_SITE_URL or ALLOW_LOCAL_SITEMAP=1.'
  )
  process.exit(1)
}

const publicDir = join(__dirname, '..', 'public')

const worldCupPaths =
  process.env.VITE_WORLD_CUP_ENABLED === 'true' || process.env.VITE_WORLD_CUP_ENABLED === '1'
    ? ['/world-cup', '/world-cup/teams', '/world-cup/schedule', '/world-cup/stats']
    : []

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
  ...worldCupPaths,
  '/about',
  '/accessibility',
  '/privacy',
  '/terms',
  '/rules',
]

const noindexPaths = ['/login', '/admin/login', '/admin', '/profile', '/player-zone']

const today = new Date().toISOString().slice(0, 10)

const urls = paths
  .map(
    (p) => `  <url>
    <loc>${siteUrl}${p === '/' ? '/' : p}</loc>
    <lastmod>${today}</lastmod>
    <changefreq>${p === '/' || p.includes('schedule') ? 'daily' : 'weekly'}</changefreq>
    <priority>${p === '/' ? '1.0' : LEGAL_SITEMAP_PATHS.has(p) ? '0.5' : '0.8'}</priority>
  </url>`
  )
  .join('\n')

const xml = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${urls}
</urlset>
`

const robots = `User-agent: *
Allow: /
${noindexPaths.map((p) => `Disallow: ${p}`).join('\n')}

Sitemap: ${siteUrl}/sitemap.xml
`

writeFileSync(join(publicDir, 'sitemap.xml'), xml, 'utf8')
writeFileSync(join(publicDir, 'robots.txt'), robots, 'utf8')
console.log(`Wrote sitemap.xml (${paths.length} URLs) → ${siteUrl}`)
console.log(`Wrote robots.txt (disallow ${noindexPaths.length} paths) → ${siteUrl}`)
