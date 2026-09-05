import { copyFileSync, existsSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

/**
 * Client-side routing needs the server to hand unknown paths back to the SPA.
 * Without it, loading /object/saturn or /satellites directly — or refreshing on
 * one, or opening a shared link — returns a hard 404, because no such file
 * exists in the build.
 *
 * The correct fix is a host rewrite rule (`/*` → `/index.html`), which also
 * returns a 200. This plugin is the belt-and-braces version: static hosts,
 * Render included, serve `404.html` for unmatched paths, so shipping a copy of
 * the shell under that name makes deep links work even with no host config.
 */
function spaFallback() {
  return {
    name: 'spa-404-fallback',
    apply: 'build',
    closeBundle() {
      // fileURLToPath rather than import.meta.dirname: the latter needs
      // Node >= 20.11, and the build host's version isn't ours to assume.
      const here = dirname(fileURLToPath(import.meta.url))
      const dir = resolve(here, 'dist')
      const index = resolve(dir, 'index.html')
      if (existsSync(index)) copyFileSync(index, resolve(dir, '404.html'))
    },
  }
}

// Parsec is a static front end — every data source (NASA images, JPL Horizons,
// wheretheiss.at) is called directly over CORS, so there is no dev proxy and no
// backend to run alongside it.
export default defineConfig({
  plugins: [
    react(),
    tailwindcss(),
    spaFallback(),
  ],
  build: {
    rollupOptions: {
      output: {
        // three.js is by far the largest dependency and changes far less often
        // than app code; splitting it lets browsers keep it cached across deploys.
        manualChunks: {
          three: ['three'],
          vendor: ['react', 'react-dom', 'react-router-dom'],
        },
      },
    },
    chunkSizeWarningLimit: 900,
  },
})
