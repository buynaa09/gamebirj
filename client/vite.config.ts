import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

export default defineConfig({
  plugins: [
    react(),
    tailwindcss(),
  ],
  // Expose CLERK_* alongside VITE_* so the Clerk publishable key
  // (CLERK_PUBLISHABLE_KEY) is available via import.meta.env.
  envPrefix: ['VITE_', 'CLERK_'],
  server: {
    port: 5173,
    strictPort: true,
    host: 'localhost',
  },
})