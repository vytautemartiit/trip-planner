import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'

export default defineConfig(({ command }) => ({
  base: command === 'build' ? '/trip-planner/' : '/',
  test: { environment: 'jsdom' },
  build: {
    // Keep each flag as its own small file instead of inlining all 270 into the JavaScript
    assetsInlineLimit: (file) => (file.includes('flag-icons') ? false : undefined),
  },
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      workbox: {
        // App code plus the Latin fonts, so the app opens offline; flags are cached as they're seen
        globPatterns: ['**/*.{js,css,html}', 'assets/*latin*.woff2', '*.{png,svg}'],
        globIgnores: ['og-image.png'],
        runtimeCaching: [
          {
            urlPattern: ({ url }) => url.pathname.endsWith('.svg'),
            handler: 'CacheFirst',
            options: { cacheName: 'flags', expiration: { maxEntries: 300 } },
          },
        ],
      },
      manifest: {
        name: 'Trip Planner',
        short_name: 'TripPlan',
        description: 'Plan trips that fit your budget from 30+ European airports',
        theme_color: '#fce6cc',
        background_color: '#fce6cc',
        display: 'standalone',
        icons: [
          { src: 'icon-192.png', sizes: '192x192', type: 'image/png' },
          { src: 'icon-512.png', sizes: '512x512', type: 'image/png' },
        ],
      },
    }),
  ],
}))