import { createContext, useContext, useEffect, useState, ReactNode } from 'react';
import { api, type User, type AuthResponse, clearAuth } from '../services/api';

interface AuthContextValue {
  user: User | null;
  token: string | null;
  loading: boolean;
  login: (email: string, password: string) => Promise<void>;
  register: (email: string, password: string, displayName?: string) => Promise<void>;
  logout: () => Promise<void>;
  refreshUser: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [token, setToken] = useState<string | null>(() => {
    try {
      return localStorage.getItem('nagrik.auth.token');
    } catch {
      return null;
    }
  });
  const [loading, setLoading] = useState(true);

  async function refreshUser() {
    if (!token) {
      setUser(null);
      setLoading(false);
      return;
    }
    try {
      const { user: userData } = await api.me();
      setUser(userData);
    } catch {
      clearAuth();
      setToken(null);
      setUser(null);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    let mounted = true;
    const timeoutId = setTimeout(() => {
      if (mounted && loading) {
        console.warn('Auth loading timeout - forcing loading=false');
        setLoading(false);
      }
    }, 5000);

    refreshUser();

    return () => {
      mounted = false;
      clearTimeout(timeoutId);
    };
  }, [token]);

  async function login(email: string, password: string) {
    const { user: userData, token: newToken } = await api.login(email, password);
    setToken(newToken);
    localStorage.setItem('nagrik.auth.token', newToken);
    setUser(userData);
  }

  async function register(email: string, password: string, displayName?: string) {
    const { user: userData, token: newToken } = await api.register(email, password, displayName);
    setToken(newToken);
    localStorage.setItem('nagrik.auth.token', newToken);
    setUser(userData);
  }

  async function logout() {
    try {
      await api.logout();
    } finally {
      clearAuth();
      setToken(null);
      setUser(null);
    }
  }

  return (
    <AuthContext.Provider value={{ user, token, loading, login, register, logout, refreshUser }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) throw new Error('useAuth must be used within AuthProvider');
  return context;
}