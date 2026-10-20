import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'

const VERSAO = new Date().toISOString()

export default defineConfig({
  define: { __VERSAO__: JSON.stringify(VERSAO) },
  plugins: [
    react(),
    // /versao.json is never precached, so the app can always ask which build is live.
    { name: 'versao', generateBundle() { (this as any).emitFile({ type: 'asset', fileName: 'versao.json', source: JSON.stringify({ v: VERSAO }) }) } },
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['img/*.png', 'img/*.svg', 'img/*.jpg'],
      manifest: {
        name: 'Puzzle Stickers · Gestão',
        short_name: 'Puzzle Gestão',
        description: 'Gestão de trabalhos, agenda, clientes, fornecedores, documentos e IVA da Puzzle Stickers.',
        lang: 'pt-MZ',
        start_url: '/',
        scope: '/',
        display: 'standalone',
        orientation: 'any',
        background_color: '#0b0b0c',
        theme_color: '#0b0b0c',
        icons: [
          { src: '/img/icon-192.png', sizes: '192x192', type: 'image/png' },
          { src: '/img/icon-512.png', sizes: '512x512', type: 'image/png' },
          { src: '/img/icon-maskable-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' }
        ]
      },
      workbox: {
        globPatterns: ['**/*.{js,mjs,css,html,png,svg,woff2}', 'img/*.jpg', 'fonts/*.woff'],
        navigateFallback: '/index.html',
        // Catalogue links open the PDF, not the app.
        navigateFallbackDenylist: [/^\/catalogos\//],
        maximumFileSizeToCacheInBytes: 4 * 1024 * 1024
      }
    })
  ],
  test: { environment: 'node' }
} as any)
