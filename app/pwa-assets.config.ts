import { defineConfig, minimal2023Preset } from '@vite-pwa/assets-generator/config'

// Gera os ícones PNG do PWA a partir de public/favicon.svg:  npm run icones
export default defineConfig({
  preset: minimal2023Preset,
  images: ['public/favicon.svg'],
})
