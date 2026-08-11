import React, { useState, useEffect, lazy, Suspense } from 'react';
import { Routes, Route, Navigate, useNavigate, useLocation } from 'react-router-dom';
import { AppToaster } from './components/ui';
import { AnimatePresence, PageTransition } from './motion';
import { supabase } from './lib/supabaseClient';
import Sidebar from './components/Sidebar';
import Login from './pages/Login';
import UpdatePassword from './pages/Auth/UpdatePassword';
import AuthCallback from './pages/AuthCallback';
import NotFound from './pages/NotFound';
import SentryModal from './components/SentryModal';
import MiniTimer from './components/MiniTimer';
import CommandPalette from './components/CommandPalette';
import { useAuth } from './context/AuthContext';
import { ProfileProvider } from './context/ProfileContext';

// Study modes are split into their own chunks: each is large, and no session
// visits all of them. The shell (sidebar, auth screens, timer) stays eager so
// first paint and the login path do not wait on a second request.
const Dashboard = lazy(() => import('./components/Dashboard'));
const BlurtingMode = lazy(() => import('./components/BlurtingMode'));
const TimerMode = lazy(() => import('./components/TimerMode'));
const SettingsMode = lazy(() => import('./components/SettingsMode'));
const ProfileMode = lazy(() => import('./components/ProfileMode'));
const FeynmanMode = lazy(() => import('./components/FeynmanMode'));
const FlashcardMode = lazy(() => import('./components/FlashcardMode'));
const StudyInterface = lazy(() => import('./components/StudyInterface'));
const PanicMode = lazy(() => import('./pages/PanicMode'));
const Success = lazy(() => import('./pages/Success'));
const PrivacyPage = lazy(() => import('./pages/Legal').then((m) => ({ default: m.PrivacyPage })));
const TermsPage = lazy(() => import('./pages/Legal').then((m) => ({ default: m.TermsPage })));
const AboutPage = lazy(() => import('./pages/Legal').then((m) => ({ default: m.AboutPage })));

// Living styleguide, dev only. import.meta.env.DEV is statically false in a
// production build, so both the route and the chunk are eliminated from it.
const DesignSystem = import.meta.env.DEV ? lazy(() => import('./pages/DesignSystem')) : null;

/** Shown while a route chunk is in flight. Mirrors the session-loading state. */
const RouteFallback = () => (
  <div className="flex h-full w-full items-center justify-center py-20">
    <div className="w-10 h-10 rounded-pill border-4 border-line border-t-accent animate-spin motion-reduce:animate-none" />
  </div>
);

// Guest Layout (No Sidebar)
const GuestLayout = ({ children }) => {
  return (
    <div className="flex h-screen w-screen bg-canvas text-primary overflow-hidden">
      <main className="flex-1 h-full overflow-y-auto overflow-x-hidden relative">
        {children}
      </main>
    </div>
  );
};

