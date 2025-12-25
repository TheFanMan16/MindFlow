import React, { useState, useEffect } from 'react';

const SettingsMode = () => {
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

