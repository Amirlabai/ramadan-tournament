import { defineConfig, type Plugin } from 'vite'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'
import { vitePrerenderPlugin } from 'vite-prerender-plugin'
import path from 'path'
import { fileURLToPath } from 'url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const isBuild = process.argv.includes('build')
const enablePrerender = isBuild && process.env.PRERENDER !== '0'

const legalPrerenderRoutes = ['/about', '/accessibility', '/privacy', '/terms']
const headOnlyPublicRoutes = [
  '/teams',
  '/schedule',
  '/stats',
  '/mvps',
  '/archive',
  '/girls',
  '/teams-girls',
  '/news-girls',
  '/archive-girls',
]
const noindexPrerenderRoutes = ['/login', '/admin/login', '/admin', '/profile', '/player-zone']

/** vite-prerender-plugin + PWA can leave open handles; Node never exits (local + CI). */
function forceExitAfterBuild(): Plugin {
  return {
    name: 'force-exit-after-build',
    apply: 'build',
    enforce: 'post',
    closeBundle() {
      setTimeout(() => process.exit(0), 250)
    },
  }
}

export default defineConfig({
  envDir: __dirname,
  resolve: {
    alias: {
      '@ramadan-tournament/shared': path.resolve(__dirname, '../shared'),
    },
  },
  server: {
    proxy: {
      '/api': {
        target: process.env.VITE_API_URL || 'http://localhost:5000',
        changeOrigin: true,
      },
      '/uploads': {
        target: process.env.VITE_API_URL || 'http://localhost:5000',
        changeOrigin: true,
      },
    },
  },
  build: {
    sourcemap: false,
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (id.includes('/pages/admin/') || id.includes('/components/admin/')) {
            return 'admin'
          }
        },
      },
    },
  },
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['favicon.ico', 'apple-touch-icon.png', 'og-image.png'],
      manifest: {
        name: 'מונדיאל קיץ 2026',
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
              ...legalPrerenderRoutes,
              ...headOnlyPublicRoutes,
              ...noindexPrerenderRoutes,
            ],
          }),
          forceExitAfterBuild(),
        ]
      : []),
  ],
})
