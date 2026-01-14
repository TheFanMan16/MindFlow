import React, { useState, useEffect } from 'react';
import { Routes, Route, Navigate, useNavigate, useLocation } from 'react-router-dom';
import { Toaster } from 'react-hot-toast';
import { supabase } from './lib/supabaseClient';
import Sidebar from './components/Sidebar';
import Dashboard from './components/Dashboard';
import BlurtingMode from './components/BlurtingMode';
import TimerMode from './components/TimerMode';
import SettingsMode from './components/SettingsMode';
import ProfileMode from './components/ProfileMode';
import FeynmanMode from './components/FeynmanMode';
import FlashcardMode from './components/FlashcardMode';
import FlashcardStudy from './components/FlashcardStudy';
import GestureFlashcards from './components/GestureFlashcards';
import StudyInterface from './components/StudyInterface';
import Success from './pages/Success';
import Login from './pages/Login';
import UpdatePassword from './pages/Auth/UpdatePassword';
import AuthCallback from './pages/AuthCallback';
import SentryModal from './components/SentryModal';
import MiniTimer from './components/MiniTimer';
import { useAuth } from './context/AuthContext';
import { ProfileProvider } from './context/ProfileContext';

// Main Layout Component (with Sidebar)
const MainLayout = ({ children }) => {
  return (
    <ProfileProvider>
      <div className="flex h-screen w-screen bg-slate-950 text-white overflow-hidden">
        <Sidebar />
        <main className="flex-1 h-full overflow-y-auto overflow-x-hidden p-6 relative">
          {children}
        </main>
      </div>
    </ProfileProvider>
  );
};

