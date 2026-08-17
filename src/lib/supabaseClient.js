/**
 * Supabase Client
 * 
 * Initializes and exports the Supabase client for authentication and database operations.
 * This is a singleton instance used throughout the app.
 */

import { createClient } from '@supabase/supabase-js';

// Get Supabase credentials directly from environment variables (Vite syntax)
const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

// Safety check: Log the URL only in development (never log keys)
if (import.meta.env.DEV || import.meta.env.MODE === 'development') {
  console.log('Supabase URL:', supabaseUrl);
  console.log('Supabase Anon Key:', supabaseAnonKey ? '✅ SET' : '❌ NOT SET');
}

// Build redirect URL for Electron (uses hash routing)
const getRedirectUrl = () => {
  // For Electron, use origin with hash routing
  // In development: http://localhost:5173/#/dashboard
  // In production: file:// protocol works with hash routing
  return `${window.location.origin}/#/dashboard`;
};

// Create a mock client for when credentials are missing (prevents crashes)
const createMockSupabaseClient = () => {
  console.warn('⚠️ Using mock Supabase client - app will render but auth features will not work');
  return {
    auth: {
      getSession: () => Promise.resolve({ data: { session: null }, error: { message: 'Supabase not configured' } }),
      onAuthStateChange: () => ({ data: { subscription: { unsubscribe: () => {} } } }),
      signInWithOAuth: () => Promise.resolve({ error: { message: 'Supabase not configured' } }),
      signOut: () => Promise.resolve({ error: { message: 'Supabase not configured' } }),
      getUser: () => Promise.resolve({ data: { user: null }, error: { message: 'Supabase not configured' } }),
    },
    from: () => ({
      select: () => ({ eq: () => ({ single: () => Promise.resolve({ data: null, error: { message: 'Supabase not configured' } }) }) }),
      insert: () => ({ eq: () => Promise.resolve({ error: { message: 'Supabase not configured' } }) }),
      update: () => ({ eq: () => Promise.resolve({ error: { message: 'Supabase not configured' } }) }),
    }),
  };
};

// Safety check: Validate credentials before creating client
let supabase;

if (!supabaseUrl || !supabaseAnonKey) {
  console.error('❌ Supabase credentials are missing!');
  console.error('Please check your .env file and ensure these variables are set:');
  console.error('  - VITE_SUPABASE_URL');
  console.error('  - VITE_SUPABASE_ANON_KEY');
  console.error('');
  console.error('Current values:');
  console.error('  VITE_SUPABASE_URL:', supabaseUrl || '❌ NOT SET');
  console.error('  VITE_SUPABASE_ANON_KEY:', supabaseAnonKey ? '✅ SET' : '❌ NOT SET');
  
  // Use mock client to prevent crashes
  supabase = createMockSupabaseClient();
} else {
  // Create the actual Supabase client
  supabase = createClient(supabaseUrl, supabaseAnonKey, {
    auth: {
      // Redirect to hash-based route for Electron compatibility
      redirectTo: getRedirectUrl(),
      // Persist session in localStorage
      persistSession: true,
      // Auto refresh session
      autoRefreshToken: true,
      // CRITICAL: Detect session in URL (for OAuth callbacks with HashRouter)
      // This tells Supabase to look for tokens in hash fragments
      detectSessionInUrl: true,
    },
  });

  if (import.meta.env.DEV || import.meta.env.MODE === 'development') {
    console.log('✅ Supabase client initialized successfully');
    console.log('Supabase: Redirect URL set to:', getRedirectUrl());
  }
}

export { supabase };
export default supabase;

