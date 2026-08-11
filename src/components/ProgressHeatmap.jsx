import React, { useState, useEffect, useMemo } from 'react';
import { ActivityCalendar } from 'react-activity-calendar';
import { supabase } from '../lib/supabaseClient';
import { useAuth } from '../context/AuthContext';

/**
 * react-activity-calendar needs concrete color strings, so the 5-step scale
 * is resolved from the design tokens at runtime: level 0 is the computed
 * --border-line value (an empty cell reads as a faint outline-tone block on
 * the card surface), levels 1-4 are the computed --accent at 28% / 52% /
 * 76% / 100% alpha. No color literals live in this file; if the tokens
 * cannot be read or parsed (e.g. jsdom), it falls back to color-mix()
 * expressions over var(--accent) so nothing ever renders unthemed.
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
    const borderSoft = readToken('--border-line');

    const empty = borderSoft || 'color-mix(in srgb, var(--text-primary) 7%, transparent)';
    const steps = [0.28, 0.52, 0.76, 1];
    const accentSteps = accentRgb
      ? steps.map((a) => `rgba(${accentRgb.r}, ${accentRgb.g}, ${accentRgb.b}, ${a})`)
      : steps.map((a) => `color-mix(in srgb, var(--accent) ${Math.round(a * 100)}%, transparent)`);

    return [empty, ...accentSteps];
  }, []);

const ProgressHeatmap = () => {
  const { user } = useAuth();
  const [activityData, setActivityData] = useState([]);
  const [loading, setLoading] = useState(true);
  const scale = useHeatmapScale();

  useEffect(() => {
    const fetchActivityData = async () => {
      if (!user?.id) {
        setLoading(false);
        return;
      }

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
          setActivityData([]);
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
        setActivityData([]);
      } finally {
        setLoading(false);
      }
    };

    fetchActivityData();
  }, [user?.id]);

  if (loading) {
    return (
      <div className="flex items-center justify-center p-3 text-center text-body-sm text-secondary">
        Loading activity...
      </div>
    );
  }

  if (!activityData || activityData.length === 0) {
    return (
      <div className="flex items-center justify-center p-3 text-center text-body-sm text-secondary">
        No activity data yet. Start a timer to see your progress!
      </div>
    );
  }

  const theme = {
    light: scale,
    dark: scale,
  };

  return (
    <div
      className="mt-2 w-full overflow-x-auto rounded-sm border border-line p-3 font-mono"
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
      />
    </div>
  );
};

export default ProgressHeatmap;
