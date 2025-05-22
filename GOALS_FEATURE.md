# Activity Goals Implementation

This document explains the implementation details of the Activity Goals feature in the Motion Tracker application.

## Overview

The Activity Goals feature allows users to create, track, and manage activity goals based on duration metrics. There are three types of goals supported:

1. **Daily Goals**: Track activity durations for a single day, resetting at midnight
2. **Weekly Goals**: Track cumulative activity durations over a week, resetting weekly
3. **Regular Goals**: Track progress continuously until the goal is completed, regardless of timeframe

## Database Schema

Goals are stored in the `user_activity_goals` table with the following structure:

```sql
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
```

## Goal Types

### Daily Goals

- Track activity durations for the current day
- Progress is calculated against activity data in the `activity_daily` table
- Automatically reset at the end of the day (midnight)
- Goal status is set to 'expired' if not completed by day end

### Weekly Goals

- Track activity durations for the current week
- Progress is calculated against activity data in the `activity_weekly` table
- Automatically reset at the end of the week
- Goal status is set to 'expired' if not completed by week end

### Regular Goals

- Track activity durations continuously until completion
- No automatic expiration
- Progress is calculated against activity data since the goal's start date
- Status changes to 'completed' once the target duration is reached

## Progress Tracking

Goals are automatically updated based on the activity data recorded in the Motion Tracking tab. The update process:

1. Runs every 60 seconds in the background when the Goals tab is active
2. Recalculates for each goal type based on the corresponding activity data table
3. Updates the goal's current_duration_ms, is_completed, and status fields
4. Updates the completion_date when a goal is achieved

## User Interface

The Goals tab interface includes:

- List of active goals with progress indicators
- List of completed goals with completion dates
- Modal form for creating new goals with:
  - Title input
  - Activity type selection (Walk, Run, Stationary)
  - Goal type selection (Daily, Weekly, Regular)
  - Target duration input in HH:MM:SS format
  - Start date selection for Regular goals

## Progress Visualization

Goal progress is visualized with:

- Percentage display
- Color-coded progress bars (red < 30%, yellow < 70%, green >= 70%)
- Current/target duration display in hours, minutes, and seconds

## Future Enhancements

Potential future improvements for the Goals feature:

1. Goal notifications and reminders
2. Recurring goals (e.g., weekly targets that reset automatically)
3. Historical goal analytics and trends
4. Social sharing of goal achievements
5. Goal categories and templates
