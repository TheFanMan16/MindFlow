-- Create daily_activity table for GitHub-style contribution heatmap
CREATE TABLE IF NOT EXISTS daily_activity (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  date DATE NOT NULL,
  minutes_focused INTEGER DEFAULT 0,
  sets_completed INTEGER DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(user_id, date) -- Ensure one row per user per day
);

-- Create index for faster queries
CREATE INDEX IF NOT EXISTS idx_daily_activity_user_date ON daily_activity(user_id, date);

-- Enable RLS
ALTER TABLE daily_activity ENABLE ROW LEVEL SECURITY;

-- RLS Policy: Users can only read their own rows
CREATE POLICY "Users can view their own daily activity"
  ON daily_activity
  FOR SELECT
  USING (auth.uid() = user_id);

-- RLS Policy: Users can insert their own rows
CREATE POLICY "Users can insert their own daily activity"
  ON daily_activity
  FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- RLS Policy: Users can update their own rows
CREATE POLICY "Users can update their own daily activity"
  ON daily_activity
  FOR UPDATE
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- Function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_daily_activity_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger to automatically update updated_at
CREATE TRIGGER update_daily_activity_updated_at
  BEFORE UPDATE ON daily_activity
  FOR EACH ROW
  EXECUTE FUNCTION update_daily_activity_updated_at();

