import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { authApi, householdsApi, setForceLogoutCallback, UserInfo, HouseholdInfo } from '../services/api';
import { authStorage } from '../services/authStorage';

interface AuthState {
  user: UserInfo | null;
  household: HouseholdInfo | null;
  loading: boolean;
}

interface AuthContextValue extends AuthState {
  login: (email: string, password: string) => Promise<void>;
  register: (name: string, email: string, password: string) => Promise<void>;
  resetPassword: (email: string, name: string, newPassword: string) => Promise<void>;
  logout: () => Promise<void>;
  refreshHousehold: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [state, setState] = useState<AuthState>({ user: null, household: null, loading: true });

  useEffect(() => {
    setForceLogoutCallback(() => {
      setState({ user: null, household: null, loading: false });
    });
    _bootstrap();
  }, []);

  async function _bootstrap() {
    try {
      const token = await authStorage.getAccessToken();
      if (!token) {
        setState({ user: null, household: null, loading: false });
        return;
      }
      const { data: user } = await authApi.me();
      let household: HouseholdInfo | null = null;
      try {
        const res = await householdsApi.me();
        household = res.data;
      } catch {}
      setState({ user, household, loading: false });
    } catch {
      await authStorage.clearTokens();
      setState({ user: null, household: null, loading: false });
    }
  }

  const login = useCallback(async (email: string, password: string) => {
    await authStorage.clearTokens();
    const { data } = await authApi.login(email, password);
    await authStorage.saveTokens(data.access_token, data.refresh_token);
    const { data: user } = await authApi.meWithToken(data.access_token);
    let household: HouseholdInfo | null = null;
    try {
      const res = await householdsApi.me();
      household = res.data;
    } catch {}
    setState({ user, household, loading: false });
  }, []);

  const register = useCallback(async (name: string, email: string, password: string) => {
    await authStorage.clearTokens();
    const { data } = await authApi.register(name, email, password);
    await authStorage.saveTokens(data.access_token, data.refresh_token);
    const { data: user } = await authApi.meWithToken(data.access_token);
    setState({ user, household: null, loading: false });
  }, []);

  const resetPassword = useCallback(async (email: string, name: string, newPassword: string) => {
    await authStorage.clearTokens();
    const { data } = await authApi.resetPassword(email, name, newPassword);
    await authStorage.saveTokens(data.access_token, data.refresh_token);
    const { data: user } = await authApi.meWithToken(data.access_token);
    let household: HouseholdInfo | null = null;
    try {
      const res = await householdsApi.me();
      household = res.data;
    } catch {}
    setState({ user, household, loading: false });
  }, []);

  const logout = useCallback(async () => {
    await authStorage.clearTokens();
    setState({ user: null, household: null, loading: false });
  }, []);

  const refreshHousehold = useCallback(async () => {
    try {
      const { data } = await householdsApi.me();
      setState((s) => ({ ...s, household: data }));
    } catch {}
  }, []);

  const value = useMemo(
    () => ({ ...state, login, register, resetPassword, logout, refreshHousehold }),
    [state, login, register, resetPassword, logout, refreshHousehold],
  );

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}
