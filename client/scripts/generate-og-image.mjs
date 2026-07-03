import sharp from 'sharp'
import { join, dirname } from 'path'
import { fileURLToPath } from 'url'
import dotenv from 'dotenv'

const __dirname = dirname(fileURLToPath(import.meta.url))
dotenv.config({ path: join(__dirname, '..', '.env') })
const publicDir = join(__dirname, '..', 'public')

const GREEN = '#509238'

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

console.log('Wrote pwa-192x192.png, pwa-512x512.png, apple-touch-icon.png')
