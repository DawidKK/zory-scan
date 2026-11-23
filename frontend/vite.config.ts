import { defineConfig, type PluginOption } from 'vite';
import react from '@vitejs/plugin-react';
import basicSsl from '@vitejs/plugin-basic-ssl';
import { VitePWA } from 'vite-plugin-pwa';

// HTTPS=1 → self-signed cert, żeby kamera działała przy testach z telefonu w sieci lokalnej.
const https = process.env.HTTPS === '1';

export default defineConfig({
  plugins: [
    react(),
    https && basicSsl(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['favicon.svg'],
      manifest: {
        name: 'Zory Scan',
        short_name: 'Zory Scan',
        description: 'Skaner kodów QR',
        lang: 'pl',
        start_url: '/scan',
        scope: '/',
        display: 'standalone',
        orientation: 'portrait',
        background_color: '#0F0F10',
        theme_color: '#0F0F10',
        icons: [
          { src: 'pwa-192x192.png', sizes: '192x192', type: 'image/png' },
          { src: 'pwa-512x512.png', sizes: '512x512', type: 'image/png' },
          { src: 'maskable-icon-512x512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
        ],
      },
      workbox: {
        navigateFallback: '/index.html',
        globPatterns: ['**/*.{js,css,html,svg,png,woff2}'],
      },
    }),
  ].filter(Boolean) as PluginOption[],
  server: {
    // W dev frontend woła /api/*, a Vite przekazuje to do Nesta.
    // Dzięki temu telefon w sieci lokalnej nie potrzebuje osobnego adresu API.
    proxy: {
      '/api': {
        target: 'http://localhost:3000',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/api/, ''),
      },
    },
  },
});
