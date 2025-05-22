import { Accelerometer, Gyroscope } from 'expo-sensors';
import React, { useEffect, useState } from 'react';
import { StyleSheet, Text, View, Alert, Dimensions, TouchableOpacity } from 'react-native';
import { supabase } from '../../services/supabase';
import { useAuth } from '../../context/AuthContext';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Image } from 'expo-image';
import { ThemedView } from '@/components/ThemedView';
import { ThemedText } from '@/components/ThemedText';
import ParallaxScrollView from '@/components/ParallaxScrollView';
import { IconSymbol } from '@/components/ui/IconSymbol';

type SensorSample = { x: number; y: number; z: number };
type ActivityDurations = { [key: string]: number };

const API_URL = 'http://192.168.1.239:5000/predict';
const WINDOW_SIZE = 100; // 1 second at 100Hz
const OVERLAP = 0.5; // 50% overlap
const ACTIVITY_STORAGE_KEY = 'motiontracker_activity_durations';
const GOALS_UPDATE_KEY = 'motiontracker_last_goals_update';

export default function MotionScreen() {
  const [accel, setAccel] = useState<SensorSample>({ x: 0, y: 0, z: 0 });
  const [gyro, setGyro] = useState<SensorSample>({ x: 0, y: 0, z: 0 });
  const [prediction, setPrediction] = useState<string>('');
  const [error, setError] = useState<string>('');
  const [activityTimes, setActivityTimes] = useState<ActivityDurations>({});
  const [blinkIndicator, setBlinkIndicator] = useState<boolean>(true);
  const bufferRef = React.useRef<{acc: SensorSample[], gyro: SensorSample[]}>({ acc: [], gyro: [] });
  const collectingRef = React.useRef<boolean>(true);
  
  // Activity tracking references
  const { user } = useAuth();
  const lastActivityRef = React.useRef<string | null>(null);
  const activityStartTimeRef = React.useRef<number>(Date.now());
  const totalDurationsRef = React.useRef<ActivityDurations>({});
  const uiUpdateIntervalRef = React.useRef<NodeJS.Timeout | null>(null);

  // Load saved activity durations from AsyncStorage
  useEffect(() => {
    const loadActivityDurations = async () => {
      try {
        // Initialize the timestamp for activity tracking
        activityStartTimeRef.current = Date.now();
        
        // Load saved durations from AsyncStorage
        const savedData = await AsyncStorage.getItem(ACTIVITY_STORAGE_KEY);
        if (savedData) {
          const durations = JSON.parse(savedData);
          totalDurationsRef.current = durations;
          setActivityTimes(durations);
          console.log('Loaded saved activity durations:', durations);
        } else {
          console.log('No saved activity durations found');
          totalDurationsRef.current = {};
        }
      } catch (error) {
        console.error('Failed to load activity times:', error);
        totalDurationsRef.current = {};
      }
    };

    loadActivityDurations();
  }, []);
  
  // Effect for real-time UI updates of activity durations
  useEffect(() => {
    // Function to update UI with current activity duration
    const updateUIWithCurrentDuration = () => {
      if (lastActivityRef.current && activityStartTimeRef.current) {
        const currentTime = Date.now();
        const currentActivity = lastActivityRef.current;
        const elapsedSeconds = Math.floor((currentTime - activityStartTimeRef.current) / 1000);
        const baseDuration = totalDurationsRef.current[currentActivity] || 0;
        
        // Create a temporary state update that includes the current elapsed time
        // This doesn't affect the actual stored durations until a formal update
        const updatedTimes = {...totalDurationsRef.current};
        updatedTimes[currentActivity] = baseDuration + elapsedSeconds;
        
        // Update the UI with the live duration
        setActivityTimes(updatedTimes);
        
        // Toggle blink state for live indicator
        setBlinkIndicator(prev => !prev);
        
        // Share the current live duration with AsyncStorage for profile screen
        const liveActivityKey = 'motiontracker_current_activity';
        AsyncStorage.setItem(liveActivityKey, JSON.stringify({
          activity: currentActivity,
          startTime: activityStartTimeRef.current,
          baseDuration: baseDuration
        }));
      }
    };
    
    // Set up interval for UI updates (every 1 second)
    uiUpdateIntervalRef.current = setInterval(updateUIWithCurrentDuration, 1000);
    
    // Call once immediately to avoid delay
    updateUIWithCurrentDuration();
    
    // Clean up interval on unmount
    return () => {
      if (uiUpdateIntervalRef.current) {
        clearInterval(uiUpdateIntervalRef.current);
        uiUpdateIntervalRef.current = null;
      }
    };
  }, []);

  useEffect(() => {
    Accelerometer.setUpdateInterval(10); // 100Hz
    Gyroscope.setUpdateInterval(10);    // 100Hz

    const accSub = Accelerometer.addListener((data) => {
      setAccel(data);
      if (collectingRef.current) bufferRef.current.acc.push(data);
    });
    const gyroSub = Gyroscope.addListener((data) => {
      setGyro(data);
      if (collectingRef.current) bufferRef.current.gyro.push(data);
    });

    // Main windowing and sending loop
    const interval = setInterval(() => {
      const accBuf = bufferRef.current.acc;
      const gyroBuf = bufferRef.current.gyro;
      // Only process if enough samples for a window
      while (accBuf.length >= WINDOW_SIZE && gyroBuf.length >= WINDOW_SIZE) {
        // Merge by index, shape: [ [accel_x, accel_y, accel_z, gyro_x, gyro_y, gyro_z], ... ]
        const window: number[][] = [];
        for (let i = 0; i < WINDOW_SIZE; i++) {
          const a = accBuf[i];
          const g = gyroBuf[i];
          window.push([
            a?.x ?? 0, a?.y ?? 0, a?.z ?? 0,
            g?.x ?? 0, g?.y ?? 0, g?.z ?? 0
          ]);
        }
        // Send to backend
        fetch(API_URL, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ window })
        })
          .then(res => res.json())
          .then(data => {
            if (data.prediction) {
              const newActivity = data.prediction;
              setPrediction(newActivity);
              
              // Log activity and its icon for debugging
              console.log(`Activity detected: "${newActivity}", using icon: ${getActivityIcon(newActivity)}`);
              
              // Start tracking new activity
              const currentTime = Date.now();
              
              // Add half a second for each prediction of any activity
              if (lastActivityRef.current === newActivity) {
                // Same activity was detected again, add 0.5 seconds bonus time
                const bonusTime = 0.5; // half a second in seconds
                const currentActivity = newActivity;
                const currentDuration = totalDurationsRef.current[currentActivity] || 0;
                
                // Update duration in our tracking ref with the bonus time and round to nearest integer
                // This prevents accumulation of floating point values that can't be stored in the database
                totalDurationsRef.current[currentActivity] = Math.round(currentDuration + bonusTime);
                
                // Update state for UI
                setActivityTimes({...totalDurationsRef.current});
                
                // Update the shared activity state for profile screen with new duration
                AsyncStorage.setItem('motiontracker_current_activity', JSON.stringify({
                  activity: currentActivity,
                  startTime: activityStartTimeRef.current,
                  baseDuration: totalDurationsRef.current[currentActivity]
                }));
                
                // Update any active goals that match this activity
                updateActiveGoals(currentActivity, bonusTime);
                
                console.log(`Added ${bonusTime}s bonus to ${currentActivity}, total now: ${totalDurationsRef.current[currentActivity]}s`);
              }
              
              // If this is the first prediction or we have a different activity
              if (lastActivityRef.current !== newActivity) {
                // If we were tracking a previous activity, update its duration
                if (lastActivityRef.current) {
                  const duration = Math.floor((currentTime - activityStartTimeRef.current) / 1000); // in seconds
                  
                  if (duration > 0) {
                    const prevActivity = lastActivityRef.current;
                    const prevDuration = totalDurationsRef.current[prevActivity] || 0;
                    
                    // Update duration in our tracking ref
                    totalDurationsRef.current[prevActivity] = prevDuration + duration;
                    
                    // Update state for UI
                    setActivityTimes({...totalDurationsRef.current});
                    
                    // Save to AsyncStorage
                    AsyncStorage.setItem(
                      ACTIVITY_STORAGE_KEY, 
                      JSON.stringify(totalDurationsRef.current)
                    );
                    
                    // Update any active goals that match this activity
                    updateActiveGoals(prevActivity, duration);
                    
                    // Note: We no longer save individual activity updates to Supabase here
                    // since we're batching all updates every 5 seconds
                    console.log(`Activity changed: Added ${duration}s to ${prevActivity}, total now: ${totalDurationsRef.current[prevActivity]}s`);
                  }
                }
                
                // Initialize the new activity if needed
                if (!totalDurationsRef.current[newActivity]) {
                  totalDurationsRef.current[newActivity] = 0;
                  setActivityTimes({...totalDurationsRef.current});
                }
              }
              
              // Reset the timer for the new activity
              activityStartTimeRef.current = currentTime;
              lastActivityRef.current = newActivity;
              
              // Update the shared activity state for profile screen
              AsyncStorage.setItem('motiontracker_current_activity', JSON.stringify({
                activity: newActivity,
                startTime: currentTime,
                baseDuration: totalDurationsRef.current[newActivity] || 0
              }));
              
              // Debug logging
              console.log(`Activity changed to: ${newActivity}, started timing at ${new Date(currentTime).toISOString()}`);
              console.log(`Current durations: ${JSON.stringify(totalDurationsRef.current)}`);
            }
            else setError(data.error || 'No prediction');
          })
          .catch(e => setError('Network error: ' + e));
        // Remove first WINDOW_SIZE * (1-OVERLAP) samples for 50% overlap
        const step = Math.floor(WINDOW_SIZE * (1 - OVERLAP));
        accBuf.splice(0, step);
        gyroBuf.splice(0, step);
      }
    }, 100); // Check every 100ms

    // Set up an interval to periodically update all activities
    // This happens every 5 seconds and batches updates for all activities
    const updateInterval = setInterval(() => {
      const currentTime = Date.now();
      
      // Handle the currently active activity first (if any)
      if (lastActivityRef.current && activityStartTimeRef.current) {
        const elapsedSeconds = Math.floor((currentTime - activityStartTimeRef.current) / 1000);
        
        if (elapsedSeconds > 0) {
          const activity = lastActivityRef.current;
          const prevDuration = totalDurationsRef.current[activity] || 0;
          
          // Update the duration in our tracking ref without resetting the activity
          // Ensure we're storing integers to avoid database type errors
          totalDurationsRef.current[activity] = Math.floor(prevDuration + elapsedSeconds);
          
          // Update any active goals that match this activity
          updateActiveGoals(activity, elapsedSeconds);
          
          // Reset the timer for the current activity
          activityStartTimeRef.current = currentTime;
        }
      }
      
      // Save all activities to AsyncStorage
      AsyncStorage.setItem(
        ACTIVITY_STORAGE_KEY,
        JSON.stringify(totalDurationsRef.current)
      );
      
      // Save all activities to Supabase if user is logged in
      if (user && user.id && Object.keys(totalDurationsRef.current).length > 0) {
        // Get the current date info for aggregation tables
        const now = new Date();
        const todayDate = now.toISOString().split('T')[0];
        const currentYear = now.getFullYear();
        const currentMonth = now.getMonth() + 1; // 1-12
        
        // Calculate week number for weekly aggregation
        const getWeekNumber = (d: Date): number => {
          const date = new Date(d.getTime());
          date.setDate(date.getDate() + 4 - (date.getDay() || 7));
          const yearStart = new Date(Date.UTC(date.getFullYear(), 0, 1));
          const weekNo = Math.ceil((((date.getTime() - yearStart.getTime()) / 86400000) + 1) / 7);
          return weekNo;
        };
        
        const currentWeekNumber = getWeekNumber(now);
        
        // Calculate week start and end dates
        const getWeekStartEnd = (d: Date): {start: string, end: string} => {
          const day = d.getDay();
          const diff = d.getDate() - day + (day === 0 ? -6 : 1); // Adjust for Sunday
          const startDate = new Date(d.setDate(diff));
          const endDate = new Date(startDate);
          endDate.setDate(startDate.getDate() + 6);
          return {
            start: startDate.toISOString().split('T')[0],
            end: endDate.toISOString().split('T')[0]
          };
        };
        
        const weekDates = getWeekStartEnd(new Date(now));
        
        // First, fetch existing records to determine what needs to be updated
        Promise.all([
          // Get daily records
          supabase
            .from('activity_daily')
            .select('activity_type, total_duration_seconds')
            .eq('user_id', user.id)
            .eq('date', todayDate),
            
          // Get weekly records
          supabase
            .from('activity_weekly')
            .select('activity_type, total_duration_seconds')
            .eq('user_id', user.id)
            .eq('year', currentYear)
            .eq('week_number', currentWeekNumber),
            
          // Get monthly records
          supabase
            .from('activity_monthly')
            .select('activity_type, total_duration_seconds')
            .eq('user_id', user.id)
            .eq('year', currentYear)
            .eq('month', currentMonth),
            
          // Get yearly records
          supabase
            .from('activity_yearly')
            .select('activity_type, total_duration_seconds')
            .eq('user_id', user.id)
            .eq('year', currentYear),
            
          // Get tracking records
          supabase
            .from('activity_tracking')
            .select('id, activity_type, duration_seconds')
            .eq('user_id', user.id)
            .gte('created_at', todayDate)
        ])
        .then(([dailyResult, weeklyResult, monthlyResult, yearlyResult, trackingResult]) => {
          // Check for errors in any queries
          if (dailyResult.error || weeklyResult.error || monthlyResult.error || yearlyResult.error || trackingResult.error) {
            console.error('Error fetching activity records:', {
              daily: dailyResult.error,
              weekly: weeklyResult.error, 
              monthly: monthlyResult.error, 
              yearly: yearlyResult.error,
              tracking: trackingResult.error
            });
            return;
          }
          
          const dailyData = dailyResult.data || [];
          const weeklyData = weeklyResult.data || [];
          const monthlyData = monthlyResult.data || [];
          const yearlyData = yearlyResult.data || [];
          const trackingData = trackingResult.data || [];
          
          console.log(`Updating all activities in Supabase directly: ${JSON.stringify(Object.keys(totalDurationsRef.current))}`);
          
          // Process each activity
          Object.entries(totalDurationsRef.current).forEach(([activity, totalDuration]) => {
            // Find existing records for this activity
            const existingDailyRecord = dailyData.find(record => record.activity_type === activity);
            const existingWeeklyRecord = weeklyData.find(record => record.activity_type === activity);
            const existingMonthlyRecord = monthlyData.find(record => record.activity_type === activity);
            const existingYearlyRecord = yearlyData.find(record => record.activity_type === activity);
            const existingTrackingRecord = trackingData.find(record => record.activity_type === activity);
            
            // Calculate durations to save (delta between current total and what's already recorded)
            const durationToSaveDaily = existingDailyRecord ? 
              totalDuration - existingDailyRecord.total_duration_seconds : totalDuration;
              
            const durationToSaveWeekly = existingWeeklyRecord ? 
              totalDuration - existingWeeklyRecord.total_duration_seconds : totalDuration;
              
            const durationToSaveMonthly = existingMonthlyRecord ? 
              totalDuration - existingMonthlyRecord.total_duration_seconds : totalDuration;
              
            const durationToSaveYearly = existingYearlyRecord ? 
              totalDuration - existingYearlyRecord.total_duration_seconds : totalDuration;
              
            const durationToSaveTracking = existingTrackingRecord ? 
              totalDuration - existingTrackingRecord.duration_seconds : totalDuration;
            
            // Convert durations to integers to avoid database type errors
            const intDurationDaily = Math.floor(durationToSaveDaily);
            const intDurationWeekly = Math.floor(durationToSaveWeekly);
            const intDurationMonthly = Math.floor(durationToSaveMonthly);
            const intDurationYearly = Math.floor(durationToSaveYearly);
            const intDurationTracking = Math.floor(durationToSaveTracking);
            
            // Only proceed if there's a positive duration difference to update
            if (intDurationDaily <= 0 && intDurationWeekly <= 0 && 
                intDurationMonthly <= 0 && intDurationYearly <= 0 && 
                intDurationTracking <= 0) {
              console.log(`No updates needed for ${activity}`);
              return;
            }
            
            // Batch the database operations as promises
            const updatePromises = [];
            
            // 1. Update activity_tracking
            if (intDurationTracking > 0) {
              if (existingTrackingRecord) {
                const updatedDuration = Math.floor(existingTrackingRecord.duration_seconds + intDurationTracking);
                updatePromises.push(
                  supabase
                    .from('activity_tracking')
                    .update({ 
                      duration_seconds: updatedDuration,
                      created_at: now.toISOString() // Update timestamp
                    })
                    .eq('id', existingTrackingRecord.id)
                    .then(({error}) => {
                      if (error) {
                        console.error(`Failed to update ${activity} tracking record:`, error);
                      } else {
                        console.log(`Updated ${activity} tracking record to ${updatedDuration}s`);
                      }
                    })
                );
              } else {
                updatePromises.push(
                  supabase
                    .from('activity_tracking')
                    .insert({
                      user_id: user.id,
                      activity_type: activity,
                      duration_seconds: intDurationTracking,
                      created_at: now.toISOString()
                    })
                    .then(({error}) => {
                      if (error) {
                        console.error(`Failed to create ${activity} tracking record:`, error);
                      } else {
                        console.log(`Created ${activity} tracking record with ${intDurationTracking}s`);
                      }
                    })
                );
              }
            }
            
            // 2. Update activity_daily
            if (intDurationDaily > 0) {
              if (existingDailyRecord) {
                const updatedDuration = Math.floor(existingDailyRecord.total_duration_seconds + intDurationDaily);
                updatePromises.push(
                  supabase
                    .from('activity_daily')
                    .update({ total_duration_seconds: updatedDuration })
                    .eq('user_id', user.id)
                    .eq('activity_type', activity)
                    .eq('date', todayDate)
                    .then(({error}) => {
                      if (error) {
                        console.error(`Failed to update ${activity} daily record:`, error);
                      } else {
                        console.log(`Updated ${activity} daily record to ${updatedDuration}s`);
                      }
                    })
                );
              } else {
                updatePromises.push(
                  supabase
                    .from('activity_daily')
                    .insert({
                      user_id: user.id,
                      activity_type: activity,
                      total_duration_seconds: intDurationDaily,
                      date: todayDate
                    })
                    .then(({error}) => {
                      if (error) {
                        console.error(`Failed to create ${activity} daily record:`, error);
                      } else {
                        console.log(`Created ${activity} daily record with ${intDurationDaily}s`);
                      }
                    })
                );
              }
            }
            
            // 3. Update activity_weekly
            if (intDurationWeekly > 0) {
              if (existingWeeklyRecord) {
                const updatedDuration = Math.floor(existingWeeklyRecord.total_duration_seconds + intDurationWeekly);
                updatePromises.push(
                  supabase
                    .from('activity_weekly')
                    .update({ total_duration_seconds: updatedDuration })
                    .eq('user_id', user.id)
                    .eq('activity_type', activity)
                    .eq('year', currentYear)
                    .eq('week_number', currentWeekNumber)
                    .then(({error}) => {
                      if (error) {
                        console.error(`Failed to update ${activity} weekly record:`, error);
                      } else {
                        console.log(`Updated ${activity} weekly record to ${updatedDuration}s`);
                      }
                    })
                );
              } else {
                updatePromises.push(
                  supabase
                    .from('activity_weekly')
                    .insert({
                      user_id: user.id,
                      activity_type: activity,
                      total_duration_seconds: intDurationWeekly,
                      year: currentYear,
                      week_number: currentWeekNumber,
                      start_date: weekDates.start,
                      end_date: weekDates.end
                    })
                    .then(({error}) => {
                      if (error) {
                        console.error(`Failed to create ${activity} weekly record:`, error);
                      } else {
                        console.log(`Created ${activity} weekly record with ${intDurationWeekly}s`);
                      }
                    })
                );
              }
            }
            
            // 4. Update activity_monthly
            if (intDurationMonthly > 0) {
              if (existingMonthlyRecord) {
                const updatedDuration = Math.floor(existingMonthlyRecord.total_duration_seconds + intDurationMonthly);
                updatePromises.push(
                  supabase
                    .from('activity_monthly')
                    .update({ total_duration_seconds: updatedDuration })
                    .eq('user_id', user.id)
                    .eq('activity_type', activity)
                    .eq('year', currentYear)
                    .eq('month', currentMonth)
                    .then(({error}) => {
                      if (error) {
                        console.error(`Failed to update ${activity} monthly record:`, error);
                      } else {
                        console.log(`Updated ${activity} monthly record to ${updatedDuration}s`);
                      }
                    })
                );
              } else {
                updatePromises.push(
                  supabase
                    .from('activity_monthly')
                    .insert({
                      user_id: user.id,
                      activity_type: activity,
                      total_duration_seconds: intDurationMonthly,
                      year: currentYear,
                      month: currentMonth
                    })
                    .then(({error}) => {
                      if (error) {
                        console.error(`Failed to create ${activity} monthly record:`, error);
                      } else {
                        console.log(`Created ${activity} monthly record with ${intDurationMonthly}s`);
                      }
                    })
                );
              }
            }
            
            // 5. Update activity_yearly
            if (intDurationYearly > 0) {
              if (existingYearlyRecord) {
                const updatedDuration = Math.floor(existingYearlyRecord.total_duration_seconds + intDurationYearly);
                supabase
                  .from('activity_yearly')
                  .update({ total_duration_seconds: updatedDuration })
                  .eq('user_id', user.id)
                  .eq('activity_type', activity)
                  .eq('year', currentYear)
                  .then(({error}) => {
                    if (error) {
                      console.error(`Failed to update ${activity} yearly record:`, error);
                    } else {
                      console.log(`Updated ${activity} yearly record to ${updatedDuration}s`);
                    }
                  });
              } else {
                supabase
                  .from('activity_yearly')
                  .insert({
                    user_id: user.id,
                    activity_type: activity,
                    total_duration_seconds: intDurationYearly,
                    year: currentYear
                  })
                  .then(({error}) => {
                    if (error) {
                      console.error(`Failed to create ${activity} yearly record:`, error);
                    } else {
                      console.log(`Created ${activity} yearly record with ${intDurationYearly}s`);
                    }
                  });
              }
            }
            
            // Execute all update promises
            Promise.all(updatePromises).then(() => {
              console.log(`Completed all database updates for ${activity}`);
            }).catch(error => {
              console.error(`Error during batch updates for ${activity}:`, error);
            });
          });
        })
        .catch(error => {
          console.error('Error querying databases:', error);
        });
      }
    }, 5000); // Persist all data every 5 seconds

    return () => {
      // Save current activity and all accumulated data before unmounting
      const currentTime = Date.now();
      
      // First update the current activity if there is one
      if (lastActivityRef.current) {
        const duration = Math.floor((currentTime - activityStartTimeRef.current) / 1000);
        
        if (duration > 0) {
          const activity = lastActivityRef.current;
          const prevDuration = totalDurationsRef.current[activity] || 0;
          totalDurationsRef.current[activity] = prevDuration + duration;
        }
      }
      
      // Save all activities to AsyncStorage
      AsyncStorage.setItem(
        ACTIVITY_STORAGE_KEY,
        JSON.stringify(totalDurationsRef.current)
      );
      
      // Clear the current activity data since we're unmounting
      AsyncStorage.removeItem('motiontracker_current_activity');
      
      // Save all activities to Supabase if user is logged in
      if (user && user.id && Object.keys(totalDurationsRef.current).length > 0) {
        console.log(`Saving final activity data before unmount: ${JSON.stringify(totalDurationsRef.current)}`);
        
        // Get the current date info for aggregation tables
        const now = new Date();
        const todayDate = now.toISOString().split('T')[0];
        const currentYear = now.getFullYear();
        const currentMonth = now.getMonth() + 1; // 1-12
        
        // Calculate week number for weekly aggregation
        const getWeekNumber = (d: Date): number => {
          const date = new Date(d.getTime());
          date.setHours(0, 0, 0, 0);
          date.setDate(date.getDate() + 4 - (date.getDay() || 7));
          const yearStart = new Date(Date.UTC(date.getFullYear(), 0, 1));
          const weekNo = Math.ceil((((date.getTime() - yearStart.getTime()) / 86400000) + 1) / 7);
          return weekNo;
        };
        
        const currentWeekNumber = getWeekNumber(now);
        
        // Calculate week start and end dates
        const getWeekStartEnd = (d: Date): {start: string, end: string} => {
          const day = d.getDay();
          const diff = d.getDate() - day + (day === 0 ? -6 : 1); // Adjust for Sunday
          const startDate = new Date(d.setDate(diff));
          const endDate = new Date(startDate);
          endDate.setDate(startDate.getDate() + 6);
          return {
            start: startDate.toISOString().split('T')[0],
            end: endDate.toISOString().split('T')[0]
          };
        };
        
        const weekDates = getWeekStartEnd(new Date(now));
        
        // First, fetch existing records to determine what needs to be updated
        Promise.all([
          // Get daily records
          supabase
            .from('activity_daily')
            .select('activity_type, total_duration_seconds')
            .eq('user_id', user.id)
            .eq('date', todayDate),
            
          // Get weekly records
          supabase
            .from('activity_weekly')
            .select('activity_type, total_duration_seconds')
            .eq('user_id', user.id)
            .eq('year', currentYear)
            .eq('week_number', currentWeekNumber),
            
          // Get monthly records
          supabase
            .from('activity_monthly')
            .select('activity_type, total_duration_seconds')
            .eq('user_id', user.id)
            .eq('year', currentYear)
            .eq('month', currentMonth),
            
          // Get yearly records
          supabase
            .from('activity_yearly')
            .select('activity_type, total_duration_seconds')
            .eq('user_id', user.id)
            .eq('year', currentYear),
            
          // Get tracking records
          supabase
            .from('activity_tracking')
            .select('id, activity_type, duration_seconds')
            .eq('user_id', user.id)
            .gte('created_at', todayDate)
        ])
        .then(([dailyResult, weeklyResult, monthlyResult, yearlyResult, trackingResult]) => {
          // Check for errors in any queries
          if (dailyResult.error || weeklyResult.error || monthlyResult.error || yearlyResult.error || trackingResult.error) {
            console.error('Error fetching activity records during unmount:', {
              daily: dailyResult.error,
              weekly: weeklyResult.error, 
              monthly: monthlyResult.error, 
              yearly: yearlyResult.error,
              tracking: trackingResult.error
            });
            return;
          }
          
          const dailyData = dailyResult.data || [];
          const weeklyData = weeklyResult.data || [];
          const monthlyData = monthlyResult.data || [];
          const yearlyData = yearlyResult.data || [];
          const trackingData = trackingResult.data || [];
          
          console.log(`Updating all tables before unmount: ${JSON.stringify(Object.keys(totalDurationsRef.current))}`);
          
          // Process each activity
          Object.entries(totalDurationsRef.current).forEach(([activity, totalDuration]) => {
            // Find existing records for this activity
            const existingDailyRecord = dailyData.find(record => record.activity_type === activity);
            const existingWeeklyRecord = weeklyData.find(record => record.activity_type === activity);
            const existingMonthlyRecord = monthlyData.find(record => record.activity_type === activity);
            const existingYearlyRecord = yearlyData.find(record => record.activity_type === activity);
            const existingTrackingRecord = trackingData.find(record => record.activity_type === activity);
            
            // Convert duration to integer to avoid database type errors
            const intDuration = Math.floor(totalDuration);
            
            // Final update for activity_tracking
            if (existingTrackingRecord) {
              // Record exists, update it
              supabase
                .from('activity_tracking')
                .update({ 
                  duration_seconds: intDuration,
                  created_at: now.toISOString() // Update timestamp
                })
                .eq('id', existingTrackingRecord.id)
                .then(({ error }) => {
                  if (error) {
                    console.error(`Failed to update final ${activity} tracking record:`, error);
                  } else {
                    console.log(`Updated final ${activity} tracking record to ${intDuration}s`);
                  }
                });
            } else {
              // No record exists, create new one
              supabase
                .from('activity_tracking')
                .insert({
                  user_id: user.id,
                  activity_type: activity,
                  duration_seconds: intDuration,
                  created_at: now.toISOString()
                })
                .then(({ error }) => {
                  if (error) {
                    console.error(`Failed to create final ${activity} tracking record:`, error);
                  } else {
                    console.log(`Created final ${activity} tracking record with ${intDuration}s`);
                  }
                });
            }
            
            // Final update for activity_daily
            if (existingDailyRecord) {
              supabase
                .from('activity_daily')
                .update({ total_duration_seconds: intDuration })
                .eq('user_id', user.id)
                .eq('activity_type', activity)
                .eq('date', todayDate)
                .then(({ error }) => {
                  if (error) {
                    console.error(`Failed to update final ${activity} daily record:`, error);
                  } else {
                    console.log(`Updated final ${activity} daily record to ${intDuration}s`);
                  }
                });
            } else {
              supabase
                .from('activity_daily')
                .insert({
                  user_id: user.id,
                  activity_type: activity,
                  total_duration_seconds: intDuration,
                  date: todayDate
                })
                .then(({ error }) => {
                  if (error) {
                    console.error(`Failed to create final ${activity} daily record:`, error);
                  } else {
                    console.log(`Created final ${activity} daily record with ${intDuration}s`);
                  }
                });
            }
            
            // Final update for activity_weekly
            if (existingWeeklyRecord) {
              supabase
                .from('activity_weekly')
                .update({ total_duration_seconds: intDuration })
                .eq('user_id', user.id)
                .eq('activity_type', activity)
                .eq('year', currentYear)
                .eq('week_number', currentWeekNumber)
                .then(({ error }) => {
                  if (error) {
                    console.error(`Failed to update final ${activity} weekly record:`, error);
                  } else {
                    console.log(`Updated final ${activity} weekly record to ${intDuration}s`);
                  }
                });
            } else {
              supabase
                .from('activity_weekly')
                .insert({
                  user_id: user.id,
                  activity_type: activity,
                  total_duration_seconds: intDuration,
                  year: currentYear,
                  week_number: currentWeekNumber,
                  start_date: weekDates.start,
                  end_date: weekDates.end
                })
                .then(({ error }) => {
                  if (error) {
                    console.error(`Failed to create final ${activity} weekly record:`, error);
                  } else {
                    console.log(`Created final ${activity} weekly record with ${intDuration}s`);
                  }
                });
            }
            
            // Final update for activity_monthly
            if (existingMonthlyRecord) {
              supabase
                .from('activity_monthly')
                .update({ total_duration_seconds: intDuration })
                .eq('user_id', user.id)
                .eq('activity_type', activity)
                .eq('year', currentYear)
                .eq('month', currentMonth)
                .then(({ error }) => {
                  if (error) {
                    console.error(`Failed to update final ${activity} monthly record:`, error);
                  } else {
                    console.log(`Updated final ${activity} monthly record to ${intDuration}s`);
                  }
                });
            } else {
              supabase
                .from('activity_monthly')
                .insert({
                  user_id: user.id,
                  activity_type: activity,
                  total_duration_seconds: intDuration,
                  year: currentYear,
                  month: currentMonth
                })
                .then(({ error }) => {
                  if (error) {
                    console.error(`Failed to create final ${activity} monthly record:`, error);
                  } else {
                    console.log(`Created final ${activity} monthly record with ${intDuration}s`);
                  }
                });
            }
            
            // Final update for activity_yearly
            if (existingYearlyRecord) {
              supabase
                .from('activity_yearly')
                .update({ total_duration_seconds: intDuration })
                .eq('user_id', user.id)
                .eq('activity_type', activity)
                .eq('year', currentYear)
                .then(({ error }) => {
                  if (error) {
                    console.error(`Failed to update final ${activity} yearly record:`, error);
                  } else {
                    console.log(`Updated final ${activity} yearly record to ${intDuration}s`);
                  }
                });
            } else {
              supabase
                .from('activity_yearly')
                .insert({
                  user_id: user.id,
                  activity_type: activity,
                  total_duration_seconds: intDuration,
                  year: currentYear
                })
                .then(({ error }) => {
                  if (error) {
                    console.error(`Failed to create final ${activity} yearly record:`, error);
                  } else {
                    console.log(`Created final ${activity} yearly record with ${intDuration}s`);
                  }
                });
            }
          });
        })
        .catch(error => {
          console.error('Error during final database updates:', error);
        });
      }
      
      accSub.remove();
      gyroSub.remove();
      clearInterval(interval);
      clearInterval(updateInterval);
      // The UI update interval is handled in its own effect, but we'll clear it here as a safety measure
      if (uiUpdateIntervalRef.current) {
        clearInterval(uiUpdateIntervalRef.current);
        uiUpdateIntervalRef.current = null;
      }
    };
  }, []);

  // Activity icon mapping
  const getActivityIcon = (activity: string): string => {
    // Normalize activity name to handle case sensitivity
    const normalizedActivity = activity ? activity.trim() : '';
    
    const mapping: Record<string, string> = {
      'walk': 'figure.walk',
      'run': 'figure.run',
      'stationary': 'figure.stand',
      'jumping': 'figure.jumping',
      'cycling': 'bicycle',
      'driving': 'car.fill',
      'stairs': 'stairs',
      // Add additional activities as they're detected
    };
    
    // Try to find a matching icon with case-insensitive comparison
    const key = Object.keys(mapping).find(
      k => k.toLowerCase() === normalizedActivity.toLowerCase()
    );
    
    if (!key && normalizedActivity) {
      // Log missing activity types to help update the mapping
      console.log(`No icon mapping found for activity: "${normalizedActivity}"`);
    }
    
    return key ? mapping[key] : 'figure.wave';
  };
  
  // Calculate total activity time
  const totalActivityTime = Object.values(activityTimes).reduce((sum, seconds) => sum + seconds, 0);
  
  // Reset all activity durations
  const resetActivities = async () => {
    // Confirm before resetting
    Alert.alert(
      "Reset Activities",
      "Are you sure you want to reset all activity durations? This action cannot be undone.",
      [
        { text: "Cancel", style: "cancel" },
        { 
          text: "Reset", 
          style: "destructive",
          onPress: async () => {
            // Reset the durations in memory
            totalDurationsRef.current = {};
            setActivityTimes({});
            
            // Reset AsyncStorage
            try {
              await AsyncStorage.removeItem(ACTIVITY_STORAGE_KEY);
              await AsyncStorage.removeItem('motiontracker_current_activity');
              console.log("All activity durations reset successfully");
            } catch (error) {
              console.error("Error resetting activity durations:", error);
            }
            
            // Reset database if user is logged in
            if (user && user.id) {
              // We don't need to delete records as they'll be updated with new values
              // in the next sync cycle. Just log that we're resetting.
              console.log("Database records will be updated in next sync cycle");
            }
          }
        }
      ]
    );
  };
  
  // Get activity percentage for progress bar
  const getActivityPercentage = (seconds: number): string => {
    if (!totalActivityTime) return '0%';
    return `${Math.min(100, (seconds / totalActivityTime) * 100)}%`;
  };
  
  // Helper function to convert percentage to style object
  const getProgressBarStyle = (seconds: number) => {
    // For React Native we need a percentage string like '50%'
    if (!totalActivityTime) return { width: '0%' };
    const percentage = Math.min(100, (seconds / totalActivityTime) * 100);
    return { width: `${percentage}%` };
  };
  
  // Known activity types and their corresponding goal types
