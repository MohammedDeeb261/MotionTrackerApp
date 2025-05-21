# Supabase Integration for Motion Tracker

This document explains how to set up and use the Supabase integration for storing activity data in the Motion Tracker application.

## Setting Up Supabase

1. **Create a Supabase Account**
   - Go to https://supabase.com/ and sign up
   - Create a new project

2. **Database Setup**
   - Go to the SQL Editor in your Supabase dashboard
   - Copy the contents of the `supabase_setup.sql` file
   - Paste and run the SQL in the editor

3. **Enable Authentication**
   - Go to Authentication settings in your Supabase dashboard
   - Enable Email/Password sign-up
   - Configure any additional authentication providers as needed

4. **Set Up API Keys**
   - The front-end application uses the Supabase URL and anon key for connection
   - These are already configured in the application
   - If you need to update them, modify the values in `/front-end/services/supabase.ts`

## Database Schema

### Main Table: `user_activity_durations`

Stores individual activity sessions:

| Column | Type | Description |
|--------|------|-------------|
| id | UUID | Primary key (auto-generated) |
| user_id | UUID | References auth.users(id) |
| activity_type | VARCHAR(50) | Type of activity (Walk, Run, Stationary, etc.) |
| duration_ms | BIGINT | Duration in milliseconds |
| start_time | TIMESTAMPTZ | When the activity started |
| end_time | TIMESTAMPTZ | When the activity ended |
| device_info | JSONB | Optional device information |
| created_at | TIMESTAMPTZ | Record creation timestamp |
| updated_at | TIMESTAMPTZ | Record update timestamp |

### Views

1. **`user_activity_summary`**
   - Aggregates total duration and count per activity type
   - Used in the History screen to show totals

2. **`daily_activity_summary`**
   - Aggregates activity data by day
   - Can be used for daily reports and charts

## Row Level Security (RLS)

The database is configured with Row Level Security to ensure:
- Users can only view their own activity data
- Users can only insert their own activity data

## App Integration

The app integrates with Supabase in the following ways:

1. **Authentication**
   - User signup and login uses Supabase Auth

2. **Data Storage**
   - Activity durations are saved when:
     - Stopping live detection
     - Resetting the durations counter
     - (Optional) On regular intervals during detection

3. **History View**
   - The History page queries the `user_activity_summary` view
   - Shows total time spent in each activity

## Extending the Integration

To add more functionality:

1. **Activity Charts**
   - Create data visualization of activity patterns

2. **Activity Goals**
   - Allow users to set goals for each activity type
   - Track progress towards goals

3. **Social Features**
   - Create friend connections between users
   - Allow sharing of activity summaries
