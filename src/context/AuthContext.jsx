import { createContext, useContext, useEffect, useState } from 'react';
import { supabase } from '../lib/supabaseClient';

const AuthContext = createContext({});

export const useAuth = () => useContext(AuthContext);

export const AuthProvider = ({ children }) => {
  const [session, setSession] = useState(null);
  const [user, setUser] = useState(null);
  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(true);
  // Session minutes for live timer updates (only counts pomodoro mode)
  const [sessionMinutes, setSessionMinutes] = useState(0);
  // Sentry Mode state - global state for tab visibility detection
  const [sentryTriggered, setSentryTriggered] = useState(false);

  // Fetch profile from Supabase
  const fetchProfile = async (userId, userEmail = null) => {
    if (!userId) {
      setProfile(null);
      return;
    }

    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', userId)
        .maybeSingle();

      if (error) {
        console.error('Error fetching profile:', error);
        setProfile(null);
        return;
      }

      if (data) {
        console.log('Profile fetched:', data);
        // Add mock subscription data
        const profileWithMockData = {
          ...data,
          nextPaymentDate: 'Feb 14, 2026',
          plan: data.is_pro ? 'Pro' : 'Free',
        };
        setProfile(profileWithMockData);
      } else {
        // Profile doesn't exist yet, create a default one
        console.log('Profile not found, creating default profile...');
        const { data: newProfile, error: createError } = await supabase
          .from('profiles')
          .insert({
            id: userId,
            email: userEmail || user?.email || '',
            is_pro: false,
            is_admin: false,
            streak_count: 0,
            total_focus_minutes: 0,
          })
          .select()
          .maybeSingle();

        if (createError) {
          console.error('Error creating profile:', createError);
        } else if (newProfile) {
          // Add mock subscription data
          const profileWithMockData = {
            ...newProfile,
            nextPaymentDate: 'Feb 14, 2026',
            plan: 'Free',
          };
          setProfile(profileWithMockData);
        }
      }
    } catch (error) {
      console.error('Error in fetchProfile:', error);
      setProfile(null);
    }
  };

  // Manual refresh function that can be called from components
  const refreshProfile = async () => {
    if (user?.id) {
      console.log('Manual profile refresh triggered');
      await fetchProfile(user.id, user.email);
    }
  };

  // Fetch profile whenever user changes
  useEffect(() => {
    if (user?.id) {
      console.log('Authenticated user changed, fetching profile');
      fetchProfile(user.id, user.email);
    } else {
      setProfile(null);
    }
  }, [user?.id]); // Re-run whenever user.id changes

  // Initial session and profile load
  useEffect(() => {
    let mounted = true;

    const initAuth = async () => {
      try {
        // Get initial session
        const { data: { session: initialSession }, error: sessionError } = await supabase.auth.getSession();
        
        if (sessionError) {
          console.error('Session error:', sessionError);
        }

        if (mounted) {
          setSession(initialSession);
          setUser(initialSession?.user ?? null);
          setLoading(false);
        }
      } catch (error) {
        console.error('Auth init error:', error);
        if (mounted) {
          setLoading(false);
        }
      }
    };

    initAuth();

    // Listen for auth state changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, newSession) => {
      console.log('Auth state changed:', event);
      
      if (mounted) {
        setSession(newSession);
        setUser(newSession?.user ?? null);
        // Profile will be fetched by the user?.id useEffect
        if (!newSession?.user) {
          setProfile(null);
        }
      }
    });

    return () => {
      mounted = false;
      subscription.unsubscribe();
    };
  }, []);

  // Calculate isPro based on profile
  const isPro = profile?.is_pro === true;

  const value = {
    session,
    user,
    profile,
    loading,
    refreshProfile, // Expose refresh function
    isPro,
    isFree: !isPro,
    sessionMinutes, // Live session minutes for timer
    setSessionMinutes, // Function to update session minutes
    sentryTriggered, // Sentry Mode triggered state (tab visibility)
    setSentryTriggered, // Function to set sentry triggered state
    signOut: async () => {
      try {
        console.log('Sign out initiated');
        await supabase.auth.signOut();
      } catch (error) {
        console.error('Sign out error:', error);
      } finally {
        // Always clear state and storage, even if signOut fails
        localStorage.clear();
        sessionStorage.clear();
        setSession(null);
        setUser(null);
        setProfile(null);
        setSessionMinutes(0); // Reset session minutes on sign out
        // Force page reset by redirecting to login
        window.location.href = '/login';
      }
    },
  };

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
};
