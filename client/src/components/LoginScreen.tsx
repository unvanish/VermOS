import React, { useEffect, useRef, useState } from 'react';
import { api } from '../api';

interface Props {
  onLogin: (username: string) => void;
}

export default function LoginScreen({ onLogin }: Props) {
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    // Small delay so the animation completes before focusing
    const t = setTimeout(() => inputRef.current?.focus(), 400);
    return () => clearTimeout(t);
  }, []);

  const handleSubmit = async (e?: React.FormEvent) => {
    e?.preventDefault();
    if (!password.trim() || loading) return;
    setLoading(true);
    setError('');
    try {
      const result = await api.login('vermcool', password);
      onLogin(result.username);
    } catch {
      setError('The password is incorrect. Please try again.');
      setPassword('');
      setTimeout(() => inputRef.current?.focus(), 50);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{
      width: '100%', height: '100%', position: 'relative', overflow: 'hidden',
      background: 'linear-gradient(160deg, #050e22 0%, #0a1a38 40%, #081530 70%, #040c1c 100%)',
      display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
    }}>

      {/* Ambient bottom glow */}
      <div style={{
        position: 'absolute', bottom: 0, left: '50%', transform: 'translateX(-50%)',
        width: '80%', height: '40%',
        background: 'radial-gradient(ellipse at 50% 100%, rgba(24,80,200,0.22) 0%, transparent 70%)',
        pointerEvents: 'none',
      }} />

      {/* VermOS logo top */}
      <div style={{
        position: 'absolute', top: 44, left: '50%', transform: 'translateX(-50%)',
        textAlign: 'center', animation: 'fadeIn 0.6s ease-out',
      }}>
        <div style={{
          color: 'rgba(255,255,255,0.88)', fontSize: 34, fontWeight: 200,
          letterSpacing: 14, textShadow: '0 0 40px rgba(80,160,255,0.4)',
        }}>
          VermOS
        </div>
        <div style={{ color: 'rgba(255,255,255,0.3)', fontSize: 11, letterSpacing: 4, marginTop: 6 }}>
          GENERATIVE OPERATING SYSTEM
        </div>
      </div>

      {/* Login card */}
      <div style={{
        display: 'flex', flexDirection: 'column', alignItems: 'center',
        animation: 'slideUp 0.5s ease-out',
      }}>
        {/* User tile — Windows 7 style square avatar */}
        <div style={{
          width: 112, height: 112,
          background: 'linear-gradient(145deg, #3a6fbe, #1840a0)',
          border: '3px solid rgba(255,255,255,0.28)',
          borderRadius: 4,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          marginBottom: 14,
          boxShadow: '0 6px 28px rgba(0,0,0,0.6), 0 0 0 1px rgba(255,255,255,0.08), 0 0 30px rgba(40,100,220,0.2)',
        }}>
          <svg width="64" height="64" viewBox="0 0 64 64" fill="none">
            <circle cx="32" cy="24" r="15" fill="rgba(255,255,255,0.88)"/>
            <ellipse cx="32" cy="60" rx="24" ry="17" fill="rgba(255,255,255,0.88)"/>
          </svg>
        </div>

        {/* Username label */}
        <div style={{
          color: 'white', fontSize: 17, fontWeight: 300, letterSpacing: 1,
          marginBottom: 18, textShadow: '0 1px 4px rgba(0,0,0,0.6)',
        }}>
          vermcool
        </div>

        {/* Password form */}
        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 10 }}>
          <div style={{ display: 'flex', alignItems: 'stretch', boxShadow: '0 2px 12px rgba(0,0,0,0.4)' }}>
            <input
              ref={inputRef}
              type="password"
              value={password}
              onChange={e => setPassword(e.target.value)}
              placeholder="Password"
              disabled={loading}
              style={{
                width: 210, height: 34,
                background: 'rgba(255,255,255,0.12)',
                backdropFilter: 'blur(12px)',
                border: '1px solid rgba(255,255,255,0.35)',
                borderRight: 'none',
                borderRadius: '3px 0 0 3px',
                color: 'white', fontSize: 13, padding: '0 12px',
                outline: 'none',
                fontFamily: 'inherit',
              }}
              onFocus={e => { e.currentTarget.style.background = 'rgba(255,255,255,0.18)'; e.currentTarget.style.borderColor = 'rgba(100,180,255,0.6)'; }}
              onBlur={e => { e.currentTarget.style.background = 'rgba(255,255,255,0.12)'; e.currentTarget.style.borderColor = 'rgba(255,255,255,0.35)'; }}
            />
            <button
              type="submit"
              disabled={loading || !password.trim()}
              style={{
                width: 34, height: 34,
                background: loading || !password.trim()
                  ? 'rgba(255,255,255,0.08)'
                  : 'linear-gradient(180deg, rgba(255,255,255,0.28) 0%, rgba(255,255,255,0.14) 100%)',
                border: '1px solid rgba(255,255,255,0.35)',
                borderRadius: '0 3px 3px 0',
                cursor: loading ? 'wait' : !password.trim() ? 'not-allowed' : 'pointer',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                color: 'white', fontSize: 17, opacity: !password.trim() ? 0.4 : 1,
                transition: 'all 0.15s',
              }}
              title="Log in"
            >
              {loading ? (
                <span style={{ fontSize: 11, animation: 'blink 1s infinite' }}>...</span>
              ) : '→'}
            </button>
          </div>

          {error && (
            <div style={{
              color: '#ffb8b8', fontSize: 12, maxWidth: 260, textAlign: 'center',
              background: 'rgba(180,0,0,0.25)', padding: '7px 14px', borderRadius: 3,
              border: '1px solid rgba(255,80,80,0.35)',
              animation: 'slideUp 0.2s ease-out',
            }}>
              {error}
            </div>
          )}

          <div style={{ color: 'rgba(255,255,255,0.35)', fontSize: 11, marginTop: 2, cursor: 'pointer' }}>
            Hint: Try your VermOS password
          </div>
        </form>
      </div>

      {/* Bottom bar */}
      <div style={{
        position: 'absolute', bottom: 0, left: 0, right: 0,
        height: 52,
        background: 'linear-gradient(180deg, transparent 0%, rgba(0,0,0,0.55) 100%)',
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        padding: '0 28px',
        borderTop: '1px solid rgba(255,255,255,0.04)',
      }}>
        <span style={{ color: 'rgba(255,255,255,0.35)', fontSize: 11 }}>VermOS • Prototype Build</span>
        <div style={{ display: 'flex', gap: 8 }}>
          {['⏻', '↺'].map((icon, i) => (
            <button key={i} style={bottomBtnStyle} title={i === 0 ? 'Shut down' : 'Restart'}>
              {icon}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}

const bottomBtnStyle: React.CSSProperties = {
  background: 'none',
  border: '1px solid rgba(255,255,255,0.18)',
  color: 'rgba(255,255,255,0.55)',
  width: 28, height: 28, borderRadius: 3,
  cursor: 'pointer', fontSize: 14,
  display: 'flex', alignItems: 'center', justifyContent: 'center',
};
