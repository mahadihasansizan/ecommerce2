'use client';

import { createContext, ReactNode, useContext, useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { AuthSession, login as loginRequest, refreshCustomer, signup as signupRequest } from '@/services/auth';

type AuthContextValue = {
  session: AuthSession | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  login: (username: string, password: string) => Promise<void>;
  signup: (payload: {
    email: string;
    username: string;
    password: string;
    firstName?: string;
    lastName?: string;
  }) => Promise<void>;
  logout: () => void;
};

const STORAGE_KEY = 'kh-auth-session';

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

export const AuthProvider = ({ children }: { children: ReactNode }) => {
  const router = useRouter();
  const [session, setSession] = useState<AuthSession | null>(null);

  useEffect(() => {
    if (typeof window === 'undefined') {
      return;
    }

    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved) {
        setSession(JSON.parse(saved) as AuthSession);
      }
    } catch (e) {
      console.warn('Failed to parse stored session', e);
    }
  }, []);

  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    if (typeof window === 'undefined') {
      return;
    }

    if (session) {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(session));
    } else {
      localStorage.removeItem(STORAGE_KEY);
    }
  }, [session]);

  // Refresh customer details in the background when we know the email
  useEffect(() => {
    if (!session?.email) return;

    refreshCustomer(session.email)
      .then((customer) => {
        if (!customer) return;

        setSession((prev) =>
          prev
            ? {
                ...prev,
                customerId: customer.id,
                firstName: customer.first_name || prev.firstName,
                lastName: customer.last_name || prev.lastName,
                avatarUrl: customer.avatar_url || prev.avatarUrl,
              }
            : prev,
        );
      })
      .catch((err) => {
        console.warn('Failed to refresh customer session', err);
      });
  }, [session?.email]);

  const login = async (username: string, password: string) => {
    setIsLoading(true);
    try {
      const data = await loginRequest(username, password);
      setSession(data);
    } finally {
      setIsLoading(false);
    }
  };

  const signup = async (payload: {
    email: string;
    username: string;
    password: string;
    firstName?: string;
    lastName?: string;
  }) => {
    setIsLoading(true);
    try {
      const data = await signupRequest(payload);
      setSession(data);
    } finally {
      setIsLoading(false);
    }
  };

  const logout = () => {
    setSession(null);
    router.replace('/');
  };

  const value = useMemo<AuthContextValue>(
    () => ({
      session,
      isAuthenticated: !!session,
      isLoading,
      login,
      signup,
      logout,
    }),
    [session, isLoading],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) {
    throw new Error('useAuth must be used within AuthProvider');
  }
  return ctx;
}
