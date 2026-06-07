import React, { useCallback, useEffect, useState } from 'react';
import { useWindowsStore } from '../hooks/useWindows';
import { api } from '../api';
import Taskbar from './Taskbar';
import StartMenu from './StartMenu';
import AppWindow from './AppWindow';
import DesktopIcon from './DesktopIcon';
import DebugPanel from './DebugPanel';
import type { DebugInfo } from '../types';

interface Props {
  username: string;
  debug: DebugInfo;
  onLogout: () => void;
  onGenerated: () => void;
}

const DESKTOP_ICONS = [
  { id: 'calculator', label: 'Calculator', icon: '🧮', appKind: 'calculator' },
  { id: 'notepad', label: 'Notepad', icon: '📝', appKind: 'notepad' },
  { id: 'browser', label: 'Internet\nExplorer', icon: '🌐', appKind: 'browser' },
  { id: 'paint', label: 'Paint', icon: '🎨', appKind: 'paint' },
  { id: 'terminal', label: 'Command\nPrompt', icon: '⌨️', appKind: 'terminal' },
  { id: 'recycle', label: 'Recycle Bin', icon: '🗑️', appKind: 'custom', prompt: 'Windows 7 Recycle Bin — show deleted files that can be restored' },
] as const;

export default function Desktop({ username, debug, onLogout, onGenerated }: Props) {
  const { windows, openWindow, setWindowData, setWindowLoading, setWindowError } = useWindowsStore();
  const [startMenuOpen, setStartMenuOpen] = useState(false);

  // Close start menu when clicking anywhere outside it
  // Use 'mousedown' but check if the click target is inside the menu first
  useEffect(() => {
    const close = (e: MouseEvent) => {
      // Don't close if the click originated inside the start menu itself
      const menu = document.querySelector('[data-startmenu]');
      if (menu && menu.contains(e.target as Node)) return;
      setStartMenuOpen(false);
    };
    document.addEventListener('mousedown', close);
    return () => document.removeEventListener('mousedown', close);
  }, []);

  const handleOpenApp = useCallback(async (appKind: string, prompt?: string) => {
    const title = prompt
      ? (prompt.length > 42 ? prompt.slice(0, 42) + '…' : prompt)
      : kindToTitle(appKind);

    const id = openWindow(appKind, title);

    // These apps are fully self-contained — no AI needed on initial open
    // browser: starts on static Google home page
    // calculator/paint: pure hardcoded logic
    if ((appKind === 'calculator' || appKind === 'paint' || appKind === 'browser') && !prompt) {
      setWindowData(id, { title: kindToTitle(appKind), appKind: appKind as 'calculator' | 'paint' | 'browser', stateSummary: 'ready', html: '', css: '', suggestedActions: [] });
      return;
    }

    // IE and Terminal manage their own subsequent navigation; initial AI call sets the first page
    // Notepad: AI generates interesting initial text content
    try {
      const data = await api.generateApp(appKind, prompt);
      setWindowData(id, data);
      onGenerated();
    } catch (err) {
      setWindowError(id, err instanceof Error ? err.message : 'App generation failed');
    }
  }, [openWindow, setWindowData, setWindowError, onGenerated]);

  // Called when user interacts with a generated app (suggested action or data-action click)
  const handleAppEvent = useCallback(async (windowId: string, event: string) => {
    const win = windows.find(w => w.id === windowId);
    if (!win?.appData) return;

    setWindowLoading(windowId, true);
    try {
      const data = await api.appEvent({
        appKind: win.appData.appKind,
        stateSummary: win.appData.stateSummary,
        event,
        currentHtml: win.appData.html,
        currentCss: win.appData.css,
      });
      setWindowData(windowId, data);
      onGenerated();
    } catch (err) {
      setWindowError(windowId, err instanceof Error ? err.message : 'Event failed');
    }
  }, [windows, setWindowLoading, setWindowData, setWindowError, onGenerated]);

  return (
    <div
      style={{
        width: '100vw', height: '100vh', overflow: 'hidden',
        position: 'relative',
        // Windows 7-style blue gradient wallpaper base
        background: 'linear-gradient(158deg, #1d4280 0%, #2870c8 22%, #1a5eb8 50%, #124aa4 75%, #0c3688 100%)',
      }}
    >
      {/* Wallpaper SVG — inspired by Windows 7 "Harmony" fish-bone aurora shapes */}
      <Wallpaper />

      {/* VermOS watermark text on desktop */}
      <div style={{
        position: 'absolute', bottom: 60, right: 20,
        color: 'rgba(255,255,255,0.06)', fontSize: 88, fontWeight: 100,
        letterSpacing: 18, userSelect: 'none', pointerEvents: 'none',
        textShadow: '0 0 60px rgba(80,160,255,0.08)',
        fontFamily: "'Segoe UI', Tahoma, sans-serif",
      }}>
        VermOS
      </div>

      {/* Desktop icons — left column */}
      <div style={{
        position: 'absolute', top: 10, left: 12,
        display: 'flex', flexDirection: 'column', gap: 4,
      }}>
        {DESKTOP_ICONS.map(icon => (
          <DesktopIcon
            key={icon.id}
            label={icon.label}
            icon={icon.icon}
            onOpen={() => handleOpenApp(
              icon.appKind,
              'prompt' in icon ? icon.prompt : undefined
            )}
          />
        ))}
      </div>

      {/* All open windows */}
      {windows.map(win => (
        <AppWindow
          key={win.id}
          win={win}
          onAppEvent={handleAppEvent}
          onGenerated={onGenerated}
        />
      ))}

      {/* Start menu (above taskbar) */}
      {startMenuOpen && (
        <StartMenu
          onOpenApp={handleOpenApp}
          onClose={() => setStartMenuOpen(false)}
          username={username}
          onLogout={onLogout}
        />
      )}

      {/* Taskbar — fixed bottom */}
      <Taskbar
        windows={windows}
        onStartClick={() => setStartMenuOpen(prev => !prev)}
        startMenuOpen={startMenuOpen}
        username={username}
      />

      {/* Debug panel — non-Aero, developer overlay */}
      <DebugPanel debug={debug} onLogout={onLogout} />
    </div>
  );
}

