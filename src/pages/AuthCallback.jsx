import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../lib/supabaseClient';

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
    <div
      style={{
        width: '100%',
        height: '100vh',
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'center',
        alignItems: 'center',
        background: 'linear-gradient(to bottom right, #111827, #000000, #581c87)',
        color: '#ffffff',
      }}
    >
      {error ? (
        <div
          style={{
            textAlign: 'center',
            padding: '24px',
            borderRadius: '12px',
            backgroundColor: 'rgba(239, 68, 68, 0.1)',
            border: '1px solid rgba(239, 68, 68, 0.3)',
            maxWidth: '400px',
          }}
        >
          <p style={{ fontSize: '16px', marginBottom: '8px', color: '#fca5a5' }}>
            {error}
          </p>
          <p style={{ fontSize: '14px', color: 'rgba(255, 255, 255, 0.6)' }}>
            Redirecting to login...
          </p>
        </div>
      ) : (
        <div style={{ textAlign: 'center' }}>
          <div
            style={{
              width: '48px',
              height: '48px',
              border: '4px solid rgba(147, 51, 234, 0.3)',
              borderTopColor: '#9333ea',
              borderRadius: '50%',
              animation: 'spin 0.8s linear infinite',
              margin: '0 auto 16px',
            }}
          />
          <p style={{ fontSize: '18px', fontWeight: '600' }}>Completing sign in...</p>
          <p style={{ fontSize: '14px', color: 'rgba(255, 255, 255, 0.6)', marginTop: '8px' }}>
            Please wait while we authenticate you.
          </p>
        </div>
      )}

      <style>{`
        @keyframes spin {
          to { transform: rotate(360deg); }
        }
      `}</style>
    </div>
  );
};

export default AuthCallback;

