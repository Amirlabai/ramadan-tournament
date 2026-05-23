import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'
import { vitePrerenderPlugin } from 'vite-prerender-plugin'
import path from 'path'
import { fileURLToPath } from 'url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const isBuild = process.argv.includes('build')
const enablePrerender = isBuild && process.env.PRERENDER !== '0'

export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['favicon.ico', 'apple-touch-icon.png', 'og-image.png'],
      manifest: {
        name: 'טורניר קיץ 2026',
        short_name: 'טורניר כפר כמא',
        description: 'טורניר כפר כמא — תוצאות, טבלאות וסטטיסטיקות בזמן אמת',
        lang: 'he',
        dir: 'rtl',
        theme_color: '#509238',
        background_color: '#ffffff',
        display: 'standalone',
        start_url: '/',
        icons: [
          {
            src: 'pwa-192x192.png',
            sizes: '192x192',
            type: 'image/png',
          },
          {
            src: 'pwa-512x512.png',
            sizes: '512x512',
            type: 'image/png',
          },
          {
            src: 'pwa-512x512.png',
            sizes: '512x512',
            type: 'image/png',
            purpose: 'maskable',
          },
        ],
      },
    }),
    ...(enablePrerender
      ? [
          vitePrerenderPlugin({
            renderTarget: '#root',
            prerenderScript: path.resolve(__dirname, 'src/prerender.tsx'),
            additionalPrerenderRoutes: [
              '/about',
              '/accessibility',
              '/privacy',
              '/terms',
            ],
          }),
        ]
      : []),
  ],
})
