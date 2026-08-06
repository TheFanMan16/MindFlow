import React, { useState, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { Lightbulb, Settings, LogOut, User } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { useProfile } from '../context/ProfileContext';

/** Matches Tailwind's md breakpoint: below 768px the sidebar becomes bottom tabs. */
const MOBILE_QUERY = '(max-width: 767px)';

const useIsMobile = () => {
  const [isMobile, setIsMobile] = useState(
    () => typeof window !== 'undefined' && window.matchMedia(MOBILE_QUERY).matches
  );
  useEffect(() => {
    const mq = window.matchMedia(MOBILE_QUERY);
    const onChange = (e) => setIsMobile(e.matches);
    mq.addEventListener('change', onChange);
    return () => mq.removeEventListener('change', onChange);
  }, []);
  return isMobile;
};


const Sidebar = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { profile, user, signOut } = useAuth();
  const profileCtx = useProfile();
  const isMobile = useIsMobile();

  // Active mode detection and color mapping
  const getActiveMode = (p) => {
    if (!p || p === '/') return 'dashboard';
    if (p.startsWith('/dashboard')) return 'dashboard';
    if (p.startsWith('/focus') || p.startsWith('/study')) return 'timer';
    if (p.startsWith('/recall') || p.startsWith('/blurting')) return 'recall';
    if (p.startsWith('/feynman')) return 'feynman';
    if (p.startsWith('/flashcards') || p.startsWith('/flashcard-study')) return 'flashcards';
    return 'default';
  };

  const modeToColorClass = {
    dashboard: 'text-indigo-400',
    timer: 'text-blue-400',
    recall: 'text-purple-400',
    feynman: 'text-amber-400',
    flashcards: 'text-emerald-400',
    default: 'text-white',
  };

  const activeMode = getActiveMode(location.pathname || '');
  const activeColorClass = modeToColorClass[activeMode] || modeToColorClass.default;

  const rawEmail = profile?.email || user?.email || '';
  const localPart = rawEmail ? (rawEmail.split('@')[0] || rawEmail) : '';
  const cleanedName = localPart ? localPart.replace(/\d+/g, '') : '';

  // Hex map for colors (used for neon glow)
  const modeToHex = {
    dashboard: '#818cf8', // indigo
    timer: '#60a5fa', // blue
    recall: '#A78BFA', // purple
    feynman: '#fbbf24', // amber
    flashcards: '#34d399', // emerald
    default: '#FFFFFF',
  };

  const activeColorHex = modeToHex[activeMode] || modeToHex.default;

  const hexToRgba = (hex, alpha = 0.12) => {
    const h = hex.replace('#', '');
    const bigint = parseInt(h, 16);
    const r = (bigint >> 16) & 255;
    const g = (bigint >> 8) & 255;
    const b = bigint & 255;
    return `rgba(${r}, ${g}, ${b}, ${alpha})`;
  };

  const menuItems = [
    {
      path: '/dashboard',
      label: 'Dashboard',
      icon: 'M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6',
      activeBg: 'rgba(255, 255, 255, 0.1)',
      activeText: '#ffffff',
    },
    {
      path: '/focus',
      label: 'Focus',
      icon: 'M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z',
      activeBg: 'rgba(59, 130, 246, 0.2)',
      activeText: '#60a5fa',
    },
    {
      path: '/recall',
      label: 'Active Recall',
      icon: 'M13 10V3L4 14h7v7l9-11h-7z',
      activeBg: 'rgba(139, 92, 246, 0.2)',
      activeText: '#a78bfa',
    },
    {
      path: '/feynman',
      label: 'Feynman',
      icon: 'M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253',
      activeBg: 'rgba(245, 158, 11, 0.18)',
      activeText: '#f59e0b',
    },
    {
      path: '/flashcards',
      label: 'Flashcards',
      icon: 'M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10',
      activeBg: 'rgba(52, 211, 153, 0.18)',
      activeText: '#34d399',
    },
  ];

  // Mobile: fixed bottom tab bar instead of the side rail. Students study on
  // phones; a 96px-wide vertical bar eats a quarter of a 375px screen.
  if (isMobile) {
    const tabs = [
      ...menuItems,
      user
        ? { path: '/profile', label: 'Profile', icon: null, lucide: User }
        : { path: '/login', label: 'Sign In', icon: null, lucide: User },
    ];
    return (
      <nav style={{
        position: 'fixed',
        bottom: 0,
        left: 0,
        right: 0,
        zIndex: 40,
        display: 'flex',
        backgroundColor: 'rgba(17, 24, 39, 0.95)',
        backdropFilter: 'blur(24px)',
        WebkitBackdropFilter: 'blur(24px)',
        borderTop: '1px solid rgba(255, 255, 255, 0.1)',
        padding: '6px 4px calc(6px + env(safe-area-inset-bottom))',
      }}>
        {tabs.map((item) => {
          const isActive = location.pathname === item.path;
          const itemMode = getActiveMode(item.path);
          const itemHex = modeToHex[itemMode] || modeToHex.default;
          const LucideIcon = item.lucide;
          return (
            <button
              key={item.path}
              onClick={() => navigate(item.path)}
              style={{
                flex: 1,
                background: 'none',
                border: 'none',
                cursor: 'pointer',
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                gap: '3px',
                padding: '6px 2px',
                minWidth: 0,
              }}
            >
              {LucideIcon ? (
                <LucideIcon
                  size={22}
                  style={{
                    color: isActive ? itemHex : 'rgba(255, 255, 255, 0.6)',
                    filter: isActive ? `drop-shadow(0 0 8px ${itemHex})` : 'none',
                  }}
                />
              ) : (
                <svg
                  style={{
                    width: '22px',
                    height: '22px',
                    stroke: isActive ? itemHex : 'rgba(255, 255, 255, 0.6)',
                    fill: 'none',
                    strokeWidth: '2',
                    filter: isActive ? `drop-shadow(0 0 8px ${itemHex})` : 'none',
                  }}
                  viewBox="0 0 24 24"
                >
                  <path strokeLinecap="round" strokeLinejoin="round" d={item.icon} />
                </svg>
              )}
              <span style={{
                fontSize: '9px',
                fontWeight: isActive ? '700' : '500',
                color: isActive ? itemHex : 'rgba(255, 255, 255, 0.55)',
                whiteSpace: 'nowrap',
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                maxWidth: '100%',
              }}>
                {item.label}
              </span>
            </button>
          );
        })}
      </nav>
    );
  }

  return (
    <div style={{
      width: '96px',
      backgroundColor: 'rgba(17, 24, 39, 0.5)',
      backdropFilter: 'blur(24px)',
      borderRight: '1px solid rgba(255, 255, 255, 0.1)',
      height: '100vh',
      display: 'flex',
      flexDirection: 'column',
      padding: '12px 16px',
      alignItems: 'center',
      position: 'relative',
      zIndex: 10,
      gap: '8px',
    }}>
      {/* Logo Section - Neon Glass (reference) */}
      <div className="flex flex-col items-center justify-center py-6 w-full">
        <Lightbulb
          size={45}
          style={{
            color: activeColorHex,
            filter: `drop-shadow(0 0 10px ${activeColorHex}) drop-shadow(0 0 20px ${activeColorHex})`,
          }}
        />
        <span style={{
          color: activeColorHex,
          fontWeight: 700,
          fontSize: 12,
          marginTop: 8,
          textShadow: `0 0 10px ${activeColorHex}`,
          lineHeight: 1,
          letterSpacing: '-0.02em'
        }}>
          MindFlow
        </span>
      </div>
      <div className="w-full border-b border-gray-800/50" />

      {/* Navigation Items - Middle */}
      <div style={{
        flex: 1,
        display: 'flex',
        flexDirection: 'column',
        gap: '8px',
        width: '100%',
      }}>
        {menuItems.map((item) => {
          const isActive = location.pathname === item.path;
          const itemMode = getActiveMode(item.path);
          const itemHex = modeToHex[itemMode] || modeToHex.default;
          const itemBg = hexToRgba(itemHex, 0.12);
          return (
            <button
              key={item.path}
              onClick={() => navigate(item.path)}
              style={{
                backgroundColor: isActive ? itemBg : 'transparent',
                padding: '12px',
                borderRadius: '12px',
                cursor: 'pointer',
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '6px',
                fontSize: '10px',
                fontWeight: isActive ? '600' : '500',
                transition: 'all 0.18s ease',
                width: '100%',
                minHeight: '64px',
                border: 'none',
              }}
              onMouseEnter={(e) => { if (!isActive) e.currentTarget.style.backgroundColor = 'rgba(255,255,255,0.03)'; }}
              onMouseLeave={(e) => { if (!isActive) e.currentTarget.style.backgroundColor = 'transparent'; }}
            >
              <div style={{
                width: 40,
                height: 40,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                borderRadius: 999,
                backgroundColor: isActive ? itemBg : 'transparent',
                boxSizing: 'border-box',
                filter: isActive ? ('drop-shadow(0 0 12px ' + itemHex + ')') : 'none',
                border: 'none'
              }}>
                <svg
                  style={{
                    width: '20px',
                    height: '20px',
                    stroke: isActive ? itemHex : 'currentColor',
                    fill: 'none',
                    strokeWidth: '2',
                  }}
                  viewBox="0 0 24 24"
                >
                  <path strokeLinecap="round" strokeLinejoin="round" d={item.icon} />
                </svg>
              </div>
              <span style={{
                fontSize: '10px',
                textAlign: 'center',
                lineHeight: '1.2',
                letterSpacing: '-0.01em',
                color: isActive ? itemHex : 'rgba(255, 255, 255, 0.7)'
              }}>
                {item.label}
              </span>
            </button>
          );
        })}
      </div>

      {/* Bottom Section - Vertical Profile Block (centered, near bottom) */}
      <div style={{ width: '100%', paddingTop: 8, paddingBottom: 8, borderTop: '1px solid rgba(31,41,55,0.6)', display: 'flex', justifyContent: 'center', marginTop: 'auto' }}>
        <div className='w-full border-b border-gray-800/60 my-6' />

        {user ? (
          <div
            className="flex flex-col items-center w-full px-2"
            style={{
              gap: 6,
              padding: '6px 0',
            }}
          >
            {/* Avatar with active-mode ring (uses currentColor) */}
            <div className={activeColorClass} style={{ borderRadius: 999, padding: 2, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <button
                onClick={() => navigate('/profile')}
                style={{
                  width: 56,
                  height: 56,
                  borderRadius: 999,
                  overflow: 'hidden',
                  background: '#0f172a',
                  border: '2px solid currentColor',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  padding: 0,
                  cursor: 'pointer'
                }}
                title={profile?.full_name || profile?.email || user?.email || 'Profile'}
              >
                {profile?.avatar_url ? (
                  <img src={profile.avatar_url} alt="avatar" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                ) : (
                  <span style={{ color: 'white', fontWeight: 700, fontSize: 18 }}>{(profile?.full_name || profile?.email || user?.email || 'U').charAt(0).toUpperCase()}</span>
                )}
              </button>
            </div>

            {/* Username (local part, no digits) */}
            <div style={{ color: 'white', fontWeight: 700, fontSize: 12, lineHeight: 1, textAlign: 'center', width: '100%', paddingLeft: 4, paddingRight: 4, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              {(cleanedName && cleanedName.length) ? cleanedName : 'User'}
            </div>

            {/* Action icons row (centered under name) */}
            <div style={{ display: 'flex', gap: 10, marginTop: 4, alignItems: 'center' }}>
              <Settings
                size={18}
                className="text-gray-400"
                style={{ transition: 'transform 0.12s ease', cursor: 'pointer' }}
                onMouseEnter={(e) => e.currentTarget.style.transform = 'scale(1.1)'}
                onMouseLeave={(e) => e.currentTarget.style.transform = 'scale(1)'}
                onClick={() => navigate('/settings')}
                title="Settings"
              />
              <LogOut
                size={18}
                className="text-red-500"
                style={{ transition: 'transform 0.12s ease', cursor: 'pointer' }}
                onMouseEnter={(e) => e.currentTarget.style.transform = 'scale(1.1)'}
                onMouseLeave={(e) => e.currentTarget.style.transform = 'scale(1)'}
                onClick={() => signOut && signOut()}
                title="Logout"
              />
            </div>
          </div>
        ) : (
          <button
            onClick={() => navigate('/login')}
            className="flex items-center justify-center w-full py-2 px-4 rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white font-medium text-sm transition-colors"
            style={{ marginTop: '8px' }}
          >
            Sign In
          </button>
        )}
      </div>
    </div>
  );
};

export default Sidebar;
