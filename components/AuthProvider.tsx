'use client';

import React, { createContext, useContext, useSyncExternalStore, useCallback } from 'react';

interface AuthContextType {
  authenticated: boolean;
  authReady: boolean;
  login: (username: string, password: string) => boolean;
  logout: () => void;
}

const AuthContext = createContext<AuthContextType>({
  authenticated: false,
  authReady: false,
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

const getServerSnapshot = () => {
  return false;
};

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

  const login = useCallback((username: string, password: string): boolean => {
    if (username === 'admin' && password === 'anveshan2026') {
      window.sessionStorage.setItem('anveshan-authenticated', 'true');
      window.dispatchEvent(new Event('anveshan-auth-change'));
      return true;
    }
    return false;
  }, []);

  const logout = useCallback(() => {
    window.sessionStorage.removeItem('anveshan-authenticated');
    window.dispatchEvent(new Event('anveshan-auth-change'));
  }, []);

  return (
    <AuthContext.Provider value={{ authenticated, authReady: isClient, login, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  return useContext(AuthContext);
}