const ACTIVITY_TO_GOAL_MAP = {
  'Walk': 'Walk',
  'Run': 'Run',
  'Cycling': 'Cycling',
  'Stairs': 'Stairs',
  'Jumping': 'Jumping',
  'Dancing': 'Dancing',
  'Still': null, // 'Still' activity doesn't contribute to any goals
};

// Function to update active goals based on detected activity
const updateActiveGoals = async (activity: string, durationSeconds: number) => {
  if (!user || !activity || durationSeconds <= 0) return;
  
  try {
    // Skip "Still" activity as it doesn't contribute to goals
    if (activity === 'Still') return;
    
    console.log(`Checking for goals that match activity: ${activity} with duration ${durationSeconds}s`);
    
    // Get the current date info for different goal types
    const now = new Date();
    const todayDate = now.toISOString().split('T')[0];
    
    // Check if we've updated goals recently (to avoid excessive database calls)
    const lastUpdateString = await AsyncStorage.getItem(GOALS_UPDATE_KEY);
    const lastUpdate = lastUpdateString ? parseInt(lastUpdateString) : 0;
    const timeSinceLastUpdate = Date.now() - lastUpdate;
    
    // Only update goals at most once every minute
    if (timeSinceLastUpdate < 60000) {
      console.log('Skipping goal update - updated less than a minute ago');
      return;
    }
    
    // Fetch active goals from Supabase
    const { data: activeGoals, error } = await supabase
      .from('user_activity_goals')
      .select('*')
      .eq('user_id', user.id)
      .eq('status', 'active');
      
    if (error) {
      console.error('Error fetching active goals:', error);
      return;
    }
    
    if (!activeGoals || activeGoals.length === 0) {
      console.log('No active goals found for the user');
      return;
    }
    
    console.log(`Found ${activeGoals.length} active goals for user`);
    
    // Convert seconds to milliseconds for goal comparison
    const durationMs = durationSeconds * 1000;
    const goalUpdates = [];
    
    // Check each active goal to see if it matches the current activity
    for (const goal of activeGoals) {
      let matchesActivity = false;
      
      // Check if this activity contributes to this goal
      if (goal.activity_type === activity) {
        matchesActivity = true;
      }
      // Special case for combined "Run & Walk" goals
      else if (goal.activity_type === 'Run & Walk' && (activity === 'Run' || activity === 'Walk')) {
        matchesActivity = true;
      }
      
      if (!matchesActivity) continue;
      
      // If we found a matching goal, update its progress
      console.log(`Updating goal "${goal.title}" (${goal.goal_type}) with ${durationMs}ms of activity`);
      
      // Calculate the new duration
      const newDuration = goal.current_duration_ms + durationMs;
      const isCompleted = newDuration >= goal.target_duration_ms;
      
      // Add to the update queue
      goalUpdates.push(
        supabase
          .from('user_activity_goals')
          .update({
            current_duration_ms: newDuration,
            is_completed: isCompleted,
            status: isCompleted ? 'completed' : 'active',
            completion_date: isCompleted ? todayDate : null
          })
          .eq('id', goal.id)
      );
    }
    
    // Execute all updates in parallel
    if (goalUpdates.length > 0) {
      console.log(`Executing ${goalUpdates.length} goal updates`);
      await Promise.all(goalUpdates);
      console.log('Goal updates completed successfully');
      
      // Show a notification if any goals were updated
      // We would add this in a production app to notify users about goal progress
    }
    
    // Update the last update timestamp
    await AsyncStorage.setItem(GOALS_UPDATE_KEY, Date.now().toString());
    
  } catch (error) {
    console.error('Error updating active goals:', error);
  }
};
  
  return (
    <ParallaxScrollView
      headerBackgroundColor={{ light: '#A1CEDC', dark: '#1D3D47' }}
      headerImage={
        <Image
          source={require('@/assets/images/partial-react-logo.png')}
          style={styles.headerImage}
        />
      }>
      <ThemedView style={styles.container}>
        <ThemedText type="title" style={styles.header}>Motion Tracking</ThemedText>
        
        {/* Current prediction card */}
        <ThemedView style={styles.predictionCard}>
          <ThemedView style={styles.predictionHeader}>
            <ThemedText type="subtitle">Current Activity</ThemedText>
            <View style={[styles.statusIndicator, { opacity: blinkIndicator ? 1 : 0.3 }]} />
          </ThemedView>
          
          <ThemedView style={styles.predictionContent}>
            <View style={styles.iconContainer}>
              <IconSymbol 
                name={getActivityIcon(prediction)} 
                size={60} 
                color="#2E86C1" 
              />
            </View>
            <ThemedText style={styles.predictionText}>
              {prediction ? prediction : 'Waiting for prediction...'}
            </ThemedText>
          </ThemedView>
          
          {error ? <ThemedText style={styles.errorText}>{error}</ThemedText> : null}
        </ThemedView>
        
        {/* Activity durations card */}
        <ThemedView style={styles.card}>
          <ThemedView style={styles.durationHeader}>
            <ThemedText type="subtitle">Activity Duration</ThemedText>
            {Object.keys(activityTimes).length > 0 && (
              <TouchableOpacity 
                style={styles.resetButton}
                onPress={resetActivities}
              >
                <ThemedText style={styles.resetButtonText}>Reset</ThemedText>
              </TouchableOpacity>
            )}
          </ThemedView>
          
          {Object.keys(activityTimes).length > 0 ? (
            <>
              <ThemedView style={styles.totalTimeContainer}>
                <ThemedText style={styles.label}>Total Time</ThemedText>
                <ThemedText style={styles.totalTime}>
                  {Math.floor(totalActivityTime / 3600) > 0 && `${Math.floor(totalActivityTime / 3600)}h `}
                  {Math.floor((totalActivityTime % 3600) / 60)}m {Math.floor(totalActivityTime % 60)}s
                </ThemedText>
              </ThemedView>
              
              {Object.entries(activityTimes).map(([activity, seconds]) => {
                const isCurrentActivity = activity === lastActivityRef.current;
                return (
                  <ThemedView key={activity} style={styles.activityItem}>
                    <ThemedView style={styles.activityHeader}>
                      <ThemedView style={styles.activityTitleRow}>
                        <IconSymbol 
                          name={getActivityIcon(activity)} 
                          size={20} 
                          color={isCurrentActivity ? "#2E86C1" : "#666"} 
                        />
                        <ThemedText 
                          style={[styles.activityName, isCurrentActivity && styles.activeText]}
                        >
                          {activity}
                          {isCurrentActivity && ' (active)'}
                        </ThemedText>
                      </ThemedView>
                      <ThemedText style={styles.durationText}>
                        {Math.floor(seconds / 3600) > 0 && `${Math.floor(seconds / 3600)}h `}
                        {Math.floor((seconds % 3600) / 60)}m {Math.floor(seconds % 60)}s
                      </ThemedText>
                    </ThemedView>
                    
                    <ThemedView style={styles.progressBarContainer}>
                      <View 
                        style={[
                          styles.progressBar,
                          getProgressBarStyle(seconds),
                          isCurrentActivity && styles.activeProgressBar
                        ]}
                      />
                    </ThemedView>
                  </ThemedView>
                );
              })}
            </>
          ) : (
            <ThemedText style={styles.emptyText}>No activities tracked yet</ThemedText>
          )}
        </ThemedView>
        
        {/* Sensor data card */}
        <ThemedView style={styles.card}>
          <ThemedText type="subtitle">Sensor Data</ThemedText>
          
          <ThemedView style={styles.sensorContainer}>
            <ThemedView style={styles.sensorColumn}>
              <ThemedText style={styles.sensorTitle}>Accelerometer</ThemedText>
              <ThemedView style={styles.sensorValues}>
                <ThemedText style={styles.sensorText}>x: {accel.x.toFixed(3)}</ThemedText>
                <ThemedText style={styles.sensorText}>y: {accel.y.toFixed(3)}</ThemedText>
                <ThemedText style={styles.sensorText}>z: {accel.z.toFixed(3)}</ThemedText>
              </ThemedView>
            </ThemedView>
            
            <ThemedView style={styles.sensorColumn}>
              <ThemedText style={styles.sensorTitle}>Gyroscope</ThemedText>
              <ThemedView style={styles.sensorValues}>
                <ThemedText style={styles.sensorText}>x: {gyro.x.toFixed(3)}</ThemedText>
                <ThemedText style={styles.sensorText}>y: {gyro.y.toFixed(3)}</ThemedText>
                <ThemedText style={styles.sensorText}>z: {gyro.z.toFixed(3)}</ThemedText>
              </ThemedView>
            </ThemedView>
          </ThemedView>
        </ThemedView>
        
        <ThemedText style={styles.footnote}>
          Motion data is automatically synced to your profile
        </ThemedText>
      </ThemedView>
    </ParallaxScrollView>
  );
}

