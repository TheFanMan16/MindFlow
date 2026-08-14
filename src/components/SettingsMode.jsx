import React, { useState, useEffect, useRef } from 'react';
import { toast } from 'react-hot-toast';
import { useAuth } from '../context/AuthContext';
import { capture } from '../lib/analytics';
import config from '../config/api';
import { getAuthHeader } from '../utils/authHeader';
import ConfirmModal from './ConfirmModal';
import {
  getReminderPreference,
  setReminderPreference,
  requestNotificationPermission,
} from '../utils/notifications';
import { Clock, RefreshCw, ExternalLink, Trash2, Crown } from 'lucide-react';
import { Breadcrumb, Card, Field, Input, Switch, Button, SaveButton, Badge, Skeleton } from './ui';
import { Stagger } from '../motion';

/**
 * Timer durations are held as raw strings so a half-typed value ("2", "")
 * can exist without being silently coerced; validation happens against the
 * parsed value and surfaces through the Field error line, never a coercion.
 */
const parseMinutes = (raw) => {
  const n = Number(raw);
  return Number.isInteger(n) && n >= 1 && n <= 180 ? n : null;
};
const minutesError = (raw) =>
  parseMinutes(raw) === null ? 'Whole minutes, 1–180.' : undefined;

/**
 * Local section wrapper: a system Card with the mono micro section label.
 * Danger sections get the red hairline and a red label.
 */
const SettingsSection = ({ label, danger = false, children, className = '' }) => (
  <Card className={[danger ? 'border-danger-line' : '', 'p-5 md:p-6', className].join(' ')}>
    <div
      className={`mb-4 text-label-sm ${danger ? 'text-danger' : 'text-secondary'}`}
    >
      {label}
    </div>
    {children}
  </Card>
);

