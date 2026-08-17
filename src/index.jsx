// CRITICAL: Import config FIRST to validate environment variables before React renders
// This ensures the app fails fast in production if required env vars are missing
// If validation fails, this will throw synchronously and prevent React from rendering
import './config/api.js';

import React from 'react';
import ReactDOM from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import { MotionConfig } from 'framer-motion';
import { MotionProvider } from './motion/MotionProvider';
import { initErrorTracking } from './lib/errors';
import './index.css';

// Sentry, lazy and DSN-gated: a no-op unless VITE_SENTRY_DSN is set.
initErrorTracking();
import App from './App';
import ErrorBoundary from './components/ErrorBoundary';
import { AuthProvider } from './context/AuthContext';
import { TimerProvider } from './context/TimerContext';

// Global Error Handler: Catch and silence ./en locale errors
// This prevents "Cannot find module './en'" errors from crashing the app
// NOTE: This does NOT suppress config validation errors (they should crash the app in production)
if (typeof window !== 'undefined') {
  // CRITICAL: Add error listener at the very top before any other code runs
  window.addEventListener('error', (event) => {
    const errorMessage = event.message || '';
    
    // DO NOT suppress config validation errors - let them crash in production
    if (errorMessage.includes('Missing required environment variables') || 
        errorMessage.includes('CRITICAL:')) {
      // Let config validation errors propagate (they should crash the app)
      return false;
    }
    
    // Only suppress locale import errors
    if (errorMessage.includes('./en') || 
        errorMessage.includes("Cannot find module './en'") ||
        (errorMessage.includes("Cannot find module") && errorMessage.includes('en'))) {
      console.warn('Suppressed locale import error:', errorMessage);
      event.stopImmediatePropagation(); // Stop the error from propagating
      event.preventDefault(); // Prevent default error handling
      return true; // Indicate error was handled
    }
    return false; // Let other errors propagate normally
  }, true); // Use capture phase to catch errors early

  // Handle unhandled promise rejections (common for module loading errors)
  window.addEventListener('unhandledrejection', (event) => {
    const errorMessage = event.reason?.message || '';
    
    // DO NOT suppress config validation errors - let them crash in production
    if (errorMessage.includes('Missing required environment variables') || 
        errorMessage.includes('CRITICAL:')) {
      // Let config validation errors propagate
      return;
    }
    
    // Only suppress locale import errors
    if (errorMessage.includes("Cannot find module './en'") || 
        (errorMessage.includes("Cannot find module") && errorMessage.includes('locale')) ||
        errorMessage.includes('./en')) {
      console.warn('Suppressed locale import error from dependency:', errorMessage);
      event.preventDefault(); // Prevent the error from propagating
    }
  });
}

// PWA: register the service worker in production builds only, so dev never
// fights a stale cache.
if (import.meta.env.PROD && 'serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/sw.js').catch(() => {
      // Install-to-home-screen is an enhancement; the app works without it.
    });
  });
}

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <ErrorBoundary>
      {/* Systemic reduced-motion floor for JS-driven animation: framer
          disables transform/layout animations app-wide when the OS asks for
          reduced motion, so a future ungated animation degrades instead of
          shipping at full motion. Components still gate individually for
          their bespoke fallbacks (crossfades, static renders). */}
      <MotionProvider>
        <MotionConfig reducedMotion="user">
          <BrowserRouter>
            <AuthProvider>
              <TimerProvider>
                <App />
              </TimerProvider>
            </AuthProvider>
          </BrowserRouter>
        </MotionConfig>
      </MotionProvider>
    </ErrorBoundary>
  </React.StrictMode>
);

