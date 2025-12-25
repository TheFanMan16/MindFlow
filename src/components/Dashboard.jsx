import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';

const Dashboard = () => {
  const navigate = useNavigate();
  const [stats, setStats] = useState({
    totalStudyTime: 0, // in seconds
    sessionsCompleted: 0,
    hoursFocusedToday: 0,
    tasksCleared: 0,
    weeklyStreak: 0,
  });

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

  // Load stats from localStorage
  useEffect(() => {
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
        
        setStats({
          totalStudyTime: totalHours * 3600 + totalMinutes * 60,
          sessionsCompleted: sessions.length,
          hoursFocusedToday: parseFloat(todayHours),
          tasksCleared: todaySessions.length,
          weeklyStreak: streak,
        });
      }
    } catch (error) {
      console.error('Error loading stats:', error);
    }
  }, []);

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
      flex: 1,
      overflowY: 'auto',
      position: 'relative',
      backgroundColor: '#030712', // Match App background
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
      <div style={{
        position: 'absolute',
        bottom: '-150px',
        left: '-150px',
        width: '500px',
        height: '500px',
        background: 'radial-gradient(circle, rgba(34, 211, 238, 0.1) 0%, rgba(139, 92, 246, 0.08) 50%, transparent 70%)',
        borderRadius: '50%',
        filter: 'blur(60px)',
        pointerEvents: 'none',
        zIndex: 0,
      }} />

      {/* Content */}
      <div style={{ position: 'relative', zIndex: 1, maxWidth: '1200px', margin: '0 auto', width: '100%' }}>
        {/* Premium Header Section */}
        <div style={{
          marginBottom: '64px',
        }}>
          {/* Top Row: Headline + Stats Pills */}
          <div style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'flex-start',
            marginBottom: '24px',
            flexWrap: 'wrap',
            gap: '32px',
          }}>
            {/* Left: Headline */}
            <div style={{
              flex: 1,
              minWidth: '300px',
            }}>
              <h1 style={{
                fontSize: '56px',
                fontWeight: '700',
                marginBottom: '12px',
                color: '#ffffff',
                letterSpacing: '-0.03em',
                lineHeight: '1.1',
                background: 'linear-gradient(135deg, #ffffff 0%, rgba(255, 255, 255, 0.8) 100%)',
                WebkitBackgroundClip: 'text',
                WebkitTextFillColor: 'transparent',
                backgroundClip: 'text',
              }}>
                {stats.hoursFocusedToday > 0 
                  ? `You're building momentum.`
                  : stats.weeklyStreak > 0
                  ? `Keep your streak alive.`
                  : `Ready to focus?`}
              </h1>
              <p style={{
                fontSize: '18px',
                color: 'rgba(255, 255, 255, 0.5)',
                fontWeight: '400',
                lineHeight: '1.5',
                marginTop: '8px',
              }}>
                {stats.hoursFocusedToday > 0
                  ? `${stats.hoursFocusedToday} hours today • ${stats.weeklyStreak} day streak`
                  : stats.weeklyStreak > 0
                  ? `${stats.weeklyStreak} day streak • ${stats.sessionsCompleted} sessions completed`
                  : 'Start your first session to begin tracking progress'}
              </p>
            </div>
            
            {/* Right: Compact Stat Pills */}
            <div style={{
              display: 'flex',
              gap: '12px',
              flexWrap: 'wrap',
              alignItems: 'flex-start',
            }}>
              {/* Focus Time Pill */}
              <div style={{
                backgroundColor: 'rgba(34, 211, 238, 0.08)',
                backdropFilter: 'blur(20px)',
                borderRadius: '16px',
                padding: '12px 20px',
                border: '1px solid rgba(34, 211, 238, 0.2)',
                display: 'flex',
                alignItems: 'center',
                gap: '10px',
                boxShadow: '0 0 20px rgba(34, 211, 238, 0.15)',
                transition: 'all 0.3s ease',
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.backgroundColor = 'rgba(34, 211, 238, 0.12)';
                e.currentTarget.style.boxShadow = '0 0 30px rgba(34, 211, 238, 0.25)';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.backgroundColor = 'rgba(34, 211, 238, 0.08)';
                e.currentTarget.style.boxShadow = '0 0 20px rgba(34, 211, 238, 0.15)';
              }}
              >
                <svg
                  style={{
                    width: '18px',
                    height: '18px',
                    stroke: '#22d3ee',
                    fill: 'none',
                    strokeWidth: '2',
                  }}
                  viewBox="0 0 24 24"
                >
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                <div>
                  <div style={{
                    fontSize: '11px',
                    color: 'rgba(255, 255, 255, 0.5)',
                    fontWeight: '500',
                    textTransform: 'uppercase',
                    letterSpacing: '0.08em',
                    lineHeight: '1',
                  }}>
                    Focus
                  </div>
                  <div style={{
                    fontSize: '20px',
                    fontWeight: '700',
                    color: '#22d3ee',
                    lineHeight: '1.2',
                    marginTop: '2px',
                  }}>
                    {stats.hoursFocusedToday}h
                  </div>
                </div>
              </div>

              {/* Tasks Pill */}
              <div style={{
                backgroundColor: 'rgba(139, 92, 246, 0.08)',
                backdropFilter: 'blur(20px)',
                borderRadius: '16px',
                padding: '12px 20px',
                border: '1px solid rgba(139, 92, 246, 0.2)',
                display: 'flex',
                alignItems: 'center',
                gap: '10px',
                boxShadow: '0 0 20px rgba(139, 92, 246, 0.15)',
                transition: 'all 0.3s ease',
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.backgroundColor = 'rgba(139, 92, 246, 0.12)';
                e.currentTarget.style.boxShadow = '0 0 30px rgba(139, 92, 246, 0.25)';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.backgroundColor = 'rgba(139, 92, 246, 0.08)';
                e.currentTarget.style.boxShadow = '0 0 20px rgba(139, 92, 246, 0.15)';
              }}
              >
                <svg
                  style={{
                    width: '18px',
                    height: '18px',
                    stroke: '#8b5cf6',
                    fill: 'none',
                    strokeWidth: '2',
                  }}
                  viewBox="0 0 24 24"
                >
                  <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                <div>
                  <div style={{
                    fontSize: '11px',
                    color: 'rgba(255, 255, 255, 0.5)',
                    fontWeight: '500',
                    textTransform: 'uppercase',
                    letterSpacing: '0.08em',
                    lineHeight: '1',
                  }}>
                    Tasks
                  </div>
                  <div style={{
                    fontSize: '20px',
                    fontWeight: '700',
                    color: '#8b5cf6',
                    lineHeight: '1.2',
                    marginTop: '2px',
                  }}>
                    {stats.tasksCleared}
                  </div>
                </div>
              </div>

              {/* Streak Pill */}
              <div style={{
                backgroundColor: 'rgba(249, 115, 22, 0.08)',
                backdropFilter: 'blur(20px)',
                borderRadius: '16px',
                padding: '12px 20px',
                border: '1px solid rgba(249, 115, 22, 0.2)',
                display: 'flex',
                alignItems: 'center',
                gap: '10px',
                boxShadow: '0 0 20px rgba(249, 115, 22, 0.15)',
                transition: 'all 0.3s ease',
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.backgroundColor = 'rgba(249, 115, 22, 0.12)';
                e.currentTarget.style.boxShadow = '0 0 30px rgba(249, 115, 22, 0.25)';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.backgroundColor = 'rgba(249, 115, 22, 0.08)';
                e.currentTarget.style.boxShadow = '0 0 20px rgba(249, 115, 22, 0.15)';
              }}
              >
                <svg
                  style={{
                    width: '18px',
                    height: '18px',
                    stroke: '#f97316',
                    fill: 'none',
                    strokeWidth: '2',
                  }}
                  viewBox="0 0 24 24"
                >
                  <path strokeLinecap="round" strokeLinejoin="round" d="M15.362 5.214A8.252 8.252 0 0112 21 8.25 8.25 0 016.038 7.048 8.287 8.287 0 009 10.5a8.983 8.983 0 013.361-6.867 8.21 8.21 0 003 2.48z" />
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 18a3.75 3.75 0 00.495-7.467 5.99 5.99 0 00-1.925 3.546 5.974 5.974 0 01-2.133-1A3.75 3.75 0 0012 18z" />
                </svg>
                <div>
                  <div style={{
                    fontSize: '11px',
                    color: 'rgba(255, 255, 255, 0.5)',
                    fontWeight: '500',
                    textTransform: 'uppercase',
                    letterSpacing: '0.08em',
                    lineHeight: '1',
                  }}>
                    Streak
                  </div>
                  <div style={{
                    fontSize: '20px',
                    fontWeight: '700',
                    color: '#f97316',
                    lineHeight: '1.2',
                    marginTop: '2px',
                  }}>
                    {stats.weeklyStreak}
                  </div>
                </div>
              </div>

              {/* Total Time Pill */}
              <div style={{
                backgroundColor: 'rgba(255, 255, 255, 0.05)',
                backdropFilter: 'blur(20px)',
                borderRadius: '16px',
                padding: '12px 20px',
                border: '1px solid rgba(255, 255, 255, 0.1)',
                display: 'flex',
                alignItems: 'center',
                gap: '10px',
                boxShadow: '0 0 20px rgba(255, 255, 255, 0.05)',
                transition: 'all 0.3s ease',
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.backgroundColor = 'rgba(255, 255, 255, 0.08)';
                e.currentTarget.style.boxShadow = '0 0 30px rgba(255, 255, 255, 0.1)';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.backgroundColor = 'rgba(255, 255, 255, 0.05)';
                e.currentTarget.style.boxShadow = '0 0 20px rgba(255, 255, 255, 0.05)';
              }}
              >
                <svg
                  style={{
                    width: '18px',
                    height: '18px',
                    stroke: 'rgba(255, 255, 255, 0.7)',
                    fill: 'none',
                    strokeWidth: '2',
                  }}
                  viewBox="0 0 24 24"
                >
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 6v6h4.5m4.5 0a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                <div>
                  <div style={{
                    fontSize: '11px',
                    color: 'rgba(255, 255, 255, 0.5)',
                    fontWeight: '500',
                    textTransform: 'uppercase',
                    letterSpacing: '0.08em',
                    lineHeight: '1',
                  }}>
                    Total
                  </div>
                  <div style={{
                    fontSize: '20px',
                    fontWeight: '700',
                    color: '#ffffff',
                    lineHeight: '1.2',
                    marginTop: '2px',
                  }}>
                    {formatTime(stats.totalStudyTime)}
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Main Tools Grid */}
        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(2, 1fr)',
          gap: '32px',
        }}>
          {cards.map((card) => (
            <div
              key={card.id}
              style={{
                backgroundColor: 'rgba(255, 255, 255, 0.03)',
                backdropFilter: 'blur(10px)',
                borderRadius: '24px',
                padding: '40px',
                border: '1px solid rgba(255, 255, 255, 0.1)',
                transition: 'all 0.3s ease',
                cursor: 'pointer',
                position: 'relative',
                display: 'flex',
                flexDirection: 'column',
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.backgroundColor = 'rgba(255, 255, 255, 0.05)';
                e.currentTarget.style.borderColor = 'rgba(255, 255, 255, 0.2)';
                e.currentTarget.style.transform = 'translateY(-4px)';
                e.currentTarget.style.boxShadow = `0 8px 40px rgba(${hexToRgb(card.neonColor)}, 0.2)`;
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.backgroundColor = 'rgba(255, 255, 255, 0.03)';
                e.currentTarget.style.borderColor = 'rgba(255, 255, 255, 0.1)';
                e.currentTarget.style.transform = 'translateY(0)';
                e.currentTarget.style.boxShadow = 'none';
              }}
              onClick={() => navigate(`/${card.view}`)}
            >
              {/* Icon circle with neon glow */}
              <div style={{
                width: '72px',
                height: '72px',
                borderRadius: '50%',
                background: `rgba(${hexToRgb(card.neonColor)}, 0.15)`,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                marginBottom: '24px',
                border: `1px solid rgba(${hexToRgb(card.neonColor)}, 0.4)`,
                boxShadow: `0 0 30px rgba(${hexToRgb(card.neonColor)}, 0.3), inset 0 0 20px rgba(${hexToRgb(card.neonColor)}, 0.1)`,
              }}>
                <svg
                  style={{
                    width: '36px',
                    height: '36px',
                    stroke: card.neonColor,
                    fill: 'none',
                    strokeWidth: '2',
                    filter: `drop-shadow(0 0 8px ${card.neonColor})`,
                  }}
                  viewBox="0 0 24 24"
                >
                  <path strokeLinecap="round" strokeLinejoin="round" d={card.icon} />
                </svg>
              </div>

              <h2 style={{
                fontSize: '28px',
                fontWeight: '600',
                color: '#ffffff',
                marginBottom: '12px',
                letterSpacing: '-0.01em',
              }}>
                {card.title}
              </h2>
              <p style={{
                fontSize: '16px',
                color: 'rgba(255, 255, 255, 0.6)',
                lineHeight: '1.6',
                marginBottom: '24px',
                fontWeight: '400',
                flex: 1,
              }}>
                {card.description}
              </p>
              
              {/* Last Used Label */}
              <div style={{
                fontSize: '12px',
                color: 'rgba(255, 255, 255, 0.4)',
                marginBottom: '16px',
                fontWeight: '400',
              }}>
                Last session: {getTimeAgo(localStorage.getItem(`lastUsed_${card.id}`))}
              </div>
              
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  // Store last used timestamp
                  localStorage.setItem(`lastUsed_${card.id}`, new Date().toISOString());
                  navigate(`/${card.view}`);
                }}
                style={{
                  background: `linear-gradient(90deg, ${card.gradient[0]}, ${card.gradient[1]})`,
                  color: '#ffffff',
                  border: 'none',
                  padding: '16px 32px',
                  borderRadius: '24px',
                  fontSize: '16px',
                  fontWeight: '600',
                  cursor: 'pointer',
                  transition: 'all 0.3s ease',
                  width: '100%',
                  boxShadow: `0 4px 20px rgba(${hexToRgb(card.gradient[0])}, 0.3)`,
                  letterSpacing: '-0.01em',
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.boxShadow = `0 6px 30px rgba(${hexToRgb(card.gradient[0])}, 0.5)`;
                  e.currentTarget.style.transform = 'scale(1.02)';
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.boxShadow = `0 4px 20px rgba(${hexToRgb(card.gradient[0])}, 0.3)`;
                  e.currentTarget.style.transform = 'scale(1)';
                }}
              >
                Start
              </button>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

export default Dashboard;
