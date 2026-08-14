import React, { useEffect, useState } from 'react';
import { capture } from '../lib/analytics';
import { useNavigate } from 'react-router-dom';
import { Check } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { Card, Button } from '../components/ui';
import { motion, useReducedMotion, pop } from '../motion';
import { entrance, reduced } from '../motion/transitions';

const Success = () => {
  const navigate = useNavigate();
  const [isLoading, setIsLoading] = useState(true);
  // Read synchronously - the URL is already there on first render, and the
  // cleanup timer below strips it shortly after.
  const [sessionId] = useState(() =>
    new URLSearchParams(window.location.search).get('session_id')
  );
  // The payment itself succeeded (Stripe redirected here); this flag only
  // covers the follow-up profile refresh, which can fail independently.
  const [refreshFailed, setRefreshFailed] = useState(false);
  const { refreshProfile } = useAuth();
  const reduce = useReducedMotion();

  useEffect(() => {
    const refreshUserProfile = async () => {
      try {
        // Refresh profile using AuthContext (this will trigger all listeners)
        await refreshProfile();
        try {
          if (!localStorage.getItem('mf_checkout_captured')) {
            localStorage.setItem('mf_checkout_captured', '1');
            capture('checkout_completed');
          }
        } catch { /* no storage, no dedupe - skip */ }

        // Also dispatch event for any components listening directly
        window.dispatchEvent(new CustomEvent('profile-updated'));
      } catch (error) {
        console.error('Error refreshing user profile:', error);
        setRefreshFailed(true);
      } finally {
        setIsLoading(false);
      }
    };

    refreshUserProfile();

    // Clean up URL parameters after reading
    const cleanUrl = () => {
      if (window.history.replaceState) {
        const url = window.location.pathname;
        window.history.replaceState({}, document.title, url);
      }
    };

    // Clean URL after a short delay to allow any other code to read the params
    setTimeout(cleanUrl, 1000);
  }, []);

  return (
    <div className="flex min-h-screen flex-1 items-center justify-center bg-canvas p-6 md:p-12">
      <motion.div
        initial={reduce ? { opacity: 0 } : { opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={reduce ? reduced : entrance}
        className="w-full max-w-md"
      >
        <Card className="flex flex-col items-center p-8 text-center md:p-10">
          <motion.div
            initial={reduce ? false : { scale: 0, rotate: -12 }}
            animate={{ scale: 1, rotate: 0 }}
            transition={reduce ? reduced : { ...pop, delay: 0.15 }}
            className="mb-6 flex h-16 w-16 items-center justify-center rounded-pill bg-success-wash"
          >
            <Check className="h-8 w-8 text-success" strokeWidth={1.5} aria-hidden="true" />
          </motion.div>

          <h1 className="text-display-sm text-primary">Payment successful</h1>

          <p className="mt-3 text-body text-secondary">
            You are now a <span className="font-medium text-primary">Pro member</span>.
          </p>

          {sessionId && (
            <div className="mt-6 w-full rounded-sm border border-line bg-canvas px-4 py-3">
              <div className="text-label-sm text-secondary">Session ID</div>
              <div className="mt-1 break-all text-body-sm text-secondary">
                {sessionId.substring(0, 20)}...
              </div>
            </div>
          )}

          {refreshFailed && (
            /* The charge went through; only the account refresh failed.
               Say exactly that, plus what resolves it. */
            <div
              role="alert"
              className="mt-6 w-full rounded-sm border border-danger-line bg-danger-wash px-4 py-3 text-left"
            >
              <p className="text-body-sm text-danger">
                Payment confirmed, but refreshing your account hit an error.
              </p>
              <p className="mt-1 text-body-sm text-secondary">
                Pro features can take a minute to appear — reload the dashboard
                if they don't.
              </p>
            </div>
          )}

          {/* Loading per the loading-button spec: w-full holds width, label
              swaps to the in-progress verb, aria-busy set, no spinner. */}
          <Button
            size="lg"
            mono
            magnetic
            className="mt-8 w-full"
            onClick={() => navigate('/dashboard')}
            disabled={isLoading}
            aria-busy={isLoading || undefined}
          >
            {isLoading ? 'Confirming your upgrade...' : 'Go to Dashboard'}
          </Button>
        </Card>
      </motion.div>
    </div>
  );
};

export default Success;
