import React, { useState } from 'react';
import { StyleSheet, TouchableOpacity, Alert, View, ActivityIndicator } from 'react-native';
import { ThemedText } from '@/components/ThemedText';
import { ThemedView } from '@/components/ThemedView';
import ParallaxScrollView from '@/components/ParallaxScrollView';
import { IconSymbol } from '@/components/ui/IconSymbol';
import { useAuth } from '@/context/AuthContext';
import { Image } from 'expo-image';

export default function ProfileScreen() {
  const { user, signOut, isLoading } = useAuth();
  const [loggingOut, setLoggingOut] = useState(false);

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
        <ThemedView style={styles.statRow}>
          <ThemedView style={styles.statItem}>
            <ThemedText style={styles.statValue}>0</ThemedText>
            <ThemedText style={styles.statLabel}>Walking</ThemedText>
          </ThemedView>
          <ThemedView style={styles.statItem}>
            <ThemedText style={styles.statValue}>0</ThemedText>
            <ThemedText style={styles.statLabel}>Running</ThemedText>
          </ThemedView>
          <ThemedView style={styles.statItem}>
            <ThemedText style={styles.statValue}>0</ThemedText>
            <ThemedText style={styles.statLabel}>Standing</ThemedText>
          </ThemedView>
        </ThemedView>
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
