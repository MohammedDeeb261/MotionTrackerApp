# Motion Tracker App

A mobile application that uses device sensors to detect and classify motion activities.

## Features

### Live Motion Detection
- Detects various physical activities in real-time (Walking, Running, Stationary)
- Uses accelerometer and gyroscope data for accurate motion detection
- 100Hz sampling rate for high-precision motion data
- 50% overlapping windows for continuous analysis
- Real-time display of current activity with confidence score

### Activity Duration Tracking
- Tracks time spent in each activity
- Accumulates durations across sessions
- Displays real-time activity counters
- Visualizes activity durations on screen
- Periodic saving to prevent data loss

### History and Insights
- Stores activity data in Supabase database
- View historical activity summary
- Track activity trends over time
- Analyzes activity patterns

### Data Storage and Privacy
- Secure user authentication
- Row-level security for user data
- Local and cloud data synchronization
- Automatic data recovery

## Technical Implementation

### Motion Detection
- 100Hz sensor data collection (accelerometer + gyroscope)
- 1-second windows (100 samples per window) 
- 50% overlapping windows (50 samples overlap)
- Real-time prediction approximately every 0.5 seconds
- Optimized UI updates to prevent performance issues

### Supabase Integration
- User authentication
- Activity data storage
- Activity summary views
- Data security with row-level security

## Setup and Installation

### Prerequisites
- Node.js and npm
- Expo CLI
- Supabase account

### Installation
1. Clone the repository
2. Install dependencies: `npm install`
3. Set up Supabase tables using the `supabase_setup.sql` file
4. Configure Supabase API keys
5. Start the app: `npm start`

See [SUPABASE_DOCS.md](./SUPABASE_DOCS.md) for detailed Supabase setup instructions.
