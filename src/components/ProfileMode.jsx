import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { toast } from 'react-hot-toast';
import { Settings, LogOut } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { supabase } from '../lib/supabaseClient';
import ConfirmModal from './ConfirmModal';
import ProgressHeatmap from './ProgressHeatmap';
import { Breadcrumb, Card, Button, Badge, StatTile, Skeleton } from './ui';
import { getLoopStreak } from '../utils/studyLoop';

export default function ProfileMode() {
  const navigate = useNavigate();
  const { user, profile } = useAuth();
  const [userEmail, setUserEmail] = useState('');
  const [memberSince, setMemberSince] = useState(new Date().getFullYear());
  const [showSignOutModal, setShowSignOutModal] = useState(false);
  // Identity fetch lifecycle: skeleton while true, inline error when the
  // session lookup fails AND no fallback email exists in context.
  const [loadingUser, setLoadingUser] = useState(true);
  const [loadFailed, setLoadFailed] = useState(false);
  // null = loading (tiles render skeletons); values of null inside the
  // object = fetch failed (tiles render the em-dash empty state). Never
  // hardcoded zeros - a fake 0 reads as real data.
  const [stats, setStats] = useState(null);

  // Get user data from Supabase session. Extracted so the error state's
  // Retry button can re-run the same fetch.
  const fetchUser = useCallback(async () => {
    setLoadingUser(true);
    setLoadFailed(false);
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
      // Fallback to user from context; only a hard failure with no fallback
      // surfaces as an error state.
      if (user?.email) {
        setUserEmail(user.email);
      } else {
        setLoadFailed(true);
      }
    } finally {
      setLoadingUser(false);
    }
  }, [user]);

  useEffect(() => {
    fetchUser();
  }, [fetchUser]);

  // Real values for the two tiles: lifetime minutes from the profile row,
  // streak derived from persisted active days exactly like the dashboard
  // (getLoopStreak, incl. the free-tier streak-freeze rule).
  useEffect(() => {
    if (!user?.id) {
      setStats({ totalFocusMinutes: null, streakCount: null });
      return;
    }
    let cancelled = false;
    Promise.all([
      supabase
        .from('profiles')
        .select('total_focus_minutes')
        .eq('id', user.id)
        .maybeSingle(),
      getLoopStreak(user.id, { isPro: profile?.is_pro === true }),
    ])
      .then(([{ data: profileRow, error: profileError }, streak]) => {
        if (cancelled) return;
        if (profileError) throw profileError;
        setStats({
          totalFocusMinutes: profileRow?.total_focus_minutes ?? 0,
          streakCount: streak ?? 0,
        });
      })
      .catch((error) => {
        console.error('Error loading profile stats:', error);
        if (!cancelled) setStats({ totalFocusMinutes: null, streakCount: null });
      });
    return () => {
      cancelled = true;
    };
  }, [user?.id, profile?.is_pro]);


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
          {loadingUser ? (
            /* Skeleton mirrors the identity card exactly - avatar circle,
               email line, member line, plan badge, two stat tiles, two
               buttons - so the layout never jumps on load. Static by rule. */
            <Card className="flex h-fit flex-col items-center gap-5 p-6" aria-busy="true">
              <div
                aria-hidden="true"
                className="h-24 w-24 rounded-pill bg-raised shadow-edge"
              />
              <div className="flex w-full flex-col items-center gap-3">
                <Skeleton className="h-6 w-52 max-w-full" />
                <Skeleton className="h-4 w-32" />
                <Skeleton className="h-6 w-20" />
              </div>
              <div className="mt-1 grid w-full grid-cols-1 gap-3">
                {[0, 1].map((i) => (
                  <div key={i} className="rounded-md border border-line bg-surface p-4">
                    <Skeleton className="h-4 w-24" />
                    <Skeleton className="mt-2 h-8 w-16" />
                  </div>
                ))}
              </div>
              <Skeleton className="h-9 w-full" />
              <Skeleton className="-mt-2 h-9 w-full" />
            </Card>
          ) : loadFailed ? (
            /* Error: name what broke, offer the action that resolves it. */
            <Card className="flex h-fit flex-col items-center gap-4 p-6 text-center">
              <p role="alert" className="text-body-sm text-danger">
                Your account details couldn't be loaded from the session.
              </p>
              <Button variant="secondary" size="sm" onClick={fetchUser}>
                Retry
              </Button>
            </Card>
          ) : (
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
                  inset
                  label="Focus Minutes"
                  loading={stats === null}
                  value={stats?.totalFocusMinutes}
                  emptyHint="not loaded — reopen to retry"
                  format={(n) => formatFocusTime(Math.round(n))}
                />
                <StatTile
                  inset
                  label="Streak"
                  loading={stats === null}
                  value={stats?.streakCount}
                  emptyHint="not loaded — reopen to retry"
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

              {/* The sign-out path: opens the confirm modal (it was
                  previously unreachable - modal existed with no trigger). */}
              <Button
                variant="ghost"
                className="-mt-2 w-full"
                onClick={() => setShowSignOutModal(true)}
              >
                <LogOut size={16} strokeWidth={1.5} aria-hidden="true" />
                Sign out
              </Button>
            </Card>
          )}

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
