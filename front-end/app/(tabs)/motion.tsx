import { Accelerometer, Gyroscope } from 'expo-sensors';
import React, { useEffect, useState } from 'react';
import { ScrollView, StyleSheet, Text, View, Alert } from 'react-native';
import { supabase } from '../../services/supabase';
import { useAuth } from '../../context/AuthContext';
import AsyncStorage from '@react-native-async-storage/async-storage';

type SensorSample = { x: number; y: number; z: number };
type ActivityDurations = { [key: string]: number };

const API_URL = 'http://192.168.1.239:5000/predict';
const WINDOW_SIZE = 100; // 1 second at 100Hz
const OVERLAP = 0.5; // 50% overlap
const ACTIVITY_STORAGE_KEY = 'motiontracker_activity_durations';

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
              
              // Start tracking new activity
              const currentTime = Date.now();
              
              // Add half a second for each prediction of any activity
              if (lastActivityRef.current === newActivity) {
                // Same activity was detected again, add 0.5 seconds bonus time
                const bonusTime = 0.5; // half a second in seconds
                const currentActivity = newActivity;
                const currentDuration = totalDurationsRef.current[currentActivity] || 0;
                
                // Update duration in our tracking ref with the bonus time
                totalDurationsRef.current[currentActivity] = currentDuration + bonusTime;
                
                // Update state for UI
                setActivityTimes({...totalDurationsRef.current});
                
                // Update the shared activity state for profile screen with new duration
                AsyncStorage.setItem('motiontracker_current_activity', JSON.stringify({
                  activity: currentActivity,
                  startTime: activityStartTimeRef.current,
                  baseDuration: totalDurationsRef.current[currentActivity]
                }));
                
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
                    
                    // Save to Supabase if user is logged in
                    if (user && user.id) {
                      supabase
                        .from('activity_tracking')
                        .insert({
                          user_id: user.id,
                          activity_type: prevActivity,
                          duration_seconds: duration,
                          created_at: new Date().toISOString()
                        })
                        .then(({ error }) => {
                          if (error) console.error('Failed to save activity to Supabase:', error);
                        });
                    }
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

    // Set up an interval to periodically update duration for ongoing activities
    // This is for data persistence, while UI updates happen more frequently
    const updateInterval = setInterval(() => {
      if (lastActivityRef.current && activityStartTimeRef.current) {
        const currentTime = Date.now();
        const elapsedSeconds = Math.floor((currentTime - activityStartTimeRef.current) / 1000);
        
        if (elapsedSeconds >= 5) { // Only persist if at least 5 seconds have passed
          const activity = lastActivityRef.current;
          
          // Update the reference time without resetting the activity
          activityStartTimeRef.current = currentTime;
          
          // Update duration in the reference (actual storage)
          const prevDuration = totalDurationsRef.current[activity] || 0;
          totalDurationsRef.current[activity] = prevDuration + elapsedSeconds;
          
          // The UI gets updated in the separate effect every second,
          // so we don't need to update it here
          
          // Save locally
          AsyncStorage.setItem(
            ACTIVITY_STORAGE_KEY,
            JSON.stringify(totalDurationsRef.current)
          );
          
          // Save to Supabase if user is logged in
          if (user && user.id) {
            supabase
              .from('activity_tracking')
              .insert({
                user_id: user.id,
                activity_type: activity,
                duration_seconds: elapsedSeconds,
                created_at: new Date().toISOString()
              })
              .then(({ error }) => {
                if (error) console.error('Failed to save activity update to Supabase:', error);
              });
          }
          
          console.log(`Periodic update: Added ${elapsedSeconds}s to ${activity}, total now: ${totalDurationsRef.current[activity]}s`);
        }
      }
    }, 15000); // Persist data every 15 seconds (more frequently than before)

    return () => {
      // Save current activity before unmounting
      if (lastActivityRef.current) {
        const currentTime = Date.now();
        const duration = Math.floor((currentTime - activityStartTimeRef.current) / 1000);
        
        if (duration > 0) {
          const activity = lastActivityRef.current;
          const prevDuration = totalDurationsRef.current[activity] || 0;
          
          totalDurationsRef.current[activity] = prevDuration + duration;
          
          // Save to AsyncStorage
          AsyncStorage.setItem(
            ACTIVITY_STORAGE_KEY,
            JSON.stringify(totalDurationsRef.current)
          );
          
          // Clear the current activity data since we're unmounting
          AsyncStorage.removeItem('motiontracker_current_activity');
          
          // Save to Supabase if user is logged in
          if (user && user.id) {
            supabase
              .from('activity_tracking')
              .insert({
                user_id: user.id,
                activity_type: activity,
                duration_seconds: duration,
                created_at: new Date().toISOString()
              })
              .then(({ error }) => {
                if (error) console.error('Failed to save activity to Supabase:', error);
              });
          }
        }
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

  return (
    <ScrollView contentContainerStyle={styles.container}>
      <Text style={styles.header}>Live Sensor Data</Text>
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Accelerometer</Text>
        <Text style={styles.text}>{`x: ${accel.x.toFixed(4)}`}</Text>
        <Text style={styles.text}>{`y: ${accel.y.toFixed(4)}`}</Text>
        <Text style={styles.text}>{`z: ${accel.z.toFixed(4)}`}</Text>
      </View>
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Gyroscope</Text>
        <Text style={styles.text}>{`x: ${gyro.x.toFixed(4)}`}</Text>
        <Text style={styles.text}>{`y: ${gyro.y.toFixed(4)}`}</Text>
        <Text style={styles.text}>{`z: ${gyro.z.toFixed(4)}`}</Text>
      </View>
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Prediction</Text>
        <Text style={styles.text}>{prediction ? prediction : 'Waiting for prediction...'}</Text>
        {error ? <Text style={[styles.text, {color: 'red'}]}>{error}</Text> : null}
      </View>
      
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Activity Durations</Text>
        {Object.keys(activityTimes).length > 0 ? (
          Object.entries(activityTimes).map(([activity, seconds]) => {
            const isCurrentActivity = activity === lastActivityRef.current;
            return (
              <View key={activity} style={[styles.activityRow, isCurrentActivity && styles.activeActivity]}>
                <Text style={[styles.text, isCurrentActivity && styles.activeText]}>
                  {activity}: {Math.floor(seconds / 60)}m {Math.floor(seconds % 60)}s
                  {isCurrentActivity && ' (active)'}
                </Text>
                {isCurrentActivity && (
                  <Text style={[styles.liveIndicator, { opacity: blinkIndicator ? 1 : 0.3 }]}>●</Text>
                )}
              </View>
            );
          })
        ) : (
          <Text style={styles.text}>No activities tracked yet</Text>
        )}
        <Text style={[styles.text, {marginTop: 10, fontSize: 13, color: '#666'}]}>
          Full history available in profile tab
        </Text>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { padding: 16 },
  header: { fontSize: 22, fontWeight: 'bold', textAlign: 'center', marginBottom: 20 },
  section: { marginBottom: 20 },
  sectionTitle: { fontSize: 18, fontWeight: '600', marginBottom: 8, color: '#333' },
  text: { fontSize: 15, marginVertical: 2 },
  activityRow: { 
    flexDirection: 'row', 
    alignItems: 'center', 
    justifyContent: 'space-between',
    paddingVertical: 3,
    borderRadius: 4
  },
  activeActivity: { 
    backgroundColor: 'rgba(46, 134, 193, 0.1)',
    paddingHorizontal: 8
  },
  activeText: { 
    fontWeight: '600',
    color: '#2E86C1'
  },
  liveIndicator: { 
    color: '#E74C3C', 
    fontSize: 12,
    marginLeft: 5,
    opacity: 0.8
  }
});
