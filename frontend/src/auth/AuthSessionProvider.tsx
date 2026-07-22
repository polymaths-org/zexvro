import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import AuthOverlay from '../components/auth/AuthOverlay';
import CliActivation from '../components/auth/CliActivation';
import {
  clearStoredSession,
  ensureValidAccessToken,
  globalSignOut,
  isAccessTokenExpired,
  persistSession,
  readStoredSession,
  type UserSession,
} from './cognito';

const API_BASE_URL = import.meta.env.VITE_API_URL ||
  'https://qkuostruh3.execute-api.us-east-1.amazonaws.com';

interface AuthSessionContextValue {
  userSession: UserSession;
  cliConnected: boolean;
  cliLastActive: number | null;
  signOut: () => Promise<void>;
}

const AuthSessionContext = createContext<AuthSessionContextValue | null>(null);

function loadSession() {
  return readStoredSession();
}

export function AuthSessionProvider({ children }: { children: React.ReactNode }) {
  const [userSession, setUserSession] = useState<UserSession | null>(loadSession);
  const [cliConnected, setCliConnected] = useState(false);
  const [cliLastActive, setCliLastActive] = useState<number | null>(null);
  const location = useLocation();
  const navigate = useNavigate();

  const activationCode = useMemo(() => {
    const params = new URLSearchParams(location.search);
    const code = params.get('code') || params.get('activate');
    return code?.toUpperCase() || null;
  }, [location.search]);

  // Keep Cognito access token fresh so NFT API never sees an expired JWT.
  useEffect(() => {
    if (!userSession) return;
    let cancelled = false;

    const sync = async () => {
      try {
        if (isAccessTokenExpired(userSession.token)) {
          await ensureValidAccessToken(userSession);
          const next = readStoredSession();
          if (!cancelled && next) setUserSession(next);
        }
      } catch {
        if (!cancelled) {
          clearStoredSession();
          setUserSession(null);
        }
      }
    };

    void sync();
    const interval = window.setInterval(() => {
      void sync();
    }, 5 * 60_000);
    return () => {
      cancelled = true;
      window.clearInterval(interval);
    };
  }, [userSession]);

  useEffect(() => {
    if (!userSession) {
      setCliConnected(false);
      setCliLastActive(null);
      return;
    }

    let cancelled = false;
    const checkCliStatus = async () => {
      try {
        let token = userSession.token;
        if (isAccessTokenExpired(token)) {
          token = await ensureValidAccessToken(userSession);
          const next = readStoredSession();
          if (next && !cancelled) setUserSession(next);
        }
        const response = await fetch(`${API_BASE_URL}/api/memory`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        if (!response.ok || cancelled) return;

        const data = await response.json();
        const connected = Boolean(data.memory?.cli_connected);
        setCliConnected(connected);
        setCliLastActive(connected && typeof data.memory?.cli_last_active === 'number'
          ? data.memory.cli_last_active
          : null);
      } catch (error) {
        if (!cancelled) console.error('Error checking CLI status:', error);
      }
    };

    void checkCliStatus();
    const interval = window.setInterval(checkCliStatus, 5000);
    return () => {
      cancelled = true;
      window.clearInterval(interval);
    };
  }, [userSession]);

  const signOut = useCallback(async () => {
    try {
      await globalSignOut(userSession?.token);
    } finally {
      clearStoredSession();
      setUserSession(null);
      navigate('/overview', { replace: true });
    }
  }, [navigate, userSession?.token]);

  const handleAuthSuccess = useCallback((session: UserSession) => {
    persistSession(session);
    setUserSession(session);
  }, []);

  if (!userSession) {
    return <AuthOverlay onSuccess={handleAuthSuccess} />;
  }

  if (activationCode) {
    return (
      <CliActivation
        code={activationCode}
        token={userSession.idToken || userSession.token}
        apiBaseUrl={API_BASE_URL}
        onClose={() => {
          const params = new URLSearchParams(location.search);
          params.delete('code');
          params.delete('activate');
          const search = params.toString();
          navigate(`${location.pathname}${search ? `?${search}` : ''}`, { replace: true });
        }}
      />
    );
  }

  return (
    <AuthSessionContext.Provider value={{ userSession, cliConnected, cliLastActive, signOut }}>
      {children}
    </AuthSessionContext.Provider>
  );
}

export function useAuthSession() {
  const context = useContext(AuthSessionContext);
  if (!context) throw new Error('useAuthSession must be used inside AuthSessionProvider');
  return context;
}