function App() {
  const navigate = useNavigate();
  const location = useLocation();
  const [session, setSession] = useState(null);
  const [loading, setLoading] = useState(true);
  const [isPasswordRecovery, setIsPasswordRecovery] = useState(false);

  useEffect(() => {
    let mounted = true;
    let oauthCallbackTimeout = null;

    // Helper function to check if URL contains OAuth callback tokens
    const hasOAuthCallbackTokens = () => {
      const hash = window.location.hash;
      // Check for access_token, code, or type=recovery in hash (OAuth callback indicators)
      return hash.includes('access_token') || 
             hash.includes('code=') || 
             hash.includes('type=recovery') ||
             hash.includes('#access_token') ||
             hash.includes('#code=');
    };

    // Initial session check
    const checkSession = async () => {
      try {
        const { data: { session }, error } = await supabase.auth.getSession();
        
        if (mounted) {
          if (error) {
            console.error('Session check error:', error);
          }
          // Set session immediately if found
          setSession(session);
          
          // Check if we have OAuth callback tokens in URL (need to wait for processing)
          if (!session && hasOAuthCallbackTokens()) {
            console.log('OAuth callback detected in URL - waiting for session establishment...');
            // Don't set loading to false yet - wait for SIGNED_IN event
            // Set a timeout as fallback (5 seconds)
            oauthCallbackTimeout = setTimeout(() => {
              if (mounted && !session) {
                console.warn('OAuth callback timeout - checking session again');
                setLoading(false);
              }
            }, 5000);
          } else if (session) {
            // Session exists, we're good
            setLoading(false);
          } else {
            // No session and no OAuth tokens - wait for INITIAL_SESSION event
            // Don't set loading to false yet
          }
        }
      } catch (err) {
        console.error('Session check failed:', err);
        if (mounted) {
          setSession(null);
          setLoading(false);
        }
      }
    };

    // Run initial check immediately
    checkSession();

    // Listen for auth changes (CRITICAL: This catches OAuth redirects and password recovery)
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange(async (event, session) => {
      console.log('Auth state changed:', event, session ? 'Session exists' : 'No session');
      
      if (mounted) {
        // Clear OAuth callback timeout if set
        if (oauthCallbackTimeout) {
          clearTimeout(oauthCallbackTimeout);
          oauthCallbackTimeout = null;
        }

        // Handle PASSWORD_RECOVERY event FIRST - trap the recovery session
        if (event === 'PASSWORD_RECOVERY') {
          console.log('PASSWORD_RECOVERY event detected - setting session and navigating to /update-password');
          setSession(session);
          setIsPasswordRecovery(true);
          setLoading(false);
          navigate('/update-password');
          return; // Exit early, don't process other logic
        }

        // Handle SIGNED_IN event (happens after OAuth callback)
        if (event === 'SIGNED_IN' && session) {
          console.log('SIGNED_IN event - user authenticated successfully');
          setSession(session);
          setLoading(false);
          setIsPasswordRecovery(false);
          // Navigate to dashboard if we're on the root/login page
          const currentPath = location.pathname;
          if (currentPath === '/' || currentPath === '/login') {
            navigate('/dashboard');
          }
          return;
        }

        // Handle INITIAL_SESSION with session
        if (event === 'INITIAL_SESSION' && session) {
          console.log('INITIAL_SESSION event with session - user authenticated');
          setSession(session);
          setLoading(false);
          setIsPasswordRecovery(false);
          return;
        }

        // Handle SIGNED_OUT event
        if (event === 'SIGNED_OUT') {
          console.log('SIGNED_OUT event - user signed out');
          setSession(null);
          setLoading(false);
          setIsPasswordRecovery(false);
          return;
        }

        // Handle INITIAL_SESSION without session
        if (event === 'INITIAL_SESSION' && !session) {
          console.log('INITIAL_SESSION event without session');
          
          // Check if we're on update-password route
          const currentPath = location.pathname;
          if (currentPath.includes('/update-password')) {
            setSession(null);
            setIsPasswordRecovery(true);
            setLoading(false); // Allow UpdatePassword to render
            return;
          }

          // Check if we're on auth/callback route
          if (currentPath.includes('/auth/callback')) {
            console.log('Auth callback route detected - waiting for SIGNED_IN event...');
            // Keep loading state, wait for SIGNED_IN event
            // Set a timeout as fallback
            oauthCallbackTimeout = setTimeout(() => {
              if (mounted) {
                console.warn('OAuth callback timeout - no session established');
                setSession(null);
                setLoading(false);
              }
            }, 5000);
            return;
          }

          // Check if we have OAuth callback tokens (still processing)
          if (hasOAuthCallbackTokens()) {
            console.log('OAuth callback tokens detected - waiting for SIGNED_IN event...');
            // Keep loading state, wait for SIGNED_IN event
            // Set a timeout as fallback
            oauthCallbackTimeout = setTimeout(() => {
              if (mounted) {
                console.warn('OAuth callback timeout - no session established');
                setSession(null);
                setLoading(false);
              }
            }, 5000);
            return;
          }

          // No session, no OAuth tokens, not on update-password route
          console.log('No session found - user not authenticated');
          setSession(null);
          setLoading(false);
          setIsPasswordRecovery(false);
          return;
        }

        // Handle other events (TOKEN_REFRESHED, etc.)
        setSession(session);
        setLoading(false);
        setIsPasswordRecovery(false);
      }
    });

    return () => {
      mounted = false;
      if (oauthCallbackTimeout) {
        clearTimeout(oauthCallbackTimeout);
      }
      subscription.unsubscribe();
    };
  }, [navigate]); // Include navigate in dependency array

  // Check if we're on the update-password route (allow it even with/without session for recovery)
  const isUpdatePasswordRoute = location.pathname === '/update-password';
  
  // Check if we're on the auth/callback route (allow it without session for OAuth callback)
  const isAuthCallbackRoute = location.pathname === '/auth/callback';

  // Show loading state while checking session (but allow UpdatePassword and AuthCallback to render)
  if (loading && !isUpdatePasswordRoute && !isAuthCallbackRoute && !isPasswordRecovery) {
    return (
      <div className="flex h-screen w-screen bg-slate-950 text-white items-center justify-center">
        <div className="flex flex-col items-center gap-6">
          <div className="w-12 h-12 border-4 border-white/10 border-t-purple-500 rounded-full animate-spin" />
          <div className="text-slate-400 text-lg">Loading...</div>
        </div>
      </div>
    );
  }

  // If we're on update-password route OR password recovery is active, render UpdatePassword
  // This is necessary for password recovery flow - allows it even WITH a recovery session
  if (isUpdatePasswordRoute || isPasswordRecovery) {
    return (
      <div className="flex h-screen w-screen bg-slate-950 text-white overflow-hidden">
        <Toaster
          position="top-right"
          toastOptions={{
            style: {
              background: '#1f2937',
              color: '#ffffff',
              border: '1px solid rgba(55, 65, 81, 0.5)',
              borderRadius: '12px',
              padding: '16px',
            },
            success: {
              iconTheme: {
                primary: '#22c55e',
                secondary: '#ffffff',
              },
            },
            error: {
              iconTheme: {
                primary: '#ef4444',
                secondary: '#ffffff',
              },
            },
          }}
        />
        <Routes>
          {/* PUBLIC ROUTE: Update Password - accessible without authentication for password recovery */}
          <Route 
            path="/update-password" 
            element={
              <div className="flex h-full w-full bg-slate-950 text-white overflow-hidden items-center justify-center">
                <UpdatePassword />
              </div>
            } 
          />
          {/* Catch all - redirect to login if not on update-password */}
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </div>
    );
  }

  // If we're on auth/callback route, render AuthCallback (public route for OAuth)
  if (isAuthCallbackRoute) {
    return (
      <div className="flex h-screen w-screen bg-slate-950 text-white overflow-hidden">
        <Toaster
          position="top-right"
          toastOptions={{
            style: {
              background: '#1f2937',
              color: '#ffffff',
              border: '1px solid rgba(55, 65, 81, 0.5)',
              borderRadius: '12px',
              padding: '16px',
            },
            success: {
              iconTheme: {
                primary: '#22c55e',
                secondary: '#ffffff',
              },
            },
            error: {
              iconTheme: {
                primary: '#ef4444',
                secondary: '#ffffff',
              },
            },
          }}
        />
        <Routes>
          {/* PUBLIC ROUTE: Auth Callback - accessible without authentication for OAuth callback */}
          <Route 
            path="/auth/callback" 
            element={<AuthCallback />} 
          />
          {/* Catch all - redirect to login if not on auth/callback */}
          <Route path="*" element={<Navigate to="/login" replace />} />
        </Routes>
      </div>
    );
  }

  // If no session, show Login page
  if (!session) {
    return <Login />;
  }

  // If session exists, show the app
  return <AppWithSentry />;
};

