import React, { useState, useEffect, useCallback } from 'react';
import { StyleSheet, TouchableOpacity, View, ActivityIndicator, Alert, Modal, TextInput, ScrollView, Platform } from 'react-native';
import { ThemedText } from '@/components/ThemedText';
import { ThemedView } from '@/components/ThemedView';
import ParallaxScrollView from '@/components/ParallaxScrollView';
import { useAuth } from '@/context/AuthContext';
import { supabase } from '../../services/supabase';
import { Image } from 'expo-image';
import { IconSymbol } from '@/components/ui/IconSymbol';
import DateTimePicker from '@react-native-community/datetimepicker';
import { useFocusEffect } from '@react-navigation/native';

// Define types for goals
interface Goal {
  id: string;
  title: string;
  activity_type: string;
  goal_type: 'daily' | 'weekly' | 'regular';
  target_duration_ms: number;
  current_duration_ms: number;
  start_date: string;
  completion_date?: string | null;
  is_completed: boolean;
  created_at: string;
  updated_at: string;
  status: 'active' | 'completed' | 'expired';
}

// Form state interface
interface GoalForm {
  title: string;
  activity_type: string;
  activity_types: string[];
  goal_type: 'daily' | 'weekly' | 'regular';
  target_duration_ms: number;
  start_date: Date;
}

