
"use client";

import { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { goOffline } from 'firebase/database';
import { database } from '@/lib/firebase';

interface AuthContextType {
  isAuthenticated: boolean;
  user: { username: string; token: string } | null;
  login: (username: string, token: string) => void;
  logout: () => void;
  isLoading: boolean;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export default function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<{ username: string; token: string } | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    try {
      const storedUser = localStorage.getItem('user');
      if (storedUser) {
        setUser(JSON.parse(storedUser));
      } else {
        goOffline(database);
      }
    } catch (e) {
      console.error("Failed to parse user from localStorage", e);
      localStorage.removeItem('user');
      goOffline(database);
    } finally {
      setIsLoading(false);
    }
  }, []);

  const login = (username: string, token: string) => {
    const userData = { username, token };
    setUser(userData);
    localStorage.setItem('user', JSON.stringify(userData));
    // The database guard will implicitly handle going online when it needs to fetch data.
    // No need to call goOnline() here, to prevent multiple connections on hot-reloads.
  };

  const logout = () => {
    // Explicitly close the Firebase connection.
    goOffline(database);
    
    setUser(null);
    localStorage.removeItem('user');
    localStorage.removeItem('reverse-sides-db'); // Also clear the DB on logout
    localStorage.removeItem('fusionCount');
    localStorage.removeItem('folioCount');
    localStorage.removeItem('frameCount');
    localStorage.removeItem('metadataCount');
    localStorage.removeItem('totalProfit');
    localStorage.removeItem('totalProviderCost');
    localStorage.removeItem('weeklyGoal');
    localStorage.removeItem('isGoalLocked');

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
