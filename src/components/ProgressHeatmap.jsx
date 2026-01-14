import React, { useState, useEffect } from 'react';
import { ActivityCalendar } from 'react-activity-calendar';
import { supabase } from '../lib/supabaseClient';
import { useAuth } from '../context/AuthContext';

const ProgressHeatmap = () => {
  const { user } = useAuth();
  const [activityData, setActivityData] = useState([]);
  const [loading, setLoading] = useState(true);

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
      <div style={{
        display: 'flex',
        justifyContent: 'center',
        alignItems: 'center',
        padding: '12px',
        color: 'rgba(255, 255, 255, 0.5)',
        fontSize: '10px',
        textAlign: 'center',
      }}>
        Loading activity...
      </div>
    );
  }

  if (!activityData || activityData.length === 0) {
    return (
      <div style={{
        display: 'flex',
        justifyContent: 'center',
        alignItems: 'center',
        padding: '12px',
        color: 'rgba(255, 255, 255, 0.5)',
        fontSize: '10px',
        textAlign: 'center',
        lineHeight: '1.4',
      }}>
        No activity data yet. Start a timer to see your progress!
      </div>
    );
  }

  // Custom theme to match MindFlow dark theme
  const theme = {
    light: ['#1e293b', '#3b82f6', '#60a5fa', '#93c5fd', '#dbeafe'], // Dark to light blue
    dark: ['#1e293b', '#3b82f6', '#60a5fa', '#93c5fd', '#dbeafe'], // Same for dark mode
  };

  return (
    <div style={{
      width: '100%',
      padding: '12px',
      backgroundColor: 'rgba(0, 0, 0, 0.2)',
      borderRadius: '8px',
      marginTop: '8px',
    }}>
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

