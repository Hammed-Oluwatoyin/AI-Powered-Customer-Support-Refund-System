import tailwindcss from '@tailwindcss/vite'
import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), tailwindcss()],
  server: {
    // Mirrors the nginx proxy used in Docker, so the app always calls a
    // same-origin /api and never needs a configured backend URL.
    proxy: {
      '/api': 'http://localhost:3001',
    },
  },
})