// Separate component to use useAuth hook (must be inside AuthProvider)
const AppWithSentry = () => {
  const navigate = useNavigate();
  const { sentryTriggered, setSentryTriggered } = useAuth();

  const handleResumeSession = () => {
    // Hide the modal
    setSentryTriggered(false);
    
    // Navigate to focus/timer page if not already there
    if (window.location.pathname !== '/focus') {
      navigate('/focus');
    }
    
    // Note: TimerMode component will handle resuming the timer
    // when it detects sentryTriggered becomes false and wasTabHiddenPaused is true
  };

  return (
    <div className="flex h-screen w-screen bg-slate-950 text-white overflow-hidden">
      {/* Mini Timer - Global timer display */}
      <MiniTimer />
      
      {/* Sentry Modal - Global overlay */}
      {sentryTriggered && (
        <SentryModal onResume={handleResumeSession} />
      )}
      
      {/* Global Toast Notifications */}
      <Toaster
        position="top-right"
        toastOptions={{
          style: {
            background: '#1f2937', // gray-800
            color: '#ffffff',
            border: '1px solid rgba(55, 65, 81, 0.5)', // gray-700
            borderRadius: '12px',
            padding: '16px',
          },
          success: {
            iconTheme: {
              primary: '#22c55e', // green-500
              secondary: '#ffffff',
            },
          },
          error: {
            iconTheme: {
              primary: '#ef4444', // red-500
              secondary: '#ffffff',
            },
          },
        }}
      />
      <Routes>
        {/* PUBLIC ROUTE: Update Password (accessible without session for password recovery) */}
        <Route 
          path="/update-password" 
          element={
            <div className="flex h-full w-full bg-slate-950 text-white overflow-hidden items-center justify-center">
              <UpdatePassword />
            </div>
          } 
        />
        
        {/* Default route - Dashboard */}
        <Route 
          path="/" 
          element={
            <MainLayout>
              <Dashboard />
            </MainLayout>
          } 
        />
        
        {/* Main App Routes */}
        <Route 
          path="/dashboard" 
          element={
            <MainLayout>
              <Dashboard />
            </MainLayout>
          } 
        />
        <Route 
          path="/blurting" 
          element={
            <MainLayout>
              <BlurtingMode />
            </MainLayout>
          } 
        />
        <Route 
          path="/focus" 
          element={
            <MainLayout>
              <TimerMode />
            </MainLayout>
          } 
        />
        <Route 
          path="/feynman" 
          element={
            <MainLayout>
              <FeynmanMode />
            </MainLayout>
          } 
        />
        <Route 
          path="/flashcards" 
          element={
            <MainLayout>
              <FlashcardMode />
            </MainLayout>
          } 
        />
        <Route 
          path="/study" 
          element={
            <div className="flex h-full w-full bg-slate-950 text-white overflow-hidden">
              <StudyInterface />
            </div>
          } 
        />
        <Route 
          path="/flashcard-study" 
          element={
            <div className="flex h-full w-full bg-slate-950 text-white overflow-hidden">
              <FlashcardStudy />
            </div>
          } 
        />
        <Route 
          path="/gesture-flashcard" 
          element={
            <div className="flex h-full w-full bg-slate-950 text-white overflow-hidden">
              <GestureFlashcards />
            </div>
          } 
        />
        <Route 
          path="/settings" 
          element={
            <MainLayout>
              <SettingsMode />
            </MainLayout>
          } 
        />
        <Route 
          path="/profile" 
          element={
            <MainLayout>
              <ProfileMode />
            </MainLayout>
          } 
        />
        <Route 
          path="/success" 
          element={
            <div className="flex h-full w-full bg-slate-950 text-white overflow-hidden items-center justify-center">
              <Success />
            </div>
          } 
        />
        
        {/* Catch All - redirect to home */}
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </div>
  );
}

export default App;
