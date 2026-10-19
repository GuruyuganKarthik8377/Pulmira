import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { defineConfig } from 'vite'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), tailwindcss()],
  server: {host:'127.0.0.1', proxy:{'/api':{target:process.env.PULMIRA_API_TARGET||'http://127.0.0.1:8000',changeOrigin:true}}},
  preview: {host:'127.0.0.1', proxy:{'/api':{target:process.env.PULMIRA_API_TARGET||'http://127.0.0.1:8000',changeOrigin:true}}},
})
