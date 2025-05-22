#!/bin/bash
# filepath: /home/mohammed/MotionTracker/MotionTrackerApp/back-end/setup-activity-tables.sh

# Check if SUPABASE_URL and SUPABASE_SERVICE_KEY are set
if [ -z "$SUPABASE_URL" ] || [ -z "$SUPABASE_SERVICE_KEY" ]; then
  echo "Error: Missing Supabase credentials."
  echo "Please set SUPABASE_URL and SUPABASE_SERVICE_KEY environment variables."
  exit 1
fi

# Check if psql is installed
if ! command -v psql &> /dev/null; then
  echo "Error: psql command not found. Please install PostgreSQL client."
  exit 1
fi

# Extract database URL from Supabase URL
# This is a simplified approach and might need adjustment based on your setup
DB_URL="${SUPABASE_URL/https:\/\/}/rest/v1"

echo "Setting up activity tracking tables..."

# Execute the SQL file
psql "$DB_URL" -f create_activity_tables.sql

echo "Setup complete!"
