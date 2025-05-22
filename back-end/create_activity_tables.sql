-- Create activity tracking tables for different time periods

-- Base table for storing raw activity entries
CREATE TABLE IF NOT EXISTS activity_tracking (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES auth.users(id) NOT NULL,
  activity_type VARCHAR(255) NOT NULL,
  duration_seconds INTEGER NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  
  -- Add an index on user_id for faster queries
  CONSTRAINT activity_tracking_user_id_index UNIQUE (id, user_id)
);

-- Daily activity aggregation
CREATE TABLE IF NOT EXISTS activity_daily (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES auth.users(id) NOT NULL,
  activity_type VARCHAR(255) NOT NULL,
  total_duration_seconds INTEGER NOT NULL,
  date DATE NOT NULL,
  
  -- Ensure we don't have duplicate daily entries for the same user/activity
  CONSTRAINT activity_daily_unique UNIQUE (user_id, activity_type, date)
);

-- Weekly activity aggregation
CREATE TABLE IF NOT EXISTS activity_weekly (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES auth.users(id) NOT NULL,
  activity_type VARCHAR(255) NOT NULL,
  total_duration_seconds INTEGER NOT NULL,
  year INTEGER NOT NULL,
  week_number INTEGER NOT NULL,
  start_date DATE NOT NULL, -- First day of week
  end_date DATE NOT NULL,   -- Last day of week
  
  -- Ensure we don't have duplicate weekly entries for the same user/activity
  CONSTRAINT activity_weekly_unique UNIQUE (user_id, activity_type, year, week_number)
);

-- Monthly activity aggregation
CREATE TABLE IF NOT EXISTS activity_monthly (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES auth.users(id) NOT NULL,
  activity_type VARCHAR(255) NOT NULL,
  total_duration_seconds INTEGER NOT NULL,
  year INTEGER NOT NULL,
  month INTEGER NOT NULL,  -- 1-12
  
  -- Ensure we don't have duplicate monthly entries for the same user/activity
  CONSTRAINT activity_monthly_unique UNIQUE (user_id, activity_type, year, month)
);

-- Yearly activity aggregation
CREATE TABLE IF NOT EXISTS activity_yearly (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES auth.users(id) NOT NULL,
  activity_type VARCHAR(255) NOT NULL,
  total_duration_seconds INTEGER NOT NULL,
  year INTEGER NOT NULL,
  
  -- Ensure we don't have duplicate yearly entries for the same user/activity
  CONSTRAINT activity_yearly_unique UNIQUE (user_id, activity_type, year)
);

-- Add row level security policies to all tables
ALTER TABLE activity_tracking ENABLE ROW LEVEL SECURITY;
ALTER TABLE activity_daily ENABLE ROW LEVEL SECURITY;
ALTER TABLE activity_weekly ENABLE ROW LEVEL SECURITY;
ALTER TABLE activity_monthly ENABLE ROW LEVEL SECURITY;
ALTER TABLE activity_yearly ENABLE ROW LEVEL SECURITY;

-- Policy: Users can insert/update/delete only their own activities
CREATE POLICY activity_tracking_policy 
  ON activity_tracking 
  FOR ALL 
  TO authenticated 
  USING (auth.uid() = user_id);

CREATE POLICY activity_daily_policy 
  ON activity_daily 
  FOR ALL 
  TO authenticated 
  USING (auth.uid() = user_id);

CREATE POLICY activity_weekly_policy 
  ON activity_weekly 
  FOR ALL 
  TO authenticated 
  USING (auth.uid() = user_id);

CREATE POLICY activity_monthly_policy 
  ON activity_monthly 
  FOR ALL 
  TO authenticated 
  USING (auth.uid() = user_id);

CREATE POLICY activity_yearly_policy 
  ON activity_yearly 
  FOR ALL 
  TO authenticated 
  USING (auth.uid() = user_id);

-- Create functions to automatically update the aggregated tables

