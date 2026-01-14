// CRITICAL: Import config FIRST to validate environment variables before React renders
// This ensures the app fails fast in production if required env vars are missing
// If validation fails, this will throw synchronously and prevent React from rendering
import './config/api.js';

import React from 'react';
import ReactDOM from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import './index.css';
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

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <ErrorBoundary>
      <BrowserRouter>
        <AuthProvider>
          <TimerProvider>
            <App />
          </TimerProvider>
        </AuthProvider>
      </BrowserRouter>
    </ErrorBoundary>
  </React.StrictMode>
);

