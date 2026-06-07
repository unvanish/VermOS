import React, { useEffect, useState } from 'react';
import type { WindowState } from '../types';
import { useWindowsStore } from '../hooks/useWindows';

const APP_ICONS: Record<string, string> = {
  calculator: '🧮', notepad: '📝', browser: '🌐',
  paint: '🎨', terminal: '⌨️', custom: '💾',
};

interface Props {
  windows: WindowState[];
  onStartClick: () => void;
  startMenuOpen: boolean;
  username: string;
}

export default function Taskbar({ windows, onStartClick, startMenuOpen, username }: Props) {
  const { focusWindow, restoreWindow } = useWindowsStore();
  const [time, setTime] = useState(getTime);
  const [date, setDate] = useState(getDate);

  useEffect(() => {
    const t = setInterval(() => { setTime(getTime()); setDate(getDate()); }, 1000);
    return () => clearInterval(t);
  }, []);

  const handleWinBtn = (win: WindowState) => {
    if (win.minimized) restoreWindow(win.id);
    else focusWindow(win.id);
  };

  return (
    <div style={{
      position: 'fixed', bottom: 0, left: 0, right: 0, height: 40, zIndex: 9999,
      background: 'rgba(0,0,0,0.72)',
      backdropFilter: 'blur(22px)',
      borderTop: '1px solid rgba(255,255,255,0.16)',
      display: 'flex', alignItems: 'stretch',
      boxShadow: '0 -2px 16px rgba(0,0,0,0.45)',
    }}>

      {/* Start (VermOS) button */}
      <button
        data-startmenu="true"
        onClick={e => { e.stopPropagation(); onStartClick(); }}
        style={{
          padding: '0 18px',
          background: startMenuOpen
            ? 'linear-gradient(180deg, #082c7a 0%, #113a96 100%)'
            : 'linear-gradient(180deg, #1e6cd4 0%, #1050bc 45%, #0a3c9a 100%)',
          border: 'none',
          borderRight: '1px solid rgba(255,255,255,0.1)',
          color: 'white',
          fontWeight: 700, fontSize: 13,
          cursor: 'pointer',
          fontFamily: "'Segoe UI', Tahoma, sans-serif",
          letterSpacing: 2,
          textShadow: '0 1px 3px rgba(0,0,0,0.7)',
          display: 'flex', alignItems: 'center', gap: 7,
          flexShrink: 0, position: 'relative', overflow: 'hidden',
          boxShadow: startMenuOpen
            ? 'inset 0 3px 10px rgba(0,0,0,0.5)'
            : 'inset 0 1px 0 rgba(255,255,255,0.2)',
          transition: 'all 0.12s',
        }}
      >
        {/* Gloss overlay */}
        <div style={{
          position: 'absolute', top: 0, left: 0, right: 0, height: '48%',
          background: 'linear-gradient(180deg, rgba(255,255,255,0.22) 0%, rgba(255,255,255,0.04) 100%)',
          pointerEvents: 'none',
        }} />
        <span style={{ fontSize: 15, position: 'relative', zIndex: 1 }}>⊞</span>
        <span style={{ position: 'relative', zIndex: 1 }}>VermOS</span>
      </button>

      {/* Window buttons */}
      <div style={{
        flex: 1, display: 'flex', alignItems: 'center',
        padding: '4px 6px', gap: 3, overflow: 'hidden',
      }}>
        {windows.map(win => (
          <TaskbarBtn key={win.id} win={win} onClick={() => handleWinBtn(win)} />
        ))}
      </div>

      {/* System tray */}
      <div style={{
        display: 'flex', alignItems: 'center',
        borderLeft: '1px solid rgba(255,255,255,0.1)',
        flexShrink: 0,
      }}>
        <TrayIcon title="VermOS Network">📶</TrayIcon>
        <TrayIcon title="Volume">🔊</TrayIcon>
        <TrayIcon title="Action Center">🛡️</TrayIcon>

        {/* Clock */}
        <div
          title={`${username} • VermOS`}
          style={{
            padding: '0 12px', color: 'white', fontSize: 11,
            textAlign: 'right', cursor: 'default', lineHeight: 1.5,
            display: 'flex', flexDirection: 'column', justifyContent: 'center',
          }}
        >
          <span style={{ fontWeight: 400 }}>{time}</span>
          <span style={{ opacity: 0.65, fontSize: 10 }}>{date}</span>
        </div>

        {/* Show desktop strip (Windows 7 signature element) */}
        <div
          title="Show desktop"
          style={{
            width: 7, height: '100%',
            background: 'rgba(255,255,255,0.06)',
            borderLeft: '1px solid rgba(255,255,255,0.12)',
            cursor: 'pointer',
            transition: 'background 0.1s',
          }}
          onMouseEnter={e => (e.currentTarget.style.background = 'rgba(255,255,255,0.16)')}
          onMouseLeave={e => (e.currentTarget.style.background = 'rgba(255,255,255,0.06)')}
        />
      </div>
    </div>
  );
}

function TaskbarBtn({ win, onClick }: { win: WindowState; onClick: () => void }) {
  const [hovered, setHovered] = useState(false);
  return (
    <button
      onClick={onClick}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      title={win.title}
      style={{
        height: 32, maxWidth: 168, minWidth: 48,
        padding: '0 10px',
        background: hovered
          ? 'rgba(255,255,255,0.22)'
          : win.minimized
          ? 'rgba(255,255,255,0.05)'
          : 'rgba(255,255,255,0.13)',
        border: `1px solid ${hovered ? 'rgba(255,255,255,0.28)' : 'rgba(255,255,255,0.14)'}`,
        borderRadius: 3,
        cursor: 'pointer',
        color: 'white', fontSize: 11,
        fontFamily: "'Segoe UI', Tahoma, sans-serif",
        display: 'flex', alignItems: 'center', gap: 5,
        overflow: 'hidden',
        flexShrink: 0,
        opacity: win.minimized ? 0.65 : 1,
        boxShadow: hovered
          ? '0 0 10px rgba(100,180,255,0.25), inset 0 1px 0 rgba(255,255,255,0.2)'
          : 'inset 0 1px 0 rgba(255,255,255,0.1)',
        transition: 'all 0.1s',
        position: 'relative',
      }}
    >
      {/* Top glass line */}
      <div style={{
        position: 'absolute', top: 0, left: 0, right: 0, height: 1,
        background: 'rgba(255,255,255,0.25)', pointerEvents: 'none',
      }} />
      <span style={{ fontSize: 13, flexShrink: 0 }}>{APP_ICONS[win.appKind] ?? '📱'}</span>
      <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', flex: 1, textAlign: 'left' }}>
        {win.title}
      </span>
    </button>
  );
}

function TrayIcon({ children, title }: { children: React.ReactNode; title: string }) {
  const [hovered, setHovered] = useState(false);
  return (
    <div
      title={title}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        width: 26, height: '100%',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        fontSize: 13, cursor: 'default', color: 'white', opacity: 0.8,
        background: hovered ? 'rgba(255,255,255,0.1)' : 'transparent',
        transition: 'background 0.1s',
      }}
    >
      {children}
    </div>
  );
}

function getTime() {
  return new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}
function getDate() {
  return new Date().toLocaleDateString([], { month: 'numeric', day: 'numeric', year: 'numeric' });
}
