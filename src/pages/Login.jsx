import React, { useState } from 'react';
import { supabase } from '../lib/supabaseClient';
import toast from 'react-hot-toast';

const Login = () => {
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState(null);

  // Handle Google OAuth
  const handleGoogleLogin = async () => {
    setError(null);
    setIsLoading(true);

    try {
      const { error: oauthError } = await supabase.auth.signInWithOAuth({
        provider: 'google',
        options: {
          redirectTo: `${window.location.origin}/auth/callback`,
          // Enable account linking for same email
          queryParams: {
            access_type: 'offline',
            prompt: 'consent',
          },
        },
      });

      if (oauthError) {
        const errorMsg = oauthError.message || 'Google sign-in failed';
        setError(errorMsg);
        toast.error(errorMsg);
        setIsLoading(false);
      }
      // OAuth redirects automatically, so we don't need to navigate manually
    } catch (err) {
      console.error('OAuth error:', err);
      const errorMsg = err.message || 'OAuth sign-in failed';
      setError(errorMsg);
      toast.error(errorMsg);
      setIsLoading(false);
    }
  };

  // Handle GitHub OAuth
  const handleGitHubLogin = async () => {
    setError(null);
    setIsLoading(true);

    try {
      const { error: oauthError } = await supabase.auth.signInWithOAuth({
        provider: 'github',
        options: {
          redirectTo: `${window.location.origin}/auth/callback`,
          // Enable account linking for same email
        },
      });

      if (oauthError) {
        const errorMsg = oauthError.message || 'GitHub sign-in failed';
        setError(errorMsg);
        toast.error(errorMsg);
        setIsLoading(false);
      }
      // OAuth redirects automatically, so we don't need to navigate manually
    } catch (err) {
      console.error('OAuth error:', err);
      const errorMsg = err.message || 'OAuth sign-in failed';
      setError(errorMsg);
      toast.error(errorMsg);
      setIsLoading(false);
    }
  };

  // Handle Discord OAuth
  const handleDiscordLogin = async () => {
    setError(null);
    setIsLoading(true);

    try {
      const { error: oauthError } = await supabase.auth.signInWithOAuth({
        provider: 'discord',
        options: {
          redirectTo: `${window.location.origin}/auth/callback`,
          // Enable account linking for same email
        },
      });

      if (oauthError) {
        const errorMsg = oauthError.message || 'Discord sign-in failed';
        setError(errorMsg);
        toast.error(errorMsg);
        setIsLoading(false);
      }
      // OAuth redirects automatically, so we don't need to navigate manually
    } catch (err) {
      console.error('OAuth error:', err);
      const errorMsg = err.message || 'OAuth sign-in failed';
      setError(errorMsg);
      toast.error(errorMsg);
      setIsLoading(false);
    }
  };

  return (
    <>
      {/* Dark Neon Theme Styles */}
      <style>{`
        .login-animated-bg {
          background: linear-gradient(to bottom right, #111827, #000000, #581c87);
          position: relative;
        }
        
        .login-glass-card {
          background: rgba(0, 0, 0, 0.7);
          backdrop-filter: blur(10px);
          -webkit-backdrop-filter: blur(10px);
          border: 1px solid rgba(147, 51, 234, 0.2);
          box-shadow: 0 0 60px -15px rgba(147, 51, 234, 0.5),
                      0 0 100px -30px rgba(147, 51, 234, 0.3),
                      0 4px 30px rgba(0, 0, 0, 0.8);
        }
        
        .login-gradient-text {
          background: linear-gradient(135deg, #ffffff 0%, #9ca3af 100%);
          -webkit-background-clip: text;
          -webkit-text-fill-color: transparent;
          background-clip: text;
        }
        
        @keyframes login-spin {
          to { transform: rotate(360deg); }
        }
        
        .login-spinner {
          display: inline-block;
          width: 16px;
          height: 16px;
          border: 2px solid rgba(255, 255, 255, 0.3);
          border-top-color: #ffffff;
          border-radius: 50%;
          animation: login-spin 0.8s linear infinite;
          margin-right: 8px;
          vertical-align: middle;
        }
      `}</style>

      <div
        className="login-animated-bg"
        style={{
          width: '100%',
          height: '100vh',
          display: 'flex',
          justifyContent: 'center',
          alignItems: 'center',
          padding: '24px',
          position: 'relative',
          overflow: 'hidden',
          backgroundColor: '#0f1012', // Deep blackish-grey base
        }}
      >
        {/* Subtle purple gradient overlay at corners */}
        <div style={{
          position: 'absolute',
          top: 0,
          left: 0,
          width: '100%',
          height: '100%',
          background: 'radial-gradient(ellipse at top left, rgba(147, 51, 234, 0.15) 0%, transparent 50%)',
          pointerEvents: 'none',
        }} />
        <div style={{
          position: 'absolute',
          bottom: 0,
          right: 0,
          width: '100%',
          height: '100%',
          background: 'radial-gradient(ellipse at bottom right, rgba(147, 51, 234, 0.15) 0%, transparent 50%)',
          pointerEvents: 'none',
        }} />

        <div
          className="login-glass-card"
          style={{
            borderRadius: '24px',
            padding: '48px',
            width: '100%',
            maxWidth: '420px',
            position: 'relative',
            zIndex: 10,
          }}
        >
          <h1
            className="login-gradient-text"
            style={{
              fontSize: '32px',
              fontWeight: '700',
              marginBottom: '8px',
              textAlign: 'center',
            }}
          >
            Welcome to MindFlow
          </h1>
          <p style={{
            fontSize: '16px',
            color: 'rgba(255, 255, 255, 0.6)',
            marginBottom: '40px',
            textAlign: 'center',
          }}>
            Sign in to continue
          </p>

          {error && (
            <div style={{
              backgroundColor: 'rgba(239, 68, 68, 0.1)',
              border: '1px solid rgba(239, 68, 68, 0.3)',
              borderRadius: '12px',
              padding: '12px 16px',
              marginBottom: '24px',
              color: '#fca5a5',
              fontSize: '14px',
            }}>
              {error}
            </div>
          )}

          {/* Google OAuth Button */}
          <button
            type="button"
            onClick={handleGoogleLogin}
            disabled={isLoading}
            style={{
              width: '100%',
              background: 'rgba(255, 255, 255, 0.95)',
              color: '#1a1a1a',
              border: '1px solid rgba(255, 255, 255, 0.2)',
              padding: '16px 24px',
              borderRadius: '12px',
              fontSize: '16px',
              fontWeight: '600',
              cursor: isLoading ? 'not-allowed' : 'pointer',
              transition: 'all 0.3s ease',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '12px',
              opacity: isLoading ? 0.6 : 1,
              marginBottom: '16px',
              boxShadow: '0 2px 8px rgba(0, 0, 0, 0.1)',
            }}
            onMouseEnter={(e) => {
              if (!isLoading) {
                e.currentTarget.style.transform = 'scale(1.02)';
                e.currentTarget.style.background = '#ffffff';
                e.currentTarget.style.boxShadow = '0 4px 12px rgba(255, 255, 255, 0.15)';
              }
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.transform = 'scale(1)';
              e.currentTarget.style.background = 'rgba(255, 255, 255, 0.95)';
              e.currentTarget.style.boxShadow = '0 2px 8px rgba(0, 0, 0, 0.1)';
            }}
          >
            {isLoading ? (
              <>
                <span className="login-spinner" />
                Signing in...
              </>
            ) : (
              <>
                <svg
                  style={{ width: '20px', height: '20px' }}
                  viewBox="0 0 24 24"
                >
                  <path
                    fill="#4285F4"
                    d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                  />
                  <path
                    fill="#34A853"
                    d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                  />
                  <path
                    fill="#FBBC05"
                    d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
                  />
                  <path
                    fill="#EA4335"
                    d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
                  />
                </svg>
                Sign in with Google
              </>
            )}
          </button>

          {/* GitHub OAuth Button */}
          <button
            type="button"
            onClick={handleGitHubLogin}
            disabled={isLoading}
            style={{
              width: '100%',
              background: 'rgba(36, 41, 47, 0.95)',
              color: '#ffffff',
              border: '1px solid rgba(255, 255, 255, 0.1)',
              padding: '16px 24px',
              borderRadius: '12px',
              fontSize: '16px',
              fontWeight: '600',
              cursor: isLoading ? 'not-allowed' : 'pointer',
              transition: 'all 0.3s ease',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '12px',
              opacity: isLoading ? 0.6 : 1,
              marginBottom: '16px',
              boxShadow: '0 2px 8px rgba(0, 0, 0, 0.2)',
            }}
            onMouseEnter={(e) => {
              if (!isLoading) {
                e.currentTarget.style.transform = 'scale(1.02)';
                e.currentTarget.style.background = 'rgba(36, 41, 47, 1)';
                e.currentTarget.style.boxShadow = '0 4px 12px rgba(0, 0, 0, 0.3)';
              }
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.transform = 'scale(1)';
              e.currentTarget.style.background = 'rgba(36, 41, 47, 0.95)';
              e.currentTarget.style.boxShadow = '0 2px 8px rgba(0, 0, 0, 0.2)';
            }}
          >
            {isLoading ? (
              <>
                <span className="login-spinner" />
                Signing in...
              </>
            ) : (
              <>
                <svg
                  style={{ width: '20px', height: '20px', fill: '#ffffff' }}
                  viewBox="0 0 24 24"
                >
                  <path
                    fillRule="evenodd"
                    d="M12 2C6.477 2 2 6.484 2 12.017c0 4.425 2.865 8.18 6.839 9.504.5.092.682-.217.682-.483 0-.237-.008-.868-.013-1.703-2.782.605-3.369-1.343-3.369-1.343-.454-1.158-1.11-1.466-1.11-1.466-.908-.62.069-.608.069-.608 1.003.07 1.531 1.032 1.531 1.032.892 1.53 2.341 1.088 2.91.832.092-.647.35-1.088.636-1.338-2.22-.253-4.555-1.113-4.555-4.951 0-1.093.39-1.988 1.029-2.688-.103-.253-.446-1.272.098-2.65 0 0 .84-.27 2.75 1.026A9.564 9.564 0 0112 6.844c.85.004 1.705.115 2.504.337 1.909-1.296 2.747-1.027 2.747-1.027.546 1.379.202 2.398.1 2.651.64.7 1.028 1.595 1.028 2.688 0 3.848-2.339 4.695-4.566 4.943.359.309.678.92.678 1.855 0 1.338-.012 2.419-.012 2.747 0 .268.18.58.688.482A10.019 10.019 0 0022 12.017C22 6.484 17.522 2 12 2z"
                    clipRule="evenodd"
                  />
                </svg>
                Sign in with GitHub
              </>
            )}
          </button>

          {/* Discord OAuth Button */}
          <button
            type="button"
            onClick={handleDiscordLogin}
            disabled={isLoading}
            style={{
              width: '100%',
              background: 'rgba(88, 101, 242, 0.95)',
              color: '#ffffff',
              border: '1px solid rgba(255, 255, 255, 0.1)',
              padding: '16px 24px',
              borderRadius: '12px',
              fontSize: '16px',
              fontWeight: '600',
              cursor: isLoading ? 'not-allowed' : 'pointer',
              transition: 'all 0.3s ease',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '12px',
              opacity: isLoading ? 0.6 : 1,
              boxShadow: '0 2px 8px rgba(88, 101, 242, 0.3)',
            }}
            onMouseEnter={(e) => {
              if (!isLoading) {
                e.currentTarget.style.transform = 'scale(1.02)';
                e.currentTarget.style.background = 'rgba(88, 101, 242, 1)';
                e.currentTarget.style.boxShadow = '0 4px 12px rgba(88, 101, 242, 0.4)';
              }
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.transform = 'scale(1)';
              e.currentTarget.style.background = 'rgba(88, 101, 242, 0.95)';
              e.currentTarget.style.boxShadow = '0 2px 8px rgba(88, 101, 242, 0.3)';
            }}
          >
            {isLoading ? (
              <>
                <span className="login-spinner" />
                Signing in...
              </>
            ) : (
              <>
                <svg
                  style={{ width: '20px', height: '20px', fill: '#ffffff' }}
                  viewBox="0 0 24 24"
                >
                  <path d="M20.317 4.37a19.791 19.791 0 00-4.885-1.515.074.074 0 00-.079.037c-.21.375-.444.864-.608 1.25a18.27 18.27 0 00-5.487 0 12.64 12.64 0 00-.617-1.25.077.077 0 00-.079-.037A19.736 19.736 0 003.677 4.37a.07.07 0 00-.032.027C.533 9.046-.32 13.58.099 18.057a.082.082 0 00.031.057 19.9 19.9 0 005.993 3.03.078.078 0 00.084-.028c.462-.63.874-1.295 1.226-1.994a.076.076 0 00-.041-.106 13.107 13.107 0 01-1.872-.892.077.077 0 01-.008-.128 10.2 10.2 0 00.372-.292.074.074 0 01.077-.01c3.928 1.793 8.18 1.793 12.062 0a.074.074 0 01.078.01c.12.098.246.198.373.292a.077.077 0 01-.006.127 12.299 12.299 0 01-1.873.892.077.077 0 00-.041.107c.36.698.772 1.362 1.225 1.993a.076.076 0 00.084.028 19.839 19.839 0 006.002-3.03.077.077 0 00.032-.054c.5-5.177-.838-9.674-3.549-13.66a.061.061 0 00-.031-.03zM8.02 15.33c-1.183 0-2.157-1.085-2.157-2.419 0-1.333.956-2.419 2.157-2.419 1.21 0 2.176 1.096 2.157 2.42 0 1.333-.956 2.418-2.157 2.418zm7.975 0c-1.183 0-2.157-1.085-2.157-2.419 0-1.333.955-2.419 2.157-2.419 1.21 0 2.176 1.096 2.157 2.42 0 1.333-.946 2.418-2.157 2.418z" />
                </svg>
                Sign in with Discord
              </>
            )}
          </button>

          <p style={{
            fontSize: '12px',
            color: 'rgba(255, 255, 255, 0.4)',
            marginTop: '32px',
            textAlign: 'center',
            lineHeight: '1.5',
          }}>
            By signing in, you agree to our Terms of Service and Privacy Policy.
            <br />
            Accounts with the same email address are automatically linked.
          </p>
        </div>
      </div>
    </>
  );
};

export default Login;
