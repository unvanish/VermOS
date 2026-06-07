import React, { useCallback, useEffect, useRef } from 'react';
import type { WindowState } from '../types';
import Window from './Window';
import { useWindowsStore } from '../hooks/useWindows';
import { CalculatorApp }  from '../apps/Calculator';
import { NotepadApp }     from '../apps/Notepad';
import { PaintApp }       from '../apps/Paint';
import { TerminalApp }    from '../apps/Terminal';
import { IEApp }          from '../apps/IE';

interface Props {
  win: WindowState;
  onAppEvent: (windowId: string, event: string) => void;
  onGenerated?: () => void;
}

// ── Iframe renderer for custom / AI-generated apps ───────────────────────────
// Runs the AI's HTML (potentially including <script> tags) in a sandboxed
// iframe so games and interactive apps have full JavaScript execution.
function IframeContent({ win }: { win: WindowState }) {
  const iframeRef  = useRef<HTMLIFrameElement>(null);
  const blobUrlRef = useRef<string | null>(null);

  useEffect(() => {
    if (!win.appData?.html || win.loading) return;

    let html = win.appData.html.trim();

    // If the AI returned a fragment (no <!DOCTYPE>/<html>), wrap it in a
    // minimal Windows-7-styled full document so CSS and scripts work properly.
    if (!html.toLowerCase().startsWith('<!doctype') && !html.toLowerCase().startsWith('<html')) {
      html = `<!DOCTYPE html>
<html>
<head>
<meta charset="utf-8">
<style>
  *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
  html, body { width: 100%; height: 100%; overflow: auto; }
  body {
    font-family: 'Segoe UI', Tahoma, sans-serif;
    font-size: 12px;
    background: #f0f0f0;
    color: #000;
  }
  button, input, select, textarea { font-family: inherit; font-size: inherit; }
  button { cursor: pointer; }
  a { cursor: pointer; }
</style>
</head>
<body>${html}</body>
</html>`;
    }

    // Revoke previous blob URL to avoid memory leaks
    if (blobUrlRef.current) URL.revokeObjectURL(blobUrlRef.current);

    const blob = new Blob([html], { type: 'text/html' });
    const url  = URL.createObjectURL(blob);
    blobUrlRef.current = url;

    if (iframeRef.current) iframeRef.current.src = url;
  }, [win.appData?.html, win.loading]);

  // Clean up blob URL on unmount
  useEffect(() => () => {
    if (blobUrlRef.current) URL.revokeObjectURL(blobUrlRef.current);
  }, []);

  return (
    <div style={{ flex: 1, overflow: 'hidden', position: 'relative', height: '100%' }}>
      {/* Loading shimmer */}
      {(win.loading || !win.appData) && !win.error && (
        <div style={{
          position: 'absolute', inset: 0, zIndex: 10, background: '#f0f0f0',
          display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 14,
        }}>
          <div style={{ fontSize: 13, color: '#444' }}>Opening {win.title}…</div>
          <div style={{
            width: 220, height: 20, background: '#d8e8f8', border: '1px solid #9ab4cc',
            borderRadius: 2, overflow: 'hidden', boxShadow: 'inset 0 2px 4px rgba(0,0,0,0.15)',
          }}>
            <div style={{
              width: '45%', height: '100%',
              background: 'linear-gradient(180deg,#72b6ff 0%,#3a90e8 40%,#2878d0 60%,#4898ec 100%)',
              animation: 'vermos-progress 1.1s ease-in-out infinite',
              boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.5)',
            }} />
          </div>
          <div style={{ fontSize: 10, color: '#888' }}>VermOS</div>
        </div>
      )}

      {/* Error state */}
      {win.error && !win.loading && (
        <div style={{
          position: 'absolute', inset: 0, zIndex: 10, background: '#f0f0f0',
          display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 12, padding: 28,
        }}>
          <div style={{
            width: 54, height: 54, borderRadius: '50%',
            background: 'radial-gradient(circle,#ff4444,#cc0000)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            color: 'white', fontSize: 30, fontWeight: 'bold', boxShadow: '0 4px 12px rgba(200,0,0,0.4)',
          }}>!</div>
          <div style={{ fontWeight: 600, color: '#cc0000', fontSize: 14 }}>VermOS — App Error</div>
          <div style={{
            color: '#444', fontSize: 12, textAlign: 'center', maxWidth: 320, lineHeight: 1.5,
            background: 'white', padding: '10px 16px', border: '1px solid #ccc', borderRadius: 3,
          }}>{win.error}</div>
        </div>
      )}

      {/* The sandboxed iframe — allow-scripts enables JavaScript */}
      <iframe
        ref={iframeRef}
        sandbox="allow-scripts allow-forms allow-modals"
        style={{
          width: '100%', height: '100%',
          border: 'none', background: '#f0f0f0',
          display: win.loading || !win.appData ? 'none' : 'block',
        }}
        title={win.title}
      />
    </div>
  );
}

// ── App window router ─────────────────────────────────────────────────────────
export default function AppWindow({ win, onAppEvent, onGenerated }: Props) {
  const { closeWindow, minimizeWindow, maximizeWindow, focusWindow } = useWindowsStore();

  const wProps = {
    win,
    onClose:    () => closeWindow(win.id),
    onMinimize: () => minimizeWindow(win.id),
    onMaximize: () => maximizeWindow(win.id),
    onFocus:    () => focusWindow(win.id),
  };

  if (win.appKind === 'calculator') return <Window {...wProps}><CalculatorApp /></Window>;
  if (win.appKind === 'notepad')    return <Window {...wProps}><NotepadApp win={win} /></Window>;
  if (win.appKind === 'paint')      return <Window {...wProps}><PaintApp /></Window>;
  if (win.appKind === 'terminal')   return <Window {...wProps}><TerminalApp win={win} onGenerated={onGenerated} /></Window>;
  if (win.appKind === 'browser')    return <Window {...wProps}><IEApp win={win} onGenerated={onGenerated} /></Window>;

  // All custom / AI-generated apps → sandboxed iframe with full JS support
  return <Window {...wProps}><IframeContent win={win} /></Window>;
}
