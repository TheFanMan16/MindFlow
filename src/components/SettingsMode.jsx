import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { toast } from 'react-hot-toast';
import { useAuth } from '../context/AuthContext';
import { supabase } from '../lib/supabaseClient';
import config from '../config/api';
import {
  Clock,
  Volume2,
  Shield,
  Crown,
  RefreshCw,
  ExternalLink,
  Trash2,
  CheckCircle2,
  AlertCircle
} from 'lucide-react';

const SettingsMode = () => {
  const navigate = useNavigate();
  const { user, profile, refreshProfile } = useAuth();

  // Timer Preferences
  const [focusDuration, setFocusDuration] = useState(25);
  const [shortBreakDuration, setShortBreakDuration] = useState(5);
  const [longBreakDuration, setLongBreakDuration] = useState(15);

  // Sound Settings
  const [tickTockSound, setTickTockSound] = useState(false);
  const [alarmVolume, setAlarmVolume] = useState(50);

  // Account Management State
  const [isSubscribing, setIsSubscribing] = useState(false);
  const [subscriptionStatus, setSubscriptionStatus] = useState(null);
  const [subscriptionData, setSubscriptionData] = useState(null);
  const [subscriptionLoading, setSubscriptionLoading] = useState(false);
  const [isSyncing, setIsSyncing] = useState(false);

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

        if (response.ok) {
          const data = await response.json();
          setSubscriptionData(data);
        } else {
          setSubscriptionData(null);
        }
      } catch (error) {
        console.error('Error fetching subscription details:', error);
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

      if (savedFocus) setFocusDuration(parseInt(savedFocus, 10));
      if (savedShortBreak) setShortBreakDuration(parseInt(savedShortBreak, 10));
      if (savedLongBreak) setLongBreakDuration(parseInt(savedLongBreak, 10));
      if (savedTickTock) setTickTockSound(savedTickTock === 'true');
      if (savedVolume) setAlarmVolume(parseInt(savedVolume, 10));
    } catch (error) {
      console.error('Error loading settings:', error);
    }
  }, []);

  // Save timer durations to localStorage
  const saveTimerSettings = () => {
    localStorage.setItem('timer_focusDuration', focusDuration.toString());
    localStorage.setItem('timer_shortBreakDuration', shortBreakDuration.toString());
    localStorage.setItem('timer_longBreakDuration', longBreakDuration.toString());
    toast.success('Timer settings saved!');
  };

  // Save sound settings
  const saveSoundSettings = () => {
    localStorage.setItem('timer_tickTockSound', tickTockSound.toString());
    localStorage.setItem('timer_alarmVolume', alarmVolume.toString());
    toast.success('Sound settings saved!');
  };

  // Reset all data
  const handleResetData = () => {
    if (window.confirm('Are you sure you want to reset all data? This will clear all local history and settings. This cannot be undone.')) {
      localStorage.clear();
      toast.success('All data has been reset.');
      setTimeout(() => window.location.reload(), 1000);
    }
  };

  // Account Management Functions
  const handleSubscribe = async () => {
    if (actuallyHasPro) {
      toast.success('You are already a Pro member!');
      return;
    }

    setIsSubscribing(true);
    try {
      if (!user?.id) {
        toast.error('Please log in to subscribe.');
        setIsSubscribing(false);
        return;
      }

      const response = await fetch(`${config.api.baseUrl}/create-checkout-session`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId: user.id, email: user.email }),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ error: 'Unknown error' }));
        toast.error(`Failed to start checkout: ${errorData.error}`);
        setIsSubscribing(false);
        return;
      }

      const data = await response.json();
      if (data?.url) {
        window.location.assign(data.url);
      } else {
        toast.error('Failed to get checkout URL.');
        setIsSubscribing(false);
      }
    } catch (err) {
      console.error('Subscribe error:', err);
      toast.error('An unexpected error occurred.');
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
        // Auto-recovery is handled by backend now, but if it fails fundamentally:
        toast.error(data.error || 'Failed to open billing portal');
      } else if (data?.url) {
        window.open(data.url, '_blank');
      }
    } catch (err) {
      console.error('Billing portal error:', err);
      toast.error('An unexpected error occurred.');
    }
  };

  // Sync subscription status from Stripe
  const handleSyncSubscription = async () => {
    if (!user?.id) return;

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
      } else {
        toast.success(data.message || 'Subscription status synced');
        await refreshProfile();
      }
    } catch (err) {
      console.error('Sync subscription error:', err);
      toast.error('An unexpected error occurred while syncing.');
    } finally {
      setIsSyncing(false);
    }
  };

  return (
    <div className="min-h-full w-full bg-[#0f1012] relative overflow-y-auto p-6 md:p-12 font-sans text-slate-200">

      {/* Background Gradient */}
      <div className="absolute top-[-20%] right-[-10%] w-[600px] h-[600px] bg-[#581c87] opacity-20 blur-[120px] rounded-full pointer-events-none" />

      <div className="max-w-4xl mx-auto relative z-10">
        <h1 className="text-4xl font-bold text-white mb-2">Settings</h1>
        <p className="text-slate-400 mb-8">Manage your preferences and subscription</p>

        {/* Account Section */}
        <section className="mb-8">
          <div className="flex items-center gap-3 mb-4">
            <Crown className="text-[#a855f7]" size={24} />
            <h2 className="text-xl font-semibold text-white">Account & Subscription</h2>
          </div>

          <div className="bg-slate-900/50 backdrop-blur-xl border border-slate-800 rounded-2xl p-6 md:p-8">
            {actuallyHasPro ? (
              // Pro View
              <div className="flex flex-col md:flex-row justify-between items-center gap-6">
                <div className="flex-1">
                  <div className="flex items-center gap-3 mb-2">
                    <h3 className="text-xl font-bold text-white">Pro Plan Active</h3>
                    <span className="px-3 py-1 rounded-full bg-[#581c87]/30 border border-[#581c87] text-[#c084fc] text-xs font-bold uppercase tracking-wider">
                      PRO
                    </span>
                  </div>
                  <p className="text-slate-400 mb-4">
                    You have full access to all AI features and unlimited study tools.
                  </p>
                  {subscriptionData?.current_period_end && (
                    <p className="text-xs text-slate-500 flex items-center gap-2">
                      <Clock size={12} />
                      Next billing: {new Date(subscriptionData.current_period_end * 1000).toLocaleDateString()}
                    </p>
                  )}
                </div>

                <div className="flex flex-col gap-3 w-full md:w-auto">
                  <button
                    onClick={handleOpenBillingPortal}
                    className="px-6 py-3 bg-[#581c87] hover:bg-[#6b21a8] text-white rounded-xl font-medium transition-all flex items-center justify-center gap-2 shadow-lg shadow-purple-900/20"
                  >
                    <ExternalLink size={18} />
                    Manage Subscription
                  </button>
                  <button
                    onClick={handleSyncSubscription}
                    disabled={isSyncing}
                    className="px-6 py-3 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-xl font-medium transition-all flex items-center justify-center gap-2 disabled:opacity-50"
                  >
                    <RefreshCw size={18} className={isSyncing ? "animate-spin" : ""} />
                    {isSyncing ? "Syncing..." : "Refresh Status"}
                  </button>
                </div>
              </div>
            ) : (
              // Free View
              <div className="bg-gradient-to-br from-[#1e1b4b] to-[#0f1012] border border-blue-900/30 rounded-xl p-6 relative overflow-hidden">
                <div className="absolute top-0 right-0 w-64 h-64 bg-blue-600/10 blur-[60px] rounded-full pointer-events-none" />

                <div className="relative z-10 flex flex-col md:flex-row justify-between items-center gap-6">
                  <div>
                    <h3 className="text-xl font-bold text-white mb-2">Upgrade to Pro</h3>
                    <p className="text-slate-400 max-w-lg">
                      Unlock unlimited AI flashcards, Feynman analysis, and smart study tools.
                    </p>
                  </div>
                  <button
                    onClick={handleSubscribe}
                    disabled={isSubscribing}
                    className="px-8 py-3 bg-blue-600 hover:bg-blue-500 text-white rounded-xl font-bold transition-all shadow-lg shadow-blue-900/20 flex items-center gap-2 disabled:opacity-70 disabled:cursor-not-allowed whitespace-nowrap"
                  >
                    {isSubscribing ? (
                      <>
                        <RefreshCw size={18} className="animate-spin" />
                        Processing...
                      </>
                    ) : (
                      <>
                        <Crown size={18} />
                        Upgrade for $8.99/mo
                      </>
                    )}
                  </button>
                </div>
              </div>
            )}
          </div>
        </section>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
          {/* Timer Preferences */}
          <section>
            <div className="flex items-center gap-3 mb-4">
              <Clock className="text-blue-400" size={24} />
              <h2 className="text-xl font-semibold text-white">Timer Preferences</h2>
            </div>
            <div className="bg-slate-900/50 backdrop-blur-xl border border-slate-800 rounded-2xl p-6">
              <div className="space-y-5">
                <div className="space-y-2">
                  <label className="text-sm font-medium text-slate-400">Focus Duration (min)</label>
                  <input
                    type="number"
                    value={focusDuration}
                    onChange={(e) => setFocusDuration(parseInt(e.target.value) || 25)}
                    className="w-full bg-slate-950 border border-slate-800 rounded-lg px-4 py-2.5 text-white focus:ring-2 focus:ring-blue-500 outline-none transition-all"
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-medium text-slate-400">Short Break (min)</label>
                  <input
                    type="number"
                    value={shortBreakDuration}
                    onChange={(e) => setShortBreakDuration(parseInt(e.target.value) || 5)}
                    className="w-full bg-slate-950 border border-slate-800 rounded-lg px-4 py-2.5 text-white focus:ring-2 focus:ring-blue-500 outline-none transition-all"
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-medium text-slate-400">Long Break (min)</label>
                  <input
                    type="number"
                    value={longBreakDuration}
                    onChange={(e) => setLongBreakDuration(parseInt(e.target.value) || 15)}
                    className="w-full bg-slate-950 border border-slate-800 rounded-lg px-4 py-2.5 text-white focus:ring-2 focus:ring-blue-500 outline-none transition-all"
                  />
                </div>
                <button
                  onClick={saveTimerSettings}
                  className="w-full py-2.5 bg-blue-600/10 hover:bg-blue-600/20 text-blue-400 border border-blue-600/20 rounded-lg font-medium transition-all"
                >
                  Save Timer Settings
                </button>
              </div>
            </div>
          </section>

          {/* Sound Settings */}
          <section>
            <div className="flex items-center gap-3 mb-4">
              <Volume2 className="text-emerald-400" size={24} />
              <h2 className="text-xl font-semibold text-white">Sound Settings</h2>
            </div>
            <div className="bg-slate-900/50 backdrop-blur-xl border border-slate-800 rounded-2xl p-6 h-full flex flex-col justify-between">
              <div className="space-y-6">
                <div className="flex items-center justify-between">
                  <div>
                    <h3 className="text-white font-medium">Tick Tock Sound</h3>
                    <p className="text-xs text-slate-500">Play ticking sound during focus</p>
                  </div>
                  <button
                    onClick={() => {
                      setTickTockSound(!tickTockSound);
                      saveSoundSettings();
                    }}
                    className={`w-12 h-6 rounded-full relative transition-colors ${tickTockSound ? 'bg-emerald-500' : 'bg-slate-700'}`}
                  >
                    <div className={`absolute top-1 left-1 w-4 h-4 rounded-full bg-white transition-transform ${tickTockSound ? 'translate-x-6' : ''}`} />
                  </button>
                </div>

                <div className="space-y-2">
                  <div className="flex justify-between">
                    <label className="text-sm font-medium text-slate-400">Alarm Volume</label>
                    <span className="text-sm text-slate-500">{alarmVolume}%</span>
                  </div>
                  <input
                    type="range"
                    min="0"
                    max="100"
                    value={alarmVolume}
                    onChange={(e) => {
                      setAlarmVolume(parseInt(e.target.value));
                    }}
                    onMouseUp={saveSoundSettings}
                    onTouchEnd={saveSoundSettings}
                    className="w-full h-2 bg-slate-800 rounded-lg appearance-none cursor-pointer accent-emerald-500"
                  />
                </div>
              </div>

              <div className="mt-8 pt-6 border-t border-slate-800/50">
                <div className="flex items-start gap-4 p-4 bg-emerald-950/20 border border-emerald-900/30 rounded-xl">
                  <Volume2 size={20} className="text-emerald-500 shrink-0 mt-0.5" />
                  <p className="text-xs text-slate-400">
                    Adjust volume for session completion alarms and ticking sounds.
                  </p>
                </div>
              </div>
            </div>
          </section>
        </div>

        {/* Data & Privacy */}
        <section>
          <div className="flex items-center gap-3 mb-4">
            <Shield className="text-red-400" size={24} />
            <h2 className="text-xl font-semibold text-white">Data & Privacy</h2>
          </div>
          <div className="bg-slate-900/50 backdrop-blur-xl border border-slate-800 rounded-2xl p-6">
            <div className="flex flex-col md:flex-row justify-between items-center gap-4">
              <div>
                <h3 className="text-white font-medium mb-1">Reset All Data</h3>
                <p className="text-sm text-slate-500">
                  Permanently delete all session history, local settings, and progress.
                </p>
              </div>
              <button
                onClick={handleResetData}
                className="px-6 py-2.5 border border-red-500/20 hover:bg-red-500/10 text-red-500 rounded-xl font-medium transition-all flex items-center gap-2"
              >
                <Trash2 size={16} />
                Reset Data
              </button>
            </div>
          </div>
        </section>
      </div>
    </div>
  );
};

export default SettingsMode;