// Windows 7 "Harmony"-inspired wallpaper — recreated with SVG
function Wallpaper() {
  return (
    <svg
      style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', pointerEvents: 'none' }}
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 1920 1080"
      preserveAspectRatio="xMidYMid slice"
    >
      <defs>
        {/* Central aurora glow */}
        <radialGradient id="wg-center" cx="52%" cy="68%" r="42%">
          <stop offset="0%" stopColor="#5090e8" stopOpacity="0.38"/>
          <stop offset="55%" stopColor="#2050c0" stopOpacity="0.12"/>
          <stop offset="100%" stopColor="#1040a0" stopOpacity="0"/>
        </radialGradient>
        {/* Left secondary glow */}
        <radialGradient id="wg-left" cx="22%" cy="72%" r="28%">
          <stop offset="0%" stopColor="#60aaff" stopOpacity="0.18"/>
          <stop offset="100%" stopColor="#1040a0" stopOpacity="0"/>
        </radialGradient>
        {/* Right glow */}
        <radialGradient id="wg-right" cx="82%" cy="58%" r="25%">
          <stop offset="0%" stopColor="#4880f0" stopOpacity="0.14"/>
          <stop offset="100%" stopColor="#1040a0" stopOpacity="0"/>
        </radialGradient>

        <filter id="wblur-heavy">
          <feGaussianBlur stdDeviation="24"/>
        </filter>
        <filter id="wblur-light">
          <feGaussianBlur stdDeviation="7"/>
        </filter>
        <filter id="wblur-mid">
          <feGaussianBlur stdDeviation="14"/>
        </filter>
      </defs>

      {/* Glow layers */}
      <ellipse cx="995" cy="735" rx="760" ry="350" fill="url(#wg-center)" filter="url(#wblur-heavy)"/>
      <ellipse cx="420" cy="780" rx="420" ry="210" fill="url(#wg-left)" filter="url(#wblur-heavy)"/>
      <ellipse cx="1580" cy="630" rx="380" ry="200" fill="url(#wg-right)" filter="url(#wblur-heavy)"/>

      {/* Main aurora spine curves — the "fish bone" structure */}
      <g opacity="0.22" filter="url(#wblur-light)">
        {/* Primary sweeping curves */}
        <path d="M 80 980 Q 420 680 960 740 Q 1480 800 1840 620" fill="none" stroke="#80c4ff" strokeWidth="5"/>
        <path d="M 60 940 Q 400 640 950 700 Q 1470 760 1820 580" fill="none" stroke="#a0d4ff" strokeWidth="3.5"/>
        <path d="M 50 900 Q 380 600 940 660 Q 1460 720 1810 540" fill="none" stroke="#c0e4ff" strokeWidth="2.5"/>
        <path d="M 100 1020 Q 440 720 970 780 Q 1490 840 1860 660" fill="none" stroke="#6ab8f0" strokeWidth="4"/>
        <path d="M 120 1060 Q 460 760 980 820 Q 1500 880 1880 700" fill="none" stroke="#58a8e0" strokeWidth="3"/>

        {/* Secondary curves above */}
        <path d="M 200 820 Q 520 540 960 600 Q 1400 660 1760 480" fill="none" stroke="#90ccff" strokeWidth="2.5"/>
        <path d="M 220 780 Q 540 500 970 560 Q 1410 620 1770 440" fill="none" stroke="#a8d8ff" strokeWidth="2"/>
        <path d="M 160 860 Q 480 580 965 640 Q 1405 700 1765 520" fill="none" stroke="#78baf0" strokeWidth="2"/>
      </g>

      {/* Fish-rib cross members */}
      <g opacity="0.14" filter="url(#wblur-light)">
        {Array.from({ length: 14 }, (_, i) => {
          const t = i / 13;
          const x = 100 + t * 1700;
          const baseY = 980 - t * 360;
          return (
            <g key={i}>
              <line x1={x - 15} y1={baseY - 55} x2={x + 50} y2={baseY + 55} stroke="#90c8ff" strokeWidth="1.8"/>
              <line x1={x + 10} y1={baseY - 75} x2={x + 65} y2={baseY + 40} stroke="#b0dcff" strokeWidth="1.2"/>
            </g>
          );
        })}
      </g>

      {/* Bright highlight sparkles near the focal zone */}
      <g filter="url(#wblur-light)">
        {[
          [820, 620, 3.5], [870, 590, 2.5], [930, 570, 4], [990, 580, 2.8], [1050, 565, 3.2],
          [1110, 578, 2.4], [770, 640, 2], [1160, 595, 1.8], [720, 660, 2.5], [1200, 620, 2.2],
          [960, 545, 2], [1010, 540, 3], [890, 555, 1.8],
        ].map(([x, y, r], i) => (
          <circle key={i} cx={x} cy={y} r={r} fill="#d0eaff" opacity={0.28 + (i % 5) * 0.08}/>
        ))}
      </g>

      {/* Very faint large leaf shapes for depth */}
      <g opacity="0.06" filter="url(#wblur-mid)">
        <ellipse cx="960" cy="700" rx="520" ry="120" fill="#a0d0ff" transform="rotate(-12 960 700)"/>
        <ellipse cx="600" cy="800" rx="280" ry="70" fill="#80c0ff" transform="rotate(-8 600 800)"/>
        <ellipse cx="1380" cy="650" rx="240" ry="60" fill="#80c0ff" transform="rotate(-15 1380 650)"/>
      </g>
    </svg>
  );
}

function kindToTitle(appKind: string): string {
  const m: Record<string, string> = {
    calculator: 'Calculator',
    notepad: 'Notepad',
    browser: 'Internet Explorer',
    paint: 'Paint',
    terminal: 'Command Prompt',
    custom: 'Application',
  };
  return m[appKind] ?? appKind;
}
