import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { toast } from 'react-hot-toast';
import { useAuth } from '../context/AuthContext';
import { supabase } from '../lib/supabaseClient';
import ConfirmModal from './ConfirmModal';
import ProgressHeatmap from './ProgressHeatmap';

export default function ProfileMode() {
  const navigate = useNavigate();
  const { user, profile, refreshProfile } = useAuth();
  const [userEmail, setUserEmail] = useState('');
  const [memberSince, setMemberSince] = useState(new Date().getFullYear());
  const [showSignOutModal, setShowSignOutModal] = useState(false);
  const [stats, setStats] = useState({
    streakCount: 0,
    totalFocusMinutes: 0,
    setsCreated: 0,
  });

  // Get user data from Supabase session
  useEffect(() => {
    const fetchUser = async () => {
      try {
        const { data: { user: authUser } } = await supabase.auth.getUser();
        if (authUser) {
          setUserEmail(authUser.email || '');
          if (authUser.created_at) {
            setMemberSince(new Date(authUser.created_at).getFullYear());
          }
        }
      } catch (error) {
        console.error('Error fetching user:', error);
        // Fallback to user from context
        if (user?.email) {
          setUserEmail(user.email);
        }
      }
    };
    fetchUser();
  }, [user]);


  const handleSignOut = async () => {
    try {
      const { error } = await supabase.auth.signOut();
      if (error) {
        console.error("Sign out error:", error);
        toast.error('Error signing out. Please try again.');
        return;
      }
      
      // Clear all local storage
      localStorage.clear();
      sessionStorage.clear();
      
      // Redirect to login
      navigate('/login');
    } catch (err) {
      console.error("Sign out error:", err);
      localStorage.clear();
      sessionStorage.clear();
      navigate('/login');
    }
  };


  const displayEmail = userEmail || user?.email || 'User';
  const initial = displayEmail[0]?.toUpperCase() || 'U';
  const actuallyHasPro = Boolean(profile?.is_pro === true && profile?.stripe_customer_id);

  // Format focus minutes
  const formatFocusTime = (minutes) => {
    const hours = Math.floor(minutes / 60);
    const mins = minutes % 60;
    if (hours === 0 && mins === 0) return '0m';
    if (hours === 0) return `${mins}m`;
    if (mins === 0) return `${hours}h`;
    return `${hours}h ${mins}m`;
  };

  return (
    <div style={{
      width: '100%',
      height: '100%',
      padding: '48px 24px',
      display: 'flex',
      justifyContent: 'center',
      alignItems: 'flex-start',
    }}>
      <div style={{
        maxWidth: '1280px',
        width: '100%',
        display: 'grid',
        gridTemplateColumns: '300px 1fr',
        gap: '32px',
      }}>
        {/* Left Column: User Identity Card */}
        <div style={{
          backgroundColor: 'rgba(0, 0, 0, 0.4)',
          backdropFilter: 'blur(20px)',
          WebkitBackdropFilter: 'blur(20px)',
          border: '1px solid rgba(255, 255, 255, 0.1)',
          borderRadius: '24px',
          padding: '32px',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          gap: '24px',
          height: 'fit-content',
        }}>
          {/* Avatar with Gradient Ring */}
          <div style={{
            position: 'relative',
            width: '120px',
            height: '120px',
          }}>
            <div style={{
              position: 'absolute',
              inset: '-4px',
              borderRadius: '50%',
              background: 'linear-gradient(135deg, #a855f7, #ec4899)',
              opacity: 0.6,
              filter: 'blur(8px)',
            }} />
            <div style={{
              position: 'relative',
              width: '100%',
              height: '100%',
              borderRadius: '50%',
              background: 'linear-gradient(135deg, rgba(168, 85, 247, 0.2), rgba(236, 72, 153, 0.2))',
              border: '3px solid rgba(168, 85, 247, 0.5)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: '40px',
              fontWeight: '700',
              color: '#ffffff',
              boxShadow: '0 0 30px rgba(168, 85, 247, 0.3)',
            }}>
              {initial}
            </div>
          </div>

          {/* Identity Section */}
          <div style={{
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            gap: '16px',
            width: '100%',
          }}>
            <h1 style={{
              fontSize: '22px',
              fontWeight: '700',
              color: '#ffffff',
              textAlign: 'center',
            }}>
              {displayEmail}
            </h1>
            
            {/* Member Since Badge */}
            <div style={{
              backgroundColor: 'rgba(255, 255, 255, 0.05)',
              border: '1px solid rgba(255, 255, 255, 0.1)',
              borderRadius: '8px',
              padding: '6px 12px',
              fontSize: '12px',
              color: 'rgba(255, 255, 255, 0.7)',
            }}>
              Member since {memberSince}
            </div>

            {/* Plan Badge */}
            <div style={{
              backgroundColor: actuallyHasPro 
                ? 'rgba(168, 85, 247, 0.2)' 
                : 'rgba(255, 255, 255, 0.05)',
              border: `1px solid ${actuallyHasPro 
                ? 'rgba(168, 85, 247, 0.4)' 
                : 'rgba(255, 255, 255, 0.1)'}`,
              borderRadius: '8px',
              padding: '8px 16px',
              fontSize: '14px',
              fontWeight: '600',
              color: actuallyHasPro ? '#a855f7' : 'rgba(255, 255, 255, 0.8)',
            }}>
              {actuallyHasPro ? '✨ Pro Plan' : 'Free Plan'}
            </div>
          </div>

          {/* Stats in Left Column */}
          <div style={{
            width: '100%',
            display: 'flex',
            flexDirection: 'column',
            gap: '16px',
            marginTop: '8px',
          }}>
            {/* Focus Minutes */}
            <div style={{
              backgroundColor: 'rgba(59, 130, 246, 0.1)',
              border: '1px solid rgba(59, 130, 246, 0.2)',
              borderRadius: '12px',
              padding: '16px',
              display: 'flex',
              flexDirection: 'column',
              gap: '4px',
            }}>
              <div style={{
                fontSize: '11px',
                fontWeight: '500',
                color: 'rgba(255, 255, 255, 0.6)',
                textTransform: 'uppercase',
                letterSpacing: '0.05em',
              }}>
                Focus Minutes
              </div>
              <div style={{
                fontSize: '24px',
                fontWeight: '700',
                color: '#60a5fa',
              }}>
                {formatFocusTime(stats.totalFocusMinutes)}
              </div>
            </div>

            {/* Streak */}
            <div style={{
              backgroundColor: 'rgba(168, 85, 247, 0.1)',
              border: '1px solid rgba(168, 85, 247, 0.2)',
              borderRadius: '12px',
              padding: '16px',
              display: 'flex',
              flexDirection: 'column',
              gap: '4px',
            }}>
              <div style={{
                fontSize: '11px',
                fontWeight: '500',
                color: 'rgba(255, 255, 255, 0.6)',
                textTransform: 'uppercase',
                letterSpacing: '0.05em',
              }}>
                Streak
              </div>
              <div style={{
                fontSize: '24px',
                fontWeight: '700',
                color: '#a855f7',
              }}>
                {stats.streakCount} days
              </div>
            </div>
          </div>

          {/* Edit Profile & Settings Button */}
          <button
            onClick={() => navigate('/settings')}
            style={{
              width: '100%',
              padding: '12px 20px',
              borderRadius: '12px',
              background: 'linear-gradient(135deg, rgba(168, 85, 247, 0.2), rgba(139, 92, 246, 0.2))',
              border: '1px solid rgba(168, 85, 247, 0.3)',
              color: '#a78bfa',
              fontSize: '14px',
              fontWeight: '600',
              cursor: 'pointer',
              transition: 'all 0.3s ease',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '8px',
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.background = 'linear-gradient(135deg, rgba(168, 85, 247, 0.3), rgba(139, 92, 246, 0.3))';
              e.currentTarget.style.borderColor = 'rgba(168, 85, 247, 0.5)';
              e.currentTarget.style.transform = 'scale(1.02)';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.background = 'linear-gradient(135deg, rgba(168, 85, 247, 0.2), rgba(139, 92, 246, 0.2))';
              e.currentTarget.style.borderColor = 'rgba(168, 85, 247, 0.3)';
              e.currentTarget.style.transform = 'scale(1)';
            }}
          >
            <svg style={{ width: '16px', height: '16px', stroke: 'currentColor', fill: 'none', strokeWidth: '2' }} viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
            </svg>
            Edit Profile & Settings
          </button>
        </div>

        {/* Right Column: Progress Heatmap */}
        <div style={{
          display: 'flex',
          flexDirection: 'column',
          gap: '24px',
        }}>
          <div style={{
            backgroundColor: 'rgba(0, 0, 0, 0.4)',
            backdropFilter: 'blur(20px)',
            WebkitBackdropFilter: 'blur(20px)',
            border: '1px solid rgba(255, 255, 255, 0.1)',
            borderRadius: '24px',
            padding: '32px',
          }}>
            <h2 style={{
              fontSize: '24px',
              fontWeight: '700',
              color: '#ffffff',
              marginBottom: '24px',
            }}>
              Activity Heatmap
            </h2>
            <ProgressHeatmap />
          </div>
        </div>
      </div>

      {/* Sign Out Confirmation Modal */}
      <ConfirmModal
        isOpen={showSignOutModal}
        onClose={() => setShowSignOutModal(false)}
        onConfirm={handleSignOut}
        title="Sign Out"
        message="Are you sure you want to sign out?"
        confirmText="Sign Out"
        cancelText="Cancel"
      />
    </div>
  );
}
