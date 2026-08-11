import React, { useState, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { CheckCircle2, Lightbulb } from 'lucide-react';
import { supabase } from '../../lib/supabaseClient';
import toast from 'react-hot-toast';
import { Button, Card, Field, Input } from '../../components/ui';
import { motion, useReducedMotion, Stagger, shake } from '../../motion';

/** Flat wordmark: accent lucide bulb + name. No glow, no gradient. */
const Wordmark = () => (
  <span className="inline-flex items-center gap-1.5">
    <Lightbulb size={16} strokeWidth={1.5} className="text-accent" aria-hidden="true" />
    <span className="text-body-sm font-semibold text-primary">MindFlow</span>
  </span>
);

const UpdatePassword = () => {
  const navigate = useNavigate();
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState(null);
  const [isRecoveryState, setIsRecoveryState] = useState(false);
  const [success, setSuccess] = useState(false);
  const [isValidating, setIsValidating] = useState(true);
  const reduce = useReducedMotion();

  // Visual-only: counts error occurrences so the card re-shakes on each new
  // error. Does not participate in any recovery/session logic.
  const [shakeCount, setShakeCount] = useState(0);
  useEffect(() => {
    if (error) setShakeCount((c) => c + 1);
  }, [error]);

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
    <div className="flex min-h-screen w-full items-center justify-center bg-canvas p-6">
      <motion.div
        key={shakeCount}
        animate={reduce ? undefined : shakeCount ? shake : undefined}
        className="w-full max-w-[400px]"
      >
        <Card className="p-8">
          <div className="mb-8 flex flex-col items-center gap-4 text-center">
            <Wordmark />
            <div>
              <h1 className="text-title text-primary">Reset Password</h1>
              <p className="mt-1 text-body-sm text-secondary">Enter your new password below</p>
            </div>
          </div>

          {error && (
            <div
              role="alert"
              className="mb-4 rounded-lg border border-danger-line bg-danger-wash px-4 py-3 text-body-sm text-danger"
            >
              {error}
            </div>
          )}

          {success && (
            <div className="mb-4 rounded-lg border border-line bg-success-wash p-5 text-center">
              <CheckCircle2
                size={20}
                strokeWidth={1.5}
                className="mx-auto mb-3 text-success"
                aria-hidden="true"
              />
              <p className="text-body font-medium text-primary">Password updated successfully</p>
              <p className="mt-2 text-body-sm text-secondary">
                Your password has been updated. You can now sign in with your new password.
              </p>
              <Link
                to="/"
                className="mt-4 inline-flex h-9 items-center justify-center gap-2 rounded-sm border border-line px-4 text-body-sm font-medium text-primary transition-colors duration-150 hover:border-strong hover:bg-hover focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-ring"
              >
                Go to Login
              </Link>
            </div>
          )}

          {!success && isValidating && !isRecoveryState && !error && (
            <div className="flex flex-col items-center gap-3 px-6 py-8 text-center">
              <span
                aria-hidden="true"
                className="mb-1 h-8 w-8 animate-spin rounded-pill border-2 border-strong border-t-transparent motion-reduce:animate-none"
              />
              <p className="text-body-sm text-secondary">Validating password reset link...</p>
              <p className="text-label-sm text-secondary">
                Checking for recovery tokens in URL...
              </p>
            </div>
          )}

          {!success && isRecoveryState && (
            <form onSubmit={handleUpdatePassword}>
              <Stagger className="flex flex-col gap-4">
                <Stagger.Item>
                  <Field label="New Password" hint="Must be at least 6 characters">
                    <Input
                      type="password"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      required
                      disabled={isLoading}
                      placeholder="Enter new password"
                      minLength={6}
                    />
                  </Field>
                </Stagger.Item>

                <Stagger.Item>
                  <Field
                    label="Confirm New Password"
                    error={
                      confirmPassword && password !== confirmPassword
                        ? 'Passwords do not match'
                        : undefined
                    }
                  >
                    <Input
                      type="password"
                      value={confirmPassword}
                      onChange={(e) => setConfirmPassword(e.target.value)}
                      required
                      disabled={isLoading}
                      placeholder="Confirm new password"
                      minLength={6}
                    />
                  </Field>
                </Stagger.Item>

                <Stagger.Item>
                  <Button
                    type="submit"
                    mono
                    size="lg"
                    className="w-full"
                    disabled={isLoading || password !== confirmPassword || password.length < 6}
                  >
                    {isLoading ? 'Saving...' : 'Save New Password'}
                  </Button>
                </Stagger.Item>
              </Stagger>
            </form>
          )}

          {!success && isRecoveryState && (
            <div className="mt-4 text-center">
              <Button variant="ghost" size="sm" onClick={() => navigate('/')}>
                Back to Login
              </Button>
            </div>
          )}
        </Card>
      </motion.div>
    </div>
  );
};

export default UpdatePassword;
