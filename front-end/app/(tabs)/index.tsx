import { Platform, StyleSheet, TouchableOpacity, View } from 'react-native';
import { router } from 'expo-router';

import { HelloWave } from '@/components/HelloWave';
import ParallaxScrollView from '@/components/ParallaxScrollView';
import { ThemedText } from '@/components/ThemedText';
import { ThemedView } from '@/components/ThemedView';
import { IconSymbol } from '@/components/ui/IconSymbol';
import { useAuth } from '@/context/AuthContext';
import { useEffect, useState } from 'react';

export default function HomeScreen() {
  const { user } = useAuth();
  const [greeting, setGreeting] = useState('Welcome!');

  useEffect(() => {
    const hour = new Date().getHours();
    if (hour < 12) setGreeting('Good Morning!');
    else if (hour < 18) setGreeting('Good Afternoon!');
    else setGreeting('Good Evening!');
  }, []);
  
  return (
    <ParallaxScrollView
      headerBackgroundColor={{ light: '#A1CEDC', dark: '#1D3D47' }}
      >
      <ThemedView style={styles.titleContainer}>
        <ThemedText type="title">{greeting}</ThemedText>
        <HelloWave />
      </ThemedView>
      
      <ThemedView style={styles.userContainer}>
        <ThemedText type="subtitle">{user?.email}</ThemedText>
        <ThemedText style={styles.welcomeText}>Welcome to the Motion Tracker App</ThemedText>
      </ThemedView>
      
      {/* Motion Tab Card */}
      <TouchableOpacity 
        style={styles.featureCard}
        onPress={() => router.push('/(tabs)/motion')}
      >
        <View style={styles.cardHeader}>
          <IconSymbol name="waveform.path" size={32} color="#0066cc" />
          <ThemedText style={styles.cardTitle}>Motion Tracking</ThemedText>
        </View>
        <ThemedText style={styles.cardDescription}>
          Track your activities in real-time using motion detection. The app uses your device's sensors to 
          automatically detect when you walk, run, climb stairs, or stay stationary.
        </ThemedText>
        <View style={styles.cardFooter}>
          <ThemedText style={styles.tapToAccess}>Tap to access →</ThemedText>
        </View>
      </TouchableOpacity>
      
      {/* Activity Center Card */}
      <TouchableOpacity 
        style={styles.featureCard}
        onPress={() => router.push('/(tabs)/activity-center')}
      >
        <View style={styles.cardHeader}>
          <IconSymbol name="chart.bar.fill" size={32} color="#0066cc" />
          <ThemedText style={styles.cardTitle}>Activity Analytics</ThemedText>
        </View>
        <ThemedText style={styles.cardDescription}>
          View detailed statistics about your activities. See daily, weekly, monthly, and yearly breakdowns 
          of your movements and track how your activity levels change over time.
        </ThemedText>
        <View style={styles.cardFooter}>
          <ThemedText style={styles.tapToAccess}>Tap to access →</ThemedText>
        </View>
      </TouchableOpacity>
      
      {/* Goals Card */}
      <TouchableOpacity 
        style={styles.featureCard}
        onPress={() => router.push('/(tabs)/goals')}
      >
        <View style={styles.cardHeader}>
          <IconSymbol name="flag.fill" size={32} color="#0066cc" />
          <ThemedText style={styles.cardTitle}>Activity Goals</ThemedText>
        </View>
        <ThemedText style={styles.cardDescription}>
          Set and track personal activity goals. Create daily, weekly, or ongoing targets for walking, 
          running, or combined activities. The app will automatically track your progress toward each goal.
        </ThemedText>
        <View style={styles.cardFooter}>
          <ThemedText style={styles.tapToAccess}>Tap to access →</ThemedText>
        </View>
      </TouchableOpacity>
      
      {/* Profile Card */}
      <TouchableOpacity 
        style={styles.featureCard}
        onPress={() => router.push('/(tabs)/profile')}
      >
        <View style={styles.cardHeader}>
          <IconSymbol name="person.fill" size={32} color="#0066cc" />
          <ThemedText style={styles.cardTitle}>Your Profile</ThemedText>
        </View>
        <ThemedText style={styles.cardDescription}>
          Manage your account settings and view your overall progress statistics. See all your activities 
          in one place and track your fitness journey over time.
        </ThemedText>
        <View style={styles.cardFooter}>
          <ThemedText style={styles.tapToAccess}>Tap to access →</ThemedText>
        </View>
      </TouchableOpacity>
      
      {/* App Information */}
      <ThemedView style={styles.infoContainer}>
        <ThemedText style={styles.infoTitle}>About Motion Tracker</ThemedText>
        <ThemedText style={styles.infoText}>
          Motion Tracker uses machine learning to accurately detect and classify your activities. Data is 
          synchronized with our secure cloud database to ensure you never lose your progress.
        </ThemedText>
      </ThemedView>
    </ParallaxScrollView>
  );
}

const styles = StyleSheet.create({
  titleContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  userContainer: {
    gap: 8,
    marginBottom: 20,
    marginTop: 10,
  },
  stepContainer: {
    gap: 8,
    marginBottom: 8,
  },
});
