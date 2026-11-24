import { defineConfig } from 'vite'
import { mockupCanvasPlugin } from './src/server'

export default defineConfig({
  root: 'demo',
  plugins: [mockupCanvasPlugin()],
  server: {
    host: '127.0.0.1',
    port: 4173,
    strictPort: false,
  },
})
