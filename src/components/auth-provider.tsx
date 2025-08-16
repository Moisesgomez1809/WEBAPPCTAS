
"use client";

import { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { goOffline } from 'firebase/database';
import { database as getDb, auth as getAuthInstance } from '@/lib/firebase';
import { onAuthStateChanged, signOut, User } from 'firebase/auth';

interface AuthContextType {
  isAuthenticated: boolean;
  user: User | null;
  login: (user: User) => void; // Accept user object from Firebase Auth
  logout: () => void;
  isLoading: boolean;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export default function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const auth = getAuthInstance();
    // onAuthStateChanged is the key to session persistence.
    // It fires once on load, and again whenever the auth state changes.
    const unsubscribe = onAuthStateChanged(auth, (firebaseUser) => {
      if (firebaseUser) {
        // User is signed in.
        setUser(firebaseUser);
      } else {
        // User is signed out.
        setUser(null);
        const db = getDb();
        goOffline(db); // Ensure DB connection is closed if not authenticated.
      }
      setIsLoading(false);
    });

    // Cleanup subscription on unmount
    return () => unsubscribe();
  }, []);

  const login = (firebaseUser: User) => {
    // This function is now mostly for semantic purposes in the login page,
    // as onAuthStateChanged is the source of truth for the user state.
    setUser(firebaseUser);
    // No need to call goOnline() here, it's handled implicitly when data is requested.
  };

  const logout = async () => {
    try {
        const auth = getAuthInstance();
        await signOut(auth); // This will trigger onAuthStateChanged, which will set user to null.
        
        // Explicitly close the Firebase database connection.
        const db = getDb();
        goOffline(db);
        
        // Also clear any local data
        localStorage.removeItem('reverse-sides-db');
        localStorage.removeItem('fusionCount');
        localStorage.removeItem('dailyFusionStats');
        localStorage.removeItem('weeklyGoal');
        localStorage.removeItem('isGoalLocked');
    } catch (error) {
        console.error("Error signing out: ", error);
    }
  };

  return (
    <AuthContext.Provider value={{ isAuthenticated: !!user, user, login, logout, isLoading }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}

    