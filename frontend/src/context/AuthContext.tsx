import React, {
  createContext,
  useContext,
  useState,
  useCallback,
  useEffect,
  ReactNode,
} from 'react';
import { apiClient, setAuthToken } from '@/api/client';

const AUTH_TOKEN_KEY = 'auth_token';
const AUTH_USER_KEY = 'auth_user';

export interface User {
  id: string;
  email: string;
  name: string | null;
  role?: string;
  organizationId?: string;
}

export type SignupResult = { success: true } | { success: false; error: string };

interface AuthContextType {
  user: User | null;
  isAuthenticated: boolean;
  authLoading: boolean;
  login: (email: string, password: string) => Promise<boolean>;
  signup: (name: string, email: string, password: string, organizationName: string) => Promise<SignupResult>;
  setAuth: (token: string, user: User) => void;
  logout: () => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

function persistAuth(token: string, user: User): void {
  localStorage.setItem(AUTH_TOKEN_KEY, token);
  localStorage.setItem(AUTH_USER_KEY, JSON.stringify(user));
}

function clearPersistedAuth(): void {
  localStorage.removeItem(AUTH_TOKEN_KEY);
  localStorage.removeItem(AUTH_USER_KEY);
}

export const AuthProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [authLoading, setAuthLoading] = useState(true);

  useEffect(() => {
    const token = localStorage.getItem(AUTH_TOKEN_KEY);
    if (!token) {
      setAuthLoading(false);
      return;
    }
    setAuthToken(token);
    apiClient
      .get<User>('/api/auth/me')
      .then((res) => {
        const userData = res.data;
        setUser(userData);
        persistAuth(token, userData);
      })
      .catch(() => {
        setAuthToken(null);
        clearPersistedAuth();
        setUser(null);
      })
      .finally(() => {
        setAuthLoading(false);
      });
  }, []);

  const login = useCallback(async (email: string, password: string): Promise<boolean> => {
    try {
      const res = await apiClient.post<{ token: string; user: User }>('/api/auth/login', {
        email,
        password,
      });
      const { token, user: userData } = res.data;
      setAuthToken(token);
      setUser(userData);
      persistAuth(token, userData);
      return true;
    } catch {
      return false;
    }
  }, []);

  const signup = useCallback(
    async (
      name: string,
      email: string,
      password: string,
      organizationName: string
    ): Promise<SignupResult> => {
      try {
        const res = await apiClient.post<{ token: string; user: User }>('/api/auth/register', {
          name,
          email,
          password,
          organizationName: organizationName.trim(),
        });
        const { token, user: userData } = res.data;
        setAuthToken(token);
        setUser(userData);
        persistAuth(token, userData);
        return { success: true };
      } catch (err: unknown) {
        const axiosErr = err as { response?: { status: number; data?: { error?: string } } };
        const message =
          axiosErr.response?.status === 409 && axiosErr.response?.data?.error
            ? axiosErr.response.data.error
            : undefined;
        return { success: false, error: message ?? 'Signup failed' };
      }
    },
    []
  );

  const setAuth = useCallback((token: string, userData: User) => {
    setAuthToken(token);
    setUser(userData);
    persistAuth(token, userData);
  }, []);

  const logout = useCallback(() => {
    setAuthToken(null);
    clearPersistedAuth();
    setUser(null);
  }, []);

  return (
    <AuthContext.Provider
      value={{
        user,
        isAuthenticated: !!user,
        authLoading,
        login,
        signup,
        setAuth,
        logout,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};
