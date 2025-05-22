# Activity Data Synchronization Strategy

## Overview

This document explains how activity data is synchronized between the client app and the Supabase backend database in the Motion Tracker application.

## Data Update Schedule

Activity data is synchronized with the database using the following strategy:

1. **Batch Updates Every 5 Seconds**:
   - All tracked activities are saved to Supabase every 5 seconds
   - Only changed/new data since the last sync is sent to avoid duplicate records
   - This ensures data is regularly backed up without overloading the database

2. **Final Update on Component Unmount**:
   - When the user leaves the motion tracking screen, a final update is sent
   - This includes the latest data for all activities
   - Ensures no data is lost when the app is closed or the user navigates away

3. **Local Storage Persistence**:
   - All activity data is regularly saved to AsyncStorage
   - This provides a local backup and enables offline functionality
   - On app restart, local data is loaded and can be synced when online

## Database Tables

Activity data is stored in a tiered database structure:

1. **Raw Activity Data**: `activity_tracking`
   - Contains individual activity session records
   - Used as the input source for the aggregated tables

2. **Time-Based Aggregation Tables**:
   - `activity_daily`: Activity totals by day
   - `activity_weekly`: Activity totals by week
   - `activity_monthly`: Activity totals by month
   - `activity_yearly`: Activity totals by year

## Automatic Data Aggregation

The system uses PostgreSQL triggers to automatically update the aggregated tables when new data is inserted into the base `activity_tracking` table. This provides efficient data querying for different time periods while maintaining detailed records.

## User Data Security

- All tables use Row Level Security (RLS) policies
- Users can only access their own activity data
- Each activity record is linked to the user through the `user_id` field

## Implementation Details

The primary logic for data synchronization can be found in:
- `/front-end/app/(tabs)/motion.tsx`: Handles data collection and periodic updates
- `/back-end/create_activity_tables.sql`: Contains database structure and trigger definitions
