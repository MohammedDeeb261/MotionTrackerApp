import { Image } from 'expo-image';
import { Platform, StyleSheet } from 'react-native';

import { HelloWave } from '@/components/HelloWave';
import ParallaxScrollView from '@/components/ParallaxScrollView';
import { ThemedText } from '@/components/ThemedText';
import { ThemedView } from '@/components/ThemedView';
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
      headerImage={
        <Image
          source={require('@/assets/images/partial-react-logo.png')}
          style={styles.reactLogo}
        />
      }>
      <ThemedView style={styles.titleContainer}>
        <ThemedText type="title">{greeting}</ThemedText>
        <HelloWave />
      </ThemedView>
      <ThemedView style={styles.userContainer}>
        <ThemedText type="subtitle">{user?.email}</ThemedText>
        <ThemedText>Welcome to the Motion Tracker App</ThemedText>
      </ThemedView>
      <ThemedView style={styles.stepContainer}>
        <ThemedText type="subtitle">Motion Tracking</ThemedText>
        <ThemedText>
          Tap the <ThemedText type="defaultSemiBold">Motion</ThemedText> tab to start tracking your movements. 
          The app uses your device's accelerometer and gyroscope to determine your activity.
        </ThemedText>
      </ThemedView>
      <ThemedView style={styles.stepContainer}>
        <ThemedText type="subtitle">Activity Tracking</ThemedText>
        <ThemedText>
          Your activities are automatically tracked and classified using machine learning.
          The model can recognize walking, running, and stationary states with high accuracy.
        </ThemedText>
      </ThemedView>
      <ThemedView style={styles.stepContainer}>
        <ThemedText type="subtitle">Your Profile</ThemedText>
        <ThemedText>
          Visit the <ThemedText type="defaultSemiBold">Profile</ThemedText> tab to view your activity statistics 
          and manage your account. You can track your progress over time and see how your activity levels change.
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
  reactLogo: {
    height: 178,
    width: 290,
    bottom: 0,
    left: 0,
    position: 'absolute',
  },
});
