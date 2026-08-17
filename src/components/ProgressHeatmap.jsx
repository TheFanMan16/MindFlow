import React, { useState, useEffect, useMemo, useCallback, cloneElement } from 'react';
import { ActivityCalendar } from 'react-activity-calendar';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../lib/supabaseClient';
import { useAuth } from '../context/AuthContext';
import { Button, EmptyState, Skeleton } from './ui';

/**
 * The year-of-focus heatmap (Profile page).
 *
 * react-activity-calendar needs concrete color strings, so the 5-step scale
 * is resolved from the design tokens at runtime: level 0 is the computed
 * --bg-inset value (an empty cell reads as a well, matching the Dashboard
 * activity grid's levelFill), levels 1-4 are the computed --accent at 28% /
 * 52% / 76% / 100% alpha. No color literals live in this file; if the tokens
 * cannot be read or parsed (e.g. jsdom), it falls back to var()/color-mix()
 * expressions over the same tokens so nothing ever renders unthemed.
 *
 * States:
 * - loading: static skeleton matched to the calendar's real geometry
 *   (10px month-label band, 7 rows of 10px blocks with 3px margins, 8px
 *   gaps, 10px footer line) so the card does not jump when data lands.
 * - error: one sentence + Retry, instead of the old silent fall-through
 *   to "no data".
 * - empty (zero minutes all year): EmptyState with the one action that
 *   fills it - starting a focus session.
 * - default: every cell carries a title with its date and minute count,
 *   so intensity is never encoded in color alone.
 * Static SVG otherwise: no hover/focus/pressed states apply to the
 * non-interactive cells, and nothing loops.
 */
const readToken = (name) => {
  if (typeof window === 'undefined' || typeof document === 'undefined') return '';
  return getComputedStyle(document.documentElement).getPropertyValue(name).trim();
};

const parseToRgb = (value) => {
  if (!value) return null;
  const hex = value.match(/^#([0-9a-f]{3}|[0-9a-f]{6})$/i);
  if (hex) {
    let h = hex[1];
    if (h.length === 3) h = h.split('').map((c) => c + c).join('');
    const n = parseInt(h, 16);
    return { r: (n >> 16) & 255, g: (n >> 8) & 255, b: n & 255 };
  }
  const rgb = value.match(/^rgba?\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)/i);
  if (rgb) {
    return { r: Number(rgb[1]), g: Number(rgb[2]), b: Number(rgb[3]) };
  }
  return null;
};

const useHeatmapScale = () =>
  useMemo(() => {
    const accentRgb = parseToRgb(readToken('--accent'));
    const insetFill = readToken('--bg-inset');

    const empty = insetFill || 'var(--bg-inset)';
    const steps = [0.28, 0.52, 0.76, 1];
    const accentSteps = accentRgb
      ? steps.map((a) => `rgba(${accentRgb.r}, ${accentRgb.g}, ${accentRgb.b}, ${a})`)
      : steps.map((a) => `color-mix(in srgb, var(--accent) ${Math.round(a * 100)}%, transparent)`);

    return [empty, ...accentSteps];
  }, []);

/**
 * Loading placeholder matched to the rendered calendar: same wrapper, same
 * weekday-label gutter (pl-9 ~ the ~34px "Wed" column), a 10px month-label
 * band, seven 10px rows at 3px gaps spanning the 53-week grid width
 * (53 * 13 - 3 = 686px), then the 10px count/legend footer after the same
 * 8px gap the library uses. Static by rule - no pulse.
 */
const HeatmapSkeleton = () => (
  <div
    aria-busy="true"
    className="mt-2 w-full overflow-x-auto rounded-sm border border-line p-3"
  >
    <div className="w-max pl-9">
      <Skeleton className="h-2.5 w-24" />
      <div className="mt-2 flex flex-col gap-[3px]">
        {Array.from({ length: 7 }).map((_, i) => (
          <Skeleton key={i} className="h-2.5 w-[686px]" />
        ))}
      </div>
      <div className="mt-2 flex items-center justify-between">
        <Skeleton className="h-2.5 w-36" />
        <Skeleton className="h-2.5 w-28" />
      </div>
    </div>
  </div>
);

/** Per-cell title: the absolute date plus the count, so the color scale is
    an accelerator, never the only carrier of the value. */
const cellTitle = (activity) => {
  const date = new Date(`${activity.date}T00:00:00`).toLocaleDateString('en-GB', {
    weekday: 'short',
    day: 'numeric',
    month: 'short',
  });
  if (activity.count === 0) return `${date} - no focus time`;
  return `${date} - ${activity.count} min focused`;
};

