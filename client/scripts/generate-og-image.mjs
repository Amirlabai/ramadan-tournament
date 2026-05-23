import sharp from 'sharp'
import { join, dirname } from 'path'
import { fileURLToPath } from 'url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const publicDir = join(__dirname, '..', 'public')

const WIDTH = 1200
const HEIGHT = 630
const GREEN = '#509238'
const GOLD = '#ffae00'

const ogSvg = `
<svg width="${WIDTH}" height="${HEIGHT}" xmlns="http://www.w3.org/2000/svg">
  <defs>
    <linearGradient id="bg" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" style="stop-color:${GREEN}"/>
      <stop offset="100%" style="stop-color:#296912"/>
    </linearGradient>
  </defs>
  <rect width="100%" height="100%" fill="url(#bg)"/>
  <rect x="40" y="40" width="${WIDTH - 80}" height="${HEIGHT - 80}" rx="24" fill="none" stroke="${GOLD}" stroke-width="6"/>
  <text x="50%" y="42%" text-anchor="middle" fill="white" font-family="Arial, sans-serif" font-size="72" font-weight="bold">טורניר קיץ 2026</text>
  <text x="50%" y="58%" text-anchor="middle" fill="${GOLD}" font-family="Arial, sans-serif" font-size="40">כפר כמא — מרכז צעירים</text>
</svg>`

await sharp(Buffer.from(ogSvg)).png().toFile(join(publicDir, 'og-image.png'))

const iconSvg = `
<svg width="512" height="512" xmlns="http://www.w3.org/2000/svg">
  <rect width="512" height="512" rx="96" fill="${GREEN}"/>
  <text x="50%" y="54%" text-anchor="middle" fill="white" font-family="Arial" font-size="120" font-weight="bold">⚽</text>
</svg>`

const iconBuffer = await sharp(Buffer.from(iconSvg)).png().toBuffer()

for (const { name, size } of [
  { name: 'pwa-192x192.png', size: 192 },
  { name: 'pwa-512x512.png', size: 512 },
  { name: 'apple-touch-icon.png', size: 180 },
]) {
  await sharp(iconBuffer).resize(size, size).png().toFile(join(publicDir, name))
}

console.log('Wrote og-image.png, pwa-192x192.png, pwa-512x512.png, apple-touch-icon.png')
