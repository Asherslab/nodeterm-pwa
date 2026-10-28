import { defineConfig } from 'vitest/config'
import preact from '@preact/preset-vite'
import { serviceWorker } from './build/service-worker.ts'

export default defineConfig({
  plugins: [preact(), serviceWorker()],
  server: {
    // Development only: the same two routes the add-on proxies (server/server.mjs), so the app talks
    // to /api/relay/* identically in dev and in production.
    proxy: {
      '/api/relay': {
        target: 'https://api.nodeterm.dev',
        changeOrigin: true,
        rewrite: (p) => p.replace(/^\/api\/relay/, '/v1/relay')
      }
    }
  },
  test: { environment: 'node', include: ['src/**/*.test.ts', 'server/**/*.test.ts'] }
})