-- Function to update daily aggregation
CREATE OR REPLACE FUNCTION update_activity_daily()
RETURNS TRIGGER AS $$
BEGIN
  -- Try to update existing record
  INSERT INTO activity_daily (user_id, activity_type, total_duration_seconds, date)
  VALUES (
    NEW.user_id,
    NEW.activity_type,
    NEW.duration_seconds,
    DATE(NEW.created_at)
  )
  ON CONFLICT (user_id, activity_type, date)
  DO UPDATE SET
    total_duration_seconds = activity_daily.total_duration_seconds + NEW.duration_seconds;
    
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Function to update weekly aggregation
CREATE OR REPLACE FUNCTION update_activity_weekly()
RETURNS TRIGGER AS $$
DECLARE
  week_start DATE;
  week_end DATE;
  week_num INTEGER;
  year_num INTEGER;
BEGIN
  -- Calculate week start and end dates
  week_start := date_trunc('week', NEW.created_at)::date;
  week_end := (week_start + interval '6 days')::date;
  
  -- Extract year and week number
  year_num := EXTRACT(YEAR FROM NEW.created_at);
  week_num := EXTRACT(WEEK FROM NEW.created_at);
  
  -- Try to update existing record
  INSERT INTO activity_weekly (
    user_id, activity_type, total_duration_seconds, 
    year, week_number, start_date, end_date
  )
  VALUES (
    NEW.user_id,
    NEW.activity_type,
    NEW.duration_seconds,
    year_num,
    week_num,
    week_start,
    week_end
  )
  ON CONFLICT (user_id, activity_type, year, week_number)
  DO UPDATE SET
    total_duration_seconds = activity_weekly.total_duration_seconds + NEW.duration_seconds;
    
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Function to update monthly aggregation
CREATE OR REPLACE FUNCTION update_activity_monthly()
RETURNS TRIGGER AS $$
DECLARE
  month_num INTEGER;
  year_num INTEGER;
BEGIN
  -- Extract year and month
  year_num := EXTRACT(YEAR FROM NEW.created_at);
  month_num := EXTRACT(MONTH FROM NEW.created_at);
  
  -- Try to update existing record
  INSERT INTO activity_monthly (
    user_id, activity_type, total_duration_seconds, 
    year, month
  )
  VALUES (
    NEW.user_id,
    NEW.activity_type,
    NEW.duration_seconds,
    year_num,
    month_num
  )
  ON CONFLICT (user_id, activity_type, year, month)
  DO UPDATE SET
    total_duration_seconds = activity_monthly.total_duration_seconds + NEW.duration_seconds;
    
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Function to update yearly aggregation
CREATE OR REPLACE FUNCTION update_activity_yearly()
RETURNS TRIGGER AS $$
DECLARE
  year_num INTEGER;
BEGIN
  -- Extract year
  year_num := EXTRACT(YEAR FROM NEW.created_at);
  
  -- Try to update existing record
  INSERT INTO activity_yearly (
    user_id, activity_type, total_duration_seconds, year
  )
  VALUES (
    NEW.user_id,
    NEW.activity_type,
    NEW.duration_seconds,
    year_num
  )
  ON CONFLICT (user_id, activity_type, year)
  DO UPDATE SET
    total_duration_seconds = activity_yearly.total_duration_seconds + NEW.duration_seconds;
    
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create triggers to automatically update aggregated tables when raw data is added
CREATE TRIGGER trigger_update_activity_daily
AFTER INSERT ON activity_tracking
FOR EACH ROW
EXECUTE FUNCTION update_activity_daily();

CREATE TRIGGER trigger_update_activity_weekly
AFTER INSERT ON activity_tracking
FOR EACH ROW
EXECUTE FUNCTION update_activity_weekly();

CREATE TRIGGER trigger_update_activity_monthly
AFTER INSERT ON activity_tracking
FOR EACH ROW
EXECUTE FUNCTION update_activity_monthly();

CREATE TRIGGER trigger_update_activity_yearly
AFTER INSERT ON activity_tracking
FOR EACH ROW
EXECUTE FUNCTION update_activity_yearly();

-- Create indexes for faster queries
CREATE INDEX idx_activity_daily_user_date ON activity_daily(user_id, date);
CREATE INDEX idx_activity_weekly_user_year_week ON activity_weekly(user_id, year, week_number);
CREATE INDEX idx_activity_monthly_user_year_month ON activity_monthly(user_id, year, month);
CREATE INDEX idx_activity_yearly_user_year ON activity_yearly(user_id, year);
