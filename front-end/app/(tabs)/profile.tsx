import React, { useState, useEffect } from 'react';
import { StyleSheet, TouchableOpacity, Alert, View, ActivityIndicator } from 'react-native';
import { ThemedText } from '@/components/ThemedText';
import { ThemedView } from '@/components/ThemedView';
import ParallaxScrollView from '@/components/ParallaxScrollView';
import { IconSymbol } from '@/components/ui/IconSymbol';
import { useAuth } from '@/context/AuthContext';
import { Image } from 'expo-image';
import { supabase } from '../../services/supabase';
import AsyncStorage from '@react-native-async-storage/async-storage';

interface ActivityStats {
  [key: string]: {
    totalDuration: number;
    lastRecorded: string;
  };
}

type TimePeriod = 'daily' | 'weekly' | 'monthly' | 'yearly';

export default function ProfileScreen() {
  const { user, signOut, isLoading } = useAuth();
  const [loggingOut, setLoggingOut] = useState(false);
  const [activityStats, setActivityStats] = useState<ActivityStats>({});
  const [loading, setLoading] = useState(true);
  const [currentActivity, setCurrentActivity] = useState<string | null>(null);
  const [blinkIndicator, setBlinkIndicator] = useState<boolean>(true);
  const [timePeriod, setTimePeriod] = useState<TimePeriod>('daily');

  // Reference to update interval
  const updateIntervalRef = React.useRef<NodeJS.Timeout | null>(null);
  
  // Load activity data from Supabase and AsyncStorage
  // Set up an interval to update the current activity duration
  useEffect(() => {
    // Function to update the current activity duration
    const updateCurrentActivityDuration = async () => {
      try {
        const currentActivityData = await AsyncStorage.getItem('motiontracker_current_activity');
        if (currentActivityData) {
          const { activity, startTime, baseDuration } = JSON.parse(currentActivityData);
          const elapsedSeconds = Math.floor((Date.now() - startTime) / 1000);
          
          // Update the current activity state
          setCurrentActivity(activity);
          
          // Toggle blink indicator for visual feedback
          setBlinkIndicator(prev => !prev);
          
          setActivityStats(prevStats => {
            const updatedStats = {...prevStats};
            if (updatedStats[activity]) {
              updatedStats[activity] = {
                ...updatedStats[activity],
                totalDuration: baseDuration + elapsedSeconds
              };
            } else {
              updatedStats[activity] = {
                totalDuration: elapsedSeconds,
                lastRecorded: new Date().toISOString()
              };
            }
            return updatedStats;
          });
        } else {
          // No current activity
          setCurrentActivity(null);
        }
      } catch (error) {
        console.error('Error updating current activity:', error);
        setCurrentActivity(null);
      }
    };
    
    // Set up interval to update every second
    updateIntervalRef.current = setInterval(updateCurrentActivityDuration, 1000);
    
    // Clean up on unmount
    return () => {
      if (updateIntervalRef.current) {
        clearInterval(updateIntervalRef.current);
        updateIntervalRef.current = null;
      }
    };
  }, []);

  // Add time period controls
  const TimePeriodSelector = () => (
    <ThemedView style={styles.timePeriodContainer}>
      {(['daily', 'weekly', 'monthly', 'yearly'] as TimePeriod[]).map((period) => (
        <TouchableOpacity 
          key={period}
          style={[
            styles.timePeriodButton,
            timePeriod === period && styles.selectedTimePeriod
          ]}
          onPress={() => setTimePeriod(period)}
        >
          <ThemedText 
            style={[
              styles.timePeriodText,
              timePeriod === period && styles.selectedTimePeriodText
            ]}
          >
            {period.charAt(0).toUpperCase() + period.slice(1)}
          </ThemedText>
        </TouchableOpacity>
      ))}
    </ThemedView>
  );
  
  useEffect(() => {
    const loadActivityData = async () => {
      setLoading(true);
      
      try {
        // First try to get data from local storage for a quick display
        const savedData = await AsyncStorage.getItem('motiontracker_activity_durations');
        let localStats: ActivityStats = {};
        
        if (savedData) {
          const durations = JSON.parse(savedData);
          Object.entries(durations).forEach(([activity, seconds]) => {
            localStats[activity] = {
              totalDuration: seconds as number,
              lastRecorded: new Date().toISOString(),
            };
          });
          
          // Check if there's an ongoing activity
          const currentActivityData = await AsyncStorage.getItem('motiontracker_current_activity');
          if (currentActivityData) {
            const { activity, startTime, baseDuration } = JSON.parse(currentActivityData);
            const elapsedSeconds = Math.floor((Date.now() - startTime) / 1000);
            
            // Update the current activity with live data
            if (localStats[activity]) {
              localStats[activity].totalDuration = baseDuration + elapsedSeconds;
              localStats[activity].lastRecorded = new Date().toISOString();
            } else {
              localStats[activity] = {
                totalDuration: elapsedSeconds,
                lastRecorded: new Date().toISOString()
              };
            }
          }
          
          // Update the state with local data first
          setActivityStats(localStats);
        }
        
        // Then fetch from Supabase if user is logged in
        if (user && user.id) {
          let tableName: string;
          let additionalFilters = {};
          
          // Determine which table to query based on the selected time period
          switch (timePeriod) {
            case 'daily':
              tableName = 'activity_daily';
              // Get today's date in YYYY-MM-DD format
              const today = new Date().toISOString().split('T')[0];
              additionalFilters = { date: today };
              break;
            
            case 'weekly':
              tableName = 'activity_weekly';
              // Get current year and week number
              const now = new Date();
              const year = now.getFullYear();
              // Calculate the week number using ISO week date standard
              const startOfYear = new Date(year, 0, 1);
              const days = Math.floor((now.getTime() - startOfYear.getTime()) / (24 * 60 * 60 * 1000));
              const weekNumber = Math.ceil((days + startOfYear.getDay() + 1) / 7);
              additionalFilters = { year, week_number: weekNumber };
              break;
            
            case 'monthly':
              tableName = 'activity_monthly';
              // Get current year and month
              const currentDate = new Date();
              additionalFilters = { 
                year: currentDate.getFullYear(),
                month: currentDate.getMonth() + 1 // JavaScript months are 0-indexed
              };
              break;
            
            case 'yearly':
              tableName = 'activity_yearly';
              // Get current year
              additionalFilters = { year: new Date().getFullYear() };
              break;
            
            default:
              // Fall back to daily if something goes wrong
              tableName = 'activity_daily';
              additionalFilters = { date: new Date().toISOString().split('T')[0] };
          }
          
          // Query the appropriate table with filters
          const { data, error } = await supabase
            .from(tableName)
            .select('*')
            .eq('user_id', user.id)
            .match(additionalFilters);
            
          if (error) {
            console.error(`Error fetching ${timePeriod} activity data:`, error);
            
            // Fallback to raw data if aggregated tables aren't available yet
            const { data: rawData, error: rawError } = await supabase
              .from('activity_tracking')
              .select('*')
              .eq('user_id', user.id);
              
            if (rawError) {
              console.error('Error fetching raw activity data:', rawError);
            } else if (rawData && rawData.length > 0) {
              processRawActivityData(rawData);
            }
          } else if (data && data.length > 0) {
            // Process the data from aggregated tables
            const onlineStats: ActivityStats = {};
            
            data.forEach(record => {
              const activity_type = record.activity_type;
              const total_duration = record.total_duration_seconds;
              // For created_at or lastRecorded, use different fields based on table
              let lastRecorded;
              
              switch (timePeriod) {
                case 'daily':
                  lastRecorded = record.date;
                  break;
                case 'weekly':
                  lastRecorded = record.end_date;
                  break;
                case 'monthly':
                  lastRecorded = `${record.year}-${record.month.toString().padStart(2, '0')}-01`;
                  break;
                case 'yearly':
                  lastRecorded = `${record.year}-01-01`;
                  break;
                default:
                  lastRecorded = new Date().toISOString();
              }
              
              onlineStats[activity_type] = {
                totalDuration: total_duration,
                lastRecorded: new Date(lastRecorded).toISOString()
              };
            });
            
            // Merge with local stats, preferring Supabase data
            setActivityStats(prevStats => {
              // Keep only the current activity from previous stats
              const newStats = {...onlineStats};
              
              if (currentActivity && prevStats[currentActivity]) {
                newStats[currentActivity] = prevStats[currentActivity];
              }
              
              return newStats;
            });
          } else {
            // If no aggregated data, try to fall back to raw activity data
            const { data: rawData, error: rawError } = await supabase
              .from('activity_tracking')
              .select('*')
              .eq('user_id', user.id);
              
            if (rawError) {
              console.error('Error fetching raw activity data:', rawError);
            } else if (rawData && rawData.length > 0) {
              processRawActivityData(rawData);
            }
          }
        }
      } catch (error) {
        console.error('Failed to load activity data:', error);
      } finally {
        setLoading(false);
      }
    };
    
    // Helper function to process raw activity tracking data
    const processRawActivityData = (rawData: any[]) => {
      const onlineStats: ActivityStats = {};
      
      rawData.forEach(record => {
        const { activity_type, duration_seconds, created_at } = record;
        
        if (!onlineStats[activity_type]) {
          onlineStats[activity_type] = {
            totalDuration: 0,
            lastRecorded: created_at
          };
        }
        
        onlineStats[activity_type].totalDuration += duration_seconds;
        
        // Update last recorded date if this is more recent
        if (new Date(created_at) > new Date(onlineStats[activity_type].lastRecorded)) {
          onlineStats[activity_type].lastRecorded = created_at;
        }
      });
      
      // Merge with local stats, keeping current activity
      setActivityStats(prevStats => {
        const newStats = {...onlineStats};
        
        if (currentActivity && prevStats[currentActivity]) {
          newStats[currentActivity] = prevStats[currentActivity];
        }
        
        return newStats;
      });
    };
    
    loadActivityData();
  }, [user, timePeriod]);

  const handleLogout = async () => {
    Alert.alert(
      'Logout',
      'Are you sure you want to logout?',
      [
        {
          text: 'Cancel',
          style: 'cancel',
        },
        {
          text: 'Logout',
          onPress: async () => {
            setLoggingOut(true);
            try {
              await signOut();
            } catch (error) {
              console.error('Error signing out:', error);
            } finally {
              setLoggingOut(false);
            }
          },
        },
      ]
    );
  };

  // Format seconds into a readable duration (Xh Ym Zs)
  const formatDuration = (totalSeconds: number): string => {
    const hours = Math.floor(totalSeconds / 3600);
    const minutes = Math.floor((totalSeconds % 3600) / 60);
    const seconds = Math.floor(totalSeconds % 60); // Floor to ensure integers only
    
    let result = '';
    if (hours > 0) result += `${hours}h `;
    if (minutes > 0 || hours > 0) result += `${minutes}m `;
    result += `${seconds}s`;
    
    return result;
  };

  const handleTimePeriodChange = async (period: TimePeriod) => {
    setTimePeriod(period);
    setLoading(true);
    
    try {
      // Fetch new data based on the selected time period
      if (user && user.id) {
        const { data, error } = await supabase
          .from('activity_tracking')
          .select('*')
          .eq('user_id', user.id)
          .gte('created_at', getTimePeriodStart(period))
          .lte('created_at', new Date().toISOString());
          
        if (error) {
          console.error('Error fetching activity data:', error);
        } else if (data && data.length > 0) {
          // Process the data from Supabase
          const newStats: ActivityStats = {};
          
          data.forEach(record => {
            const { activity_type, duration_seconds, created_at } = record;
            
            if (!newStats[activity_type]) {
              newStats[activity_type] = {
                totalDuration: 0,
                lastRecorded: created_at
              };
            }
            
            newStats[activity_type].totalDuration += duration_seconds;
            
            // Update last recorded date if this is more recent
            if (new Date(created_at) > new Date(newStats[activity_type].lastRecorded)) {
              newStats[activity_type].lastRecorded = created_at;
            }
          });
          
          setActivityStats(newStats);
        } else {
          // No data for the selected period, clear the stats
          setActivityStats({});
        }
      }
    } catch (error) {
      console.error('Failed to load activity data:', error);
    } finally {
      setLoading(false);
    }
  };

  const getTimePeriodStart = (period: TimePeriod): string => {
    const now = new Date();
    let startDate = new Date(now);

    switch (period) {
      case 'daily':
        startDate.setHours(0, 0, 0, 0);
        break;
      case 'weekly':
        const day = now.getDay();
        const diff = now.getDate() - day + (day === 0 ? -6 : 1); // Adjust if Sunday
        startDate.setDate(diff);
        startDate.setHours(0, 0, 0, 0);
        break;
      case 'monthly':
        startDate.setDate(1);
        startDate.setHours(0, 0, 0, 0);
        break;
      case 'yearly':
        startDate.setMonth(0);
        startDate.setDate(1);
        startDate.setHours(0, 0, 0, 0);
        break;
    }

    return startDate.toISOString();
  };

  if (isLoading || loggingOut) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#2E86C1" />
      </View>
    );
  }

  return (
    <ParallaxScrollView
      headerBackgroundColor={{ light: '#A1CEDC', dark: '#1D3D47' }}
      headerImage={
        <IconSymbol
          size={310}
          color="#808080"
          name="person.circle.fill"
          style={styles.headerImage}
        />
      }>
      <ThemedView style={styles.titleContainer}>
        <ThemedText type="title">Profile</ThemedText>
      </ThemedView>

      <ThemedView style={styles.userInfoContainer}>
        <ThemedText type="subtitle">Account Information</ThemedText>
        <ThemedView style={styles.userInfoItem}>
          <ThemedText style={styles.label}>Email</ThemedText>
          <ThemedText>{user?.email}</ThemedText>
        </ThemedView>
      </ThemedView>

      <ThemedView style={styles.statsContainer}>
        <ThemedText type="subtitle">Activity Stats</ThemedText>
        
        <ThemedView style={styles.timePeriodContainer}>
          <TouchableOpacity 
            style={[
              styles.timePeriodButton, 
              timePeriod === 'daily' && styles.activeTimePeriodButton
            ]}
            onPress={() => handleTimePeriodChange('daily')}
          >
            <ThemedText 
              style={[
                styles.timePeriodText, 
                timePeriod === 'daily' && styles.activeTimePeriodText
              ]}
            >
              Daily
            </ThemedText>
          </TouchableOpacity>
          
          <TouchableOpacity 
            style={[
              styles.timePeriodButton, 
              timePeriod === 'weekly' && styles.activeTimePeriodButton
            ]}
            onPress={() => handleTimePeriodChange('weekly')}
          >
            <ThemedText 
              style={[
                styles.timePeriodText, 
                timePeriod === 'weekly' && styles.activeTimePeriodText
              ]}
            >
              Weekly
            </ThemedText>
          </TouchableOpacity>
          
          <TouchableOpacity 
            style={[
              styles.timePeriodButton, 
              timePeriod === 'monthly' && styles.activeTimePeriodButton
            ]}
            onPress={() => handleTimePeriodChange('monthly')}
          >
            <ThemedText 
              style={[
                styles.timePeriodText, 
                timePeriod === 'monthly' && styles.activeTimePeriodText
              ]}
            >
              Monthly
            </ThemedText>
          </TouchableOpacity>
          
          <TouchableOpacity 
            style={[
              styles.timePeriodButton, 
              timePeriod === 'yearly' && styles.activeTimePeriodButton
            ]}
            onPress={() => handleTimePeriodChange('yearly')}
          >
            <ThemedText 
              style={[
                styles.timePeriodText, 
                timePeriod === 'yearly' && styles.activeTimePeriodText
              ]}
            >
              Yearly
            </ThemedText>
          </TouchableOpacity>
        </ThemedView>
        
        {loading ? (
          <ActivityIndicator style={{marginTop: 15}} size="small" color="#2E86C1" />
        ) : Object.keys(activityStats).length === 0 ? (
          <ThemedText style={{marginTop: 15, textAlign: 'center'}}>
            No activity data recorded yet. Start moving to track activities!
          </ThemedText>
        ) : (
          <>
            <ThemedView style={styles.statList}>
              {Object.entries(activityStats).map(([activity, stats]) => {
                const isActive = activity === currentActivity;
                
                return (
                  <ThemedView 
                    key={activity} 
                    style={[
                      styles.activityItem, 
                      isActive && styles.activeActivityItem
                    ]}
                  >
                    <ThemedView style={styles.activityHeader}>
                      <View style={{flexDirection: 'row', alignItems: 'center'}}>
                        <ThemedText style={[
                          styles.activityName,
                          isActive && styles.activeText
                        ]}>
                          {activity}
                        </ThemedText>
                        {isActive && (
                          <ThemedText style={[
                            styles.liveIndicator, 
                            {opacity: blinkIndicator ? 1 : 0.3}
                          ]}>
                            ●
                          </ThemedText>
                        )}
                      </View>
                      <ThemedText style={[
                        styles.activityDuration,
                        isActive && styles.activeText
                      ]}>
                        {formatDuration(stats.totalDuration)}
                      </ThemedText>
                    </ThemedView>
                    <ThemedText style={styles.lastTracked}>
                      {isActive ? (
                        'Currently active'
                      ) : (
                        `Last tracked: ${new Date(stats.lastRecorded).toLocaleDateString()}`
                      )}
                    </ThemedText>
                  </ThemedView>
                );
              })}
            </ThemedView>
            
            <ThemedText style={styles.totalStats}>
              {Object.entries(activityStats).length} activities tracked
            </ThemedText>
          </>
        )}
      </ThemedView>

      <ThemedView style={styles.actionsContainer}>
        <TouchableOpacity 
          style={styles.button} 
          onPress={handleLogout}
        >
          <ThemedText style={styles.buttonText}>Sign Out</ThemedText>
        </TouchableOpacity>
      </ThemedView>
    </ParallaxScrollView>
  );
}

