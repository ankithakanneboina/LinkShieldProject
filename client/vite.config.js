import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// The Express backend listens on :4000 in development (see the root .env.example).
const apiProxy = { '/api': { target: 'http://localhost:4000', changeOrigin: true } };

export default defineConfig({
  plugins: [react()],
  server: { port: 5173, proxy: apiProxy },
  preview: { port: 4173, proxy: apiProxy },
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: './src/test/setup.js',
    css: false,
  },
});
