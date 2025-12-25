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

// Environment variables are prefixed with VITE_ in Vite
const config = {
  // Gemini AI API - Now handled via Supabase Edge Function (generate-flashcards)
  // API key is stored securely in the Edge Function, not in frontend

  // Stripe
  stripe: {
    publishableKey: import.meta.env.VITE_STRIPE_PUBLISHABLE_KEY,
    priceId: import.meta.env.VITE_STRIPE_PRICE_ID || 'price_1Si0mZCeNi12DQQTN2jcPYJT', // Pro plan price ID
  },

  // Supabase
  supabase: {
    url: import.meta.env.VITE_SUPABASE_URL,
    anonKey: import.meta.env.VITE_SUPABASE_ANON_KEY,
  },

  // Environment
  env: import.meta.env.VITE_ENV || 'development',
  isDevelopment: import.meta.env.DEV,
  isProduction: import.meta.env.PROD,
};

// Validate required environment variables
const validateConfig = () => {
  const required = [
    'VITE_STRIPE_PUBLISHABLE_KEY',
    'VITE_SUPABASE_URL',
    'VITE_SUPABASE_ANON_KEY',
  ];

  const missing = required.filter(key => !import.meta.env[key]);

  if (missing.length > 0 && config.isProduction) {
    console.error('Missing required environment variables:', missing);
    // In production, you might want to throw an error
    // throw new Error(`Missing required environment variables: ${missing.join(', ')}`);
  }

  if (missing.length > 0) {
    console.warn('Missing environment variables (app may not work correctly):', missing);
  }
};

// Validate on import
validateConfig();

export default config;

