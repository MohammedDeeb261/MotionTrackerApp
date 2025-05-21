import { createClient } from '@supabase/supabase-js';
import AsyncStorage from '@react-native-async-storage/async-storage';

// Your Supabase project details
const supabaseUrl = 'https://kmqqwiomvtfsyqfwbdxm.supabase.co';
const supabaseAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImttcXF3aW9tdnRmc3lxZndiZHhtIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDc1MTEwODEsImV4cCI6MjA2MzA4NzA4MX0.0QvkJDzV2GbFDRKq29G-iXzxqNOd9PFvmzLeTJTBZ6Y';

// Create a React Native compatible storage adapter
const ExpoSecureStoreAdapter = {
  getItem: async (key: string): Promise<string | null> => {
    try {
      console.log(`Getting storage item: ${key}`);
      const value = await AsyncStorage.getItem(key);
      console.log(`Storage value for ${key}:`, value ? 'exists' : 'not found');
      return value;
    } catch (error) {
      console.error('Error getting item from AsyncStorage:', error);
      return null;
    }
  },
  setItem: async (key: string, value: string): Promise<void> => {
    try {
      console.log(`Storing item with key: ${key}`);
      await AsyncStorage.setItem(key, value);
      console.log(`Successfully stored item with key: ${key}`);
      
      // Verify the item was stored correctly
      const check = await AsyncStorage.getItem(key);
      console.log(`Storage verification for ${key}:`, check ? 'success' : 'failed');
    } catch (error) {
      console.error('Error setting item in AsyncStorage:', error);
    }
  },
  removeItem: async (key: string): Promise<void> => {
    try {
      console.log(`Removing item with key: ${key}`);
      await AsyncStorage.removeItem(key);
    } catch (error) {
      console.error('Error removing item from AsyncStorage:', error);
    }
  }
};

// Initialize Supabase with React Native storage adapter and proper configuration
export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    storage: ExpoSecureStoreAdapter,
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: false,
  },
  global: {
    headers: {
      'X-Client-Info': 'react-native-expo'
    },
  },
  // Disable WebSockets/realtime features to avoid issues
  realtime: {
    params: {
      eventsPerSecond: 0,
    },
  },
});
