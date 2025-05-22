import React, { useState, useEffect } from 'react';
import { StyleSheet, TouchableOpacity, View, ActivityIndicator } from 'react-native';
import { ThemedText } from '@/components/ThemedText';
import { ThemedView } from '@/components/ThemedView';
import ParallaxScrollView from '@/components/ParallaxScrollView';
import { useAuth } from '@/context/AuthContext';
import { supabase } from '../../services/supabase';
import { Image } from 'expo-image';

// Define type for time period selection
type TimePeriod = 'daily' | 'weekly' | 'monthly' | 'yearly';

// Define activity stats interface
interface ActivityStats {
  activity_type: string;
  total_duration_seconds: number;
  last_tracked?: string;
}

export default function ActivityCenterScreen() {
  const { user } = useAuth();
  const [timePeriod, setTimePeriod] = useState<TimePeriod>('daily');
  const [activityStats, setActivityStats] = useState<ActivityStats[]>([]);
  const [loading, setLoading] = useState(true);
  const [currentDate, setCurrentDate] = useState(new Date());
  
  // Format duration from seconds to readable time
  const formatDuration = (seconds: number): string => {
    if (!seconds) return '0m 0s';
    
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    const remainingSeconds = Math.floor(seconds % 60);
    
    let result = '';
    if (hours > 0) result += `${hours}h `;
    if (minutes > 0 || hours > 0) result += `${minutes}m `;
    result += `${remainingSeconds}s`;
    
    return result;
  };
  
  // Load activity data from the database
  const loadActivityData = async () => {
    if (!user) return;
    
    setLoading(true);
    try {
      let table, query;
      const today = new Date();
      
      // Query different tables based on time period
      switch (timePeriod) {
        case 'daily':
          table = 'activity_daily';
          // Format date in YYYY-MM-DD format
          const dateStr = currentDate.toISOString().split('T')[0];
          query = supabase
            .from(table)
            .select('*')
            .eq('user_id', user.id)
            .eq('date', dateStr);
          break;
          
        case 'weekly':
          table = 'activity_weekly';
          // Get the year and week number
          const year = currentDate.getFullYear();
          // Calculate the week number (ISO week)
          const weekNum = getWeekNumber(currentDate);
          query = supabase
            .from(table)
            .select('*')
            .eq('user_id', user.id)
            .eq('year', year)
            .eq('week_number', weekNum);
          break;
          
        case 'monthly':
          table = 'activity_monthly';
          // Get the year and month
          const monthYear = currentDate.getFullYear();
          const month = currentDate.getMonth() + 1; // 1-indexed month
          query = supabase
            .from(table)
            .select('*')
            .eq('user_id', user.id)
            .eq('year', monthYear)
            .eq('month', month);
          break;
          
        case 'yearly':
          table = 'activity_yearly';
          const yearValue = currentDate.getFullYear();
          query = supabase
            .from(table)
            .select('*')
            .eq('user_id', user.id)
            .eq('year', yearValue);
          break;
      }
      
      const { data, error } = await query;
      
      if (error) {
        console.error(`Error loading ${timePeriod} activity data:`, error);
        
        // Try fallback to raw activity data if aggregated tables fail
        const fallbackQuery = supabase
          .from('activity_tracking')
          .select('activity_type, duration_seconds, created_at')
          .eq('user_id', user.id);
        
        // Add date filter based on time period
        if (timePeriod === 'daily') {
          const startOfDay = new Date(currentDate);
          startOfDay.setHours(0, 0, 0, 0);
          
          const endOfDay = new Date(currentDate);
          endOfDay.setHours(23, 59, 59, 999);
          
          fallbackQuery
            .gte('created_at', startOfDay.toISOString())
            .lte('created_at', endOfDay.toISOString());
        } else if (timePeriod === 'weekly') {
          const startOfWeek = new Date(currentDate);
          startOfWeek.setDate(currentDate.getDate() - currentDate.getDay());
          startOfWeek.setHours(0, 0, 0, 0);
          
          const endOfWeek = new Date(startOfWeek);
          endOfWeek.setDate(startOfWeek.getDate() + 6);
          endOfWeek.setHours(23, 59, 59, 999);
          
          fallbackQuery
            .gte('created_at', startOfWeek.toISOString())
            .lte('created_at', endOfWeek.toISOString());
        } else if (timePeriod === 'monthly') {
          const startOfMonth = new Date(currentDate.getFullYear(), currentDate.getMonth(), 1);
          const endOfMonth = new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, 0);
          endOfMonth.setHours(23, 59, 59, 999);
          
          fallbackQuery
            .gte('created_at', startOfMonth.toISOString())
            .lte('created_at', endOfMonth.toISOString());
        } else if (timePeriod === 'yearly') {
          const startOfYear = new Date(currentDate.getFullYear(), 0, 1);
          const endOfYear = new Date(currentDate.getFullYear(), 11, 31);
          endOfYear.setHours(23, 59, 59, 999);
          
          fallbackQuery
            .gte('created_at', startOfYear.toISOString())
            .lte('created_at', endOfYear.toISOString());
        }
        
        const { data: rawData, error: fallbackError } = await fallbackQuery;
        
        if (fallbackError) {
          console.error('Fallback query failed:', fallbackError);
          setActivityStats([]);
        } else if (rawData) {
          // Aggregate the raw data
          const aggregatedData: { [key: string]: ActivityStats } = {};
          
          rawData.forEach(record => {
            const { activity_type, duration_seconds, created_at } = record;
            
            if (!aggregatedData[activity_type]) {
              aggregatedData[activity_type] = {
                activity_type,
                total_duration_seconds: 0,
                last_tracked: created_at
              };
            }
            
            aggregatedData[activity_type].total_duration_seconds += duration_seconds;
            
            // Update last tracked if this record is more recent
            if (new Date(created_at) > new Date(aggregatedData[activity_type].last_tracked!)) {
              aggregatedData[activity_type].last_tracked = created_at;
            }
          });
          
          setActivityStats(Object.values(aggregatedData));
        }
      } else {
        console.log(`Loaded ${data.length} ${timePeriod} activities`);
        setActivityStats(data || []);
      }
    } catch (err) {
      console.error('Failed to load activity data:', err);
      setActivityStats([]);
    } finally {
      setLoading(false);
    }
  };
  
  // Get ISO week number from date
  const getWeekNumber = (d: Date): number => {
    // Copy date to avoid modifying the original
    const date = new Date(d.getTime());
    // Set to nearest Thursday: current date + 4 - current day number
    date.setUTCDate(date.getUTCDate() + 4 - (date.getUTCDay() || 7));
    // Get first day of year
    const yearStart = new Date(Date.UTC(date.getUTCFullYear(), 0, 1));
    // Calculate full weeks to nearest Thursday
    const weekNo = Math.ceil((((date.getTime() - yearStart.getTime()) / 86400000) + 1) / 7);
    return weekNo;
  };
  
  // Helper to get previous period
  const goToPreviousPeriod = () => {
    const newDate = new Date(currentDate);
    
    switch (timePeriod) {
      case 'daily':
        newDate.setDate(newDate.getDate() - 1);
        break;
      case 'weekly':
        newDate.setDate(newDate.getDate() - 7);
        break;
      case 'monthly':
        newDate.setMonth(newDate.getMonth() - 1);
        break;
      case 'yearly':
        newDate.setFullYear(newDate.getFullYear() - 1);
        break;
    }
    
    setCurrentDate(newDate);
  };
  
  // Helper to get next period
  const goToNextPeriod = () => {
    const newDate = new Date(currentDate);
    const today = new Date();
    
    switch (timePeriod) {
      case 'daily':
        newDate.setDate(newDate.getDate() + 1);
        break;
      case 'weekly':
        newDate.setDate(newDate.getDate() + 7);
        break;
      case 'monthly':
        newDate.setMonth(newDate.getMonth() + 1);
        break;
      case 'yearly':
        newDate.setFullYear(newDate.getFullYear() + 1);
        break;
    }
    
    // Don't allow future dates
    if (newDate <= today) {
      setCurrentDate(newDate);
    }
  };
  
  // Format date range for display
  const getDateRangeText = (): string => {
    switch (timePeriod) {
      case 'daily':
        return currentDate.toLocaleDateString('en-US', {
          weekday: 'long',
          year: 'numeric',
          month: 'long',
          day: 'numeric'
        });
      case 'weekly': {
        // Get start of the week (Sunday)
        const weekStart = new Date(currentDate);
        weekStart.setDate(currentDate.getDate() - currentDate.getDay());
        
        // Get end of the week (Saturday)
        const weekEnd = new Date(weekStart);
        weekEnd.setDate(weekStart.getDate() + 6);
        
        // Format dates
        const startStr = weekStart.toLocaleDateString('en-US', {
          month: 'short',
          day: 'numeric'
        });
        const endStr = weekEnd.toLocaleDateString('en-US', {
          month: 'short',
          day: 'numeric',
          year: 'numeric'
        });
        
        return `${startStr} - ${endStr}`;
      }
      case 'monthly':
        return currentDate.toLocaleDateString('en-US', {
          month: 'long',
          year: 'numeric'
        });
      case 'yearly':
        return currentDate.getFullYear().toString();
      default:
        return '';
    }
  };
  
  // Calculate total activity time
  const getTotalActivityTime = (): number => {
    return activityStats.reduce((total, stat) => total + stat.total_duration_seconds, 0);
  };
  
  // Set up auto-refresh interval to sync with database updates
  useEffect(() => {
    if (user) {
      // First load immediately
      loadActivityData();
      
      // Set up interval to reload every 5 seconds
      const refreshInterval = setInterval(() => {
        console.log("Auto-refreshing activity center data");
        loadActivityData();
      }, 5000); // 5 seconds to match the motion tab update interval
      
      // Clean up interval on unmount
      return () => {
        clearInterval(refreshInterval);
      };
    }
  }, [user, timePeriod, currentDate]);
  
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
        <ThemedText type="title">Activity Center</ThemedText>
        
        {/* Time period selector */}
        <ThemedView style={styles.timePeriodSelector}>
          <TouchableOpacity
            style={[
              styles.periodButton,
              timePeriod === 'daily' && styles.activePeriod
            ]}
            onPress={() => setTimePeriod('daily')}
          >
            <ThemedText style={timePeriod === 'daily' ? styles.activeText : styles.periodText}>
              Daily
            </ThemedText>
          </TouchableOpacity>
          
          <TouchableOpacity
            style={[
              styles.periodButton,
              timePeriod === 'weekly' && styles.activePeriod
            ]}
            onPress={() => setTimePeriod('weekly')}
          >
            <ThemedText style={timePeriod === 'weekly' ? styles.activeText : styles.periodText}>
              Weekly
            </ThemedText>
          </TouchableOpacity>
          
          <TouchableOpacity
            style={[
              styles.periodButton,
              timePeriod === 'monthly' && styles.activePeriod
            ]}
            onPress={() => setTimePeriod('monthly')}
          >
            <ThemedText style={timePeriod === 'monthly' ? styles.activeText : styles.periodText}>
              Monthly
            </ThemedText>
          </TouchableOpacity>
          
          <TouchableOpacity
            style={[
              styles.periodButton,
              timePeriod === 'yearly' && styles.activePeriod
            ]}
            onPress={() => setTimePeriod('yearly')}
          >
            <ThemedText style={timePeriod === 'yearly' ? styles.activeText : styles.periodText}>
              Yearly
            </ThemedText>
          </TouchableOpacity>
        </ThemedView>
        
        {/* Date navigation */}
        <ThemedView style={styles.dateNavigator}>
          <TouchableOpacity
            onPress={goToPreviousPeriod}
            style={styles.navButton}
          >
            <ThemedText style={styles.navButtonText}>←</ThemedText>
          </TouchableOpacity>
          
          <ThemedText style={styles.dateRangeText}>
            {getDateRangeText()}
          </ThemedText>
          
          <TouchableOpacity
            onPress={goToNextPeriod}
            style={styles.navButton}
            // Disable if current date is today
            disabled={
              new Date(currentDate).setHours(0, 0, 0, 0) >= 
              new Date().setHours(0, 0, 0, 0)
            }
          >
            <ThemedText 
              style={[
                styles.navButtonText,
                new Date(currentDate).setHours(0, 0, 0, 0) >= 
                new Date().setHours(0, 0, 0, 0) && styles.disabledText
              ]}
            >
              →
            </ThemedText>
          </TouchableOpacity>
        </ThemedView>
        
        {/* Summary section */}
        <ThemedView style={styles.summaryContainer}>
          <ThemedText style={styles.summaryTitle}>
            Activity Summary
          </ThemedText>
          
          {loading ? (
            <ActivityIndicator size="small" color="#2E86C1" />
          ) : (
            <ThemedView style={styles.summaryContent}>
              <ThemedView style={styles.summaryItem}>
                <ThemedText style={styles.summaryLabel}>Total Activities</ThemedText>
                <ThemedText style={styles.summaryValue}>
                  {activityStats.length}
                </ThemedText>
              </ThemedView>
              
              <ThemedView style={styles.summaryItem}>
                <ThemedText style={styles.summaryLabel}>Total Time</ThemedText>
                <ThemedText style={styles.summaryValue}>
                  {formatDuration(getTotalActivityTime())}
                </ThemedText>
              </ThemedView>
            </ThemedView>
          )}
        </ThemedView>
        
        {/* Activity stats */}
        <ThemedView style={styles.statsContainer}>
          <ThemedText style={styles.sectionTitle}>Activity Details</ThemedText>
          
          {loading ? (
            <ActivityIndicator size="large" color="#2E86C1" />
          ) : activityStats.length > 0 ? (
            activityStats.map((stat, index) => (
              <ThemedView key={index} style={styles.activityItem}>
                <ThemedView style={styles.activityHeader}>
                  <ThemedText style={styles.activityName}>
                    {stat.activity_type}
                  </ThemedText>
                  <ThemedText style={styles.activityDuration}>
                    {formatDuration(stat.total_duration_seconds)}
                  </ThemedText>
                </ThemedView>
                {stat.last_tracked && (
                  <ThemedText style={styles.lastTracked}>
                    Last tracked: {new Date(stat.last_tracked).toLocaleString()}
                  </ThemedText>
                )}
                
                {/* Activity progress bar */}
                <ThemedView style={styles.progressBarContainer}>
                  <View 
                    style={[
                      styles.progressBar,
                      { 
                        width: `${Math.min(100, (stat.total_duration_seconds / getTotalActivityTime()) * 100)}%` 
                      }
                    ]}
                  />
                </ThemedView>
              </ThemedView>
            ))
          ) : (
            <ThemedView style={styles.emptyState}>
              <ThemedText style={styles.emptyStateText}>
                No activities tracked for this {timePeriod} period.
              </ThemedText>
            </ThemedView>
          )}
        </ThemedView>
      </ThemedView>
    </ParallaxScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: 16,
  },
  headerImage: {
    height: 100,
    width: 160,
    bottom: -30,
    right: -20,
    position: 'absolute',
    opacity: 0.6,
  },
  timePeriodSelector: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginVertical: 16,
    borderRadius: 8,
    overflow: 'hidden',
    backgroundColor: '#f0f0f0',
  },
  periodButton: {
    flex: 1,
    paddingVertical: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  activePeriod: {
    backgroundColor: '#2E86C1',
  },
  periodText: {
    color: '#555',
  },
  activeText: {
    color: 'white',
    fontWeight: 'bold',
  },
  dateNavigator: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
    paddingHorizontal: 6,
  },
  navButton: {
    padding: 8,
  },
  navButtonText: {
    fontSize: 24,
    fontWeight: 'bold',
  },
  disabledText: {
    opacity: 0.3,
  },
  dateRangeText: {
    fontSize: 16,
    fontWeight: 'bold',
  },
  summaryContainer: {
    backgroundColor: '#f5f5f5',
    borderRadius: 8,
    padding: 16,
    marginBottom: 20,
  },
  summaryTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    marginBottom: 10,
  },
  summaryContent: {
    flexDirection: 'row',
    justifyContent: 'space-around',
  },
  summaryItem: {
    alignItems: 'center',
  },
  summaryLabel: {
    fontSize: 14,
    color: '#666',
    marginBottom: 4,
  },
  summaryValue: {
    fontSize: 22,
    fontWeight: 'bold',
    color: '#2E86C1',
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    marginBottom: 12,
  },
  statsContainer: {
    marginTop: 8,
  },
  activityItem: {
    padding: 16,
    borderRadius: 8,
    marginBottom: 12,
    backgroundColor: '#f5f5f5',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 3,
    elevation: 2,
  },
  activityHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  activityName: {
    fontSize: 18,
    fontWeight: 'bold',
  },
  activityDuration: {
    fontSize: 16,
    fontWeight: '500',
    color: '#2E86C1',
  },
  lastTracked: {
    fontSize: 12,
    color: '#666',
    marginTop: 4,
  },
  progressBarContainer: {
    height: 6,
    backgroundColor: '#E0E0E0',
    borderRadius: 3,
    marginTop: 12,
    overflow: 'hidden',
  },
  progressBar: {
    height: '100%',
    backgroundColor: '#2E86C1',
  },
  emptyState: {
    padding: 40,
    alignItems: 'center',
    justifyContent: 'center',
  },
  emptyStateText: {
    textAlign: 'center',
    fontSize: 16,
    opacity: 0.6,
  },
});
