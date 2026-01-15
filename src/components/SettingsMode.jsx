import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { toast } from 'react-hot-toast';
import { useAuth } from '../context/AuthContext';
import { supabase } from '../lib/supabaseClient';
import config from '../config/api';

const SettingsMode = () => {
  const navigate = useNavigate();
  const { user, profile, refreshProfile } = useAuth();
  const [userEmail, setUserEmail] = useState('');
  // Timer Preferences
  const [focusDuration, setFocusDuration] = useState(25);
  const [shortBreakDuration, setShortBreakDuration] = useState(5);
  const [longBreakDuration, setLongBreakDuration] = useState(15);

  // Sound Settings
  const [tickTockSound, setTickTockSound] = useState(false);
  const [alarmVolume, setAlarmVolume] = useState(50);

  // Notifications
  const [desktopNotifications, setDesktopNotifications] = useState(false);
  const [notificationPermission, setNotificationPermission] = useState('default');

  // Account Management State
  const [isSubscribing, setIsSubscribing] = useState(false);
  const [subscriptionStatus, setSubscriptionStatus] = useState(null);
  const [subscriptionData, setSubscriptionData] = useState(null);
  const [subscriptionLoading, setSubscriptionLoading] = useState(false);
  const [subscriptionError, setSubscriptionError] = useState(null);
  const [subscriptionMessage, setSubscriptionMessage] = useState({ type: null, text: null });
  const [isSyncing, setIsSyncing] = useState(false);

  // Get user email
  useEffect(() => {
    const fetchUser = async () => {
      try {
        const { data: { user: authUser } } = await supabase.auth.getUser();
        if (authUser) {
          setUserEmail(authUser.email || '');
        }
      } catch (error) {
        console.error('Error fetching user:', error);
        if (user?.email) {
          setUserEmail(user.email);
        }
      }
    };
    fetchUser();
  }, [user]);

  // Fetch subscription status
  useEffect(() => {
    const fetchSubscriptionStatus = async () => {
      if (!user?.id) return;

      try {
        const response = await fetch(`${config.api.baseUrl}/get-subscription-details`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ userId: user.id }),
        });

        if (response.ok) {
          const data = await response.json();
          if (data.isSubscribed && data.status) {
            setSubscriptionStatus(data.status);
          } else {
            setSubscriptionStatus(null);
          }
        } else {
          setSubscriptionStatus(null);
        }
      } catch (error) {
        console.error('Error fetching subscription status:', error);
        setSubscriptionStatus(null);
      }
    };

    if (profile?.is_pro) {
      fetchSubscriptionStatus();
    } else {
      setSubscriptionStatus(null);
    }
  }, [user, profile]);

  // Fetch subscription details for Pro users
  useEffect(() => {
    const fetchSubscriptionDetails = async () => {
      if (!user?.id || !profile?.is_pro) {
        setSubscriptionLoading(false);
        return;
      }
      
      setSubscriptionLoading(true);
      try {
        const response = await fetch(`${config.api.baseUrl}/get-subscription-details`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ userId: user.id }),
        });

        const data = await response.json();
        
        if (!response.ok) {
          if (data.error?.toLowerCase().includes('stripe customer not found')) {
            setSubscriptionError('missing_customer');
          } else {
            setSubscriptionError(data.error || 'Unknown error');
          }
          setSubscriptionData(null);
        } else {
          setSubscriptionData(data);
          setSubscriptionError(null);
        }
      } catch (error) {
        console.error('Error fetching subscription details:', error);
        setSubscriptionError('Failed to fetch subscription details');
        setSubscriptionData(null);
      } finally {
        setSubscriptionLoading(false);
      }
    };

    if (profile?.is_pro) {
      fetchSubscriptionDetails();
    } else {
      setSubscriptionLoading(false);
    }
  }, [user, profile]);

  // Strict Check: Create a computed variable actuallyHasPro
  const actuallyHasPro = Boolean(
    profile?.is_pro === true &&
    profile?.stripe_customer_id &&
    (subscriptionStatus === null || subscriptionStatus === 'active' || subscriptionStatus === 'trialing')
  );

  // Load settings from localStorage on mount
  useEffect(() => {
    try {
      const savedFocus = localStorage.getItem('timer_focusDuration');
      const savedShortBreak = localStorage.getItem('timer_shortBreakDuration');
      const savedLongBreak = localStorage.getItem('timer_longBreakDuration');
      const savedTickTock = localStorage.getItem('timer_tickTockSound');
      const savedVolume = localStorage.getItem('timer_alarmVolume');
      const savedNotifications = localStorage.getItem('timer_desktopNotifications');

      if (savedFocus) setFocusDuration(parseInt(savedFocus, 10));
      if (savedShortBreak) setShortBreakDuration(parseInt(savedShortBreak, 10));
      if (savedLongBreak) setLongBreakDuration(parseInt(savedLongBreak, 10));
      if (savedTickTock) setTickTockSound(savedTickTock === 'true');
      if (savedVolume) setAlarmVolume(parseInt(savedVolume, 10));
      if (savedNotifications) setDesktopNotifications(savedNotifications === 'true');

      // Check notification permission
      if ('Notification' in window) {
        setNotificationPermission(Notification.permission);
        if (Notification.permission === 'granted') {
          setDesktopNotifications(true);
        }
      }
    } catch (error) {
      console.error('Error loading settings:', error);
    }
  }, []);

  // Save timer durations to localStorage
  const saveTimerSettings = () => {
    localStorage.setItem('timer_focusDuration', focusDuration.toString());
    localStorage.setItem('timer_shortBreakDuration', shortBreakDuration.toString());
    localStorage.setItem('timer_longBreakDuration', longBreakDuration.toString());
    alert('Timer settings saved!');
  };

  // Handle notification toggle
  const handleNotificationToggle = async (enabled) => {
    if (enabled && 'Notification' in window) {
      if (Notification.permission === 'default') {
        const permission = await Notification.requestPermission();
        setNotificationPermission(permission);
        if (permission === 'granted') {
          setDesktopNotifications(true);
          localStorage.setItem('timer_desktopNotifications', 'true');
          // Show a test notification
          new Notification('MindFlow', {
            body: 'Desktop notifications enabled!',
            icon: '/favicon.ico',
          });
        } else {
          setDesktopNotifications(false);
          localStorage.setItem('timer_desktopNotifications', 'false');
        }
      } else if (Notification.permission === 'granted') {
        setDesktopNotifications(true);
        localStorage.setItem('timer_desktopNotifications', 'true');
      } else {
        alert('Notification permission denied. Please enable it in your browser settings.');
        setDesktopNotifications(false);
      }
    } else {
      setDesktopNotifications(false);
      localStorage.setItem('timer_desktopNotifications', 'false');
    }
  };

  // Save sound settings
  const saveSoundSettings = () => {
    localStorage.setItem('timer_tickTockSound', tickTockSound.toString());
    localStorage.setItem('timer_alarmVolume', alarmVolume.toString());
    alert('Sound settings saved!');
  };

  // Reset all data
  const handleResetData = () => {
    const confirmed = window.confirm(
      'Are you sure you want to reset all data? This will clear all your session history, settings, and progress. This action cannot be undone.'
    );
    if (confirmed) {
      localStorage.clear();
      alert('All data has been reset. The page will reload.');
      window.location.reload();
    }
  };

  // Account Management Functions
  const handleSubscribe = async () => {
    if (actuallyHasPro) {
      toast.error('You are already a Pro member!');
      return;
    }

    setIsSubscribing(true);
    try {
      const { data: { user: authUser }, error: userError } = await supabase.auth.getUser();
      if (userError || !authUser) {
        toast.error('Error: Please log in to subscribe.');
        setIsSubscribing(false);
        return;
      }

      const userId = authUser.id;
      if (!userId || typeof userId !== 'string') {
        toast.error('Error: Unable to get user ID. Please try logging out and back in.');
        setIsSubscribing(false);
        return;
      }

      const requestBody = { userId: String(userId) };
      const response = await fetch(`${config.api.baseUrl}/create-checkout-session`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(requestBody),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ error: 'Unknown error' }));
        toast.error(`Failed to start checkout: ${errorData.error || 'Unknown error'}`);
        setIsSubscribing(false);
        return;
      }

      const data = await response.json();
      if (data?.url) {
        window.location.assign(data.url);
      } else {
        toast.error('Failed to get checkout URL. Please try again.');
        setIsSubscribing(false);
      }
    } catch (err) {
      console.error('Subscribe error:', err);
      toast.error('An unexpected error occurred. Please try again.');
      setIsSubscribing(false);
    }
  };

  const handleChangePassword = async () => {
    try {
      const email = userEmail || user?.email;
      if (!email) {
        toast.error('Email not found. Please try again.');
        return;
      }

      const { error } = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo: `${window.location.origin}/update-password`,
      });

      if (error) {
        console.error("Password reset error:", error);
        toast.error(error.message || 'Failed to send password reset email.');
        return;
      }

      toast.success('Password reset email sent! Check your inbox.');
    } catch (err) {
      console.error("Password reset error:", err);
      toast.error('An unexpected error occurred. Please try again.');
    }
  };

  const handleManageSubscription = async () => {
    if (!user || !user.id) {
      toast.error('Error: Please log in to manage your subscription.');
      return;
    }

    const isSubscribed = actuallyHasPro;
    let portalWindow = null;
    if (isSubscribed) {
      portalWindow = window.open('', '_blank');
      if (portalWindow) {
        portalWindow.document.write('<html><head><title>Loading...</title></head><body style="font-family: system-ui; display: flex; align-items: center; justify-content: center; height: 100vh; background: #0f172a; color: white;"><div style="text-align: center;"><div style="width: 40px; height: 40px; border: 3px solid rgba(255,255,255,0.1); border-top: 3px solid #a855f7; border-radius: 50%; margin: 0 auto 16px; animation: spin 0.8s linear infinite;"></div><p>Loading your billing portal...</p></div><style>@keyframes spin { to { transform: rotate(360deg); } }</style></body></html>');
      }
    }

    try {
      if (isSubscribed) {
        const response = await fetch(`${config.api.baseUrl}/create-portal-session`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ userId: user.id }),
        });

        if (!response.ok) {
          const errorData = await response.json().catch(() => ({ error: 'Unknown error' }));
          if (portalWindow) portalWindow.close();
          
          const errorMessage = errorData.error?.toLowerCase() || '';
          if (errorMessage.includes('not found') || errorMessage.includes('no stripe') || 
              errorMessage.includes('stripe customer not found') || errorMessage.includes('no stripe account')) {
            toast.success('Subscription not found. Redirecting to subscribe...');
            setIsSubscribing(true);
            const requestBody = { userId: String(user.id), email: user.email || userEmail || undefined };
            const checkoutWindow = window.open('', '_blank');
            if (checkoutWindow) {
              checkoutWindow.document.write('<html><head><title>Loading...</title></head><body style="font-family: system-ui; display: flex; align-items: center; justify-content: center; height: 100vh; background: #0f172a; color: white;"><div style="text-align: center;"><div style="width: 40px; height: 40px; border: 3px solid rgba(255,255,255,0.1); border-top: 3px solid #fbbf24; border-radius: 50%; margin: 0 auto 16px; animation: spin 0.8s linear infinite;"></div><p>Loading checkout...</p></div><style>@keyframes spin { to { transform: rotate(360deg); } }</style></body></html>');
            }
            const checkoutResponse = await fetch(`${config.api.baseUrl}/create-checkout-session`, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify(requestBody),
            });
            if (!checkoutResponse.ok) {
              const checkoutError = await checkoutResponse.json().catch(() => ({ error: 'Unknown error' }));
              if (checkoutWindow) checkoutWindow.close();
              toast.error(`Failed to start checkout: ${checkoutError.error || 'Unknown error'}`);
              setIsSubscribing(false);
              return;
            }
            const checkoutData = await checkoutResponse.json();
            if (checkoutData?.url && checkoutWindow) {
              checkoutWindow.location.href = checkoutData.url;
            } else {
              if (checkoutWindow) checkoutWindow.close();
              toast.error('Failed to get checkout URL. Please try again.');
              setIsSubscribing(false);
            }
            return;
          } else {
            toast.error(`Failed to open billing portal: ${errorData.error || 'Unknown error'}`);
            return;
          }
        }

        const data = await response.json();
        if (data?.url && portalWindow) {
          portalWindow.location.href = data.url;
        } else {
          if (portalWindow) portalWindow.close();
          toast.error('Failed to get billing portal URL. Please try again.');
        }
      } else {
        setIsSubscribing(true);
        const requestBody = { userId: String(user.id), email: user.email || userEmail || undefined };
        const checkoutWindow = window.open('', '_blank');
        if (checkoutWindow) {
          checkoutWindow.document.write('<html><head><title>Loading...</title></head><body style="font-family: system-ui; display: flex; align-items: center; justify-content: center; height: 100vh; background: #0f172a; color: white;"><div style="text-align: center;"><div style="width: 40px; height: 40px; border: 3px solid rgba(255,255,255,0.1); border-top: 3px solid #fbbf24; border-radius: 50%; margin: 0 auto 16px; animation: spin 0.8s linear infinite;"></div><p>Loading checkout...</p></div><style>@keyframes spin { to { transform: rotate(360deg); } }</style></body></html>');
        }
        const response = await fetch(`${config.api.baseUrl}/create-checkout-session`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(requestBody),
        });
        if (!response.ok) {
          const errorData = await response.json().catch(() => ({ error: 'Unknown error' }));
          if (checkoutWindow) checkoutWindow.close();
          toast.error(`Failed to start checkout: ${errorData.error || 'Unknown error'}`);
          setIsSubscribing(false);
          return;
        }
        const data = await response.json();
        if (data?.url && checkoutWindow) {
          checkoutWindow.location.href = data.url;
        } else {
          if (checkoutWindow) checkoutWindow.close();
          toast.error('Failed to get checkout URL. Please try again.');
          setIsSubscribing(false);
        }
      }
    } catch (err) {
      console.error('Subscription management error:', err);
      if (portalWindow) portalWindow.close();
      toast.error('An unexpected error occurred. Please try again.');
      setIsSubscribing(false);
    }
  };

  const handleOpenBillingPortal = async () => {
    if (!user?.id) return;
    try {
      const response = await fetch(`${config.api.baseUrl}/create-portal-session`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId: user.id }),
      });
      const data = await response.json();
      if (!response.ok) {
        if (data.error?.toLowerCase().includes('stripe customer not found')) {
          setSubscriptionMessage({ type: 'error', text: 'Your subscription account is not properly linked. Please contact support or try resubscribing.' });
        } else {
          setSubscriptionMessage({ type: 'error', text: data.error || 'Failed to open billing portal' });
        }
        setTimeout(() => setSubscriptionMessage({ type: null, text: null }), 8000);
      } else if (data?.url) {
        window.open(data.url, '_blank');
      }
    } catch (err) {
      console.error('Billing portal error:', err);
      setSubscriptionMessage({ type: 'error', text: 'An unexpected error occurred.' });
      setTimeout(() => setSubscriptionMessage({ type: null, text: null }), 8000);
    }
  };

  // Check subscription status by refreshing profile from database
  const handleCheckSubscriptionStatus = async () => {
    try {
      // Get user
      const { data: { user: authUser }, error: userError } = await supabase.auth.getUser();
      if (userError || !authUser) {
        toast.error('Error: Please log in to check subscription status.');
        return;
      }

      // Refresh profile from database (this will update the local state via AuthContext)
      await refreshProfile();
      
      toast.success('Subscription status updated');
    } catch (err) {
      console.error('Check subscription status error:', err);
      toast.error('An unexpected error occurred.');
    }
  };

  // Sync subscription status from Stripe
  const handleSyncSubscription = async () => {
    if (!user?.id) {
      toast.error('Error: Please log in to sync subscription.');
      return;
    }

    setIsSyncing(true);
    try {
      const response = await fetch(`${config.api.baseUrl}/api/user/sync-subscription`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId: user.id }),
      });

      const data = await response.json();

      if (!response.ok) {
        toast.error(data.error || 'Failed to sync subscription');
        setIsSyncing(false);
        return;
      }

      // Success - refresh profile to update UI
      toast.success(data.message || 'Subscription status synced successfully');
      await refreshProfile();
      
      // Also refetch subscription details if user has Pro
      if (data.is_pro) {
        const detailsResponse = await fetch(`${config.api.baseUrl}/get-subscription-details`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ userId: user.id }),
        });
        if (detailsResponse.ok) {
          const detailsData = await detailsResponse.json();
          setSubscriptionData(detailsData);
        }
      }
    } catch (err) {
      console.error('Sync subscription error:', err);
      toast.error('An unexpected error occurred while syncing.');
    } finally {
      setIsSyncing(false);
    }
  };

  return (
    <div style={{
      padding: '48px',
      flex: 1,
      overflowY: 'auto',
      position: 'relative',
      backgroundColor: '#030712',
    }}>
      {/* Gradient blob background */}
      <div style={{
        position: 'absolute',
        top: '-200px',
        right: '-200px',
        width: '600px',
        height: '600px',
        background: 'radial-gradient(circle, rgba(139, 92, 246, 0.15) 0%, rgba(236, 72, 153, 0.1) 50%, transparent 70%)',
        borderRadius: '50%',
        filter: 'blur(60px)',
        pointerEvents: 'none',
        zIndex: 0,
      }} />

      {/* Content */}
      <div style={{ position: 'relative', zIndex: 1, maxWidth: '900px', margin: '0 auto' }}>
        {/* Header */}
        <h1 style={{
          fontSize: '42px',
          fontWeight: '700',
          marginBottom: '48px',
          color: '#ffffff',
          letterSpacing: '-0.02em',
          lineHeight: '1.1',
        }}>
          Settings
        </h1>

        {/* Timer Preferences Section */}
        <div style={{
          backgroundColor: 'rgba(255, 255, 255, 0.03)',
          backdropFilter: 'blur(10px)',
          borderRadius: '24px',
          padding: '32px',
          border: '1px solid rgba(255, 255, 255, 0.1)',
          marginBottom: '32px',
        }}>
          <h2 style={{
            fontSize: '24px',
            fontWeight: '600',
            color: '#ffffff',
            marginBottom: '24px',
            display: 'flex',
            alignItems: 'center',
            gap: '12px',
          }}>
            <svg
              style={{
                width: '24px',
                height: '24px',
                stroke: '#60a5fa',
                fill: 'none',
                strokeWidth: '2',
              }}
              viewBox="0 0 24 24"
            >
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            Timer Preferences
          </h2>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
            <div>
              <label style={{
                display: 'block',
                fontSize: '14px',
                fontWeight: '500',
                color: 'rgba(255, 255, 255, 0.7)',
                marginBottom: '8px',
              }}>
                Focus Duration (minutes)
              </label>
              <input
                type="number"
                min="1"
                max="120"
                value={focusDuration}
                onChange={(e) => setFocusDuration(parseInt(e.target.value, 10) || 25)}
                style={{
                  width: '100%',
                  padding: '12px 16px',
                  backgroundColor: 'rgba(0, 0, 0, 0.3)',
                  border: '1px solid rgba(255, 255, 255, 0.1)',
                  borderRadius: '12px',
                  color: '#ffffff',
                  fontSize: '16px',
                  outline: 'none',
                }}
              />
            </div>

            <div>
              <label style={{
                display: 'block',
                fontSize: '14px',
                fontWeight: '500',
                color: 'rgba(255, 255, 255, 0.7)',
                marginBottom: '8px',
              }}>
                Short Break (minutes)
              </label>
              <input
                type="number"
                min="1"
                max="60"
                value={shortBreakDuration}
                onChange={(e) => setShortBreakDuration(parseInt(e.target.value, 10) || 5)}
                style={{
                  width: '100%',
                  padding: '12px 16px',
                  backgroundColor: 'rgba(0, 0, 0, 0.3)',
                  border: '1px solid rgba(255, 255, 255, 0.1)',
                  borderRadius: '12px',
                  color: '#ffffff',
                  fontSize: '16px',
                  outline: 'none',
                }}
              />
            </div>

            <div>
              <label style={{
                display: 'block',
                fontSize: '14px',
                fontWeight: '500',
                color: 'rgba(255, 255, 255, 0.7)',
                marginBottom: '8px',
              }}>
                Long Break (minutes)
              </label>
              <input
                type="number"
                min="1"
                max="120"
                value={longBreakDuration}
                onChange={(e) => setLongBreakDuration(parseInt(e.target.value, 10) || 15)}
                style={{
                  width: '100%',
                  padding: '12px 16px',
                  backgroundColor: 'rgba(0, 0, 0, 0.3)',
                  border: '1px solid rgba(255, 255, 255, 0.1)',
                  borderRadius: '12px',
                  color: '#ffffff',
                  fontSize: '16px',
                  outline: 'none',
                }}
              />
            </div>

            <button
              onClick={saveTimerSettings}
              style={{
                background: 'linear-gradient(90deg, #3b82f6, #60a5fa)',
                color: '#ffffff',
                border: 'none',
                padding: '14px 28px',
                borderRadius: '12px',
                fontSize: '16px',
                fontWeight: '600',
                cursor: 'pointer',
                transition: 'all 0.3s ease',
                alignSelf: 'flex-start',
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.transform = 'scale(1.02)';
                e.currentTarget.style.boxShadow = '0 6px 30px rgba(59, 130, 246, 0.5)';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.transform = 'scale(1)';
                e.currentTarget.style.boxShadow = 'none';
              }}
            >
              Save Timer Settings
            </button>
          </div>
        </div>

        {/* Sound Settings Section */}
        <div style={{
          backgroundColor: 'rgba(255, 255, 255, 0.03)',
          backdropFilter: 'blur(10px)',
          borderRadius: '24px',
          padding: '32px',
          border: '1px solid rgba(255, 255, 255, 0.1)',
          marginBottom: '32px',
        }}>
          <h2 style={{
            fontSize: '24px',
            fontWeight: '600',
            color: '#ffffff',
            marginBottom: '24px',
            display: 'flex',
            alignItems: 'center',
            gap: '12px',
          }}>
            <svg
              style={{
                width: '24px',
                height: '24px',
                stroke: '#a78bfa',
                fill: 'none',
                strokeWidth: '2',
              }}
              viewBox="0 0 24 24"
            >
              <path strokeLinecap="round" strokeLinejoin="round" d="M15.536 8.464a5 5 0 010 7.072m2.828-9.9a9 9 0 010 12.728M5.586 15H4a1 1 0 01-1-1v-4a1 1 0 011-1h1.586l4.707-4.707C10.923 3.663 12 4.109 12 5v14c0 .891-1.077 1.337-1.707.707L5.586 15z" />
            </svg>
            Sound Settings
          </h2>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
            <div style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
            }}>
              <div>
                <div style={{
                  fontSize: '16px',
                  fontWeight: '500',
                  color: '#ffffff',
                  marginBottom: '4px',
                }}>
                  Tick Tock Sound
                </div>
                <div style={{
                  fontSize: '14px',
                  color: 'rgba(255, 255, 255, 0.6)',
                }}>
                  Play a ticking sound during focus sessions
                </div>
              </div>
              <button
                onClick={() => {
                  setTickTockSound(!tickTockSound);
                  saveSoundSettings();
                }}
                style={{
                  width: '52px',
                  height: '28px',
                  borderRadius: '14px',
                  backgroundColor: tickTockSound ? '#3b82f6' : 'rgba(255, 255, 255, 0.2)',
                  border: 'none',
                  cursor: 'pointer',
                  position: 'relative',
                  transition: 'all 0.3s ease',
                }}
              >
                <div style={{
                  width: '24px',
                  height: '24px',
                  borderRadius: '50%',
                  backgroundColor: '#ffffff',
                  position: 'absolute',
                  top: '2px',
                  left: tickTockSound ? '26px' : '2px',
                  transition: 'all 0.3s ease',
                }} />
              </button>
            </div>

            <div>
              <div style={{
                fontSize: '16px',
                fontWeight: '500',
                color: '#ffffff',
                marginBottom: '8px',
              }}>
                Alarm Volume: {alarmVolume}%
              </div>
              <input
                type="range"
                min="0"
                max="100"
                value={alarmVolume}
                onChange={(e) => {
                  setAlarmVolume(parseInt(e.target.value, 10));
                  saveSoundSettings();
                }}
                style={{
                  width: '100%',
                  height: '8px',
                  borderRadius: '4px',
                  background: 'rgba(255, 255, 255, 0.1)',
                  outline: 'none',
                  cursor: 'pointer',
                }}
              />
            </div>
          </div>
        </div>

        {/* Notifications Section */}
        <div style={{
          backgroundColor: 'rgba(255, 255, 255, 0.03)',
          backdropFilter: 'blur(10px)',
          borderRadius: '24px',
          padding: '32px',
          border: '1px solid rgba(255, 255, 255, 0.1)',
          marginBottom: '32px',
        }}>
          <h2 style={{
            fontSize: '24px',
            fontWeight: '600',
            color: '#ffffff',
            marginBottom: '24px',
            display: 'flex',
            alignItems: 'center',
            gap: '12px',
          }}>
            <svg
              style={{
                width: '24px',
                height: '24px',
                stroke: '#4ade80',
                fill: 'none',
                strokeWidth: '2',
              }}
              viewBox="0 0 24 24"
            >
              <path strokeLinecap="round" strokeLinejoin="round" d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
            </svg>
            Notifications
          </h2>

          <div style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
          }}>
            <div>
              <div style={{
                fontSize: '16px',
                fontWeight: '500',
                color: '#ffffff',
                marginBottom: '4px',
              }}>
                Desktop Notifications
              </div>
              <div style={{
                fontSize: '14px',
                color: 'rgba(255, 255, 255, 0.6)',
              }}>
                {notificationPermission === 'granted' 
                  ? 'Notifications enabled' 
                  : notificationPermission === 'denied'
                  ? 'Notifications blocked. Please enable in browser settings.'
                  : 'Get notified when timers complete'}
              </div>
            </div>
            <button
              onClick={() => handleNotificationToggle(!desktopNotifications)}
              style={{
                width: '52px',
                height: '28px',
                borderRadius: '14px',
                backgroundColor: desktopNotifications ? '#4ade80' : 'rgba(255, 255, 255, 0.2)',
                border: 'none',
                cursor: 'pointer',
                position: 'relative',
                transition: 'all 0.3s ease',
                opacity: notificationPermission === 'denied' ? 0.5 : 1,
              }}
              disabled={notificationPermission === 'denied'}
            >
              <div style={{
                width: '24px',
                height: '24px',
                borderRadius: '50%',
                backgroundColor: '#ffffff',
                position: 'absolute',
                top: '2px',
                left: desktopNotifications ? '26px' : '2px',
                transition: 'all 0.3s ease',
              }} />
            </button>
          </div>
        </div>

        {/* Account Management Section */}
        <div style={{
          backgroundColor: 'rgba(255, 255, 255, 0.03)',
          backdropFilter: 'blur(10px)',
          borderRadius: '24px',
          padding: '32px',
          border: '1px solid rgba(255, 255, 255, 0.1)',
          marginBottom: '32px',
        }}>
          <h2 style={{
            fontSize: '24px',
            fontWeight: '600',
            color: '#ffffff',
            marginBottom: '24px',
            display: 'flex',
            alignItems: 'center',
            gap: '12px',
          }}>
            <svg
              style={{
                width: '24px',
                height: '24px',
                stroke: '#a855f7',
                fill: 'none',
                strokeWidth: '2',
              }}
              viewBox="0 0 24 24"
            >
              <path strokeLinecap="round" strokeLinejoin="round" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
            </svg>
            Account Management
          </h2>

          {/* Subscription Card */}
          {subscriptionLoading ? (
            <div style={{ padding: '20px', textAlign: 'center', color: 'rgba(255, 255, 255, 0.5)' }}>
              Loading subscription details...
            </div>
          ) : actuallyHasPro && subscriptionData ? (
            <div style={{
              background: 'linear-gradient(135deg, rgba(168, 85, 247, 0.2), rgba(139, 92, 246, 0.2))',
              border: '1px solid rgba(168, 85, 247, 0.3)',
              borderRadius: '16px',
              padding: '24px',
              marginBottom: '24px',
            }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
                <div>
                  <h3 style={{ fontSize: '20px', fontWeight: '700', color: '#a855f7', marginBottom: '4px' }}>
                    Pro Plan Active
                  </h3>
                  <p style={{ fontSize: '14px', color: 'rgba(255, 255, 255, 0.7)' }}>
                    {subscriptionData.status === 'active' ? 'Your subscription is active' : 
                     subscriptionData.status === 'trialing' ? 'Your trial is active' : 
                     'Subscription status: ' + subscriptionData.status}
                  </p>
                </div>
                <div style={{
                  backgroundColor: 'rgba(168, 85, 247, 0.3)',
                  padding: '8px 16px',
                  borderRadius: '8px',
                  fontSize: '14px',
                  fontWeight: '600',
                  color: '#a855f7',
                }}>
                  Pro
                </div>
              </div>
              {subscriptionData.current_period_end && (
                <div style={{ marginBottom: '16px', fontSize: '14px', color: 'rgba(255, 255, 255, 0.6)' }}>
                  Next billing date: {new Date(subscriptionData.current_period_end * 1000).toLocaleDateString()}
                </div>
              )}
              <button
                onClick={handleOpenBillingPortal}
                style={{
                  background: 'linear-gradient(135deg, #a855f7, #8b5cf6)',
                  color: '#ffffff',
                  border: 'none',
                  borderRadius: '12px',
                  padding: '12px 24px',
                  fontSize: '16px',
                  fontWeight: '600',
                  cursor: 'pointer',
                  transition: 'all 0.3s ease',
                  width: '100%',
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.transform = 'scale(1.02)';
                  e.currentTarget.style.boxShadow = '0 4px 20px rgba(168, 85, 247, 0.4)';
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.transform = 'scale(1)';
                  e.currentTarget.style.boxShadow = 'none';
                }}
              >
                Manage in Stripe Portal
              </button>
            </div>
          ) : (
            <div style={{
              background: 'linear-gradient(135deg, rgba(251, 191, 36, 0.2), rgba(245, 158, 11, 0.2))',
              border: '1px solid rgba(251, 191, 36, 0.3)',
              borderRadius: '16px',
              padding: '24px',
              marginBottom: '24px',
            }}>
              <div>
                <h3 style={{ fontSize: '20px', fontWeight: '700', color: '#fbbf24', marginBottom: '8px' }}>
                  Upgrade to Pro
                </h3>
                <p style={{ fontSize: '14px', color: 'rgba(255, 255, 255, 0.7)', marginBottom: '16px' }}>
                  Unlock unlimited AI features and advanced study tools
                </p>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                <button
                  onClick={handleSubscribe}
                  disabled={isSubscribing}
                  style={{
                    background: isSubscribing ? 'rgba(251, 191, 36, 0.5)' : 'linear-gradient(135deg, #fbbf24, #f59e0b)',
                    color: '#000000',
                    border: 'none',
                    borderRadius: '12px',
                    padding: '12px 24px',
                    fontSize: '16px',
                    fontWeight: '600',
                    cursor: isSubscribing ? 'not-allowed' : 'pointer',
                    transition: 'all 0.3s ease',
                    opacity: isSubscribing ? 0.7 : 1,
                    width: '100%',
                  }}
                  onMouseEnter={(e) => {
                    if (!isSubscribing) {
                      e.currentTarget.style.transform = 'scale(1.02)';
                      e.currentTarget.style.boxShadow = '0 4px 20px rgba(251, 191, 36, 0.4)';
                    }
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.transform = 'scale(1)';
                    e.currentTarget.style.boxShadow = 'none';
                  }}
                >
                  {isSubscribing ? 'Redirecting...' : 'Subscribe for $5.99/mo'}
                </button>
                <button
                  onClick={handleSyncSubscription}
                  disabled={isSyncing}
                  style={{
                    background: 'transparent',
                    color: '#60a5fa',
                    border: '1px solid rgba(96, 165, 250, 0.3)',
                    borderRadius: '12px',
                    padding: '8px 16px',
                    fontSize: '12px',
                    fontWeight: '500',
                    cursor: isSyncing ? 'not-allowed' : 'pointer',
                    transition: 'all 0.3s ease',
                    opacity: isSyncing ? 0.7 : 1,
                    textDecoration: 'underline',
                  }}
                  onMouseEnter={(e) => {
                    if (!isSyncing) {
                      e.currentTarget.style.backgroundColor = 'rgba(96, 165, 250, 0.1)';
                    }
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.backgroundColor = 'transparent';
                  }}
                >
                  {isSyncing ? 'Syncing...' : 'Refresh Status'}
                </button>
              </div>
            </div>
          )}

          {/* Subscription Status Row */}
          <div style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            padding: '16px',
            backgroundColor: 'rgba(255, 255, 255, 0.03)',
            borderRadius: '12px',
            border: '1px solid rgba(255, 255, 255, 0.05)',
            marginBottom: '16px',
          }}>
            <div>
              <div style={{ fontSize: '16px', fontWeight: '600', color: '#ffffff', marginBottom: '4px' }}>
                Subscription Status
              </div>
              <div style={{ fontSize: '14px', color: 'rgba(255, 255, 255, 0.6)' }}>
                {profile?.plan === 'Pro' 
                  ? `Active • Next payment on ${profile?.nextPaymentDate || 'Feb 14, 2026'}`
                  : 'Free Plan'
                }
              </div>
            </div>
            <div style={{ display: 'flex', gap: '12px', alignItems: 'center' }}>
              <button
                onClick={handleCheckSubscriptionStatus}
                style={{
                  fontSize: '12px',
                  color: '#60a5fa',
                  background: 'transparent',
                  border: 'none',
                  cursor: 'pointer',
                  textDecoration: 'underline',
                  fontWeight: '500',
                  transition: 'color 0.2s ease',
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.color = '#93c5fd';
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.color = '#60a5fa';
                }}
              >
                Check Subscription Status
              </button>
              {profile?.plan === 'Pro' && (
                <button
                  onClick={handleOpenBillingPortal}
                  style={{
                    fontSize: '14px',
                    color: '#a855f7',
                    background: 'transparent',
                    border: 'none',
                    cursor: 'pointer',
                    textDecoration: 'underline',
                    fontWeight: '500',
                    transition: 'color 0.2s ease',
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.color = '#c084fc';
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.color = '#a855f7';
                  }}
                >
                  Manage Subscription
                </button>
              )}
            </div>
          </div>

          {/* Change Password */}
          <div 
            onClick={handleChangePassword}
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              padding: '16px',
              backgroundColor: 'rgba(255, 255, 255, 0.03)',
              borderRadius: '12px',
              border: '1px solid rgba(255, 255, 255, 0.05)',
              cursor: 'pointer',
              transition: 'all 0.2s ease',
              marginBottom: '16px',
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.backgroundColor = 'rgba(255, 255, 255, 0.05)';
              e.currentTarget.style.borderColor = 'rgba(255, 255, 255, 0.1)';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.backgroundColor = 'rgba(255, 255, 255, 0.03)';
              e.currentTarget.style.borderColor = 'rgba(255, 255, 255, 0.05)';
            }}
          >
            <div>
              <div style={{ fontSize: '16px', fontWeight: '600', color: '#ffffff', marginBottom: '4px' }}>
                Change Password
              </div>
              <div style={{ fontSize: '14px', color: 'rgba(255, 255, 255, 0.5)' }}>
                Update your account password
              </div>
            </div>
            <svg style={{ width: '20px', height: '20px', stroke: 'rgba(255, 255, 255, 0.5)', fill: 'none', strokeWidth: '2' }} viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
            </svg>
          </div>

          {/* Email Preferences */}
          <div style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            padding: '16px',
            backgroundColor: 'rgba(255, 255, 255, 0.03)',
            borderRadius: '12px',
            border: '1px solid rgba(255, 255, 255, 0.05)',
            cursor: 'pointer',
            transition: 'all 0.2s ease',
            marginBottom: '16px',
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.backgroundColor = 'rgba(255, 255, 255, 0.05)';
            e.currentTarget.style.borderColor = 'rgba(255, 255, 255, 0.1)';
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.backgroundColor = 'rgba(255, 255, 255, 0.03)';
            e.currentTarget.style.borderColor = 'rgba(255, 255, 255, 0.05)';
          }}
          >
            <div>
              <div style={{ fontSize: '16px', fontWeight: '600', color: '#ffffff', marginBottom: '4px' }}>
                Email Preferences
              </div>
              <div style={{ fontSize: '14px', color: 'rgba(255, 255, 255, 0.5)' }}>
                Manage notification settings
              </div>
            </div>
            <svg style={{ width: '20px', height: '20px', stroke: 'rgba(255, 255, 255, 0.5)', fill: 'none', strokeWidth: '2' }} viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
            </svg>
          </div>
        </div>

        {/* Account / Data Section */}
        <div style={{
          backgroundColor: 'rgba(255, 255, 255, 0.03)',
          backdropFilter: 'blur(10px)',
          borderRadius: '24px',
          padding: '32px',
          border: '1px solid rgba(255, 255, 255, 0.1)',
        }}>
          <h2 style={{
            fontSize: '24px',
            fontWeight: '600',
            color: '#ffffff',
            marginBottom: '24px',
            display: 'flex',
            alignItems: 'center',
            gap: '12px',
          }}>
            <svg
              style={{
                width: '24px',
                height: '24px',
                stroke: '#ef4444',
                fill: 'none',
                strokeWidth: '2',
              }}
              viewBox="0 0 24 24"
            >
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
            </svg>
            Data & Privacy
          </h2>

          <div>
            <div style={{
              fontSize: '16px',
              fontWeight: '500',
              color: '#ffffff',
              marginBottom: '12px',
            }}>
              Reset All Data
            </div>
            <div style={{
              fontSize: '14px',
              color: 'rgba(255, 255, 255, 0.6)',
              marginBottom: '20px',
            }}>
              This will permanently delete all your session history, settings, and progress. This action cannot be undone.
            </div>
            <button
              onClick={handleResetData}
              style={{
                background: 'transparent',
                color: '#ef4444',
                border: '2px solid #ef4444',
                padding: '12px 24px',
                borderRadius: '12px',
                fontSize: '16px',
                fontWeight: '600',
                cursor: 'pointer',
                transition: 'all 0.3s ease',
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.backgroundColor = 'rgba(239, 68, 68, 0.1)';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.backgroundColor = 'transparent';
              }}
            >
              Reset All Data
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default SettingsMode;

