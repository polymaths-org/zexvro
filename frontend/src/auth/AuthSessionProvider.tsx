import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import AuthOverlay from '../components/auth/AuthOverlay';
import CliActivation from '../components/auth/CliActivation';
import { globalSignOut, type UserSession } from './cognito';

const API_BASE_URL = import.meta.env.VITE_API_URL ||
  ((window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1')
    ? 'http://localhost:8080'
    : 'https://qkuostruh3.execute-api.us-east-1.amazonaws.com');

interface AuthSessionContextValue {
  userSession: UserSession;
  cliConnected: boolean;
  cliLastActive: number | null;
  signOut: () => Promise<void>;
}

const AuthSessionContext = createContext<AuthSessionContextValue | null>(null);

function isUsableSession(value: unknown): value is UserSession {
  if (!value || typeof value !== 'object') return false;
  const session = value as Partial<UserSession>;
  return (
    typeof session.username === 'string' &&
    typeof session.token === 'string' &&
    session.token.split('.').length === 3 &&
    !session.token.startsWith('prod_jwt_token_')
  );
}

function loadSession() {
  const saved = localStorage.getItem('zexvro_user_session');
  if (!saved) return null;

  try {
    const parsed: unknown = JSON.parse(saved);
    if (isUsableSession(parsed)) return parsed;
  } catch {
    // Invalid local auth state is cleared below.
  }

  localStorage.removeItem('zexvro_user_session');
  return null;
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

  useEffect(() => {
    if (!userSession) {
      setCliConnected(false);
      setCliLastActive(null);
      return;
    }

    let cancelled = false;
    const checkCliStatus = async () => {
      try {
        const response = await fetch(`${API_BASE_URL}/api/memory`, {
          headers: { Authorization: `Bearer ${userSession.token}` },
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
      localStorage.removeItem('zexvro_user_session');
      setUserSession(null);
      navigate('/overview', { replace: true });
    }
  }, [navigate, userSession?.token]);

  if (!userSession) {
    return <AuthOverlay onSuccess={setUserSession} />;
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