const { width } = Dimensions.get('window');

const styles = StyleSheet.create({
  container: { 
    padding: 16,
    paddingBottom: 32,
  },
  headerImage: {
    height: 120,
    width: 180,
    bottom: -30,
    right: -20,
    position: 'absolute',
    opacity: 0.6,
  },
  header: { 
    marginBottom: 16,
    textAlign: 'center',
  },
  card: {
    backgroundColor: '#f8f9fa',
    borderRadius: 16,
    padding: 16,
    marginBottom: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  predictionCard: {
    backgroundColor: '#f8f9fa',
    borderRadius: 16,
    padding: 16,
    marginBottom: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  predictionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  predictionContent: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 24,
  },
  iconContainer: {
    padding: 16,
    borderRadius: 50,
    backgroundColor: 'rgba(46, 134, 193, 0.1)',
    marginBottom: 12,
  },
  predictionText: {
    fontSize: 28,
    fontWeight: '600',
    color: '#2E86C1',
    marginTop: 12,
  },
  statusIndicator: {
    width: 12,
    height: 12,
    borderRadius: 6,
    backgroundColor: '#27AE60',
  },
  errorText: {
    color: '#E74C3C',
    textAlign: 'center',
    marginTop: 8,
  },
  totalTimeContainer: {
    alignItems: 'center',
    marginVertical: 16,
    padding: 12,
    backgroundColor: 'rgba(46, 134, 193, 0.1)',
    borderRadius: 8,
  },
  label: {
    fontSize: 14,
    color: '#666',
    marginBottom: 4,
  },
  totalTime: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#2E86C1',
  },
  activityItem: {
    marginBottom: 16,
  },
  activityHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  activityTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  activityName: {
    fontSize: 16,
    marginLeft: 8,
  },
  durationText: {
    fontSize: 15,
    fontWeight: '500',
    color: '#2E86C1',
  },
  progressBarContainer: {
    height: 6,
    backgroundColor: '#E0E0E0',
    borderRadius: 3,
    overflow: 'hidden',
  },
  progressBar: {
    height: '100%',
    backgroundColor: '#7FB3D5',
  },
  activeProgressBar: {
    backgroundColor: '#2E86C1',
  },
  emptyText: {
    textAlign: 'center',
    padding: 20,
    color: '#999',
    fontStyle: 'italic',
  },
  sensorContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 12,
  },
  sensorColumn: {
    width: '48%',
  },
  sensorTitle: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 8,
    color: '#666',
  },
  sensorValues: {
    backgroundColor: 'rgba(46, 134, 193, 0.05)',
    borderRadius: 8,
    padding: 12,
  },
  sensorText: {
    fontFamily: 'monospace',
    fontSize: 14,
    marginVertical: 2,
  },
  footnote: {
    textAlign: 'center',
    color: '#999',
    fontSize: 13,
    marginTop: 4,
  },
  activeText: { 
    fontWeight: '600',
    color: '#2E86C1'
  },
  durationHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 10,
  },
  resetButton: {
    backgroundColor: '#E74C3C',
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: 6,
  },
  resetButtonText: {
    color: 'white',
    fontWeight: 'bold',
    fontSize: 12,
  },
});
