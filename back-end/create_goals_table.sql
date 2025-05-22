-- Create a table to store user activity goals
CREATE TABLE IF NOT EXISTS user_activity_goals (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id),
  title VARCHAR(100) NOT NULL,
  activity_type VARCHAR(50) NOT NULL,
  goal_type VARCHAR(20) NOT NULL CHECK (goal_type IN ('daily', 'weekly', 'regular')),
  target_duration_ms BIGINT NOT NULL,
  current_duration_ms BIGINT DEFAULT 0 NOT NULL,
  start_date DATE NOT NULL,
  completion_date DATE,
  is_completed BOOLEAN DEFAULT FALSE NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now() NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT now() NOT NULL,
  status VARCHAR(20) DEFAULT 'active' CHECK (status IN ('active', 'completed', 'expired'))
);

-- Create indexes for the goals table
CREATE INDEX IF NOT EXISTS idx_user_goals_user_id ON user_activity_goals(user_id);
CREATE INDEX IF NOT EXISTS idx_user_goals_activity_type ON user_activity_goals(activity_type);
CREATE INDEX IF NOT EXISTS idx_user_goals_status ON user_activity_goals(status);

-- Add RLS policy for goals
ALTER TABLE user_activity_goals ENABLE ROW LEVEL SECURITY;

-- RLS Policies
CREATE POLICY "Users can view their own goals"
  ON user_activity_goals
  FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own goals"
  ON user_activity_goals
  FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own goals"
  ON user_activity_goals
  FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own goals"
  ON user_activity_goals
  FOR DELETE
  USING (auth.uid() = user_id);

-- Trigger to automatically update the updated_at field
-- Make sure the update_timestamp() function exists
CREATE OR REPLACE FUNCTION update_timestamp()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_user_activity_goals_timestamp
BEFORE UPDATE ON user_activity_goals
FOR EACH ROW
EXECUTE FUNCTION update_timestamp();

-- Add sample comment for Run & Walk tracking
COMMENT ON TABLE user_activity_goals IS 'Stores user activity goals with support for single activities (Walk, Run) and combined activities (Run & Walk)';
COMMENT ON COLUMN user_activity_goals.activity_type IS 'Type of activity: Walk, Run, Run & Walk, etc.';
