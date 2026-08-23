import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'
import { VitePWA } from 'vite-plugin-pwa'
import pkg from './package.json'

// Served from https://<owner>.github.io/my-car/ as a GitHub Pages project
// site, so production assets need that subpath prefix; local dev stays at /.
export default defineConfig(({ command, isPreview }) => {
  const base = command === 'build' || isPreview ? '/my-car/' : '/'

  return {
    base,
    define: {
      __APP_VERSION__: JSON.stringify(pkg.version),
    },
    plugins: [
      vue(),
      VitePWA({
        registerType: 'autoUpdate',
        injectRegister: false,
        includeAssets: [
          'icons/favicon-16.png',
          'icons/favicon-32.png',
          'icons/apple-touch-icon.png',
        ],
        manifest: {
          name: 'Моя машина',
          short_name: 'Моя машина',
          description: 'Учёт пробега и техобслуживания автомобиля',
          theme_color: '#0A84FF',
          background_color: '#F2F2F7',
          display: 'standalone',
          orientation: 'portrait',
          start_url: base,
          scope: base,
          lang: 'ru',
          icons: [
            {
              src: 'icons/icon-192.png',
              sizes: '192x192',
              type: 'image/png',
            },
            {
              src: 'icons/icon-512.png',
              sizes: '512x512',
              type: 'image/png',
            },
            {
              src: 'icons/maskable-512.png',
              sizes: '512x512',
              type: 'image/png',
              purpose: 'maskable',
            },
          ],
        },
        workbox: {
          globPatterns: ['**/*.{js,css,html,png,svg,ico,webmanifest}'],
          navigateFallback: `${base}index.html`,
          runtimeCaching: [
            {
              urlPattern: ({ request }) => request.destination === 'document',
              handler: 'NetworkFirst',
              options: { cacheName: 'html-cache' },
            },
          ],
        },
        devOptions: {
          enabled: true,
          type: 'module',
        },
      }),
    ],
  }
})
