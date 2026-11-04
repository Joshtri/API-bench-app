import { fileURLToPath } from 'node:url'
import process from 'node:process'
import tailwindcss from '@tailwindcss/vite'
import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

const host = process.env.TAURI_DEV_HOST

// The benchmark runs in Rust (src-tauri), not in the webview: browsers cap
// connections per host and block cross-origin calls, which would make the
// numbers wrong. The page talks to it with invoke('run_bench').
export default defineConfig({
  plugins: [react(), tailwindcss()],
  resolve: { alias: { '@': fileURLToPath(new URL('./src', import.meta.url)) } },
  build: { chunkSizeWarningLimit: 800 },

  // Tauri: keep Rust errors visible, use the fixed port tauri.conf.json expects.
  clearScreen: false,
  server: {
    port: 1420,
    strictPort: true,
    host: host || false,
    hmr: host ? { protocol: 'ws', host, port: 1421 } : undefined,
    watch: { ignored: ['**/src-tauri/**'] },
  },
})