const ProgressHeatmap = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [activityData, setActivityData] = useState([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(false);
  const scale = useHeatmapScale();

  const fetchActivityData = useCallback(async () => {
    if (!user?.id) {
      setLoading(false);
      return;
    }

    setLoading(true);
    setLoadError(false);

    try {
      // Fetch last 365 days of activity
      const oneYearAgo = new Date();
      oneYearAgo.setFullYear(oneYearAgo.getFullYear() - 1);
      const startDate = oneYearAgo.toISOString().split('T')[0];

      const { data, error } = await supabase
        .from('daily_activity')
        .select('date, minutes_focused')
        .eq('user_id', user.id)
        .gte('date', startDate)
        .order('date', { ascending: true });

      if (error) {
        console.error('Error fetching daily activity:', error);
        setLoadError(true);
        setLoading(false);
        return;
      }

      // Create a map of dates to minutes
      const activityMap = new Map();
      if (data) {
        data.forEach((row) => {
          activityMap.set(row.date, row.minutes_focused || 0);
        });
      }

      // Generate data for the last 365 days
      const today = new Date();
      const calendarData = [];

      for (let i = 364; i >= 0; i--) {
        const date = new Date(today);
        date.setDate(date.getDate() - i);
        const dateString = date.toISOString().split('T')[0];
        const minutes = activityMap.get(dateString) || 0;

        // Calculate level based on minutes (0-4 scale)
        // Level 0: 0 minutes
        // Level 1: 1-15 minutes
        // Level 2: 16-30 minutes
        // Level 3: 31-60 minutes
        // Level 4: 60+ minutes
        let level = 0;
        if (minutes > 0 && minutes <= 15) level = 1;
        else if (minutes > 15 && minutes <= 30) level = 2;
        else if (minutes > 30 && minutes <= 60) level = 3;
        else if (minutes > 60) level = 4;

        calendarData.push({
          date: dateString,
          count: minutes,
          level: level,
        });
      }

      setActivityData(calendarData);
    } catch (error) {
      console.error('Error in fetchActivityData:', error);
      setLoadError(true);
    } finally {
      setLoading(false);
    }
  }, [user?.id]);

  useEffect(() => {
    fetchActivityData();
  }, [fetchActivityData]);

  if (loading) {
    return <HeatmapSkeleton />;
  }

  if (loadError) {
    return (
      <div role="alert" className="mt-2 rounded-sm border border-line p-4">
        <p className="text-body-sm text-secondary">
          Your focus activity could not be loaded.
        </p>
        <div className="mt-3">
          <Button variant="secondary" size="sm" onClick={fetchActivityData}>
            Retry
          </Button>
        </div>
      </div>
    );
  }

  // A year of zero-minute days is empty in every way that matters; the
  // signed-out case lands here too (no rows generated at all).
  const totalMinutes = activityData.reduce((sum, day) => sum + day.count, 0);
  if (activityData.length === 0 || totalMinutes === 0) {
    return (
      <EmptyState
        className="mt-2"
        title="No focus time recorded yet"
        description="This heatmap fills in as you complete focus sessions."
        action={
          <Button variant="secondary" size="sm" onClick={() => navigate('/focus')}>
            Start a focus session
          </Button>
        }
      />
    );
  }

  const theme = {
    light: scale,
    dark: scale,
  };

  return (
    <div
      className="mt-2 w-full overflow-x-auto rounded-sm border border-line p-3"
      style={{ color: 'var(--text-secondary)' }}
    >
      <ActivityCalendar
        data={activityData}
        theme={theme}
        colorScheme="dark"
        labels={{
          months: ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'],
          weekdays: ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'],
          totalCount: '{{count}} minutes in {{year}}',
          legend: {
            less: 'Less',
            more: 'More',
          },
        }}
        blockSize={10}
        blockRadius={2}
        blockMargin={3}
        fontSize={10}
        hideTotalCount={false}
        showWeekdayLabels={true}
        weekStart={0} // Sunday
        // Native SVG <title> per cell: the exact date and minutes for every
        // block, keyboard- and screen-reader-reachable meaning that never
        // rides on color alone.
        renderBlock={(block, activity) =>
          cloneElement(block, {}, <title>{cellTitle(activity)}</title>)
        }
      />
    </div>
  );
};

export default ProgressHeatmap;
