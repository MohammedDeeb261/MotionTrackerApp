-- 
-- This SQL script sets up the necessary tables and views for the Motion Tracker activity tracking
-- Copy this into Supabase SQL Editor and run it to set up your database
--

-- Create a table to store user activity time data
CREATE TABLE IF NOT EXISTS user_activity_durations (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id),  -- References Supabase auth user
  activity_type VARCHAR(50) NOT NULL,               -- 'Walk', 'Run', 'Stationary', etc.
  duration_ms BIGINT NOT NULL,                      -- Duration in milliseconds
  start_time TIMESTAMPTZ NOT NULL,                  -- When the activity started
  end_time TIMESTAMPTZ NOT NULL,                    -- When the activity ended
  device_info JSONB,                                -- Optional device information
  created_at TIMESTAMPTZ DEFAULT now() NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT now() NOT NULL
);

-- Create an index for faster queries by user
CREATE INDEX IF NOT EXISTS idx_user_activity_user_id ON user_activity_durations(user_id);

-- Create an index for activity type queries
CREATE INDEX IF NOT EXISTS idx_user_activity_type ON user_activity_durations(activity_type);

-- Add RLS (Row Level Security) policy so users can only see their own data
ALTER TABLE user_activity_durations ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view their own activity data" ON user_activity_durations;
CREATE POLICY "Users can view their own activity data"
  ON user_activity_durations
  FOR SELECT
  USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can insert their own activity data" ON user_activity_durations;
CREATE POLICY "Users can insert their own activity data"
  ON user_activity_durations
  FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- Function to update the updated_at timestamp
CREATE OR REPLACE FUNCTION update_timestamp()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger to automatically update the updated_at field
DROP TRIGGER IF EXISTS update_user_activity_durations_timestamp ON user_activity_durations;
CREATE TRIGGER update_user_activity_durations_timestamp
BEFORE UPDATE ON user_activity_durations
FOR EACH ROW
EXECUTE FUNCTION update_timestamp();

-- Create a view for total activity duration per user and activity type
DROP VIEW IF EXISTS user_activity_summary;
CREATE VIEW user_activity_summary AS
SELECT 
  user_id,
  activity_type,
  SUM(duration_ms) as total_duration_ms,
  COUNT(*) as activity_count,
  MIN(start_time) as first_activity,
  MAX(end_time) as latest_activity
FROM user_activity_durations
GROUP BY user_id, activity_type;

-- Create a daily activity summary view
DROP VIEW IF EXISTS daily_activity_summary;
CREATE VIEW daily_activity_summary AS
SELECT 
  user_id,
  activity_type,
  DATE_TRUNC('day', start_time) as day,
  SUM(duration_ms) as daily_duration_ms,
  COUNT(*) as daily_activity_count
FROM user_activity_durations
GROUP BY user_id, activity_type, DATE_TRUNC('day', start_time);
