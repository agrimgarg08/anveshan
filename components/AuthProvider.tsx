'use client';

import React, { createContext, useContext, useSyncExternalStore, useCallback } from 'react';

interface AuthContextType {
  authenticated: boolean;
  authReady: boolean;
  username: string | null;
  login: (username: string, password: string) => boolean;
  logout: () => void;
}

const AuthContext = createContext<AuthContextType>({
  authenticated: false,
  authReady: false,
  username: null,
  login: () => false,
  logout: () => {},
});

const subscribe = (callback: () => void) => {
  window.addEventListener('storage', callback);
  window.addEventListener('anveshan-auth-change', callback);
  return () => {
    window.removeEventListener('storage', callback);
    window.removeEventListener('anveshan-auth-change', callback);
  };
};

const getSnapshot = () => {
  return window.sessionStorage.getItem('anveshan-authenticated') === 'true';
};

const getUserSnapshot = () => {
  return window.sessionStorage.getItem('anveshan-username');
};

const getServerSnapshot = () => false;
const getServerUserSnapshot = () => null;

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const isClient = useSyncExternalStore(
    () => () => {},
    () => true,
    () => false
  );

  const authenticated = useSyncExternalStore(
    subscribe,
    getSnapshot,
    getServerSnapshot
  );

  const username = useSyncExternalStore(
    subscribe,
    getUserSnapshot,
    getServerUserSnapshot
  );

  const login = useCallback((user: string, pass: string): boolean => {
    if (user === 'admin' && pass === 'anveshan2026') {
      window.sessionStorage.setItem('anveshan-authenticated', 'true');
      window.sessionStorage.setItem('anveshan-username', user);
      window.dispatchEvent(new Event('anveshan-auth-change'));
      return true;
    }
    return false;
  }, []);

  const logout = useCallback(() => {
    window.sessionStorage.removeItem('anveshan-authenticated');
    window.sessionStorage.removeItem('anveshan-username');
    window.dispatchEvent(new Event('anveshan-auth-change'));
  }, []);

  return (
    <AuthContext.Provider value={{ authenticated, authReady: isClient, username, login, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  return useContext(AuthContext);
}