const styles = StyleSheet.create({
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  headerImage: {
    opacity: 0.5,
    bottom: -60,
    right: -35,
    position: 'absolute',
  },
  titleContainer: {
    flexDirection: 'row',
    gap: 8,
  },
  userInfoContainer: {
    marginTop: 20,
    gap: 15,
  },
  userInfoItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 10,
    paddingHorizontal: 5,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(0,0,0,0.1)',
  },
  label: {
    fontWeight: '600',
  },
  statsContainer: {
    marginTop: 30,
    gap: 15,
  },
  timePeriodContainer: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    marginTop: 10,
    marginBottom: 15,
  },
  timePeriodButton: {
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 16,
    backgroundColor: 'rgba(46, 134, 193, 0.1)',
    flex: 1,
    marginHorizontal: 5,
    alignItems: 'center',
  },
  activeTimePeriodButton: {
    backgroundColor: 'rgba(46, 134, 193, 0.15)',
  },
  timePeriodText: {
    fontSize: 14,
    fontWeight: '500',
    color: '#2E86C1',
  },
  activeTimePeriodText: {
    fontWeight: 'bold',
    color: '#2E86C1',
  },
  statRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  statItem: {
    alignItems: 'center',
    padding: 10,
    borderRadius: 8,
    backgroundColor: 'rgba(46, 134, 193, 0.1)',
    flex: 1,
    margin: 5,
  },
  statValue: {
    fontWeight: 'bold',
    fontSize: 24,
  },
  statLabel: {
    marginTop: 5,
    fontSize: 14,
  },
  statList: {
    marginTop: 15,
  },
  activityItem: {
    backgroundColor: 'rgba(46, 134, 193, 0.1)',
    padding: 15,
    borderRadius: 8,
    marginBottom: 10,
  },
  activityHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  activityName: {
    fontSize: 16,
    fontWeight: '600',
  },
  activityDuration: {
    fontSize: 16,
    fontWeight: '600',
    color: '#2E86C1',
  },
  lastTracked: {
    fontSize: 12,
    color: '#666',
    marginTop: 5,
  },
  totalStats: {
    marginTop: 15,
    textAlign: 'center',
    fontSize: 14,
    color: '#666',
  },
  activeActivityItem: {
    backgroundColor: 'rgba(46, 134, 193, 0.15)',
    borderLeftWidth: 3,
    borderLeftColor: '#2E86C1',
  },
  activeText: {
    color: '#2E86C1',
    fontWeight: '600',
  },
  liveIndicator: { 
    color: '#E74C3C', 
    fontSize: 12,
    marginLeft: 5,
    opacity: 0.8
  },
  actionsContainer: {
    marginTop: 40,
    alignItems: 'center',
  },
  button: {
    backgroundColor: '#2E86C1',
    paddingVertical: 12,
    paddingHorizontal: 40,
    borderRadius: 8,
    width: '100%',
    alignItems: 'center',
  },
  buttonText: {
    color: 'white',
    fontWeight: 'bold',
    fontSize: 16,
  },
});