export default function GoalsScreen() {
  const { user } = useAuth();
  const [goals, setGoals] = useState<Goal[]>([]);
  const [loading, setLoading] = useState(true);
  const [modalVisible, setModalVisible] = useState(false);
  const [refreshCounter, setRefreshCounter] = useState(0);
  
  // Form states
  const [form, setForm] = useState<GoalForm>({
    title: '',
    activity_type: 'Walk', // For backward compatibility
    activity_types: ['Walk'], // Default to just Walk
    goal_type: 'daily',
    target_duration_ms: 1800000, // 30 minutes default
    start_date: new Date(),
  });
  
  const [showDatePicker, setShowDatePicker] = useState(false);
  
  // Format duration from milliseconds to readable time
  const formatDuration = (milliseconds: number): string => {
    if (!milliseconds) return '0h 0m 0s';
    
    const seconds = Math.floor(milliseconds / 1000);
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    const remainingSeconds = Math.floor(seconds % 60);
    
    let result = '';
    if (hours > 0) result += `${hours}h `;
    if (minutes > 0 || hours > 0) result += `${minutes}m `;
    result += `${remainingSeconds}s`;
    
    return result;
  };
  
  // Function to parse time string to milliseconds (HH:MM:SS)
  const parseTimeToMs = (timeString: string): number => {
    try {
      // Handle empty or invalid string
      if (!timeString.trim()) return 0;
      
      const parts = timeString.split(':');
      let hours = 0, minutes = 0, seconds = 0;
      
      if (parts.length === 3) {
        hours = parseInt(parts[0], 10) || 0;
        minutes = parseInt(parts[1], 10) || 0;
        seconds = parseInt(parts[2], 10) || 0;
      } else if (parts.length === 2) {
        minutes = parseInt(parts[0], 10) || 0;
        seconds = parseInt(parts[1], 10) || 0;
      } else if (parts.length === 1) {
        seconds = parseInt(parts[0], 10) || 0;
      }
      
      return ((hours * 60 * 60) + (minutes * 60) + seconds) * 1000;
    } catch (error) {
      console.error('Error parsing time:', error);
      return 0;
    }
  };
  
  // Function to format milliseconds to time string (HH:MM:SS)
  const formatMsToTimeString = (milliseconds: number): string => {
    if (!milliseconds) return '00:30:00'; // Default 30 minutes
    
    const seconds = Math.floor(milliseconds / 1000);
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    const remainingSeconds = Math.floor(seconds % 60);
    
    return `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}:${String(remainingSeconds).padStart(2, '0')}`;
  };
  
  // Function to calculate progress percentage
  const calculateProgress = (current: number, target: number): number => {
    if (!target || target <= 0) return 0;
    const progress = Math.min(100, Math.floor((current / target) * 100));
    return progress;
  };
  
  // Function to determine the color based on progress
  const getProgressColor = (progress: number): string => {
    if (progress < 30) return '#ff6b6b'; // Red
    if (progress < 70) return '#feca57'; // Yellow
    return '#1dd1a1'; // Green
  };
  
  // Function to load goals data
  const loadGoals = async () => {
    if (!user) return;
    
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('user_activity_goals')
        .select('*')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false });
        
      if (error) {
        console.error('Error loading goals:', error);
        Alert.alert('Error', 'Failed to load your goals');
      } else if (data) {
        setGoals(data);
      }
    } catch (error) {
      console.error('Exception loading goals:', error);
      Alert.alert('Error', 'An unexpected error occurred');
    } finally {
      setLoading(false);
    }
  };
  
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
          .select('activity_type, total_duration_seconds')
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
              
              const walkDuration = walkData ? walkData.total_duration_seconds * 1000 : 0;
              const runDuration = runData ? runData.total_duration_seconds * 1000 : 0;
              
              currentDuration = walkDuration + runDuration;
            } else {
              // For single activity goals
              const activityData = todayData.find(d => d.activity_type === goal.activity_type);
              if (activityData && activityData.total_duration_seconds) {
                currentDuration = activityData.total_duration_seconds * 1000; // Convert to ms
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
          .select('activity_type, total_duration_seconds')
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
              
              const walkDuration = walkData ? walkData.total_duration_seconds * 1000 : 0;
              const runDuration = runData ? runData.total_duration_seconds * 1000 : 0;
              
              currentDuration = walkDuration + runDuration;
            } else {
              // For single activity goals
              const activityData = weekData.find(d => d.activity_type === goal.activity_type);
              if (activityData) {
                currentDuration = activityData.total_duration_seconds * 1000; // Convert to ms
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
  
  // Function to handle creating a new goal
  const handleCreateGoal = async () => {
    if (!user) {
      Alert.alert('Error', 'You must be logged in to create goals');
      return;
    }
    
    if (!form.title.trim()) {
      Alert.alert('Error', 'Please enter a goal title');
      return;
    }
    
    try {
      // Format start_date to YYYY-MM-DD
      const formattedDate = form.start_date.toISOString().split('T')[0];
      
      // Create a single goal with the selected activity type (including Run & Walk)
      const { error } = await supabase
        .from('user_activity_goals')
        .insert([
          {
            user_id: user.id,
            title: form.title,
            activity_type: form.activity_type, // Use activity_type directly
            goal_type: form.goal_type,
            target_duration_ms: form.target_duration_ms,
            current_duration_ms: 0,
            start_date: formattedDate,
            status: 'active'
          }
        ]);
        
      if (error) {
        console.error('Error creating goal:', error);
        Alert.alert('Error', 'Failed to create the goal');
      } else {
        // Reset form and close modal
        setForm({
          title: '',
          activity_type: 'Walk',
          activity_types: ['Walk'],
          goal_type: 'daily',
          target_duration_ms: 1800000,
          start_date: new Date(),
        });
        setModalVisible(false);
        
        // Refresh goals list
        loadGoals();
      }
    } catch (error) {
      console.error('Exception creating goal:', error);
      Alert.alert('Error', 'An unexpected error occurred');
    }
  };
  
  // Load goals when the screen is focused
  useFocusEffect(
    useCallback(() => {
      if (user) {
        loadGoals();
        updateGoalsProgress();
      }
      
      // Set up interval to update goals progress (every 60 seconds)
      const progressInterval = setInterval(() => {
        if (user) {
          updateGoalsProgress();
        }
      }, 60000);
      
      return () => {
        clearInterval(progressInterval);
      };
    }, [user, refreshCounter])
  );
  
  // Handle date change
  const onDateChange = (event: any, selectedDate?: Date) => {
    setShowDatePicker(Platform.OS === 'ios');
    if (selectedDate) {
      setForm({...form, start_date: selectedDate});
    }
  };
  
  // UI components for different goal types
  const renderGoalItem = (goal: Goal) => {
    const progress = calculateProgress(goal.current_duration_ms, goal.target_duration_ms);
    const progressColor = getProgressColor(progress);
    
    // Format dates for display
    const startDate = new Date(goal.start_date).toLocaleDateString();
    const completionDate = goal.completion_date 
      ? new Date(goal.completion_date).toLocaleDateString()
      : null;
    
    // Determine time remaining for daily/weekly goals
    let timeLeft = "";
    if (goal.goal_type === 'daily' && !goal.is_completed) {
      timeLeft = "Ends today";
    } else if (goal.goal_type === 'weekly' && !goal.is_completed) {
      const now = new Date();
      const dayOfWeek = now.getDay();
      const daysLeft = 7 - dayOfWeek;
      timeLeft = `${daysLeft} day${daysLeft !== 1 ? 's' : ''} left`;
    }
    
    return (
      <View 
        key={goal.id} 
        style={[
          styles.goalCard, 
          goal.is_completed ? styles.completedGoal : null
        ]}
      >
        <View style={styles.goalHeader}>
          <ThemedText style={styles.goalTitle}>{goal.title}</ThemedText>
          <ThemedText style={styles.goalType}>
            {goal.goal_type.charAt(0).toUpperCase() + goal.goal_type.slice(1)}
          </ThemedText>
        </View>
        
        <View style={styles.goalDetails}>
          <View style={styles.activityContainer}>
            <ThemedText style={styles.activityLabel}>Activity: </ThemedText>
            <ThemedText style={styles.activityValue}>
              {/* Display activity type with appropriate icon */}
              {goal.activity_type === 'Walk' && '🚶 Walk'}
              {goal.activity_type === 'Run' && '🏃 Run'}
              {goal.activity_type === 'Run & Walk' && '🏃‍♂️🚶‍♂️ Run & Walk'}
            </ThemedText>
          </View>
          
          <View style={styles.dateContainer}>
            <ThemedText style={styles.dateLabel}>Started: </ThemedText>
            <ThemedText style={styles.dateValue}>{startDate}</ThemedText>
          </View>
          
          {goal.is_completed && completionDate && (
            <View style={styles.dateContainer}>
              <ThemedText style={styles.dateLabel}>Completed: </ThemedText>
              <ThemedText style={styles.dateValue}>{completionDate}</ThemedText>
            </View>
          )}
          
          {!goal.is_completed && (goal.goal_type === 'daily' || goal.goal_type === 'weekly') && (
            <View style={styles.timeLeftContainer}>
              <ThemedText style={styles.timeLeftText}>{timeLeft}</ThemedText>
            </View>
          )}
        </View>
        
        <View style={styles.progressSection}>
          <View style={styles.progressTextContainer}>
            <ThemedText style={styles.progressLabel}>Progress: </ThemedText>
            <ThemedText style={styles.progressPercentage}>{progress}%</ThemedText>
          </View>
          
          <View style={styles.durationTextContainer}>
            <ThemedText style={styles.currentDuration}>
              {formatDuration(goal.current_duration_ms)}
            </ThemedText>
            <ThemedText style={styles.durationSeparator}> / </ThemedText>
            <ThemedText style={styles.targetDuration}>
              {formatDuration(goal.target_duration_ms)}
            </ThemedText>
          </View>
          
          <View style={styles.progressBarContainer}>
            <View style={[styles.progressBar, {width: `${progress}%`, backgroundColor: progressColor}]} />
          </View>
        </View>
      </View>
    );
  };
  
  const renderNewGoalButton = () => (
    <TouchableOpacity 
      style={styles.newGoalButton}
      onPress={() => setModalVisible(true)}
    >
      <IconSymbol name="plus.circle.fill" size={24} color="#fff" />
      <ThemedText style={styles.newGoalButtonText}>New Goal</ThemedText>
    </TouchableOpacity>
  );
  
  // Goal creation modal
  const renderGoalFormModal = () => (
    <Modal
      animationType="slide"
      transparent={true}
      visible={modalVisible}
      onRequestClose={() => setModalVisible(false)}
    >
      <View style={styles.modalOverlay}>
        <View style={styles.modalContent}>
          <ThemedText style={styles.modalHeader}>Create New Goal</ThemedText>
          
          <View style={styles.formGroup}>
            <ThemedText style={styles.formLabel}>Title</ThemedText>
            <TextInput
              style={styles.input}
              placeholder="Goal title"
              placeholderTextColor="#999"
              value={form.title}
              onChangeText={(text) => setForm({...form, title: text})}
            />
          </View>
          
          <View style={styles.formGroup}>
            <ThemedText style={styles.formLabel}>Activity Type</ThemedText>
            <View style={styles.activityTypeSelector}>
              <TouchableOpacity
                style={[
                  styles.activityTypeButton,
                  form.activity_type === 'Walk' ? styles.activityTypeButtonSelected : null
                ]}
                onPress={() => setForm({...form, activity_type: 'Walk', activity_types: ['Walk']})}
              >
                <ThemedText 
                  style={[
                    styles.activityTypeButtonText,
                    form.activity_type === 'Walk' ? styles.activityTypeButtonTextSelected : null
                  ]}
                >
                  Walk 🚶
                </ThemedText>
              </TouchableOpacity>
              
              <TouchableOpacity
                style={[
                  styles.activityTypeButton,
                  form.activity_type === 'Run' ? styles.activityTypeButtonSelected : null
                ]}
                onPress={() => setForm({...form, activity_type: 'Run', activity_types: ['Run']})}
              >
                <ThemedText 
                  style={[
                    styles.activityTypeButtonText,
                    form.activity_type === 'Run' ? styles.activityTypeButtonTextSelected : null
                  ]}
                >
                  Run 🏃
                </ThemedText>
              </TouchableOpacity>
              
              <TouchableOpacity
                style={[
                  styles.activityTypeButton,
                  form.activity_type === 'Run & Walk' ? styles.activityTypeButtonSelected : null
                ]}
                onPress={() => setForm({...form, activity_type: 'Run & Walk', activity_types: ['Run', 'Walk']})}
              >
                <ThemedText 
                  style={[
                    styles.activityTypeButtonText,
                    form.activity_type === 'Run & Walk' ? styles.activityTypeButtonTextSelected : null
                  ]}
                >
                  Run & Walk 🏃‍♂️🚶‍♂️
                </ThemedText>
              </TouchableOpacity>
            </View>
          </View>
          
          <View style={styles.formGroup}>
            <ThemedText style={styles.formLabel}>Goal Type</ThemedText>
            <View style={styles.goalTypeSelector}>
              {[
                { value: 'daily', label: 'Daily' },
                { value: 'weekly', label: 'Weekly' },
                { value: 'regular', label: 'Regular' }
              ].map((type) => (
                <TouchableOpacity
                  key={type.value}
                  style={[
                    styles.goalTypeButton,
                    form.goal_type === type.value ? styles.goalTypeButtonSelected : null
                  ]}
                  onPress={() => setForm({...form, goal_type: type.value as 'daily' | 'weekly' | 'regular'})}
                >
                  <ThemedText 
                    style={[
                      styles.goalTypeButtonText,
                      form.goal_type === type.value ? styles.goalTypeButtonTextSelected : null
                    ]}
                  >
                    {type.label}
                  </ThemedText>
                </TouchableOpacity>
              ))}
            </View>
          </View>
          
          <View style={styles.formGroup}>
            <ThemedText style={styles.formLabel}>Target Duration (HH:MM:SS)</ThemedText>
            <TextInput
              style={styles.input}
              placeholder="00:30:00"
              placeholderTextColor="#999"
              value={formatMsToTimeString(form.target_duration_ms)}
              onChangeText={(text) => {
                const durationMs = parseTimeToMs(text);
                setForm({...form, target_duration_ms: durationMs});
              }}
            />
          </View>
          
          {form.goal_type === 'regular' && (
            <View style={styles.formGroup}>
              <ThemedText style={styles.formLabel}>Start Date</ThemedText>
              <TouchableOpacity
                style={styles.dateInput}
                onPress={() => setShowDatePicker(true)}
              >
                <ThemedText style={styles.dateText}>
                  {form.start_date.toLocaleDateString()}
                </ThemedText>
              </TouchableOpacity>
              
              {showDatePicker && (
                <DateTimePicker
                  value={form.start_date}
                  mode="date"
                  display="default"
                  onChange={onDateChange}
                />
              )}
            </View>
          )}
          
          <View style={styles.modalButtons}>
            <TouchableOpacity 
              style={[styles.button, styles.cancelButton]}
              onPress={() => setModalVisible(false)}
            >
              <ThemedText style={styles.buttonText}>Cancel</ThemedText>
            </TouchableOpacity>
            
            <TouchableOpacity 
              style={[styles.button, styles.createButton]}
              onPress={handleCreateGoal}
            >
              <ThemedText style={styles.buttonText}>Create</ThemedText>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );
  
  // Group goals by status
  const activeGoals = goals.filter(g => !g.is_completed);
  const completedGoals = goals.filter(g => g.is_completed);
  
  return (
    <ParallaxScrollView
      headerBackgroundColor={{ light: '#A0D995', dark: '#1F432A' }}
      headerImage={
        <Image
          source={require('@/assets/images/partial-react-logo.png')}
          style={styles.headerImage}
        />
      }>
      <ThemedView style={styles.container}>
        <ThemedText type="title">Activity Goals</ThemedText>
        {loading ? (
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="large" color="#0066cc" />
          </View>
        ) : (
          <>
            {/* Active Goals Section */}
            <View style={styles.sectionContainer}>
              <View style={styles.sectionHeader}>
                <ThemedText style={styles.sectionTitle}>Active Goals</ThemedText>
                <TouchableOpacity 
                  style={styles.refreshButton}
                  onPress={() => {
                    setRefreshCounter(prev => prev + 1);
                  }}
                >
                  <IconSymbol name="arrow.clockwise" size={20} color="#0066cc" />
                </TouchableOpacity>
              </View>
              
              {activeGoals.length > 0 ? (
                activeGoals.map(renderGoalItem)
              ) : (
                <ThemedView style={styles.emptyStateContainer}>
                  <ThemedText style={styles.emptyStateText}>No active goals</ThemedText>
                  <ThemedText style={styles.emptyStateSubtext}>Create a new goal to start tracking</ThemedText>
                </ThemedView>
              )}
            </View>
            
            {/* Completed Goals Section */}
            {completedGoals.length > 0 && (
              <View style={styles.sectionContainer}>
                <View style={styles.sectionHeader}>
                  <ThemedText style={styles.sectionTitle}>Completed Goals</ThemedText>
                </View>
                {completedGoals.map(renderGoalItem)}
              </View>
            )}
            
            {/* Add New Goal Button */}
            {renderNewGoalButton()}
          </>
        )}
        
        {/* New Goal Modal */}
        {renderGoalFormModal()}
      </ThemedView>
    </ParallaxScrollView>
  );
}

const styles = StyleSheet.create({
  headerImage: {
    width: '100%',
    height: '100%',
    opacity: 0.7,
  },
  container: {
    flex: 1,
    paddingHorizontal: 16,
    paddingTop: 8,
    paddingBottom: 32,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 40,
  },
  sectionContainer: {
    marginVertical: 8,
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
    paddingHorizontal: 4,
  },
  sectionTitle: {
    fontSize: 20,
    fontWeight: '600',
  },
  refreshButton: {
    padding: 8,
  },
  goalCard: {
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
    backgroundColor: '#ffffff',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  completedGoal: {
    opacity: 0.8,
    borderLeftWidth: 4,
    borderLeftColor: '#1dd1a1',
  },
  goalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  goalTitle: {
    fontSize: 18,
    fontWeight: '600',
  },
  goalType: {
    fontSize: 14,
    padding: 4,
    paddingHorizontal: 8,
    backgroundColor: '#f0f0f0',
    borderRadius: 6,
    overflow: 'hidden',
  },
  goalDetails: {
    marginBottom: 16,
  },
  activityContainer: {
    flexDirection: 'row',
    marginBottom: 4,
  },
  activityLabel: {
    fontSize: 14,
    color: '#666',
  },
  activityValue: {
    fontSize: 14,
    fontWeight: '500',
  },
  dateContainer: {
    flexDirection: 'row',
    marginBottom: 4,
  },
  dateLabel: {
    fontSize: 14,
    color: '#666',
  },
  dateValue: {
    fontSize: 14,
  },
  timeLeftContainer: {
    marginTop: 4,
  },
  timeLeftText: {
    fontSize: 14,
    fontStyle: 'italic',
    color: '#ff9f43',
  },
  progressSection: {
    marginTop: 8,
  },
  progressTextContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 4,
  },
  progressLabel: {
    fontSize: 14,
    color: '#666',
  },
  progressPercentage: {
    fontSize: 14,
    fontWeight: '600',
  },
  durationTextContainer: {
    flexDirection: 'row',
    marginBottom: 8,
  },
  currentDuration: {
    fontSize: 14,
  },
  durationSeparator: {
    fontSize: 14,
    color: '#999',
  },
  targetDuration: {
    fontSize: 14,
    color: '#666',
  },
  progressBarContainer: {
    height: 8,
    backgroundColor: '#f0f0f0',
    borderRadius: 4,
    overflow: 'hidden',
  },
  progressBar: {
    height: '100%',
  },
  emptyStateContainer: {
    padding: 32,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#f9f9f9',
    borderRadius: 12,
  },
  emptyStateText: {
    fontSize: 18,
    fontWeight: '500',
    marginBottom: 8,
  },
  emptyStateSubtext: {
    fontSize: 14,
    color: '#666',
    textAlign: 'center',
  },
  newGoalButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#0066cc',
    borderRadius: 12,
    padding: 16,
    marginTop: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  newGoalButtonText: {
    color: '#fff',
    fontWeight: '600',
    fontSize: 16,
    marginLeft: 8,
  },
  modalOverlay: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
  },
  modalContent: {
    width: '90%',
    maxWidth: 400,
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 24,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.25,
    shadowRadius: 8,
    elevation: 5,
    maxHeight: '90%',
  },
  modalHeader: {
    fontSize: 22,
    fontWeight: '600',
    marginBottom: 24,
    textAlign: 'center',
  },
  formGroup: {
    marginBottom: 16,
  },
  formLabel: {
    fontSize: 16,
    marginBottom: 8,
    fontWeight: '500',
  },
  input: {
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 8,
    padding: 12,
    fontSize: 16,
    backgroundColor: '#f9f9f9',
    color: '#333',
  },
  activityTypeSelector: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  activityTypeButton: {
    flex: 1,
    padding: 12,
    borderWidth: 1,
    borderColor: '#ddd',
    alignItems: 'center',
    marginHorizontal: 4,
    borderRadius: 8,
  },
  activityTypeButtonSelected: {
    backgroundColor: '#0066cc',
    borderColor: '#0066cc',
  },
  activityTypeButtonText: {
    fontSize: 14,
  },
  activityTypeButtonTextSelected: {
    color: '#fff',
    fontWeight: '500',
  },
  goalTypeSelector: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  goalTypeButton: {
    flex: 1,
    padding: 12,
    borderWidth: 1,
    borderColor: '#ddd',
    alignItems: 'center',
    marginHorizontal: 4,
    borderRadius: 8,
  },
  goalTypeButtonSelected: {
    backgroundColor: '#0066cc',
    borderColor: '#0066cc',
  },
  goalTypeButtonText: {
    fontSize: 14,
  },
  goalTypeButtonTextSelected: {
    color: '#fff',
    fontWeight: '500',
  },
  dateInput: {
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 8,
    padding: 12,
    backgroundColor: '#f9f9f9',
  },
  dateText: {
    fontSize: 16,
  },
  modalButtons: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 24,
  },
  button: {
    flex: 1,
    padding: 16,
    borderRadius: 8,
    alignItems: 'center',
    marginHorizontal: 4,
  },
  cancelButton: {
    backgroundColor: '#f0f0f0',
  },
  createButton: {
    backgroundColor: '#0066cc',
  },
  buttonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#fff',
  },
});
