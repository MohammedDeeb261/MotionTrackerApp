import { supabase } from './supabase';
import AsyncStorage from '@react-native-async-storage/async-storage';

// Define response types
interface AuthResponse {
  success: boolean;
  message?: string;
  token?: string;
  user?: {
    id: string;
    email: string;
  };
}

export const authService = {
  // Sign up a new user
  async signUp(email: string, password: string): Promise<AuthResponse> {
    try {
      const { data, error } = await supabase.auth.signUp({
        email,
        password,
      });

      if (error) throw error;
      
      return {
        success: true,
        user: {
          id: data.user?.id || '',
          email: data.user?.email || '',
        }
      };
    } catch (error) {
      console.error('Error during signup:', error);
      return {
        success: false,
        message: error instanceof Error ? error.message : 'An unexpected error occurred',
      };
    }
  },

  // Sign in an existing user
  async signIn(email: string, password: string): Promise<AuthResponse> {
    try {
      console.log('Attempting sign in with email:', email);
      const { data, error } = await supabase.auth.signInWithPassword({
        email,
        password,
      });

      if (error) {
        console.error('Supabase auth error:', error);
        throw error;
      }

      if (!data.session) {
        console.error('No session returned from sign in');
        throw new Error('No session returned from sign in');
      }

      console.log('Sign in successful, session established');
      
      // Verify session is stored correctly
      const { data: sessionCheck } = await supabase.auth.getSession();
      console.log('Session verification:', sessionCheck.session ? 'Session exists' : 'No session found');

      return {
        success: true,
        token: data.session?.access_token,
        user: {
          id: data.user?.id || '',
          email: data.user?.email || '',
        }
      };
    } catch (error) {
      console.error('Error during login:', error);
      return {
        success: false,
        message: error instanceof Error ? error.message : 'An unexpected error occurred',
      };
    }
  },
  
  // Sign out the current user
  async signOut(): Promise<void> {
    const { error } = await supabase.auth.signOut();
    if (error) {
      console.error('Error signing out:', error);
    }
  },
  
  // Check if user is logged in
  async isAuthenticated(): Promise<boolean> {
    const { data } = await supabase.auth.getSession();
    return !!data.session;
  },
  
  // Get the current user
  async getCurrentUser() {
    try {
      console.log('Fetching current session from Supabase...');
      // First check for a session - this is more reliable in React Native
      const { data: sessionData, error: sessionError } = await supabase.auth.getSession();
      
      if (sessionError) {
        console.error('Error getting session:', sessionError.message);
        return null;
      }
      
      console.log('Session data:', sessionData?.session ? 'Session exists' : 'No active session');
      
      // If we have a session, extract user from it
      if (sessionData?.session?.user) {
        console.log('User found in session');
        return {
          id: sessionData.session.user.id,
          email: sessionData.session.user.email
        };
      }
      
      // Fallback to getUser if session doesn't have user (rare case)
      const { data, error } = await supabase.auth.getUser();
      
      if (error) {
        console.error('Error getting current user:', error.message);
        return null;
      }
      
      console.log('Auth data received:', data?.user ? 'User found' : 'No user');
      
      if (data?.user) {
        return {
          id: data.user.id,
          email: data.user.email
        };
      }
      
      return null;
    } catch (error) {
      console.error('Unexpected error in getCurrentUser:', error);
      return null;
    }
  }
};
