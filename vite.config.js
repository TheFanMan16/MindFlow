import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  base: './',
  server: {
    port: 5173,
    strictPort: true
  },
  build: {
    outDir: 'dist'
  },
  // Expose environment variables to the client
  // Only variables prefixed with VITE_ are exposed
  envPrefix: 'VITE_',
});

