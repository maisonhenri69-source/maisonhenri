import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react()],
  // Cette ligne est cruciale pour que le site fonctionne une fois mis en ligne
  // peu importe où il est hébergé (sous-dossier ou racine)
  base: './', 
  build: {
    outDir: 'dist',
    assetsDir: 'assets',
    sourcemap: false,
  }
})