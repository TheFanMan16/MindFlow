import React, { useEffect, useState } from 'react';
import { useAuth } from '../context/AuthContext';

import { useNavigate } from 'react-router-dom';

const Success = () => {
  const navigate = useNavigate();
  const [isLoading, setIsLoading] = useState(true);
  const [sessionId, setSessionId] = useState(null);
  const { refreshProfile } = useAuth();

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

  // Confetti component
  const Confetti = () => {
    return (
      <div style={{
        position: 'fixed',
        top: 0,
        left: 0,
        width: '100%',
        height: '100%',
        pointerEvents: 'none',
        zIndex: 9999,
      }}>
        {[...Array(100)].map((_, i) => (
          <div
            key={i}
            style={{
              position: 'absolute',
              width: '10px',
              height: '10px',
              backgroundColor: ['#22c55e', '#10b981', '#34d399', '#a855f7', '#ec4899', '#f59e0b'][i % 6],
              left: `${Math.random() * 100}%`,
              top: '-10px',
              animation: `confetti-fall ${2 + Math.random() * 3}s linear forwards`,
              animationDelay: `${Math.random() * 0.5}s`,
              borderRadius: '50%',
              opacity: 0.9,
            }}
          />
        ))}
        <style>{`
          @keyframes confetti-fall {
            to {
              transform: translateY(100vh) rotate(360deg);
              opacity: 0;
            }
          }
        `}</style>
      </div>
    );
  };

  return (
    <div style={{
      padding: '48px',
      flex: 1,
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: '#030712',
      minHeight: '100vh',
      position: 'relative',
    }}>
      <Confetti />

      {/* Gradient blob background */}
      <div style={{
        position: 'absolute',
        top: '-200px',
        right: '-200px',
        width: '600px',
        height: '600px',
        background: 'radial-gradient(circle, rgba(34, 197, 94, 0.15) 0%, rgba(16, 185, 129, 0.1) 50%, transparent 70%)',
        borderRadius: '50%',
        filter: 'blur(60px)',
        pointerEvents: 'none',
        zIndex: 0,
      }} />

      <div style={{
        position: 'relative',
        zIndex: 1,
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        maxWidth: '600px',
        textAlign: 'center',
      }}>
        {/* Success Checkmark */}
        <div style={{
          width: '120px',
          height: '120px',
          borderRadius: '50%',
          background: 'linear-gradient(135deg, #22c55e, #10b981)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          marginBottom: '32px',
          boxShadow: '0 0 60px rgba(34, 197, 94, 0.5), 0 0 120px rgba(34, 197, 94, 0.3)',
          animation: 'scale-in 0.5s ease-out',
        }}>
          <svg
            style={{
              width: '64px',
              height: '64px',
              stroke: '#ffffff',
              fill: 'none',
              strokeWidth: '4',
              strokeLinecap: 'round',
              strokeLinejoin: 'round',
            }}
            viewBox="0 0 24 24"
          >
            <path d="M20 6L9 17l-5-5" />
          </svg>
        </div>

        {/* Success Message */}
        <h1 style={{
          fontSize: '48px',
          fontWeight: '700',
          marginBottom: '16px',
          color: '#ffffff',
          letterSpacing: '-0.02em',
          background: 'linear-gradient(90deg, #22c55e, #10b981)',
          WebkitBackgroundClip: 'text',
          WebkitTextFillColor: 'transparent',
          backgroundClip: 'text',
        }}>
          Payment Successful!
        </h1>

        <p style={{
          fontSize: '20px',
          color: 'rgba(255, 255, 255, 0.7)',
          marginBottom: '48px',
          lineHeight: '1.6',
        }}>
          You are now a <strong style={{ color: '#22c55e' }}>Pro member</strong>. 
          {sessionId && (
            <span style={{ display: 'block', fontSize: '14px', marginTop: '8px', color: 'rgba(255, 255, 255, 0.5)' }}>
              Session ID: {sessionId.substring(0, 20)}...
            </span>
          )}
        </p>

        {/* Go to Dashboard Button */}
        <button
          onClick={() => navigate('/dashboard')}
          disabled={isLoading}
          style={{
            background: 'linear-gradient(90deg, #22c55e, #10b981)',
            color: '#ffffff',
            border: 'none',
            padding: '16px 48px',
            borderRadius: '12px',
            fontSize: '18px',
            fontWeight: '600',
            cursor: isLoading ? 'not-allowed' : 'pointer',
            transition: 'all 0.3s ease',
            opacity: isLoading ? 0.7 : 1,
            boxShadow: '0 4px 20px rgba(34, 197, 94, 0.3)',
          }}
          onMouseEnter={(e) => {
            if (!isLoading) {
              e.currentTarget.style.transform = 'scale(1.05)';
              e.currentTarget.style.boxShadow = '0 6px 30px rgba(34, 197, 94, 0.5)';
            }
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.transform = 'scale(1)';
            e.currentTarget.style.boxShadow = '0 4px 20px rgba(34, 197, 94, 0.3)';
          }}
        >
          {isLoading ? 'Loading...' : 'Go to Dashboard'}
        </button>

        <style>{`
          @keyframes scale-in {
            from {
              transform: scale(0);
              opacity: 0;
            }
            to {
              transform: scale(1);
              opacity: 1;
            }
          }
        `}</style>
      </div>
    </div>
  );
};

export default Success;

