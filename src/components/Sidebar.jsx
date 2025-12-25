import React from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { Shield } from 'lucide-react';
import { useAuth } from '../context/AuthContext';

const Sidebar = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { profile } = useAuth();

  // Debug logging for admin button
  React.useEffect(() => {
    console.log('SIDEBAR CHECK -> Email:', profile?.email, 'Role:', profile?.role);
    console.log('SIDEBAR CHECK -> is_admin:', profile?.is_admin, '(type:', typeof profile?.is_admin, ')');
    console.log('SIDEBAR CHECK -> is_admin === true?', profile?.is_admin === true);
    console.log('SIDEBAR CHECK -> Full profile:', profile);
    
    // Direct database check for debugging
    if (profile?.email) {
      console.log('SIDEBAR: To verify in Supabase, run:');
      console.log(`SELECT email, is_admin, role FROM profiles WHERE email = '${profile.email}';`);
    }
  }, [profile]);

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
      path: '/blurting', 
      label: 'Active Recall', 
      icon: 'M13 10V3L4 14h7v7l9-11h-7z',
      activeBg: 'rgba(139, 92, 246, 0.2)',
      activeText: '#a78bfa',
    },
    { 
      path: '/feynman', 
      label: 'Feynman', 
      icon: 'M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253',
      activeBg: 'rgba(249, 115, 22, 0.2)',
      activeText: '#fb923c',
    },
    { 
      path: '/flashcards', 
      label: 'Flashcards', 
      icon: 'M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10',
      activeBg: 'rgba(34, 197, 94, 0.2)',
      activeText: '#4ade80',
    },
  ];

  return (
    <div style={{
      width: '96px',
      backgroundColor: 'rgba(17, 24, 39, 0.5)',
      backdropFilter: 'blur(24px)',
      borderRight: '1px solid rgba(255, 255, 255, 0.1)',
      height: '100vh',
      display: 'flex',
      flexDirection: 'column',
      padding: '24px 16px',
      alignItems: 'center',
      position: 'relative',
      zIndex: 10,
      gap: '8px',
    }}>
      {/* Logo Section - Top */}
      <div style={{
        marginBottom: '16px',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        gap: '8px',
        paddingBottom: '24px',
        borderBottom: '1px solid rgba(255, 255, 255, 0.1)',
        width: '100%',
      }}>
        <div style={{
          width: '48px',
          height: '48px',
          borderRadius: '12px',
          background: 'linear-gradient(135deg, rgba(168, 85, 247, 0.2), rgba(236, 72, 153, 0.2))',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          border: '1px solid rgba(168, 85, 247, 0.3)',
          boxShadow: '0 0 20px rgba(168, 85, 247, 0.2)',
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
            <path strokeLinecap="round" strokeLinejoin="round" d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
          </svg>
        </div>
        <span style={{
          fontSize: '11px',
          fontWeight: '700',
          color: '#ffffff',
          letterSpacing: '0.05em',
          textTransform: 'uppercase',
        }}>
          MindFlow
        </span>
      </div>

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
          return (
            <button
              key={item.path}
              onClick={() => navigate(item.path)}
              style={{
                backgroundColor: isActive ? item.activeBg : 'transparent',
                color: isActive ? item.activeText : 'rgba(255, 255, 255, 0.6)',
                padding: '12px',
                borderRadius: '16px',
                cursor: 'pointer',
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '6px',
                fontSize: '10px',
                fontWeight: isActive ? '600' : '500',
                transition: 'all 0.2s ease',
                width: '100%',
                minHeight: '64px',
                border: 'none',
                boxShadow: isActive ? `0 0 20px ${item.activeBg}` : 'none',
              }}
              onMouseEnter={(e) => {
                if (!isActive) {
                  e.currentTarget.style.backgroundColor = 'rgba(255, 255, 255, 0.05)';
                  e.currentTarget.style.color = 'rgba(255, 255, 255, 0.9)';
                }
              }}
              onMouseLeave={(e) => {
                if (!isActive) {
                  e.currentTarget.style.backgroundColor = 'transparent';
                  e.currentTarget.style.color = 'rgba(255, 255, 255, 0.6)';
                }
              }}
            >
              <svg
                style={{
                  width: '24px',
                  height: '24px',
                  stroke: 'currentColor',
                  fill: 'none',
                  strokeWidth: '2',
                }}
                viewBox="0 0 24 24"
              >
                <path strokeLinecap="round" strokeLinejoin="round" d={item.icon} />
              </svg>
              <span style={{ 
                fontSize: '10px',
                textAlign: 'center',
                lineHeight: '1.2',
                letterSpacing: '-0.01em',
              }}>
                {item.label}
              </span>
            </button>
          );
        })}
      </div>

      {/* Bottom Section - Settings & Profile */}
      <div style={{
        display: 'flex',
        flexDirection: 'column',
        gap: '8px',
        width: '100%',
        paddingTop: '16px',
        borderTop: '1px solid rgba(255, 255, 255, 0.1)',
      }}>
        <button
          onClick={() => navigate('/settings')}
          style={{
            backgroundColor: location.pathname === '/settings' 
              ? 'rgba(255, 255, 255, 0.1)' 
              : 'transparent',
            color: location.pathname === '/settings' 
              ? '#ffffff' 
              : 'rgba(255, 255, 255, 0.6)',
            padding: '12px',
            borderRadius: '16px',
            cursor: 'pointer',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            gap: '6px',
            fontSize: '10px',
            fontWeight: location.pathname === '/settings' ? '600' : '500',
            transition: 'all 0.2s ease',
            width: '100%',
            minHeight: '64px',
            border: 'none',
            boxShadow: location.pathname === '/settings' 
              ? '0 0 20px rgba(255, 255, 255, 0.1)' 
              : 'none',
          }}
          onMouseEnter={(e) => {
            if (location.pathname !== '/settings') {
              e.currentTarget.style.backgroundColor = 'rgba(255, 255, 255, 0.05)';
              e.currentTarget.style.color = 'rgba(255, 255, 255, 0.9)';
            }
          }}
          onMouseLeave={(e) => {
            if (location.pathname !== '/settings') {
              e.currentTarget.style.backgroundColor = 'transparent';
              e.currentTarget.style.color = 'rgba(255, 255, 255, 0.6)';
            }
          }}
        >
          <svg
            style={{
              width: '24px',
              height: '24px',
              stroke: 'currentColor',
              fill: 'none',
              strokeWidth: '2',
            }}
            viewBox="0 0 24 24"
          >
            <path strokeLinecap="round" strokeLinejoin="round" d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
          </svg>
          <span style={{ 
            fontSize: '10px',
            textAlign: 'center',
            lineHeight: '1.2',
            letterSpacing: '-0.01em',
          }}>
            Settings
          </span>
        </button>

        {/* Admin Panel Button */}
        {/* Check profile.is_admin (overridden by God Mode) or master email */}
        {(() => {
          const isMasterUser = user?.email === 'hannajohn37@gmail.com';
          const isDbAdmin = profile?.is_admin === true || profile?.role === 'admin';
          const isAdmin = isMasterUser || isDbAdmin;
          console.log('Sidebar: Admin button check:', { 
            email: user?.email,
            isMasterUser,
            is_admin: profile?.is_admin, 
            role: profile?.role, 
            isAdmin 
          });
          return isAdmin;
        })() && (
          <button
            onClick={() => navigate('/admin')}
            style={{
              backgroundColor: location.pathname === '/admin' 
                ? 'rgba(239, 68, 68, 0.2)' 
                : 'transparent',
              color: location.pathname === '/admin' 
                ? '#fca5a5' 
                : 'rgba(255, 255, 255, 0.6)',
              padding: '12px',
              borderRadius: '16px',
              cursor: 'pointer',
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '6px',
              fontSize: '10px',
              fontWeight: location.pathname === '/admin' ? '600' : '500',
              transition: 'all 0.2s ease',
              width: '100%',
              minHeight: '64px',
              border: 'none',
              boxShadow: location.pathname === '/admin' 
                ? '0 0 20px rgba(239, 68, 68, 0.2)' 
                : 'none',
            }}
            onMouseEnter={(e) => {
              if (location.pathname !== '/admin') {
                e.currentTarget.style.backgroundColor = 'rgba(239, 68, 68, 0.1)';
                e.currentTarget.style.color = 'rgba(255, 255, 255, 0.9)';
              }
            }}
            onMouseLeave={(e) => {
              if (location.pathname !== '/admin') {
                e.currentTarget.style.backgroundColor = 'transparent';
                e.currentTarget.style.color = 'rgba(255, 255, 255, 0.6)';
              }
            }}
          >
            <Shield size={24} style={{ stroke: 'currentColor' }} />
            <span style={{ 
              fontSize: '10px',
              textAlign: 'center',
              lineHeight: '1.2',
              letterSpacing: '-0.01em',
            }}>
              Admin
            </span>
          </button>
        )}

        {/* Profile Avatar */}
        <div style={{
          width: '100%',
          display: 'flex',
          justifyContent: 'center',
          marginTop: '8px',
        }}>
          <button
            onClick={() => navigate('/profile')}
            style={{
              width: '48px',
              height: '48px',
              borderRadius: '12px',
              background: location.pathname === '/profile'
                ? 'rgba(59, 130, 246, 0.3)'
                : 'linear-gradient(135deg, rgba(59, 130, 246, 0.2), rgba(139, 92, 246, 0.2))',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              border: location.pathname === '/profile'
                ? '1px solid rgba(255, 255, 255, 0.3)'
                : '1px solid rgba(255, 255, 255, 0.1)',
              cursor: 'pointer',
              transition: 'all 0.2s ease',
              padding: 0,
            }}
            onMouseEnter={(e) => {
              if (location.pathname !== '/profile') {
                e.currentTarget.style.backgroundColor = 'rgba(59, 130, 246, 0.3)';
                e.currentTarget.style.borderColor = 'rgba(255, 255, 255, 0.2)';
              }
            }}
            onMouseLeave={(e) => {
              if (location.pathname !== '/profile') {
                e.currentTarget.style.backgroundColor = 'linear-gradient(135deg, rgba(59, 130, 246, 0.2), rgba(139, 92, 246, 0.2))';
                e.currentTarget.style.borderColor = 'rgba(255, 255, 255, 0.1)';
              }
            }}
          >
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
              <path strokeLinecap="round" strokeLinejoin="round" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
            </svg>
          </button>
        </div>
      </div>
    </div>
  );
};

export default Sidebar;
