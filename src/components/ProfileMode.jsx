import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { toast } from 'react-hot-toast';
import { Settings } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { supabase } from '../lib/supabaseClient';
import ConfirmModal from './ConfirmModal';
import ProgressHeatmap from './ProgressHeatmap';
import { Breadcrumb, Card, Button, Badge, StatTile } from './ui';

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
    <div className="h-full w-full overflow-y-auto px-6 py-10">
      <div className="mx-auto w-full max-w-5xl">
        <Breadcrumb trail={['MindFlow', 'Profile']} />

        <div className="mt-8 grid grid-cols-1 gap-6 md:grid-cols-[300px_1fr]">
          {/* Left column: identity */}
          <Card className="flex h-fit flex-col items-center gap-5 p-6">
            {/* Avatar: flat accent-wash circle */}
            <div
              className="flex h-24 w-24 items-center justify-center rounded-pill border border-accent-line bg-accent-wash"
              aria-hidden="true"
            >
              <span className="text-display-sm text-accent">{initial}</span>
            </div>

            <div className="flex w-full flex-col items-center gap-3">
              <h1 className="max-w-full break-all text-center text-title text-primary">
                {displayEmail}
              </h1>

              <div className="text-label-sm text-secondary">
                Member since <span className="text-primary">{memberSince}</span>
              </div>

              <Badge variant={actuallyHasPro ? 'accent' : 'neutral'}>
                {actuallyHasPro ? 'Pro Plan' : 'Free Plan'}
              </Badge>
            </div>

            {/* Stats */}
            <div className="mt-1 grid w-full grid-cols-1 gap-3">
              <StatTile
                label="Focus Minutes"
                value={stats.totalFocusMinutes}
                format={(n) => formatFocusTime(Math.round(n))}
              />
              <StatTile
                label="Streak"
                value={stats.streakCount}
                unit="days"
              />
            </div>

            <Button
              variant="secondary"
              className="w-full"
              onClick={() => navigate('/settings')}
            >
              <Settings size={16} strokeWidth={1.5} aria-hidden="true" />
              Edit Profile &amp; Settings
            </Button>
          </Card>

          {/* Right column: activity heatmap */}
          <Card className="h-fit p-6">
            <h2 className="text-title text-primary">Activity Heatmap</h2>
            <div className="mt-5">
              <ProgressHeatmap />
            </div>
          </Card>
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
