import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// Open Graph requires absolute URLs - Twitter and most other scrapers will not
// resolve a relative og:image against the page, so the card silently renders
// without an image. The canonical host is not knowable at author time, so
// index.html carries a __SITE_URL__ placeholder that this plugin substitutes at
// build time. Default keeps the previously hardcoded value.
const SITE_URL_FALLBACK = 'https://mindflow.app';

function siteUrlPlugin() {
  const siteUrl = (process.env.VITE_PUBLIC_SITE_URL || SITE_URL_FALLBACK).replace(/\/+$/, '');
  return {
    name: 'mindflow-site-url',
    transformIndexHtml(html) {
      return html.replaceAll('__SITE_URL__', siteUrl);
    },
  };
}

export default defineConfig({
  plugins: [react(), siteUrlPlugin()],
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
    // The default 'forks' pool cannot start workers on Windows here - every
    // test file dies with "Timeout waiting for worker to respond" before a
    // single test runs. Threads work fine on every platform we target.
    pool: 'threads',
    setupFiles: ['./src/test/setup.js'],
    // Vitest otherwise walks node_modules and the Electron build output.
    include: ['src/**/*.test.{js,jsx}', 'utils/**/*.test.js', 'services/**/*.test.js'],
  },
  envPrefix: 'VITE_',
  optimizeDeps: {
    // We include @supabase/supabase-js so it's pre-bundled correctly
    include: ['@supabase/supabase-js'],
    exclude: ['electron'],
  },
});