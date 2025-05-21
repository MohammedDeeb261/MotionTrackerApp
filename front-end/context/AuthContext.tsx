import React, { createContext, useState, useEffect, useContext, ReactNode } from 'react';
import { authService } from '../services/authService';
import { supabase } from '../services/supabase';

// Define the shape of the user object
interface User {
  id: string;
  email: string | null | undefined;
}

// Define the shape of the auth context
interface AuthContextType {
  user: User | null;
  isLoading: boolean;
  signIn: (email: string, password: string) => Promise<{ success: boolean; message?: string }>;
  signUp: (email: string, password: string) => Promise<{ success: boolean; message?: string }>;
  signOut: () => Promise<void>;
}

// Create the auth context with a default value
export const AuthContext = createContext<AuthContextType>({
  user: null,
  isLoading: true,
  signIn: async () => ({ success: false }),
  signUp: async () => ({ success: false }),
  signOut: async () => {},
});

// Create a custom hook to use the auth context
export const useAuth = () => useContext(AuthContext);

// Define the props for the AuthProvider component
interface AuthProviderProps {
  children: ReactNode;
}

// Create the AuthProvider component
export const AuthProvider = ({ children }: AuthProviderProps) => {
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  // Check for an active session when the app loads
  useEffect(() => {
    const checkUser = async () => {
      try {
        console.log('Checking for existing session...');
        
        // First check directly for a session
        const { data: sessionData } = await supabase.auth.getSession();
        console.log('Session check:', sessionData?.session ? 'Active session found' : 'No active session');
        
        if (sessionData?.session?.user) {
          setUser({
            id: sessionData.session.user.id,
            email: sessionData.session.user.email,
          });
        } else {
          // Fallback to authService
          const currentUser = await authService.getCurrentUser();
          console.log('Current user from service:', currentUser);
          setUser(currentUser);
        }
      } catch (error) {
        console.error('Error checking user:', error);
      } finally {
        setIsLoading(false);
      }
    };
    
    checkUser();

    // Set up a listener for auth state changes
    const { data: authListener } = supabase.auth.onAuthStateChange(
      async (event, session) => {
        console.log('Auth event:', event, session ? 'Session exists' : 'No session');
        if (event === 'SIGNED_IN' && session?.user) {
          console.log('User signed in:', session.user.email);
          setUser({
            id: session.user.id,
            email: session.user.email,
          });
        } else if (event === 'SIGNED_OUT') {
          console.log('User signed out');
          setUser(null);
        } else if (event === 'TOKEN_REFRESHED' && session?.user) {
          console.log('Token refreshed');
          setUser({
            id: session.user.id,
            email: session.user.email,
          });
        }
      }
    );

    return () => {
      authListener.subscription.unsubscribe();
    };
  }, []);

  // Define the sign in function
  const signIn = async (email: string, password: string) => {
    setIsLoading(true);
    try {
      const result = await authService.signIn(email, password);
      if (result.success && result.user) {
        setUser({
          id: result.user.id,
          email: result.user.email,
        });
        return { success: true };
      }
      return { success: false, message: result.message || 'Failed to sign in' };
    } catch (error) {
      console.error('Error signing in:', error);
      return { 
        success: false, 
        message: error instanceof Error ? error.message : 'An unexpected error occurred' 
      };
    } finally {
      setIsLoading(false);
    }
  };

  // Define the sign up function
  const signUp = async (email: string, password: string) => {
    setIsLoading(true);
    try {
      const result = await authService.signUp(email, password);
      if (result.success) {
        return { success: true, message: 'Please check your email to confirm your account' };
      }
      return { success: false, message: result.message || 'Failed to sign up' };
    } catch (error) {
      console.error('Error signing up:', error);
      return { 
        success: false, 
        message: error instanceof Error ? error.message : 'An unexpected error occurred' 
      };
    } finally {
      setIsLoading(false);
    }
  };

  // Define the sign out function
  const signOut = async () => {
    setIsLoading(true);
    try {
      await authService.signOut();
      setUser(null);
    } catch (error) {
      console.error('Error signing out:', error);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <AuthContext.Provider value={{ user, isLoading, signIn, signUp, signOut }}>
      {children}
    </AuthContext.Provider>
  );
};
