import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'
import { readFileSync, writeFileSync } from 'node:fs'

const appVersion = JSON.parse(readFileSync('./package.json', 'utf-8')).version

// Keep public/version.json in sync with package.json version
writeFileSync('./public/version.json', JSON.stringify({ version: appVersion }) + '\n')

export default defineConfig({
  define: {
    __APP_VERSION__: JSON.stringify(appVersion),
  },
  test: {
    environment: 'node',
    include: ['src/**/*.test.ts', 'src/**/*.test.tsx'],
  },
  base: '/Budget-Follow-Up/',
  build: {
    sourcemap: true,
    // ES2022 (private methods/fields, static blocks, top-level await — all
    // supported since iOS Safari 16.4) so esbuild keeps pdf.js's native
    // `#privateField`/`static {}` syntax instead of down-leveling it to a
    // WeakMap-based emulation, which appears to crash inside pdf.js's
    // getTextContent() on iOS Safari's JavaScriptCore.
    target: 'es2022',
  },
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['favicon.svg', 'apple-touch-icon.png'],
      manifest: {
        name: 'Budget Foyer',
        short_name: 'Budget',
        description: 'Suivi de budget personnel et familial',
        theme_color: '#f2f2f7',
        background_color: '#f2f2f7',
        display: 'standalone',
        orientation: 'portrait',
        start_url: '/Budget-Follow-Up/',
        icons: [
          { src: 'icon-192.png', sizes: '192x192', type: 'image/png' },
          { src: 'icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'any maskable' }
        ]
      },
      workbox: {
        globPatterns: ['**/*.{js,mjs,css,html,ico,png,svg,woff2,pfb,ttf}'],
        // All static assets are precached — no runtimeCaching needed.
        // Removing it prevents the SW from intercepting external API calls
        // (e.g. api.frankfurter.app) and logging spurious no-response errors.
        runtimeCaching: []
      }
    })
  ]
})
