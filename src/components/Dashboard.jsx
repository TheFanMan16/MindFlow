import React, { useState, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { supabase } from '../lib/supabaseClient';
import { useAuth } from '../context/AuthContext';
import config from '../config/api';

const Dashboard = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { user, profile, refreshProfile } = useAuth();
  const [stats, setStats] = useState({
    totalStudyTime: 0, // in seconds
    sessionsCompleted: 0,
    hoursFocusedToday: 0,
    tasksCleared: 0,
    weeklyStreak: 0,
    streakCount: 0,
    totalFocusMinutes: 0,
    cardsCreated: 0,
  });
  const [loading, setLoading] = useState(true);
  const [isSubscribing, setIsSubscribing] = useState(false);
  const [isCanceling, setIsCanceling] = useState(false);

  // Calculate time ago string
  const getTimeAgo = (timestamp) => {
    if (!timestamp) return 'Never';
    const now = new Date();
    const then = new Date(timestamp);
    const diffMs = now - then;
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);

    if (diffMins < 1) return 'Just now';
    if (diffMins < 60) return `${diffMins} minute${diffMins > 1 ? 's' : ''} ago`;
    if (diffHours < 24) return `${diffHours} hour${diffHours > 1 ? 's' : ''} ago`;
    return `${diffDays} day${diffDays > 1 ? 's' : ''} ago`;
  };

  // Handle Stripe success redirect - refresh profile when redirected back after payment
  useEffect(() => {
    const searchParams = new URLSearchParams(location.search);
    const success = searchParams.get('success');

    if (success === 'true') {
      console.log('✅ Payment successful, refreshing profile...');
      // Refresh profile to get updated subscription status
      refreshProfile();
      // Remove success parameter from URL
      navigate('/dashboard', { replace: true });
    }
  }, [location.search, refreshProfile, navigate]);

  // Fetch real data from Supabase
  useEffect(() => {
    const fetchDashboardStats = async () => {
      // Use user from context if available, otherwise fetch
      const currentUser = user;

      if (!currentUser) {
        setLoading(false);
        return;
      }

      try {
        setLoading(true);
        const userId = currentUser.id;

        // Fetch profile stats (streak_count, total_focus_minutes)
        let { data: profile, error: profileError } = await supabase
          .from('profiles')
          .select('streak_count, total_focus_minutes')
          .eq('id', userId)
          .maybeSingle();

        // If profile doesn't exist, create a default one
        if (!profile && !profileError) {
          console.log('Profile not found, creating default profile...');
          const { data: newProfile, error: createError } = await supabase
            .from('profiles')
            .insert({
              id: userId,
              email: currentUser.email,
              streak_count: 0,
              total_focus_minutes: 0,
              is_pro: false,
              is_admin: false,
            })
            .select('streak_count, total_focus_minutes')
            .maybeSingle();

          if (createError) {
            console.error('Error creating profile:', createError);
          } else {
            profile = newProfile;
          }
        } else if (profileError) {
          console.error('Error fetching profile:', profileError);
        }

        // Count flashcards
        const { count: flashcardsCount, error: flashcardsError } = await supabase
          .from('flashcards')
          .select('*', { count: 'exact', head: true })
          .eq('user_id', userId);

        if (flashcardsError) {
          console.error('Error counting flashcards:', flashcardsError);
        }

        // Update stats with database values
        setStats(prev => ({
          ...prev,
          streakCount: profile?.streak_count || 0,
          totalFocusMinutes: profile?.total_focus_minutes || 0,
          cardsCreated: flashcardsCount || 0,
          // Keep localStorage-based stats for now (can be migrated later)
        }));

      } catch (error) {
        console.error('Error fetching dashboard stats:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchDashboardStats();

    // Also load localStorage stats (for backward compatibility)
    try {
      const sessionHistory = localStorage.getItem('timerSessionHistory');
      if (sessionHistory) {
        const sessions = JSON.parse(sessionHistory);
        const totalSeconds = sessions.reduce((sum, session) => sum + (session.duration || 0), 0);
        const totalHours = Math.floor(totalSeconds / 3600);
        const totalMinutes = Math.floor((totalSeconds % 3600) / 60);

        // Calculate today's sessions
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        const todaySessions = sessions.filter(session => {
          const sessionDate = new Date(session.timestamp);
          sessionDate.setHours(0, 0, 0, 0);
          return sessionDate.getTime() === today.getTime();
        });
        const todaySeconds = todaySessions.reduce((sum, session) => sum + (session.duration || 0), 0);
        const todayHours = (todaySeconds / 3600).toFixed(1);

        // Calculate weekly streak
        const uniqueDays = new Set();
        sessions.forEach(session => {
          const sessionDate = new Date(session.timestamp);
          sessionDate.setHours(0, 0, 0, 0);
          uniqueDays.add(sessionDate.getTime());
        });

        // Count consecutive days (simplified - counts last 7 days with activity)
        const sortedDays = Array.from(uniqueDays).sort((a, b) => b - a);
        let streak = 0;
        const todayTime = today.getTime();
        for (let i = 0; i < sortedDays.length; i++) {
          const dayDiff = (todayTime - sortedDays[i]) / (1000 * 60 * 60 * 24);
          if (dayDiff === i) {
            streak++;
          } else {
            break;
          }
        }

        setStats(prev => ({
          ...prev,
          totalStudyTime: totalHours * 3600 + totalMinutes * 60,
          sessionsCompleted: sessions.length,
          hoursFocusedToday: parseFloat(todayHours),
          tasksCleared: todaySessions.length,
          weeklyStreak: streak,
        }));
      }
    } catch (error) {
      console.error('Error loading localStorage stats:', error);
    }
  }, [user]); // Add user to dependency array

  const formatTime = (seconds) => {
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    if (hours > 0) {
      return `${hours}h ${minutes}m`;
    }
    return `${minutes}m`;
  };

  const hexToRgb = (hex) => {
    const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
    return result
      ? `${parseInt(result[1], 16)}, ${parseInt(result[2], 16)}, ${parseInt(result[3], 16)}`
      : null;
  };

  // Handle Subscribe button click
  const handleSubscribe = async () => {
    if (!user) {
      alert('Please sign in to subscribe.');
      navigate('/login');
      return;
    }

    if (profile?.is_pro) {
      alert('You are already a Pro member!');
      return;
    }

    try {
      setIsSubscribing(true);

      // Get user ID from AuthContext (already available, no need to fetch again)
      console.log('🔍 Step 1: Getting user from AuthContext');
      console.log('🔍 User from context:', user ? { id: user.id, email: user.email } : 'null/undefined');

      if (!user || !user.id) {
        console.error('❌ Error: User not available in context', { user });
        alert('Error: Please log in to subscribe.');
        setIsSubscribing(false);
        return;
      }

      // Prepare request body (include email for customer creation)
      const requestBody = {
        userId: user.id,
        email: user.email || undefined, // Include email if available
      };
      console.log('🔍 Step 2: Preparing request body:', requestBody);
      console.log('Sending User ID:', user.id);
      console.log('Sending Email:', user.email);
      console.log('Request body stringified:', JSON.stringify(requestBody));

      // Call the Express server to create checkout session
      const response = await fetch(`${config.api.baseUrl}/create-checkout-session`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(requestBody),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ error: 'Unknown error' }));
        console.error('❌ Error response:', errorData);
        alert(`Failed to start checkout: ${errorData.error || 'Unknown error'}. Please check the console for details.`);
        setIsSubscribing(false);
        return;
      }

      const data = await response.json();
      console.log('Response data:', data);

      if (data?.url) {
        // Redirect to Stripe Checkout URL
        window.location.assign(data.url);
        // Note: setIsSubscribing(false) won't run because page is redirecting
      } else {
        alert('Failed to get checkout URL. Please try again.');
        setIsSubscribing(false);
      }
    } catch (err) {
      console.error('Subscribe error:', err);
      alert('An unexpected error occurred. Please try again.');
      setIsSubscribing(false);
    }
  };

  // Handle Cancel Subscription button click
  const handleCancelSubscription = async () => {
    if (!profile?.is_pro) {
      alert('You do not have an active subscription.');
      return;
    }

    // Confirm cancellation
    const confirmed = window.confirm(
      'Are you sure you want to cancel your subscription? You will retain Pro access until the end of your current billing period.'
    );

    if (!confirmed) {
      return;
    }

    try {
      setIsCanceling(true);

      if (!user || !user.id) {
        alert('Error: Please log in to cancel subscription.');
        setIsCanceling(false);
        return;
      }

      // Call the Express server to cancel subscription
      console.log('📤 Calling cancel-subscription with userId:', user.id);
      const response = await fetch(`${config.api.baseUrl}/cancel-subscription`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ userId: user.id }),
      });

      console.log('📥 Response status:', response.status, response.statusText);

      if (!response.ok) {
        let errorMessage = 'Unknown error';
        try {
          const errorData = await response.json();
          errorMessage = errorData.error || errorMessage;
          console.error('❌ Error response:', errorData);
        } catch (parseError) {
          // If JSON parsing fails, try to get text
          const errorText = await response.text().catch(() => 'Failed to read error response');
          console.error('❌ Non-JSON error response:', errorText);
          errorMessage = errorText || `Server returned ${response.status} ${response.statusText}`;
        }
        alert(`Failed to cancel subscription: ${errorMessage}`);
        setIsCanceling(false);
        return;
      }

      const data = await response.json();
      console.log('Cancel subscription response:', data);

      // Show success message with cancellation date
      const cancelDate = data.cancellationDate || (data.cancel_at
        ? new Date(data.cancel_at * 1000).toLocaleDateString('en-US', {
          year: 'numeric',
          month: 'long',
          day: 'numeric',
        })
        : 'the end of your billing period');

      alert(`Your subscription has been cancelled. You will retain Pro access until ${cancelDate}.`);

      // Refresh profile to update the UI (though is_pro will still be true until period ends)
      refreshProfile();
    } catch (err) {
      console.error('Cancel subscription error:', err);
      alert('An unexpected error occurred. Please try again.');
    } finally {
      setIsCanceling(false);
    }
  };

  // Create Stripe Billing Portal Session
  const createPortalSession = async () => {
    if (!user || !user.id) {
      alert('Error: Please log in to manage your subscription.');
      return;
    }

    try {
      // Call the Express server to create billing portal session
      console.log('📤 Creating billing portal session for userId:', user.id);
      const response = await fetch(`${config.api.baseUrl}/create-portal-session`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ userId: user.id }),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ error: 'Unknown error' }));
        console.error('❌ Error response:', errorData);
        alert(`Failed to open billing portal: ${errorData.error || 'Unknown error'}`);
        return;
      }

      const data = await response.json();
      console.log('Billing portal session created:', data);

      if (data?.url) {
        // Redirect to Stripe Billing Portal
        window.location.assign(data.url);
      } else {
        alert('Failed to get billing portal URL. Please try again.');
      }
    } catch (err) {
      console.error('Billing portal error:', err);
      alert('An unexpected error occurred. Please try again.');
    }
  };

  const cards = [
    {
      id: 'focus',
      title: 'Deep Work Timer',
      description: 'Pomodoro, Flowmodoro, and Sentry Mode.',
      icon: 'M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z', // Clock
      gradient: ['#22d3ee', '#3b82f6'], // Cyan to Blue
      neonColor: '#22d3ee', // Neon Cyan
      view: 'focus',
    },
    {
      id: 'blurting',
      title: 'Active Recall',
      description: 'Test your recall of knowledge with AI feedback.',
      icon: 'M13 10V3L4 14h7v7l9-11h-7z', // Lightning/Brain
      gradient: ['#8b5cf6', '#ec4899'], // Purple to Pink
      neonColor: '#8b5cf6', // Neon Purple
      view: 'blurting',
    },
    {
      id: 'feynman',
      title: 'Feynman Method',
      description: 'Teach it to learn it. Explain concepts to a curious AI.',
      icon: 'M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253', // Book/Education
      gradient: ['#f59e0b', '#ea580c'], // Amber to Orange
      neonColor: '#f59e0b', // Neon Amber
      view: 'feynman',
    },
    {
      id: 'flashcards',
      title: 'Spaced Repetition',
      description: 'AI-generated flashcards using the Leitner system.',
      icon: 'M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10', // Cards/Stack
      gradient: ['#22c55e', '#10b981'], // Green to Emerald
      neonColor: '#22c55e', // Neon Green
      view: 'flashcards',
    },
  ];

  return (
    <div style={{
      padding: '48px',
      width: '100%',
      minHeight: '100%',
      position: 'relative',
      background: 'radial-gradient(ellipse at center, rgba(15, 23, 42, 0.8) 0%, rgba(3, 7, 18, 0.95) 40%, #030712 100%)',
      fontFamily: 'Inter, -apple-system, BlinkMacSystemFont, "Segoe UI", system-ui, sans-serif',
    }}>
      {/* Subtle noise texture overlay */}
      <div style={{
        position: 'absolute',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        backgroundImage: 'url("data:image/svg+xml,%3Csvg viewBox=\'0 0 400 400\' xmlns=\'http://www.w3.org/2000/svg\'%3E%3Cfilter id=\'noiseFilter\'%3E%3CfeTurbulence type=\'fractalNoise\' baseFrequency=\'0.9\' numOctaves=\'3\' stitchTiles=\'stitch\'/%3E%3C/filter%3E%3Crect width=\'100%25\' height=\'100%25\' filter=\'url(%23noiseFilter)\' opacity=\'0.03\'/%3E%3C/svg%3E")',
        pointerEvents: 'none',
        zIndex: 1,
      }} />

      {/* Content */}
      <div style={{ position: 'relative', zIndex: 2, maxWidth: '1200px', margin: '0 auto', width: '100%' }}>
        {/* Hero Section */}
        <div className="text-center py-12 md:py-16 relative mb-8">
          {/* Animated Orb - Positioned absolutely behind text */}
          <div className="absolute inset-0 flex items-center justify-center pointer-events-none" style={{ zIndex: 0 }}>
            <div className="mindflow-animation-container">
              <div className="mindflow-orb"></div>
            </div>
          </div>

          {/* Text Content - Positioned above orb */}
          <div className="relative" style={{ zIndex: 1 }}>
            <h1 className="text-7xl md:text-8xl lg:text-9xl font-black mb-6 tracking-tight fade-in-up-delay" style={{
              fontFamily: 'Inter, -apple-system, BlinkMacSystemFont, "Segoe UI", system-ui, sans-serif',
              textShadow: '0 4px 20px rgba(0, 0, 0, 0.3)',
              background: 'linear-gradient(90deg, #3b82f6 0%, #1e40af 25%, #6b21a8 50%, #a855f7 75%, #3b82f6 100%)',
              backgroundSize: '200% auto',
              WebkitBackgroundClip: 'text',
              WebkitTextFillColor: 'transparent',
              backgroundClip: 'text',
              filter: 'none',
              backdropFilter: 'none',
              WebkitBackdropFilter: 'none',
            }}>
              Mindflow
            </h1>
            <p className="text-xs md:text-sm text-white/50 mb-8 fade-in-up-delay tracking-widest uppercase" style={{
              fontFamily: 'Inter, -apple-system, BlinkMacSystemFont, "Segoe UI", system-ui, sans-serif',
              letterSpacing: '0.2em',
              fontWeight: '400',
            }}>
              Discover your peak state of flow and productivity
            </p>
          </div>
        </div>
        {/* Main Tools Grid - Single Row Layout */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6 max-w-7xl mx-auto">
          {cards.map((card) => (
            <div
              key={card.id}
              className="fade-in-up-delay-more"
              style={{
                backgroundColor: 'rgba(0, 0, 0, 0.4)',
                backdropFilter: 'blur(16px)',
                WebkitBackdropFilter: 'blur(16px)',
                borderRadius: '20px',
                padding: '32px',
                border: '1px solid rgba(255, 255, 255, 0.05)',
                transition: 'all 0.4s cubic-bezier(0.4, 0, 0.2, 1)',
                cursor: 'pointer',
                position: 'relative',
                display: 'flex',
                flexDirection: 'column',
                boxShadow: '0 8px 32px rgba(0, 0, 0, 0.5)',
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.backgroundColor = 'rgba(0, 0, 0, 0.55)';
                e.currentTarget.style.transform = 'translateY(-8px)';
                e.currentTarget.style.borderColor = 'rgba(255, 255, 255, 0.2)';
                e.currentTarget.style.boxShadow = `0 20px 64px rgba(${hexToRgb(card.neonColor)}, 0.3), 0 8px 32px rgba(0, 0, 0, 0.6), 0 0 0 1px rgba(255, 255, 255, 0.1)`;
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.backgroundColor = 'rgba(0, 0, 0, 0.4)';
                e.currentTarget.style.transform = 'translateY(0)';
                e.currentTarget.style.borderColor = 'rgba(255, 255, 255, 0.05)';
                e.currentTarget.style.boxShadow = '0 8px 32px rgba(0, 0, 0, 0.5)';
              }}
              onClick={() => {
                if (!user) {
                  navigate('/login');
                  return;
                }
                navigate(`/${card.view}`);
              }}
            >
              {/* Icon with internal glow */}
              <div style={{
                width: '56px',
                height: '56px',
                borderRadius: '12px',
                background: `rgba(${hexToRgb(card.neonColor)}, 0.08)`,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                marginBottom: '20px',
                border: `1px solid rgba(${hexToRgb(card.neonColor)}, 0.15)`,
                boxShadow: `inset 0 0 20px rgba(${hexToRgb(card.neonColor)}, 0.1)`,
                position: 'relative',
              }}>
                <svg
                  className={
                    card.id === 'focus' ? 'icon-spin-slow' :
                      card.id === 'blurting' ? 'icon-pulse-soft' :
                        card.id === 'feynman' ? 'icon-float' :
                          card.id === 'flashcards' ? 'icon-breathe' : ''
                  }
                  style={{
                    width: '28px',
                    height: '28px',
                    stroke: card.neonColor,
                    fill: 'none',
                    strokeWidth: '2',
                    filter: `drop-shadow(0 0 8px rgba(${hexToRgb(card.neonColor)}, 0.4))`,
                  }}
                  viewBox="0 0 24 24"
                >
                  <path strokeLinecap="round" strokeLinejoin="round" d={card.icon} />
                </svg>
              </div>

              <h2 style={{
                fontSize: '24px',
                fontWeight: '600',
                color: '#ffffff',
                marginBottom: '12px',
                letterSpacing: '-0.02em',
                fontFamily: 'Inter, -apple-system, BlinkMacSystemFont, "Segoe UI", system-ui, sans-serif',
              }}>
                {card.title}
              </h2>
              <p style={{
                fontSize: '14px',
                color: 'rgba(255, 255, 255, 0.55)',
                lineHeight: '1.6',
                marginBottom: '20px',
                fontWeight: '400',
                flex: 1,
                fontFamily: 'Inter, -apple-system, BlinkMacSystemFont, "Segoe UI", system-ui, sans-serif',
              }}>
                {card.description}
              </p>

              {/* Last Used Label */}
              <div style={{
                fontSize: '11px',
                color: 'rgba(255, 255, 255, 0.35)',
                marginBottom: '16px',
                fontWeight: '400',
                fontFamily: 'Inter, -apple-system, BlinkMacSystemFont, "Segoe UI", system-ui, sans-serif',
              }}>
                Last session: {getTimeAgo(localStorage.getItem(`lastUsed_${card.id}`))}
              </div>

              <button
                onClick={(e) => {
                  e.stopPropagation();
                  if (!user) {
                    navigate('/login');
                    return;
                  }
                  // Store last used timestamp
                  localStorage.setItem(`lastUsed_${card.id}`, new Date().toISOString());
                  navigate(`/${card.view}`);
                }}
                style={{
                  background: `linear-gradient(135deg, ${card.gradient[0]}, ${card.gradient[1]})`,
                  color: '#ffffff',
                  border: 'none',
                  padding: '14px 28px',
                  borderRadius: '12px',
                  fontSize: '14px',
                  fontWeight: '600',
                  cursor: 'pointer',
                  transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
                  width: '100%',
                  boxShadow: `0 4px 20px rgba(${hexToRgb(card.gradient[0])}, 0.25), inset 0 1px 0 rgba(255, 255, 255, 0.1)`,
                  letterSpacing: '-0.01em',
                  fontFamily: 'Inter, -apple-system, BlinkMacSystemFont, "Segoe UI", system-ui, sans-serif',
                  position: 'relative',
                  overflow: 'hidden',
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.boxShadow = `0 8px 32px rgba(${hexToRgb(card.gradient[0])}, 0.4), inset 0 1px 0 rgba(255, 255, 255, 0.15)`;
                  e.currentTarget.style.transform = 'translateY(-1px)';
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.boxShadow = `0 4px 20px rgba(${hexToRgb(card.gradient[0])}, 0.25), inset 0 1px 0 rgba(255, 255, 255, 0.1)`;
                  e.currentTarget.style.transform = 'translateY(0)';
                }}
              >
                {user ? 'Start' : 'Sign in to use'}
              </button>
            </div>
          ))}
        </div>

      </div>
    </div>
  );
};

export default Dashboard;
