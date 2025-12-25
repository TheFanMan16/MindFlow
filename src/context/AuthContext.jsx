import { createContext, useContext, useEffect, useState } from 'react';
import { supabase } from '../lib/supabaseClient';

const AuthContext = createContext({});

export const useAuth = () => useContext(AuthContext);

export const AuthProvider = ({ children }) => {
  const [session, setSession] = useState(null);
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(false);
  const [profile, setProfile] = useState(null);

  useEffect(() => {
    let mounted = true;

    // 1. Get Profile Helper
    const fetchProfile = async (userId, userEmail = null) => {
      try {
        console.log('AuthContext: Fetching profile for user ID:', userId);
        const { data, error } = await supabase.from('profiles').select('*').eq('id', userId).single();
        
        if (error) {
          console.error('Error fetching profile:', error);
          console.error('Error code:', error.code);
          console.error('Error message:', error.message);
          
          // If profile doesn't exist (PGRST116), try to create it
          if (error.code === 'PGRST116') {
            console.log('Profile does not exist, creating new profile...');
            // Profile creation will be handled elsewhere or on first login
          }
          return;
        }
        
        if (mounted && data) {
          console.log('AuthContext: Profile loaded successfully:', data);
          console.log('AuthContext: is_admin =', data.is_admin, '(type:', typeof data.is_admin, ')');
          console.log('AuthContext: email =', data.email);
          console.log('AuthContext: role =', data.role);
          
          // --- GOD MODE OVERRIDE ---
          // If the email is mine, force PRO and ADMIN status regardless of database value.
          const currentUserEmail = user?.email || session?.user?.email || userEmail || data?.email;
          if (currentUserEmail === 'hannajohn37@gmail.com') {
            data = {
              ...data,
              is_pro: true, // Bypasses all usage limits
              is_admin: true, // Unlocks Admin Dashboard
              role: 'admin' // Double-check for admin role
            };
            console.log("⚡ GOD MODE ACTIVE: Restrictions Removed ⚡");
          }
          // -------------------------
          
          setProfile(data);
        } else if (mounted && !data) {
          console.warn('AuthContext: Profile query returned no data');
        }
      } catch (error) {
        console.error('Error fetching profile (catch block):', error);
      }
    };

    // 2. Initial Session Check
    const getInitialSession = async () => {
      try {
        const { data: { session } } = await supabase.auth.getSession();
        if (mounted && session) {
          setSession(session);
          setUser(session.user);
          await fetchProfile(session.user.id, session.user.email);
        }
      } catch (error) {
        console.error('Auth Init Error:', error);
      } finally {
        if (mounted) setLoading(false); // <--- FORCE STOP LOADING
      }
    };
    getInitialSession();

    // 3. Listen for Auth Changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (_event, session) => {
      if (mounted) {
        setSession(session);
        setUser(session?.user ?? null);
        if (session?.user) await fetchProfile(session.user.id, session.user.email);
        else setProfile(null);
        setLoading(false); // <--- SAFETY VALVE
      }
    });

    return () => {
      mounted = false;
      subscription?.unsubscribe();
    };
  }, []);

  // Refresh profile function (can be called manually)
  const refreshProfile = async () => {
    if (user?.id) {
      console.log('AuthContext: Manually refreshing profile for user:', user.id);
      await fetchProfile(user.id, user.email);
    }
  };

  // Calculate if user is Pro
  const calculateIsPro = () => {
    if (!profile) return false;
    // Check if God Mode override is active (is_pro will be true from override)
    if (profile.is_pro === true) return true;
    if (profile.subscription_status === 'active') return true;
    if (profile.pro_expires_at) {
      const expiresAt = new Date(profile.pro_expires_at);
      const now = new Date();
      if (expiresAt > now) return true;
    }
    return profile.plan_type === 'pro' || profile.is_pro === true;
  };

  const value = {
    session,
    user,
    loading,
    profile,
    refreshProfile,
    isPro: calculateIsPro(),
    isFree: !calculateIsPro(),
    signOut: () => supabase.auth.signOut(),
  };

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
};
