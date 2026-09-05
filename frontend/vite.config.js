import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

// Parsec is a static front end — every data source (NASA images, JPL Horizons,
// wheretheiss.at) is called directly over CORS, so there is no dev proxy and no
// backend to run alongside it.
export default defineConfig({
  plugins: [
    react(),
    tailwindcss(),
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
