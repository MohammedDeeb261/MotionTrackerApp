-- Create the activity tracking table for storing user activity durations
CREATE TABLE IF NOT EXISTS activity_tracking (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES auth.users(id) NOT NULL,
  activity_type VARCHAR(255) NOT NULL,
  duration_seconds INTEGER NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  
  -- Add an index on user_id for faster queries
  CONSTRAINT activity_tracking_user_id_index UNIQUE (id, user_id)
);

-- Add row level security policy
ALTER TABLE activity_tracking ENABLE ROW LEVEL SECURITY;

-- Policy: Users can insert/update/delete only their own activities
CREATE POLICY activity_tracking_user_policy 
  ON activity_tracking 
  FOR ALL 
  TO authenticated 
  USING (auth.uid() = user_id);

-- Policy: Users can read only their own activities
CREATE POLICY activity_tracking_read_policy 
  ON activity_tracking 
  FOR SELECT 
  TO authenticated 
  USING (auth.uid() = user_id);
