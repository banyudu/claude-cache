import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  base: '/claude-cache/',
  build: {
    outDir: '../docs',
    emptyOutDir: true,
  },
})
