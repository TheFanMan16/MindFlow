import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  base: '/',
  server: {
    port: 5173,
    strictPort: true,
    proxy: {
      '/api': {
        target: 'http://localhost:3000',
        changeOrigin: true,
        secure: false,
      },
    },
  },
  // This is the critical fix for "Cannot find module './en'"
  resolve: {
    alias: {
      // If a library looks for a locale folder that doesn't exist, 
      // we point it to a safe empty path or ignore it.
      './en': 'dayjs/locale/en.js' 
    }
  },
  build: {
    outDir: 'dist',
    commonjsOptions: {
      transformMixedEsModules: true,
    },
  },
  esbuild: {
    // Strip chatty logging from production bundles. console.error and
    // console.warn survive so real failures are still diagnosable; only the
    // narrative logs go. Marking them pure lets the minifier drop them along
    // with the arguments they build, so nothing they referenced can leak.
    // This is a backstop - do not log secrets or personal data in the first
    // place. Dev builds are unaffected.
    pure: ['console.log', 'console.debug', 'console.info', 'console.trace'],
  },
  test: {
    // jsdom so component tests can render; node-only tests still work fine.
    environment: 'jsdom',
    globals: true,
    setupFiles: ['./src/test/setup.js'],
    // Vitest otherwise walks node_modules and the Electron build output.
    include: ['src/**/*.test.{js,jsx}', 'utils/**/*.test.js'],
  },
  envPrefix: 'VITE_',
  optimizeDeps: {
    // We include @supabase/supabase-js so it's pre-bundled correctly
    include: ['@supabase/supabase-js'],
    // We exclude these to prevent them from trying to load node-specific locales
    exclude: ['electron', '@stripe/stripe-js'] // Exclude @stripe/stripe-js since it's not used and causes locale errors
  },
});