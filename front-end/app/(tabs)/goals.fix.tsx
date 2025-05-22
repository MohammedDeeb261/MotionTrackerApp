// This is the fixed version of the updateGoalsProgress function

// Function to update goals progress
const updateGoalsProgress = async () => {
  if (!user || goals.length === 0) return;
  
  try {
    // Get today's date in YYYY-MM-DD format
    const today = new Date().toISOString().split('T')[0];
    
    // 1. Handle daily goals - fetch today's activity data
    const dailyGoals = goals.filter(g => g.goal_type === 'daily' && g.status === 'active');
    if (dailyGoals.length > 0) {
      const { data: todayData, error: todayError } = await supabase
        .from('activity_daily')
        .select('activity_type, duration_seconds')
        .eq('user_id', user.id)
        .eq('date', today);
        
      if (todayError) {
        console.error('Error fetching daily activity data:', todayError);
      } else if (todayData) {
        // Update each daily goal with the corresponding activity data
        for (const goal of dailyGoals) {
          // Check if this is a combined "Run & Walk" goal
          let currentDuration = 0;
          
          if (goal.activity_type === 'Run & Walk') {
            // For combined goals, sum both Walk and Run activities
            const walkData = todayData.find(d => d.activity_type === 'Walk');
            const runData = todayData.find(d => d.activity_type === 'Run');
            
            const walkDuration = walkData ? walkData.duration_seconds * 1000 : 0;
            const runDuration = runData ? runData.duration_seconds * 1000 : 0;
            
            currentDuration = walkDuration + runDuration;
          } else {
            // For single activity goals
            const activityData = todayData.find(d => d.activity_type === goal.activity_type);
            if (activityData) {
              currentDuration = activityData.duration_seconds * 1000; // Convert to ms
            }
          }
          
          // Update the goal in the database if progress has changed
          if (currentDuration !== goal.current_duration_ms) {
            const isCompleted = currentDuration >= goal.target_duration_ms;
            
            await supabase
              .from('user_activity_goals')
              .update({ 
                current_duration_ms: currentDuration,
                is_completed: isCompleted,
                status: isCompleted ? 'completed' : 'active',
                completion_date: isCompleted ? today : null
              })
              .eq('id', goal.id);
          }
        }
      }
    }
    
    // 2. Handle weekly goals
    const weeklyGoals = goals.filter(g => g.goal_type === 'weekly' && g.status === 'active');
    if (weeklyGoals.length > 0) {
      // Get the current week number and year
      const now = new Date();
      const startOfYear = new Date(now.getFullYear(), 0, 1);
      const pastDaysOfYear = (now.getTime() - startOfYear.getTime()) / 86400000;
      const currentWeekNumber = Math.ceil((pastDaysOfYear + startOfYear.getDay() + 1) / 7);
      
      const { data: weekData, error: weekError } = await supabase
        .from('activity_weekly')
        .select('activity_type, duration_seconds')
        .eq('user_id', user.id)
        .eq('year', now.getFullYear())
        .eq('week_number', currentWeekNumber);
        
      if (weekError) {
        console.error('Error fetching weekly activity data:', weekError);
      } else if (weekData) {
        // Update each weekly goal
        for (const goal of weeklyGoals) {
          let currentDuration = 0;
          
          // Check if this is a combined "Run & Walk" goal
          if (goal.activity_type === 'Run & Walk') {
            // For combined goals, sum both Walk and Run activities
            const walkData = weekData.find(d => d.activity_type === 'Walk');
            const runData = weekData.find(d => d.activity_type === 'Run');
            
            const walkDuration = walkData ? walkData.duration_seconds * 1000 : 0;
            const runDuration = runData ? runData.duration_seconds * 1000 : 0;
            
            currentDuration = walkDuration + runDuration;
          } else {
            // For single activity goals
            const activityData = weekData.find(d => d.activity_type === goal.activity_type);
            if (activityData) {
              currentDuration = activityData.duration_seconds * 1000; // Convert to ms
            }
          }
          
          // Update the goal in the database if progress has changed
          if (currentDuration !== goal.current_duration_ms) {
            const isCompleted = currentDuration >= goal.target_duration_ms;
            
            await supabase
              .from('user_activity_goals')
              .update({ 
                current_duration_ms: currentDuration,
                is_completed: isCompleted,
                status: isCompleted ? 'completed' : 'active',
                completion_date: isCompleted ? today : null
              })
              .eq('id', goal.id);
          }
        }
      }
    }
    
    // 3. Handle regular goals (cumulative)
    const regularGoals = goals.filter(g => g.goal_type === 'regular' && g.status === 'active');
    if (regularGoals.length > 0) {
      // For each regular goal, calculate the total activity duration since start_date
      for (const goal of regularGoals) {
        const startDate = new Date(goal.start_date).toISOString().split('T')[0];
        
        let totalDurationMs = 0;
        
        // Handle combined "Run & Walk" goals differently
        if (goal.activity_type === 'Run & Walk') {
          // Query the raw activity data for both Walk and Run
          const { data: walkData, error: walkError } = await supabase
            .from('user_activity_durations')
            .select('duration_ms')
            .eq('user_id', user.id)
            .eq('activity_type', 'Walk')
            .gte('start_time', startDate);
            
          const { data: runData, error: runError } = await supabase
            .from('user_activity_durations')
            .select('duration_ms')
            .eq('user_id', user.id)
            .eq('activity_type', 'Run')
            .gte('start_time', startDate);
            
          if (walkError) {
            console.error('Error fetching Walk activity duration data:', walkError);
          }
          if (runError) {
            console.error('Error fetching Run activity duration data:', runError);
          }
          
          // Sum up durations from both activity types
          const walkDurationMs = walkData ? walkData.reduce((sum, record) => sum + record.duration_ms, 0) : 0;
          const runDurationMs = runData ? runData.reduce((sum, record) => sum + record.duration_ms, 0) : 0;
          
          totalDurationMs = walkDurationMs + runDurationMs;
        } else {
          // For single activity type goals
          const { data: activityData, error: activityError } = await supabase
            .from('user_activity_durations')
            .select('duration_ms')
            .eq('user_id', user.id)
            .eq('activity_type', goal.activity_type)
            .gte('start_time', startDate);
            
          if (activityError) {
            console.error('Error fetching activity duration data:', activityError);
          } else if (activityData) {
            // Calculate total duration
            totalDurationMs = activityData.reduce((sum, record) => sum + record.duration_ms, 0);
          }
        }
        
        // Update the goal if progress has changed
        if (totalDurationMs !== goal.current_duration_ms) {
          const isCompleted = totalDurationMs >= goal.target_duration_ms;
          
          await supabase
            .from('user_activity_goals')
            .update({ 
              current_duration_ms: totalDurationMs,
              is_completed: isCompleted,
              status: isCompleted ? 'completed' : 'active',
              completion_date: isCompleted ? today : null
            })
            .eq('id', goal.id);
        }
      }
    }
    
    // Reload goals after updates
    loadGoals();
    
  } catch (error) {
    console.error('Error updating goals progress:', error);
  }
};
