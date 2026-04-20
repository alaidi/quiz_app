import { defineConfig } from 'vite'
import tailwindcss from '@tailwindcss/vite'
import { resolve } from 'path'

export default defineConfig({
  base: './',
  plugins: [tailwindcss()],
  build: {
    rollupOptions: {
      input: {
        index: resolve(__dirname, 'index.html'),
        host: resolve(__dirname, 'host.html'),
        screen: resolve(__dirname, 'screen.html'),
        team: resolve(__dirname, 'team.html'),
        solo: resolve(__dirname, 'solo.html'),
        soloLogin: resolve(__dirname, 'solo-login.html'),
      },
    },
  },
})
