import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { VitePWA } from 'vite-plugin-pwa';

// PWA plugin is the whole point of this stack change: it makes the site
// installable (home-screen icon, standalone window, offline app shell)
// on Android, iOS, Windows, and Mac from one codebase, with none of the
// $99/year Apple Developer fee that shipping through the App Store
// requires — installing a PWA from Safari is free for any user.
export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['favicon.svg'],
      manifest: {
        name: 'Nagrik — Civic Issue Reporter',
        short_name: 'Nagrik',
        description: 'Report any public infrastructure issue on a shared, aging-aware civic map.',
        theme_color: '#0A1420',
        background_color: '#0A1420',
        display: 'standalone',
        start_url: '/',
        icons: [
          { src: 'icons/icon-192.png', sizes: '192x192', type: 'image/png' },
          { src: 'icons/icon-512.png', sizes: '512x512', type: 'image/png' },
          { src: 'icons/icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
        ],
      },
      workbox: {
        // Without these two, a new deployed build sits "waiting" in the
        // background and the currently-open tab keeps running the OLD
        // cached JS until every tab for this site is fully closed and
        // reopened — which is exactly what "I gave you an updated
        // version and it still behaved like the old one" looks like
        // from a user's side. skipWaiting + clientsClaim makes a new
        // service worker take control immediately instead of waiting.
        skipWaiting: true,
        clientsClaim: true,
        cleanupOutdatedCaches: true,
        // Map tiles are cached at runtime so a previously-viewed area of
        // the map still renders offline — not full offline editing, just
        // a resilient "the map doesn't go blank on a bad connection" app shell.
        runtimeCaching: [
          {
            urlPattern: /^https:\/\/server\.arcgismaps\.com\/arcgis\/rest\/services\/Canvas\/.*/i,
            handler: 'CacheFirst',
            options: {
              cacheName: 'esri-dark-tiles',
              expiration: { maxEntries: 500, maxAgeSeconds: 60 * 60 * 24 * 14 },
            },
          },
        ],
      },
    }),
  ],
    server: {
    port: 5173,
    host: true,
    allowedHosts: ['mounted-enviably-tapeless.ngrok-free.dev'],
    proxy: {
      '/api': {
        target: 'http://localhost:8080',
        changeOrigin: true,
      },
    },
  },
});