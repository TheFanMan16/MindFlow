/**
 * API Configuration
 * 
 * This file centralizes all API endpoints and keys.
 * All sensitive data comes from environment variables.
 * 
 * ⚠️ SECURITY WARNING:
 * In Vite/React apps, ALL VITE_ environment variables are BUNDLED into client-side JavaScript.
 * This means API keys are visible to anyone who inspects your app's code.
 * 
 * ✅ SAFE FOR DEVELOPMENT: Current setup is fine for local development
 * ❌ NOT SAFE FOR PRODUCTION: You MUST use a backend proxy for production
 * 
 * PROTECT YOUR KEYS:
 * 1. Set API key restrictions (domain/IP whitelist) in provider dashboards
 * 2. Set daily/monthly quotas and cost limits
 * 3. Enable usage alerts
 * 4. Monitor usage daily
 * 5. For production: Create backend API that proxies requests (keys stay on server)
 * 
 * See API_SECURITY_GUIDE.md for detailed security instructions.
 */

// CRITICAL: FAIL-FAST VALIDATION - Must run BEFORE config object is created
// This ensures the module fails to load if required variables are missing in production
// If this validation fails, the config object is never created and React never renders

// Check environment mode directly from import.meta.env (before config exists)
const isProduction = import.meta.env.PROD === true || import.meta.env.MODE === 'production';
const isDevelopment = import.meta.env.DEV === true || import.meta.env.MODE === 'development';

// Required environment variables for production
const requiredEnvVars = [
  'VITE_STRIPE_PUBLISHABLE_KEY',
  'VITE_STRIPE_PRICE_ID',
  'VITE_SUPABASE_URL',
  'VITE_SUPABASE_ANON_KEY',
  // Note: VITE_GEMINI_API_KEY is NOT required - API key is stored in Supabase Edge Function
];

// FAIL-HARD VALIDATION: Check each required variable individually
// In production, throw immediately if any required variable is missing
// This prevents the config object from being created below
// The synchronous throw prevents the module from loading, which stops React from rendering
if (isProduction) {
  for (const varName of requiredEnvVars) {
    if (!import.meta.env[varName]) {
      const errorMessage = `FATAL: Missing required environment variable ${varName}.`;
      
      // Log detailed error message
      console.error('='.repeat(80));
      console.error(errorMessage);
      console.error('='.repeat(80));
      console.error('\nThe application cannot start in production without this variable.');
      console.error(`Please set ${varName} in your hosting platform's environment configuration.`);
      console.error('='.repeat(80));
      
      // Throw synchronously - this prevents the module from loading
      // The config object below will never be created
      // React will never render because the import fails
      throw new Error(errorMessage);
    }
  }
}

// Check for missing variables (for development warnings)
const missingVars = requiredEnvVars.filter(key => !import.meta.env[key]);

// In development, warn but allow app to continue (for easier local development)
if (missingVars.length > 0 && isDevelopment) {
  console.warn('⚠️ Missing environment variables (app may not work correctly):', missingVars);
  console.warn('   Set these in your .env file for full functionality.');
}

// Determine API base URL (backend proxy)
// In production, points to Render backend; in development, points to localhost
const apiBaseUrl = import.meta.env.VITE_API_BASE_URL || (
  isProduction ? 'https://mindflow-backend.onrender.com' : 'http://localhost:3000'
);

// Only create config object if validation passed (or in development)
// In production, if validation failed above, we never reach this point
const config = {
  // Gemini AI API - Secure integration via Supabase Edge Function
  // ✅ SECURE: API key is stored in Supabase Edge Function secrets (gemini_key)
  // All API calls go through the Edge Function which verifies authentication
  gemini: {
    model: 'gemini-1.5-flash', // Model name (API key is server-side)
  },

  // Stripe
  stripe: {
    publishableKey: import.meta.env.VITE_STRIPE_PUBLISHABLE_KEY,
    priceId: import.meta.env.VITE_STRIPE_PRICE_ID, // Pro plan price ID - must be set in .env
  },

  // Supabase
  supabase: {
    url: import.meta.env.VITE_SUPABASE_URL,
    anonKey: import.meta.env.VITE_SUPABASE_ANON_KEY,
  },

  // API Backend (for all fetch requests)
  // Uses environment variable or auto-detects based on mode
  api: {
    baseUrl: apiBaseUrl,
  },

  // Environment
  env: import.meta.env.VITE_ENV || 'development',
  isDevelopment: isDevelopment,
  isProduction: isProduction,
};

export default config;