# Activity Tracking Database Structure

## Overview

The Motion Tracker App uses a tiered database structure to efficiently store and query activity durations at different time intervals. This design allows for fast queries of aggregated data while maintaining detailed records of individual activity sessions.

## Database Tables

### 1. `activity_tracking` (Base Table)

This table stores raw activity data as it comes in from the app:

- `id`: UUID primary key
- `user_id`: UUID (references auth.users)
- `activity_type`: VARCHAR(255)
- `duration_seconds`: INTEGER
- `created_at`: TIMESTAMP WITH TIME ZONE

### 2. `activity_daily`

Aggregates activity duration by day:

- `id`: UUID primary key
- `user_id`: UUID (references auth.users)
- `activity_type`: VARCHAR(255)
- `total_duration_seconds`: INTEGER
- `date`: DATE

### 3. `activity_weekly`

Aggregates activity duration by week:

- `id`: UUID primary key
- `user_id`: UUID (references auth.users)
- `activity_type`: VARCHAR(255)
- `total_duration_seconds`: INTEGER
- `year`: INTEGER
- `week_number`: INTEGER
- `start_date`: DATE (first day of the week)
- `end_date`: DATE (last day of the week)

### 4. `activity_monthly`

Aggregates activity duration by month:

- `id`: UUID primary key
- `user_id`: UUID (references auth.users)
- `activity_type`: VARCHAR(255)
- `total_duration_seconds`: INTEGER
- `year`: INTEGER
- `month`: INTEGER (1-12)

### 5. `activity_yearly`

Aggregates activity duration by year:

- `id`: UUID primary key
- `user_id`: UUID (references auth.users)
- `activity_type`: VARCHAR(255)
- `total_duration_seconds`: INTEGER
- `year`: INTEGER

## Automatic Aggregation

The system uses PostgreSQL triggers and functions to automatically update the aggregated tables when new data is inserted into the base `activity_tracking` table. This means you only need to insert data into the base table, and the aggregates will be updated automatically.

## Security

All tables use Row Level Security (RLS) to ensure users can only access their own data. The security policies are applied consistently across all tables.

## Setup

To set up the database tables:

1. Ensure you have Supabase properly configured.
2. Run the setup script:

```bash
# Set environment variables
export SUPABASE_URL=your_supabase_url
export SUPABASE_SERVICE_KEY=your_service_key

# Run the setup script
node back-end/setup-activity-tables.js
```

or manually execute the SQL in the `create_activity_tables.sql` file.

## Using the Tables in the App

The front-end app is configured to:

1. Always write data to the base `activity_tracking` table.
2. Query the appropriate aggregation table based on the selected time period (daily, weekly, monthly, yearly).
3. Fall back to the base table if aggregated data is not available.
