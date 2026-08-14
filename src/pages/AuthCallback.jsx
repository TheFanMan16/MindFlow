import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../lib/supabaseClient';
import { Card, Button } from '../components/ui';

const AuthCallback = () => {
  const navigate = useNavigate();
  const [error, setError] = useState(null);

  useEffect(() => {
    let mounted = true;
    let subscription = null;
    let timeout = null;

    // Set up auth state change listener
    const {
      data: { subscription: authSubscription },
    } = supabase.auth.onAuthStateChange(async (event, session) => {
      if (!mounted) return;

      console.log('AuthCallback - Auth state change:', event);

      if (event === 'SIGNED_IN' && session) {
        console.log('AuthCallback - Session established, navigating to dashboard');
        if (timeout) clearTimeout(timeout);

        // Navigate to dashboard
        navigate('/dashboard', { replace: true });
      } else if (event === 'SIGNED_OUT') {
        console.log('AuthCallback - Signed out, navigating to login');
        if (timeout) clearTimeout(timeout);
        navigate('/login', { replace: true });
      }
    });
    subscription = authSubscription;

    // Also check for existing session immediately
    const checkSession = async () => {
      try {
        const { data: { session }, error: sessionError } = await supabase.auth.getSession();

        if (!mounted) return;

        if (sessionError) {
          console.error('AuthCallback - Session check error:', sessionError);
          setError('Failed to authenticate. Please try again.');
          timeout = setTimeout(() => {
            if (mounted) navigate('/login', { replace: true });
          }, 3000);
          return;
        }

        if (session) {
          console.log('AuthCallback - Session found, navigating to dashboard');
          if (timeout) clearTimeout(timeout);
          navigate('/dashboard', { replace: true });
        } else {
          // No session found, wait a bit for auth state change
          console.log('AuthCallback - No session found, waiting for auth state change...');
          timeout = setTimeout(() => {
            if (mounted) {
              console.warn('AuthCallback - Timeout waiting for session');
              setError('Authentication timeout. Please try signing in again.');
              setTimeout(() => {
                if (mounted) navigate('/login', { replace: true });
              }, 3000);
            }
          }, 5000);
        }
      } catch (err) {
        console.error('AuthCallback - Error checking session:', err);
        if (mounted) {
          setError('An error occurred during authentication.');
          timeout = setTimeout(() => {
            if (mounted) navigate('/login', { replace: true });
          }, 3000);
        }
      }
    };

    checkSession();

    // Cleanup
    return () => {
      mounted = false;
      if (subscription) {
        subscription.unsubscribe();
      }
      if (timeout) {
        clearTimeout(timeout);
      }
    };
  }, [navigate]);

  return (
    <div className="flex min-h-screen w-full flex-col items-center justify-center bg-canvas p-6">
      {error ? (
        /* Error: the failure message, what happens next, and an immediate
           way out - the auto-redirect still fires as a fallback. */
        <div
          role="alert"
          className="flex w-full max-w-[400px] flex-col items-center rounded-lg border border-danger-line bg-danger-wash p-6 text-center"
        >
          <p className="text-body-sm text-danger">{error}</p>
          <p className="mt-2 text-label-sm text-secondary">
            Sending you back to sign in…
          </p>
          <Button
            variant="secondary"
            size="sm"
            className="mt-4"
            onClick={() => navigate('/login', { replace: true })}
          >
            Back to sign in now
          </Button>
        </div>
      ) : (
        /* Loading: static by rule (no spinner, nothing loops). This page is
           transient - it resolves into a redirect, so words carry the state. */
        <Card className="w-full max-w-[400px] p-6 text-center" aria-busy="true">
          <p className="text-body font-medium text-primary">Completing sign in…</p>
          <p className="mt-1.5 text-body-sm text-secondary">
            Confirming your session — you'll land on the dashboard in a moment.
          </p>
        </Card>
      )}
    </div>
  );
};

export default AuthCallback;
