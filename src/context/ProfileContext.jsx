import React, { createContext, useContext, useEffect, useState } from 'react';
import { useAuth } from './AuthContext';

const ProfileContext = createContext({});

export const useProfile = () => useContext(ProfileContext);

export const ProfileProvider = ({ children }) => {
  const { profile: authProfile } = useAuth() || {};

  const [xp, setXp] = useState(() => {
    try {
      const raw = localStorage.getItem('profile_xp');
      return raw ? Number(raw) : 0;
    } catch (e) {
      return 0;
    }
  });
  const [level, setLevel] = useState(() => {
    try {
      const raw = localStorage.getItem('profile_level');
      return raw ? Number(raw) : 1;
    } catch (e) {
      return 1;
    }
  });
  const [streak, setStreak] = useState(() => {
    try {
      const raw = localStorage.getItem('profile_streak');
      return raw ? Number(raw) : 0;
    } catch (e) {
      return 0;
    }
  });

  useEffect(() => {
    try {
      localStorage.setItem('profile_xp', String(xp));
      localStorage.setItem('profile_level', String(level));
      localStorage.setItem('profile_streak', String(streak));
    } catch (e) {}
  }, [xp, level, streak]);

  useEffect(() => {
    if (!authProfile) return;
    if (typeof authProfile.xp === 'number') setXp(authProfile.xp);
    if (typeof authProfile.level === 'number') setLevel(authProfile.level);
    if (typeof authProfile.streak_count === 'number') setStreak(authProfile.streak_count);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [authProfile?.id]);

  const addXp = (amount = 1) => setXp((prev) => prev + Number(amount));
  const resetXp = () => setXp(0);
  const incrementStreak = () => setStreak((s) => s + 1);
  const resetStreak = () => setStreak(0);

  const value = {
    xp,
    level,
    streak,
    setXp,
    setLevel,
    addXp,
    resetXp,
    incrementStreak,
    resetStreak,
  };

  return <ProfileContext.Provider value={value}>{children}</ProfileContext.Provider>;
};

export default ProfileContext;
