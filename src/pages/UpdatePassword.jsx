import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../lib/supabaseClient';

const UpdatePassword = () => {
  const navigate = useNavigate();
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(false);
  const [showForm, setShowForm] = useState(false);

  // Listen for PASSWORD_RECOVERY event using onAuthStateChange
  useEffect(() => {
    let mounted = true;

    // Set up auth state change listener
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((event, session) => {
      console.log('Auth state changed:', event, session ? 'Session exists' : 'No session');
      
      if (mounted) {
        // When PASSWORD_RECOVERY event fires, show the form
        if (event === 'PASSWORD_RECOVERY') {
          console.log('PASSWORD_RECOVERY event detected - showing form');
          setShowForm(true);
          setError(null);
        } else if (event === 'SIGNED_IN' && !showForm) {
          // If user is already signed in but no recovery event, they might have navigated here directly
          // Check if they have a valid recovery session by checking the URL hash
          const hash = window.location.hash;
          if (hash.includes('access_token') && hash.includes('type=recovery')) {
            setShowForm(true);
            setError(null);
          } else {
            // Not a recovery session, redirect to dashboard
            navigate('/dashboard');
          }
        }
      }
    });

    // Also check for tokens in URL hash on mount (for hash routing)
    // Supabase will automatically parse these and trigger the PASSWORD_RECOVERY event
    const hash = window.location.hash;
    let timeoutId = null;
    
    if (hash.includes('access_token') && hash.includes('type=recovery')) {
      // Extract tokens from hash and set session to trigger the event
      try {
        const params = new URLSearchParams(hash.substring(hash.indexOf('?') + 1));
        const accessToken = params.get('access_token');
        const refreshToken = params.get('refresh_token');
        const type = params.get('type');

        if (accessToken && refreshToken && type === 'recovery') {
          // Set the session which will trigger PASSWORD_RECOVERY event
          supabase.auth.setSession({
            access_token: accessToken,
            refresh_token: refreshToken,
          }).then(({ error: sessionError }) => {
            if (sessionError) {
              console.error('Failed to set recovery session:', sessionError);
              if (mounted) {
                setError('Invalid or expired reset link. Please request a new password reset.');
                setShowForm(false);
              }
            }
            // The onAuthStateChange listener will handle showing the form
          });
        }
      } catch (err) {
        console.error('Error parsing recovery tokens:', err);
        if (mounted) {
          setError('Invalid reset link format. Please request a new password reset.');
          setShowForm(false);
        }
      }
    } else {
      // No recovery tokens in URL, check if we should wait or show error
      // Wait a moment for the auth state change to fire
      timeoutId = setTimeout(() => {
        if (mounted && !showForm) {
          setError('No password reset session found. Please request a new password reset.');
        }
      }, 2000);
    }

    // Cleanup function - always return it
    return () => {
      mounted = false;
      if (timeoutId) {
        clearTimeout(timeoutId);
      }
      subscription.unsubscribe();
    };
  }, [navigate, showForm]);

  // Handle password update
  const handleUpdatePassword = async (e) => {
    e.preventDefault();
    
    setError(null);
    setSuccess(false);

    // Validation
    if (password.length < 6) {
      setError('Password must be at least 6 characters long.');
      return;
    }

    if (password !== confirmPassword) {
      setError('Passwords do not match.');
      return;
    }

    setIsLoading(true);

    try {
      // Update the user's password
      const { error: updateError } = await supabase.auth.updateUser({
        password: password,
      });

      if (updateError) {
        setError(updateError.message || 'Failed to update password. Please try again.');
        setIsLoading(false);
        return;
      }

      // Success! Show success message
      setSuccess(true);
      setIsLoading(false);

      // Sign out the user (since they're in recovery session)
      await supabase.auth.signOut();

      // Redirect to login page with success message after 2 seconds
      // Use navigate with query parameter (HashRouter will handle hash format)
      setTimeout(() => {
        navigate('/?passwordUpdated=true', { replace: true });
      }, 2000);
    } catch (err) {
      console.error('Password update error:', err);
      setError(err.message || 'An unexpected error occurred. Please try again.');
      setIsLoading(false);
    }
  };

  // Handle "Back to Login" redirect
  const handleBackToLogin = () => {
    // Clear any session tokens from URL
    window.location.hash = '/';
    navigate('/');
  };

  return (
    <>
      {/* Dark Neon Theme Styles (matching Login) */}
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
        
        .login-input {
          background: rgba(15, 23, 42, 0.8) !important;
          border: 1px solid rgba(255, 255, 255, 0.1) !important;
          transition: all 0.3s ease !important;
          color: #ffffff !important;
        }
        
        .login-input::placeholder {
          color: rgba(255, 255, 255, 0.4) !important;
        }
        
        .login-input:focus {
          border-color: rgba(168, 85, 247, 0.5) !important;
          box-shadow: 0 0 0 3px rgba(168, 85, 247, 0.1), 0 0 20px rgba(168, 85, 247, 0.3) !important;
          outline: none !important;
          background: rgba(15, 23, 42, 0.9) !important;
        }
        
        .login-input:hover:not(:disabled) {
          border-color: rgba(255, 255, 255, 0.15) !important;
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
          backgroundColor: '#0f1012',
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
            maxWidth: '400px',
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
            Update Password
          </h1>
          <p style={{
            fontSize: '16px',
            color: 'rgba(255, 255, 255, 0.6)',
            marginBottom: '32px',
            textAlign: 'center',
          }}>
            {success 
              ? 'Password updated successfully! Redirecting to login...' 
              : 'Enter your new password below'}
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

          {success && (
            <div style={{
              backgroundColor: 'rgba(34, 197, 94, 0.1)',
              border: '1px solid rgba(34, 197, 94, 0.3)',
              borderRadius: '12px',
              padding: '12px 16px',
              marginBottom: '24px',
              color: '#86efac',
              fontSize: '14px',
            }}>
              Password updated successfully! Redirecting to login...
            </div>
          )}

          {!showForm && !success && (
            <div style={{
              marginBottom: '24px',
              textAlign: 'center',
            }}>
              <p style={{
                fontSize: '14px',
                color: 'rgba(255, 255, 255, 0.6)',
                marginBottom: '20px',
              }}>
                Waiting for password reset link...
              </p>
              <button
                type="button"
                onClick={handleBackToLogin}
                style={{
                  background: 'transparent',
                  border: '1px solid rgba(255, 255, 255, 0.2)',
                  color: 'rgba(255, 255, 255, 0.6)',
                  fontSize: '14px',
                  cursor: 'pointer',
                  padding: '10px 20px',
                  borderRadius: '12px',
                  transition: 'all 0.3s ease',
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.background = 'rgba(255, 255, 255, 0.1)';
                  e.currentTarget.style.borderColor = 'rgba(255, 255, 255, 0.3)';
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.background = 'transparent';
                  e.currentTarget.style.borderColor = 'rgba(255, 255, 255, 0.2)';
                }}
              >
                Back to Login
              </button>
            </div>
          )}

          {showForm && !success && (
            <form onSubmit={handleUpdatePassword} style={{ marginBottom: '24px' }}>
              <div style={{ marginBottom: '20px' }}>
                <label style={{
                  display: 'block',
                  fontSize: '14px',
                  fontWeight: '500',
                  color: 'rgba(255, 255, 255, 0.7)',
                  marginBottom: '8px',
                }}>
                  New Password
                </label>
                <input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  disabled={isLoading}
                  className="login-input"
                  style={{
                    width: '100%',
                    padding: '12px 16px',
                    borderRadius: '12px',
                    color: '#ffffff',
                    fontSize: '15px',
                    opacity: isLoading ? 0.6 : 1,
                  }}
                  placeholder="Enter new password"
                  minLength={6}
                />
                <div style={{
                  fontSize: '12px',
                  color: 'rgba(255, 255, 255, 0.4)',
                  marginTop: '6px',
                }}>
                  Must be at least 6 characters
                </div>
              </div>

              <div style={{ marginBottom: '20px' }}>
                <label style={{
                  display: 'block',
                  fontSize: '14px',
                  fontWeight: '500',
                  color: 'rgba(255, 255, 255, 0.7)',
                  marginBottom: '8px',
                }}>
                  Confirm Password
                </label>
                <input
                  type="password"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  required
                  disabled={isLoading}
                  className="login-input"
                  style={{
                    width: '100%',
                    padding: '12px 16px',
                    borderRadius: '12px',
                    color: '#ffffff',
                    fontSize: '15px',
                    opacity: isLoading ? 0.6 : 1,
                  }}
                  placeholder="Confirm new password"
                  minLength={6}
                />
              </div>

              <button
                type="submit"
                disabled={isLoading || success}
                style={{
                  width: '100%',
                  background: isLoading || success
                    ? 'rgba(255, 255, 255, 0.1)'
                    : 'linear-gradient(90deg, #a855f7, #ec4899)',
                  color: '#ffffff',
                  border: 'none',
                  padding: '14px 24px',
                  borderRadius: '12px',
                  fontSize: '16px',
                  fontWeight: '600',
                  cursor: isLoading || success ? 'not-allowed' : 'pointer',
                  transition: 'all 0.3s ease',
                  opacity: isLoading || success ? 0.6 : 1,
                  marginBottom: '16px',
                }}
              >
                {isLoading ? 'Saving...' : success ? 'Saved!' : 'Save'}
              </button>
            </form>
          )}

          {!success && (
            <div style={{
              textAlign: 'center',
            }}>
              <button
                type="button"
                onClick={handleBackToLogin}
                style={{
                  background: 'transparent',
                  border: 'none',
                  color: 'rgba(255, 255, 255, 0.6)',
                  fontSize: '14px',
                  cursor: 'pointer',
                  textDecoration: 'underline',
                }}
              >
                Back to Login
              </button>
            </div>
          )}
        </div>
      </div>
    </>
  );
};

export default UpdatePassword;



