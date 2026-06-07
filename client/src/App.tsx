import React, { useEffect, useState } from 'react';
import { api } from './api';
import LoginScreen from './components/LoginScreen';
import Desktop from './components/Desktop';
import type { AuthState, DebugInfo } from './types';

export default function App() {
  const [auth, setAuth] = useState<AuthState>({ authenticated: false, username: null, loading: true });
  const [debug, setDebug] = useState<DebugInfo>({
    model: 'deepseek/deepseek-v4-flash',
    username: null,
    lastGenTime: null,
    generationCount: 0,
  });

  // Restore session on load — avoids login flash for already-authenticated users
  useEffect(() => {
    api.me()
      .then(data => {
        setAuth({ authenticated: data.authenticated, username: data.username ?? null, loading: false });
        if (data.authenticated && data.username) {
          setDebug(d => ({ ...d, username: data.username ?? null }));
        }
      })
      .catch(() => {
        setAuth({ authenticated: false, username: null, loading: false });
      });
  }, []);

  const handleLogin = (username: string) => {
    setAuth({ authenticated: true, username, loading: false });
    setDebug(d => ({ ...d, username }));
  };

  const handleLogout = async () => {
    try { await api.logout(); } catch { /* ignore */ }
    setAuth({ authenticated: false, username: null, loading: false });
    setDebug(d => ({ ...d, username: null, lastGenTime: null, generationCount: 0 }));
  };

  const handleGenerated = () => {
    setDebug(d => ({
      ...d,
      lastGenTime: new Date().toLocaleTimeString(),
      generationCount: d.generationCount + 1,
    }));
  };

  if (auth.loading) {
    return (
      <div style={{
        width: '100%', height: '100%',
        background: 'linear-gradient(160deg, #1b3f7a 0%, #2563b0 30%, #1a4f99 60%, #0f3070 100%)',
        display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 20,
      }}>
        <div style={{ color: 'rgba(255,255,255,0.9)', fontSize: 36, fontWeight: 200, letterSpacing: 14 }}>VermOS</div>
        <div style={{ width: 220, height: 5, background: 'rgba(255,255,255,0.15)', borderRadius: 3, overflow: 'hidden' }}>
          <div style={{
            width: '45%', height: '100%',
            background: 'linear-gradient(90deg, transparent, rgba(255,255,255,0.8), transparent)',
            animation: 'vermos-progress 1.4s ease-in-out infinite',
          }} />
        </div>
      </div>
    );
  }

  if (!auth.authenticated) {
    return <LoginScreen onLogin={handleLogin} />;
  }

  return (
    <Desktop
      username={auth.username!}
      debug={debug}
      onLogout={handleLogout}
      onGenerated={handleGenerated}
    />
  );
}
