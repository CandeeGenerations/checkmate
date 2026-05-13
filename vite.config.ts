import tailwindcss from '@tailwindcss/vite'
import {sentryVitePlugin} from '@sentry/vite-plugin'
import react from '@vitejs/plugin-react'
import path from 'path'
import {defineConfig} from 'vite'

const sentryEnabled = Boolean(process.env.SENTRY_AUTH_TOKEN && process.env.SENTRY_ORG)

export default defineConfig({
  plugins: [
    react(),
    tailwindcss(),
    sentryEnabled &&
      sentryVitePlugin({
        org: process.env.SENTRY_ORG,
        project: process.env.SENTRY_PROJECT_WEB ?? 'checkmate-web',
        authToken: process.env.SENTRY_AUTH_TOKEN,
        release: {name: process.env.SENTRY_RELEASE},
        sourcemaps: {assets: './dist/**'},
      }),
  ],
  build: {
    sourcemap: 'hidden',
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
  server: {
    host: true,
    port: 5184,
    allowedHosts: ['checkmate.cgen.cc'],
    proxy: {
      '/api': 'http://localhost:5186',
    },
  },
})
