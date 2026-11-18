import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// En développement, l'API Django (port 8000) est servie via le proxy Vite :
// le frontend appelle /api/... sans problème de CORS ni d'URL à configurer.
const backend = process.env.VITE_BACKEND_URL || 'http://localhost:8000';

export default defineConfig({
  plugins: [react()],
  optimizeDeps: {
    exclude: ['lucide-react'],
  },
  server: {
    port: 5173,
    host: true,
    proxy: {
      '/api': backend,
      '/media': backend,
      '/graphql': backend,
      '/admin': backend,
      '/static': backend,
    },
  },
  build: {
    sourcemap: false,
    chunkSizeWarningLimit: 900,
  },
});