// Main Layout Component (with Sidebar)
const MainLayout = ({ children }) => {
  return (
    <ProfileProvider>
      <div className="flex h-screen w-screen bg-canvas text-primary overflow-hidden">
        <Sidebar />
        {/* pb-24 clears the mobile bottom tab bar; the bar hides at sm, where
            the side rail takes over, so the clearance hides with it */}
        <main className="flex-1 h-full overflow-y-auto overflow-x-hidden p-4 pb-24 sm:pb-4 md:p-6 relative">
          {/* Inner boundary so a route chunk loads without unmounting the
              sidebar - React resolves to the nearest Suspense ancestor. */}
          <Suspense fallback={<RouteFallback />}>{children}</Suspense>
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
  const { sentryTriggered, setSentryTriggered } = useAuth();

  const handleResumeSession = () => {
    // Hide the modal
    setSentryTriggered(false);

    // Navigate to focus/timer page if not already there
    if (window.location.pathname !== '/focus') {
      navigate('/focus');
    }
  };

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
      <div className="flex h-screen w-screen bg-canvas text-primary items-center justify-center">
        <div className="flex flex-col items-center gap-6">
          <div className="w-12 h-12 rounded-pill border-4 border-line border-t-accent animate-spin motion-reduce:animate-none" />
          <div className="text-secondary text-lg">Loading...</div>
        </div>
      </div>
    );
  }

  // If we're on update-password route OR password recovery is active, render UpdatePassword
  // This is necessary for password recovery flow - allows it even WITH a recovery session
  if (isUpdatePasswordRoute || isPasswordRecovery) {
    return (
      <div className="flex h-screen w-screen bg-canvas text-primary overflow-hidden">
        <AppToaster />
        <Routes>
          {/* PUBLIC ROUTE: Update Password - accessible without authentication for password recovery */}
          <Route
            path="/update-password"
            element={
              <div className="flex h-full w-full bg-canvas text-primary overflow-hidden items-center justify-center">
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
      <div className="flex h-screen w-screen bg-canvas text-primary overflow-hidden">
        <AppToaster />
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

  return (
    <div className="flex h-screen w-screen bg-canvas text-primary overflow-hidden">
      {/* Mini Timer - Global timer display */}
      <MiniTimer />

      {/* Cmd/Ctrl+K command palette - the shell's fastest way anywhere */}
      <CommandPalette />

      {/* Sentry Modal - Global overlay */}
      {sentryTriggered && (
        <SentryModal onResume={handleResumeSession} />
      )}

      {/* Global Toast Notifications */}
      <AppToaster />
      {/* Route transitions: exit is a 120ms fade-down, enter rides the
          entrance spring. mode="wait" sequences them; initial={false} stops
          the first paint from double-animating pages that choreograph their
          own entrances. Routes must receive this location so the exiting
          tree keeps rendering the old route during its exit. */}
      <AnimatePresence mode="wait" initial={false}>
      <PageTransition key={location.pathname}>
      {/* Outer boundary for routes that render outside MainLayout. */}
      <Suspense fallback={<RouteFallback />}>
      <Routes location={location}>
        {/* PUBLIC ROUTE: Login */}
        <Route path="/login" element={<Login />} />
        {DesignSystem ? <Route path="/design" element={<DesignSystem />} /> : null}

        {/* PUBLIC ROUTE: Update Password (accessible without session for password recovery) */}
        <Route
          path="/update-password"
          element={
            <div className="flex h-full w-full bg-canvas text-primary overflow-hidden items-center justify-center">
              <UpdatePassword />
            </div>
          }
        />

        {/* PUBLIC ROUTES: Legal pages */}
        <Route
          path="/privacy"
          element={
            <GuestLayout>
              <PrivacyPage />
            </GuestLayout>
          }
        />
        <Route
          path="/terms"
          element={
            <GuestLayout>
              <TermsPage />
            </GuestLayout>
          }
        />
        <Route
          path="/about"
          element={
            <GuestLayout>
              <AboutPage />
            </GuestLayout>
          }
        />

        {/* Default route - Dashboard (Public/Guest Access) */}
        <Route
          path="/"
          element={
            <GuestLayout>
              <Dashboard />
            </GuestLayout>
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
          path="/recall"
          element={
            <MainLayout>
              <BlurtingMode />
            </MainLayout>
          }
        />
        {/* Legacy alias: the nav has always called this "Active Recall", so
            the URL now matches. Old bookmarks still land in the right place. */}
        <Route path="/blurting" element={<Navigate to="/recall" replace />} />
        <Route
          path="/panic"
          element={
            <MainLayout>
              <PanicMode />
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
            <div className="flex h-full w-full bg-canvas text-primary overflow-hidden">
              <StudyInterface />
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
            <div className="flex h-full w-full bg-canvas text-primary overflow-hidden items-center justify-center">
              <Success />
            </div>
          }
        />

        {/* Catch All - an unknown path is an error, not a silent trip home */}
        <Route
          path="*"
          element={
            <MainLayout>
              <NotFound />
            </MainLayout>
          }
        />
      </Routes>
      </Suspense>
      </PageTransition>
      </AnimatePresence>
    </div>
  );
}

export default App;
