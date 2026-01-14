import React, { useState, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { supabase } from '../../lib/supabaseClient';
import toast from 'react-hot-toast';

const UpdatePassword = () => {
  const navigate = useNavigate();
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState(null);
  const [isRecoveryState, setIsRecoveryState] = useState(false);
  const [success, setSuccess] = useState(false);
  const [isValidating, setIsValidating] = useState(true);

  // Parse URL hash for recovery tokens or errors
  const parseUrlHash = (hash) => {
    if (!hash || hash === '#' || hash === '#/update-password') {
      return null;
    }

    console.log('Parsing URL hash:', hash);

    // Handle multiple formats:
    // 1. #access_token=...&type=recovery (direct tokens)
    // 2. #/update-password?access_token=...&type=recovery (with route)
    // 3. #?access_token=...&type=recovery (with query start)
    let hashParams = '';
    
    if (hash.includes('?')) {
      // Format: #/update-password?access_token=... OR #?access_token=...
      hashParams = hash.substring(hash.indexOf('?') + 1);
    } else if (hash.startsWith('#') && hash.length > 1) {
      // Format: #access_token=... (no route, just params)
      hashParams = hash.substring(1);
      
      // If it doesn't start with a known param, might be a route like #/update-password
      // Check if it looks like query params (contains =)
      if (!hashParams.includes('=')) {
        return null; // Looks like a route, not params
      }
    }

    if (!hashParams || !hashParams.includes('=')) {
      console.log('No valid params found in hash');
      return null;
    }

    try {
      const params = new URLSearchParams(hashParams);
      
      // Check for errors FIRST (before checking for tokens)
      const errorParam = params.get('error');
      const errorDescription = params.get('error_description');
      if (errorParam) {
        console.error('❌ Error found in URL:', errorParam, errorDescription);
        return {
          type: 'error',
          error: errorParam,
          description: errorDescription || decodeURIComponent(errorParam) || 'An error occurred with the password reset link.',
        };
      }

      // Check for recovery tokens
      const accessToken = params.get('access_token');
      const refreshToken = params.get('refresh_token');
      const type = params.get('type');
      
      console.log('Found params:', { 
        hasAccessToken: !!accessToken, 
        hasRefreshToken: !!refreshToken, 
        type: type 
      });
      
      if (accessToken && refreshToken && type === 'recovery') {
        console.log('✅ Valid recovery tokens found in URL');
        return {
          type: 'recovery',
          accessToken,
          refreshToken,
        };
      }

      // Check if type=recovery exists but tokens are missing
      if (type === 'recovery' && (!accessToken || !refreshToken)) {
        console.error('❌ Recovery type found but tokens missing');
        return {
          type: 'error',
          error: 'invalid_token',
          description: 'Password reset link is missing required tokens. Please request a new password reset.',
        };
      }

      // Check if we have tokens but type is missing or wrong
      if ((accessToken || refreshToken) && type !== 'recovery') {
        console.warn('⚠️ Tokens found but type is not "recovery":', type);
        return {
          type: 'error',
          error: 'invalid_type',
          description: 'Invalid reset link type. Please request a new password reset.',
        };
      }

      console.log('No recovery tokens or errors found in URL hash');
      return null;
    } catch (err) {
      console.error('❌ Error parsing URL hash:', err);
      return {
        type: 'error',
        error: 'parse_error',
        description: `Invalid reset link format: ${err.message}. Please request a new password reset.`,
      };
    }
  };

  // Dedicated useEffect to check session on mount and verify recovery metadata
  useEffect(() => {
    let mounted = true;

    const checkSessionOnMount = async () => {
      try {
        const { data: { session }, error: sessionError } = await supabase.auth.getSession();
        
        if (sessionError) {
          console.error('❌ Error checking session on mount:', sessionError);
          if (mounted) {
            setError('Failed to verify session. Please try requesting a new password reset.');
            setIsValidating(false);
          }
          return;
        }

        if (session && mounted) {
          console.log('✅ Session found on mount:', {
            user: session.user?.id,
            email: session.user?.email,
            metadata: session.user?.user_metadata,
            app_metadata: session.user?.app_metadata,
          });

          // Check if user metadata indicates recovery mode
          // Supabase recovery sessions typically have specific metadata or can be detected
          // by checking the access_token type or recovery flag
          const userMetadata = session.user?.user_metadata || {};
          const appMetadata = session.user?.app_metadata || {};
          
          // Check for recovery indicators in metadata
          const isRecoveryMetadata = 
            userMetadata.recovery === true ||
            appMetadata.recovery === true ||
            session.user?.recovery_sent_at !== undefined;

          // Also check if the URL hash contains recovery tokens (most reliable indicator)
          const hash = window.location.hash;
          const urlData = parseUrlHash(hash);
          const hasRecoveryTokens = urlData && urlData.type === 'recovery';

          if (isRecoveryMetadata || hasRecoveryTokens) {
            console.log('✅ Recovery session detected via metadata or URL tokens');
            // Set recovery state - the PASSWORD_RECOVERY event should confirm this
            setIsRecoveryState(true);
            setIsValidating(false);
            setError(null);
          } else {
            console.log('ℹ️ Regular session detected (not recovery) - waiting for PASSWORD_RECOVERY event...');
            // Don't set error yet - wait for PASSWORD_RECOVERY event or timeout
          }
        } else if (!session && mounted) {
          console.log('ℹ️ No session found on mount - checking URL hash for recovery tokens...');
          // No session - check URL hash for tokens that we can use to create a session
          const hash = window.location.hash;
          const urlData = parseUrlHash(hash);
          
          if (urlData && urlData.type === 'recovery') {
            console.log('✅ Recovery tokens found in URL - will be handled by main useEffect');
            // Recovery tokens found - the main useEffect will handle setting the session
            // Keep isValidating true so the main useEffect can process it
          } else if (urlData && urlData.type === 'error') {
            console.error('❌ Error in URL on mount:', urlData);
            if (mounted) {
              setError(urlData.description || urlData.error);
              setIsValidating(false);
            }
          } else {
            // No session and no recovery tokens in URL - keep validating to allow auth listener to catch PASSWORD_RECOVERY event
            // The 5-second timeout will handle showing error if nothing happens
            console.log('ℹ️ No session and no URL tokens - waiting for auth state changes or timeout...');
          }
        }
      } catch (err) {
        console.error('❌ Unexpected error checking session:', err);
        if (mounted) {
          setError('An unexpected error occurred while verifying your session. Please try again.');
          setIsValidating(false);
        }
      }
    };

    checkSessionOnMount();
  }, []); // Run only on mount

  // Main useEffect: Use onAuthStateChange to specifically look for PASSWORD_RECOVERY event
  useEffect(() => {
    let mounted = true;
    let validationTimeout;
    let fallbackTimeout; // 5-second fallback timeout

    // Set up a 5-second fallback timeout FIRST - this ensures we always have a safety net
    // The timeout will be cleared if recovery state is confirmed or error is found
    fallbackTimeout = setTimeout(() => {
      if (mounted && !isRecoveryState && !error && isValidating) {
        console.log('⏰ 5-second validation timeout reached - showing fallback message');
        setError('Link may have expired. Please try requesting a new reset email.');
        setIsValidating(false);
      }
    }, 5000); // 5-second fallback timeout

    // SECOND: Check URL hash immediately for errors or recovery tokens
    const hash = window.location.hash;
    console.log('Checking URL hash for recovery tokens:', hash);
    const urlData = parseUrlHash(hash);

    if (urlData && urlData.type === 'error') {
      // Display error immediately - clear timeout since we found the issue
      console.error('❌ Password reset error from URL:', urlData);
      if (mounted) {
        setError(urlData.description || urlData.error || 'Invalid password reset link. Please request a new one.');
        setIsRecoveryState(false);
        setIsValidating(false);
        if (fallbackTimeout) {
          clearTimeout(fallbackTimeout);
        }
      }
      // Don't return - continue to set up auth listener in case state changes
    }

    if (urlData && urlData.type === 'recovery') {
      // Found recovery tokens in URL - set session immediately
      console.log('✅ Found recovery tokens in URL hash, setting session...');
      supabase.auth.setSession({
        access_token: urlData.accessToken,
        refresh_token: urlData.refreshToken,
      }).then(({ error: sessionError }) => {
        if (sessionError) {
          console.error('❌ Failed to set recovery session:', sessionError);
          if (mounted) {
            setError(sessionError.message || 'Invalid or expired reset link. Please request a new password reset.');
            setIsRecoveryState(false);
            setIsValidating(false);
            if (fallbackTimeout) {
              clearTimeout(fallbackTimeout);
            }
          }
        } else {
          console.log('✅ Recovery session set successfully, waiting for PASSWORD_RECOVERY event...');
          // Keep timeout active - will be cleared when PASSWORD_RECOVERY event fires
        }
      });
    } else if (!hash || hash === '#' || hash === '#/update-password' || !urlData) {
      // No recovery tokens in URL - check if we need to show error or wait
      console.log('⚠️ No recovery tokens found in URL hash:', hash);
      // Keep timeout active - will show fallback message after 5 seconds if nothing happens
    }

    // Set up auth state change listener to specifically detect PASSWORD_RECOVERY event
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((event, session) => {
      console.log('🔄 UpdatePassword: Auth state changed:', event, session ? 'Session exists' : 'No session');
      
      if (mounted) {
        // Specifically look for PASSWORD_RECOVERY event (this is the key!)
        if (event === 'PASSWORD_RECOVERY') {
          console.log('✅ PASSWORD_RECOVERY event detected - recovery state confirmed!');
          setIsRecoveryState(true);
          setError(null);
          setIsValidating(false);
          
          // Clear all timeouts
          if (validationTimeout) {
            clearTimeout(validationTimeout);
          }
          if (fallbackTimeout) {
            clearTimeout(fallbackTimeout);
          }
        } else if (event === 'SIGNED_IN' && session) {
          // If signed in, check URL hash again for recovery context
          const currentHash = window.location.hash;
          const currentUrlData = parseUrlHash(currentHash);
          
          if (currentUrlData && currentUrlData.type === 'recovery') {
            console.log('✅ Signed in with recovery tokens in URL - PASSWORD_RECOVERY event should fire next...');
            // The PASSWORD_RECOVERY event should fire after SIGNED_IN
            // Give it a moment, but don't show error yet
          } else if (currentUrlData && currentUrlData.type === 'error') {
            console.error('❌ Error in URL hash after sign-in:', currentUrlData);
            if (mounted) {
              setError(currentUrlData.description || currentUrlData.error);
              setIsRecoveryState(false);
              setIsValidating(false);
              if (validationTimeout) {
                clearTimeout(validationTimeout);
              }
              if (fallbackTimeout) {
                clearTimeout(fallbackTimeout);
              }
            }
          } else {
            // Regular sign-in - check if URL has any error parameters
            const hashParams = new URLSearchParams(currentHash.includes('?') 
              ? currentHash.substring(currentHash.indexOf('?') + 1) 
              : currentHash.substring(1));
            const urlError = hashParams.get('error');
            const urlErrorDesc = hashParams.get('error_description');
            
            if (urlError) {
              console.error('❌ Error parameter in URL:', urlError, urlErrorDesc);
              if (mounted) {
                setError(urlErrorDesc || urlError || 'An error occurred with the password reset.');
                setIsRecoveryState(false);
                setIsValidating(false);
                if (validationTimeout) {
                  clearTimeout(validationTimeout);
                }
                if (fallbackTimeout) {
                  clearTimeout(fallbackTimeout);
                }
              }
            } else {
              console.log('ℹ️ Regular session detected (not recovery) - form will require recovery state');
              // Allow user to stay on page but form validation will prevent submission
              // Clear validation state after a moment if we haven't received PASSWORD_RECOVERY
              setTimeout(() => {
                if (mounted && !isRecoveryState) {
                  setIsValidating(false);
                }
              }, 1000);
            }
          }
        } else if (event === 'SIGNED_OUT') {
          console.log('ℹ️ Signed out event - recovery session may have expired');
          // If signed out while on this page, that's okay - recovery session may have expired
          if (mounted && !isRecoveryState && !error) {
            setIsValidating(false);
            if (validationTimeout) {
              clearTimeout(validationTimeout);
            }
            if (fallbackTimeout) {
              clearTimeout(fallbackTimeout);
            }
          }
        }
      }
    });

    return () => {
      mounted = false;
      if (validationTimeout) {
        clearTimeout(validationTimeout);
      }
      if (fallbackTimeout) {
        clearTimeout(fallbackTimeout);
      }
      subscription.unsubscribe();
    };
  }, [navigate, isValidating]); // Added isValidating to ensure timeout runs correctly

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

    // Ensure we're in recovery state
    if (!isRecoveryState) {
      setError('Password recovery session not found. Please request a new password reset.');
      return;
    }

    setIsLoading(true);

    try {
      // Update the user's password using supabase.auth.updateUser
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

      // Sign out the recovery session
      await supabase.auth.signOut();

      // Show toast notification
      toast.success('Password updated successfully!', {
        duration: 3000,
      });
    } catch (err) {
      console.error('Password update error:', err);
      setError(err.message || 'An unexpected error occurred. Please try again.');
      setIsLoading(false);
    }
  };

  return (
    <>
      {/* Dark Neon Theme Styles (matching Login) */}
      <style>{`
        @keyframes spin {
          to { transform: rotate(360deg); }
        }
        
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
            Reset Password
          </h1>
          <p style={{
            fontSize: '16px',
            color: 'rgba(255, 255, 255, 0.6)',
            marginBottom: '32px',
            textAlign: 'center',
          }}>
            Enter your new password below
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
              padding: '20px',
              marginBottom: '24px',
              color: '#86efac',
              fontSize: '14px',
              textAlign: 'center',
            }}>
              <p style={{ marginBottom: '16px', fontWeight: '600', fontSize: '16px' }}>
                ✅ Password Updated Successfully!
              </p>
              <p style={{ marginBottom: '16px', color: 'rgba(255, 255, 255, 0.7)', fontSize: '14px' }}>
                Your password has been updated. You can now sign in with your new password.
              </p>
              <Link
                to="/"
                style={{
                  display: 'inline-block',
                  padding: '10px 20px',
                  backgroundColor: 'rgba(34, 197, 94, 0.2)',
                  border: '1px solid rgba(34, 197, 94, 0.4)',
                  borderRadius: '8px',
                  color: '#86efac',
                  textDecoration: 'none',
                  fontWeight: '500',
                  fontSize: '14px',
                  transition: 'all 0.3s ease',
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.backgroundColor = 'rgba(34, 197, 94, 0.3)';
                  e.currentTarget.style.borderColor = 'rgba(34, 197, 94, 0.5)';
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.backgroundColor = 'rgba(34, 197, 94, 0.2)';
                  e.currentTarget.style.borderColor = 'rgba(34, 197, 94, 0.4)';
                }}
              >
                Go to Login →
              </Link>
            </div>
          )}

          {!success && isValidating && !isRecoveryState && !error && (
            <div style={{
              textAlign: 'center',
              padding: '32px 24px',
              color: 'rgba(255, 255, 255, 0.6)',
              fontSize: '14px',
            }}>
              <div style={{
                width: '32px',
                height: '32px',
                border: '4px solid rgba(255, 255, 255, 0.1)',
                borderTop: '4px solid #a855f7',
                borderRadius: '50%',
                margin: '0 auto 16px',
                animation: 'spin 1s linear infinite',
              }} />
              <p>Validating password reset link...</p>
              <p style={{ 
                marginTop: '12px', 
                fontSize: '12px', 
                color: 'rgba(255, 255, 255, 0.4)' 
              }}>
                Checking for recovery tokens in URL...
              </p>
            </div>
          )}

          {!success && isRecoveryState && (
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
                Confirm New Password
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
                  borderColor: confirmPassword && password !== confirmPassword 
                    ? 'rgba(239, 68, 68, 0.5)' 
                    : 'rgba(255, 255, 255, 0.1)',
                }}
                placeholder="Confirm new password"
                minLength={6}
              />
              {confirmPassword && password !== confirmPassword && (
                <p style={{
                  fontSize: '12px',
                  color: 'rgba(239, 68, 68, 0.8)',
                  marginTop: '4px',
                }}>
                  Passwords do not match
                </p>
              )}
            </div>

            <button
              type="submit"
              disabled={isLoading || password !== confirmPassword || password.length < 6}
              style={{
                width: '100%',
                background: (isLoading || password !== confirmPassword || password.length < 6)
                  ? 'rgba(255, 255, 255, 0.1)'
                  : 'linear-gradient(90deg, #a855f7, #ec4899)',
                color: '#ffffff',
                border: 'none',
                padding: '14px 24px',
                borderRadius: '12px',
                fontSize: '16px',
                fontWeight: '600',
                cursor: (isLoading || password !== confirmPassword || password.length < 6) ? 'not-allowed' : 'pointer',
                transition: 'all 0.3s ease',
                opacity: (isLoading || password !== confirmPassword || password.length < 6) ? 0.6 : 1,
                marginBottom: '16px',
              }}
            >
              {isLoading ? 'Saving...' : 'Save New Password'}
            </button>
          </form>
          )}

          {!success && isRecoveryState && (
            <div style={{
              textAlign: 'center',
            }}>
              <button
                type="button"
                onClick={() => navigate('/')}
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

