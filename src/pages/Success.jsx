import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Check } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { Card, Button } from '../components/ui';
import { motion, useReducedMotion } from '../motion';
import { entrance, reduced } from '../motion/transitions';

const Success = () => {
  const navigate = useNavigate();
  const [isLoading, setIsLoading] = useState(true);
  const [sessionId, setSessionId] = useState(null);
  const { refreshProfile } = useAuth();
  const reduce = useReducedMotion();

  useEffect(() => {
    // Get session_id from URL
    const params = new URLSearchParams(window.location.search);
    const sid = params.get('session_id');
    setSessionId(sid);

    const refreshUserProfile = async () => {
      try {
        // Refresh profile using AuthContext (this will trigger all listeners)
        await refreshProfile();

        // Also dispatch event for any components listening directly
        window.dispatchEvent(new CustomEvent('profile-updated'));
      } catch (error) {
        console.error('Error refreshing user profile:', error);
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
    <div className="flex min-h-screen flex-1 items-center justify-center bg-base p-6 md:p-12">
      <motion.div
        initial={reduce ? { opacity: 0 } : { opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={reduce ? reduced : entrance}
        className="w-full max-w-md"
      >
        <Card className="flex flex-col items-center p-8 text-center md:p-10">
          <div className="mb-6 flex h-16 w-16 items-center justify-center rounded-pill bg-success-wash">
            <Check className="h-8 w-8 text-success" strokeWidth={1.5} aria-hidden="true" />
          </div>

          <h1 className="text-h1 text-primary">Payment successful</h1>

          <p className="mt-3 text-body text-secondary">
            You are now a <span className="font-medium text-primary">Pro member</span>.
          </p>

          {sessionId && (
            <div className="mt-6 w-full rounded-input border border-soft bg-base px-4 py-3">
              <div className="font-mono text-micro uppercase text-secondary">Session ID</div>
              <div className="mt-1 break-all font-mono text-small text-secondary">
                {sessionId.substring(0, 20)}...
              </div>
            </div>
          )}

          <Button
            size="lg"
            mono
            magnetic
            className="mt-8 w-full"
            onClick={() => navigate('/dashboard')}
            disabled={isLoading}
          >
            {isLoading ? 'Loading...' : 'Go to Dashboard'}
          </Button>
        </Card>
      </motion.div>
    </div>
  );
};

export default Success;