const SettingsMode = () => {
  const { user, profile, refreshProfile } = useAuth();

  // Timer Preferences (raw strings; see parseMinutes above)
  const [focusDuration, setFocusDuration] = useState('25');
  const [shortBreakDuration, setShortBreakDuration] = useState('5');
  const [longBreakDuration, setLongBreakDuration] = useState('15');

  // Sound Settings
  const [tickTockSound, setTickTockSound] = useState(false);
  const [alarmVolume, setAlarmVolume] = useState(50);

  // Account Management State
  const [isSubscribing, setIsSubscribing] = useState(false);
  const [subscriptionStatus, setSubscriptionStatus] = useState(null);
  const [subscriptionData, setSubscriptionData] = useState(null);
  const [subscriptionLoading, setSubscriptionLoading] = useState(false);
  const [isSyncing, setIsSyncing] = useState(false);
  const [isOpeningPortal, setIsOpeningPortal] = useState(false);

  // Destructive-action confirmation
  const [showResetModal, setShowResetModal] = useState(false);

  // Cards-due reminders
  const [remindersEnabled, setRemindersEnabled] = useState(() => getReminderPreference());

  // SaveButton lifecycle for the timer-durations save action
  const [timerSaveState, setTimerSaveState] = useState('idle');
  const timerSaveTimeoutRef = useRef(null);
  useEffect(() => () => clearTimeout(timerSaveTimeoutRef.current), []);

  const handleToggleReminders = async () => {
    if (remindersEnabled) {
      setReminderPreference(false);
      setRemindersEnabled(false);
      toast.success('Review reminders turned off.');
      return;
    }
    const permission = await requestNotificationPermission();
    if (permission === 'unsupported') {
      toast.error('This browser does not support notifications.');
      return;
    }
    if (permission !== 'granted') {
      toast.error('Notifications are blocked for this site. Allow them in your browser settings first.');
      return;
    }
    setReminderPreference(true);
    setRemindersEnabled(true);
    toast.success("You'll get one reminder a day when cards are due.");
  };

  // Fetch subscription status
  useEffect(() => {
    const fetchSubscriptionStatus = async () => {
      if (!user?.id) return;

      try {
        const response = await fetch(`${config.api.baseUrl}/get-subscription-details`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', ...(await getAuthHeader()) },
          body: JSON.stringify({}),
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
          headers: { 'Content-Type': 'application/json', ...(await getAuthHeader()) },
          body: JSON.stringify({}),
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

      if (savedFocus) setFocusDuration(savedFocus);
      if (savedShortBreak) setShortBreakDuration(savedShortBreak);
      if (savedLongBreak) setLongBreakDuration(savedLongBreak);
      if (savedTickTock) setTickTockSound(savedTickTock === 'true');
      if (savedVolume) setAlarmVolume(parseInt(savedVolume, 10));
    } catch (error) {
      console.error('Error loading settings:', error);
    }
  }, []);

  // Per-field validation, live: the error line appears as soon as a value
  // goes out of range and clears itself the moment it is fixed.
  const timerErrors = {
    focus: minutesError(focusDuration),
    shortBreak: minutesError(shortBreakDuration),
    longBreak: minutesError(longBreakDuration),
  };
  const timersInvalid = Boolean(
    timerErrors.focus || timerErrors.shortBreak || timerErrors.longBreak
  );

  // Save timer durations to localStorage (only reachable with valid values -
  // the SaveButton disables while any field carries an error).
  const saveTimerSettings = () => {
    localStorage.setItem('timer_focusDuration', String(parseMinutes(focusDuration)));
    localStorage.setItem('timer_shortBreakDuration', String(parseMinutes(shortBreakDuration)));
    localStorage.setItem('timer_longBreakDuration', String(parseMinutes(longBreakDuration)));
    toast.success('Timer settings saved!');
  };

  // Drives the SaveButton state machine around the existing save handler.
  const handleSaveTimerSettings = () => {
    if (timersInvalid) return;
    setTimerSaveState('saving');
    saveTimerSettings();
    setTimerSaveState('saved');
    clearTimeout(timerSaveTimeoutRef.current);
    timerSaveTimeoutRef.current = setTimeout(() => setTimerSaveState('idle'), 1500);
  };

  // Save sound settings. Takes explicit values: the Switch handler passes
  // the NEXT state, so we never persist a stale closure read.
  const persistSoundSettings = (sound, volume) => {
    localStorage.setItem('timer_tickTockSound', sound.toString());
    localStorage.setItem('timer_alarmVolume', volume.toString());
    toast.success('Sound settings saved!');
  };

  // Reset all data - the modal requires typing DELETE first
  const handleResetData = () => {
    localStorage.clear();
    toast.success('All data has been reset.');
    setTimeout(() => window.location.reload(), 1000);
  };

  // Account Management Functions
  const handleSubscribe = async () => {
    capture('checkout_started');
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
        headers: { 'Content-Type': 'application/json', ...(await getAuthHeader()) },
        body: JSON.stringify({}),
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

    setIsOpeningPortal(true);
    try {
      const response = await fetch(`${config.api.baseUrl}/create-portal-session`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...(await getAuthHeader()) },
        body: JSON.stringify({}),
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
    } finally {
      setIsOpeningPortal(false);
    }
  };

  // Sync subscription status from Stripe
  const handleSyncSubscription = async () => {
    if (!user?.id) return;

    setIsSyncing(true);
    try {
      const response = await fetch(`${config.api.baseUrl}/api/user/sync-subscription`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...(await getAuthHeader()) },
        body: JSON.stringify({}),
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
    <div className="min-h-full w-full overflow-y-auto bg-canvas p-6 md:p-10">
      <div className="mx-auto w-full max-w-2xl">
        <Breadcrumb trail={['MindFlow', 'Settings']} className="mb-8" />

        <h1 className="text-display-sm text-primary">Settings</h1>
        <p className="mt-1 mb-8 text-body-sm text-secondary">
          Manage your preferences and subscription
        </p>

        <Stagger className="flex flex-col gap-4">
          {/* Timer durations */}
          <Stagger.Item>
            <SettingsSection label="Timer durations">
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
                <Field label="Focus (min)" error={timerErrors.focus}>
                  <Input
                    type="number"
                    min={1}
                    max={180}
                    value={focusDuration}
                    onChange={(e) => setFocusDuration(e.target.value)}
                  />
                </Field>
                <Field label="Short break (min)" error={timerErrors.shortBreak}>
                  <Input
                    type="number"
                    min={1}
                    max={180}
                    value={shortBreakDuration}
                    onChange={(e) => setShortBreakDuration(e.target.value)}
                  />
                </Field>
                <Field label="Long break (min)" error={timerErrors.longBreak}>
                  <Input
                    type="number"
                    min={1}
                    max={180}
                    value={longBreakDuration}
                    onChange={(e) => setLongBreakDuration(e.target.value)}
                  />
                </Field>
              </div>
              <div className="mt-5 flex justify-end">
                <SaveButton
                  state={timerSaveState}
                  variant="secondary"
                  size="sm"
                  onClick={handleSaveTimerSettings}
                  disabled={timersInvalid || timerSaveState === 'saving'}
                >
                  Save timers
                </SaveButton>
              </div>
            </SettingsSection>
          </Stagger.Item>

          {/* Sound */}
          <Stagger.Item>
            <SettingsSection label="Sound">
              <div className="flex items-center justify-between gap-4">
                <div>
                  <div className="text-body font-medium text-primary">Tick tock sound</div>
                  <p className="mt-0.5 text-body-sm text-secondary">
                    Play ticking sound during focus
                  </p>
                </div>
                <Switch
                  checked={tickTockSound}
                  onChange={(next) => {
                    setTickTockSound(next);
                    persistSoundSettings(next, alarmVolume);
                  }}
                  label="Tick tock sound"
                />
              </div>

              <div className="mt-6 border-t border-line pt-5">
                <div className="mb-2 flex items-center justify-between">
                  <label
                    htmlFor="settings-alarm-volume"
                    className="text-label-sm text-secondary"
                  >
                    Alarm volume
                  </label>
                  <span className="text-body-sm tabular-nums text-secondary">
                    {alarmVolume}%
                  </span>
                </div>
                {/* Focus ring comes from the global :focus-visible rule -
                    no per-component ring. onBlur covers keyboard users, who
                    adjust with arrows and never fire mouseup/touchend. */}
                <input
                  id="settings-alarm-volume"
                  type="range"
                  min="0"
                  max="100"
                  value={alarmVolume}
                  onChange={(e) => {
                    setAlarmVolume(parseInt(e.target.value));
                  }}
                  onMouseUp={() => persistSoundSettings(tickTockSound, alarmVolume)}
                  onTouchEnd={() => persistSoundSettings(tickTockSound, alarmVolume)}
                  onBlur={() => {
                    // Keyboard path only - skip if mouseup already persisted.
                    if (localStorage.getItem('timer_alarmVolume') !== String(alarmVolume)) {
                      persistSoundSettings(tickTockSound, alarmVolume);
                    }
                  }}
                  className="w-full cursor-pointer"
                  style={{ accentColor: 'var(--accent)' }}
                  aria-label="Alarm volume"
                />
                <p className="mt-3 text-body-sm text-secondary">
                  Adjust volume for session completion alarms and ticking sounds.
                </p>
              </div>
            </SettingsSection>
          </Stagger.Item>

          {/* Notifications */}
          <Stagger.Item>
            <SettingsSection label="Notifications">
              <div className="flex items-center justify-between gap-4">
                <div>
                  <div className="text-body font-medium text-primary">Daily review reminder</div>
                  <p className="mt-0.5 text-body-sm text-secondary">
                    One browser notification a day when flashcards are due — never more.
                  </p>
                </div>
                <Switch
                  checked={remindersEnabled}
                  onChange={handleToggleReminders}
                  label="Daily review reminder"
                />
              </div>
            </SettingsSection>
          </Stagger.Item>

          {/* Billing */}
          <Stagger.Item>
            <SettingsSection label="Billing">
              {profile?.is_pro && subscriptionLoading ? (
                /* Skeleton mirrors the Pro layout line for line (title+badge,
                   description, billing date, two h-8 buttons) so nothing
                   jumps when the real content lands. Static by rule. */
                <div
                  className="flex flex-col gap-5 md:flex-row md:items-start md:justify-between"
                  aria-busy="true"
                >
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2.5">
                      <Skeleton className="h-6 w-36" />
                      <Skeleton className="h-5 w-12" />
                    </div>
                    <Skeleton className="mt-2.5 h-4 w-64 max-w-full" />
                    <Skeleton className="mt-4 h-4 w-44" />
                  </div>
                  <div className="flex w-full shrink-0 flex-col gap-2 md:w-48">
                    <Skeleton className="h-8 w-full" />
                    <Skeleton className="h-8 w-full" />
                  </div>
                </div>
              ) : actuallyHasPro ? (
                <div className="flex flex-col gap-5 md:flex-row md:items-start md:justify-between">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2.5">
                      <h3 className="text-title text-primary">Pro plan active</h3>
                      <Badge variant="accent">PRO</Badge>
                    </div>
                    <p className="mt-1.5 text-body-sm text-secondary">
                      You have full access to all AI features and unlimited study tools.
                    </p>
                    {subscriptionData?.current_period_end && (
                      <p className="mt-3 flex items-center gap-1.5 text-label-sm text-secondary">
                        <Clock size={12} strokeWidth={1.5} aria-hidden="true" />
                        Next billing:{' '}
                        {new Date(subscriptionData.current_period_end * 1000).toLocaleDateString()}
                      </p>
                    )}
                  </div>

                  <div className="flex w-full shrink-0 flex-col gap-2 md:w-auto">
                    {/* Loading button per spec: width held by the invisible
                        idle content, label swaps to the in-progress verb,
                        aria-busy set, no spinner and nothing rotates. */}
                    <Button
                      variant="secondary"
                      size="sm"
                      className="relative"
                      onClick={handleOpenBillingPortal}
                      disabled={isOpeningPortal}
                      aria-busy={isOpeningPortal || undefined}
                    >
                      <span
                        className={`inline-flex items-center gap-2 ${isOpeningPortal ? 'invisible' : ''}`}
                        aria-hidden={isOpeningPortal || undefined}
                      >
                        <ExternalLink size={15} strokeWidth={1.5} aria-hidden="true" />
                        Manage subscription
                      </span>
                      {isOpeningPortal && (
                        <span className="absolute inset-0 flex items-center justify-center">
                          Opening portal...
                        </span>
                      )}
                    </Button>
                    {/* Loading button per spec: width held by the invisible
                        idle content, label swaps to the in-progress verb,
                        aria-busy set, no spinner and nothing rotates. */}
                    <Button
                      variant="ghost"
                      size="sm"
                      className="relative"
                      onClick={handleSyncSubscription}
                      disabled={isSyncing}
                      aria-busy={isSyncing || undefined}
                    >
                      <span
                        className={`inline-flex items-center gap-2 ${isSyncing ? 'invisible' : ''}`}
                        aria-hidden={isSyncing || undefined}
                      >
                        <RefreshCw size={15} strokeWidth={1.5} aria-hidden="true" />
                        Refresh status
                      </span>
                      {isSyncing && (
                        <span className="absolute inset-0 flex items-center justify-center">
                          Syncing...
                        </span>
                      )}
                    </Button>
                  </div>
                </div>
              ) : (
                <div className="flex flex-col gap-5 md:flex-row md:items-center md:justify-between">
                  <div className="min-w-0">
                    <h3 className="text-title text-primary">Upgrade to Pro</h3>
                    <p className="mt-1.5 max-w-lg text-body-sm text-secondary">
                      Unlock unlimited AI flashcards, Feynman analysis, and smart study tools.
                    </p>
                  </div>
                  {/* Loading button per spec: the invisible idle content holds
                      the width, the label swaps to the in-progress verb,
                      aria-busy set, no spinner glyph. */}
                  <Button
                    variant="primary"
                    mono
                    className="relative shrink-0 whitespace-nowrap"
                    onClick={handleSubscribe}
                    disabled={isSubscribing}
                    aria-busy={isSubscribing || undefined}
                  >
                    <span
                      className={`inline-flex items-center gap-2 ${isSubscribing ? 'invisible' : ''}`}
                      aria-hidden={isSubscribing || undefined}
                    >
                      <Crown size={15} strokeWidth={1.5} aria-hidden="true" />
                      Upgrade for $8.99/mo
                    </span>
                    {isSubscribing && (
                      <span className="absolute inset-0 flex items-center justify-center">
                        Starting checkout...
                      </span>
                    )}
                  </Button>
                </div>
              )}
            </SettingsSection>
          </Stagger.Item>

          {/* Danger zone */}
          <Stagger.Item>
            <SettingsSection label="Danger zone" danger className="mt-4">
              <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
                <div>
                  <div className="text-body font-medium text-primary">Reset all data</div>
                  <p className="mt-0.5 text-body-sm text-secondary">
                    Permanently delete all session history, local settings, and progress.
                  </p>
                </div>
                <Button
                  variant="danger"
                  size="sm"
                  className="shrink-0"
                  onClick={() => setShowResetModal(true)}
                >
                  <Trash2 size={15} strokeWidth={1.5} aria-hidden="true" />
                  Reset data
                </Button>
              </div>
            </SettingsSection>
          </Stagger.Item>
        </Stagger>
      </div>

      <ConfirmModal
        isOpen={showResetModal}
        onClose={() => setShowResetModal(false)}
        onConfirm={handleResetData}
        title="Reset All Data?"
        message="This permanently deletes all session history, local settings, and progress on this device. This cannot be undone."
        confirmText="Reset Everything"
        typeToConfirm="DELETE"
      />
    </div>
  );
};

export default SettingsMode;
