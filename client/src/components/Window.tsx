import React, { useCallback, useEffect, useRef, useState } from 'react';
import type { WindowState } from '../types';
import { useWindowsStore } from '../hooks/useWindows';

const APP_ICONS: Record<string, string> = {
  calculator: '🧮',
  notepad: '📝',
  browser: '🌐',
  paint: '🎨',
  terminal: '⌨️',
  custom: '💾',
};

// Resize handle descriptors — direction id + style overrides + cursor
const HANDLES = [
  { id: 'n',  cursor: 'n-resize',  style: { top: -4, left: 10, right: 10, height: 8 } },
  { id: 'ne', cursor: 'ne-resize', style: { top: -4, right: -4, width: 14, height: 14 } },
  { id: 'e',  cursor: 'e-resize',  style: { top: 10, right: -4, bottom: 10, width: 8 } },
  { id: 'se', cursor: 'se-resize', style: { bottom: -4, right: -4, width: 14, height: 14 } },
  { id: 's',  cursor: 's-resize',  style: { bottom: -4, left: 10, right: 10, height: 8 } },
  { id: 'sw', cursor: 'sw-resize', style: { bottom: -4, left: -4, width: 14, height: 14 } },
  { id: 'w',  cursor: 'w-resize',  style: { top: 10, left: -4, bottom: 10, width: 8 } },
  { id: 'nw', cursor: 'nw-resize', style: { top: -4, left: -4, width: 14, height: 14 } },
] as const;

interface ResizeState {
  dir: string;
  startMouseX: number; startMouseY: number;
  startW: number; startH: number;
  startLeft: number; startTop: number;
}

interface Props {
  win: WindowState;
  children: React.ReactNode;
  onClose: () => void;
  onMinimize: () => void;
  onMaximize: () => void;
  onFocus: () => void;
}

export default function Window({ win, children, onClose, onMinimize, onMaximize, onFocus }: Props) {
  const { moveWindow, resizeWindow } = useWindowsStore();
  const containerRef = useRef<HTMLDivElement>(null);
  const isDragging = useRef(false);
  const dragOffset = useRef({ x: 0, y: 0 });
  const isResizing = useRef<ResizeState | null>(null);

  // ── Drag ──────────────────────────────────────────────────────────────────
  const handleTitleMouseDown = useCallback((e: React.MouseEvent) => {
    if (win.maximized) return;
    if ((e.target as HTMLElement).closest('[data-winbtn]')) return;
    e.preventDefault();
    isDragging.current = true;
    dragOffset.current = { x: e.clientX - win.x, y: e.clientY - win.y };
    onFocus();
  }, [win.maximized, win.x, win.y, onFocus]);

  // ── Resize ────────────────────────────────────────────────────────────────
  const handleResizeStart = useCallback((e: React.MouseEvent, dir: string) => {
    if (win.maximized) return;
    e.preventDefault();
    e.stopPropagation();
    onFocus();
    isResizing.current = {
      dir,
      startMouseX: e.clientX, startMouseY: e.clientY,
      startW: win.width, startH: win.height,
      startLeft: win.x, startTop: win.y,
    };
  }, [win.maximized, win.width, win.height, win.x, win.y, onFocus]);

  // ── Shared mouse handlers ─────────────────────────────────────────────────
  useEffect(() => {
    const MIN_W = 300, MIN_H = 200;

    function applyResize(r: ResizeState, clientX: number, clientY: number) {
      const dx = clientX - r.startMouseX;
      const dy = clientY - r.startMouseY;
      const dir = r.dir;

      let newX = r.startLeft, newY = r.startTop;
      let newW = r.startW,    newH = r.startH;

      if (dir.includes('e')) newW = Math.max(MIN_W, r.startW + dx);
      if (dir.includes('s')) newH = Math.max(MIN_H, r.startH + dy);
      if (dir.includes('w')) {
        const raw = r.startW - dx;
        newW = Math.max(MIN_W, raw);
        newX = raw > MIN_W ? r.startLeft + dx : r.startLeft + (r.startW - MIN_W);
      }
      if (dir.includes('n')) {
        const raw = r.startH - dy;
        newH = Math.max(MIN_H, raw);
        newY = raw > MIN_H ? r.startTop + dy : r.startTop + (r.startH - MIN_H);
      }
      return { newX, newY, newW, newH };
    }

    const onMove = (e: MouseEvent) => {
      if (isDragging.current) {
        const x = e.clientX - dragOffset.current.x;
        const y = Math.max(0, e.clientY - dragOffset.current.y);
        if (containerRef.current) {
          containerRef.current.style.left = `${x}px`;
          containerRef.current.style.top  = `${y}px`;
        }
      } else if (isResizing.current) {
        const { newX, newY, newW, newH } = applyResize(isResizing.current, e.clientX, e.clientY);
        if (containerRef.current) {
          containerRef.current.style.left   = `${newX}px`;
          containerRef.current.style.top    = `${newY}px`;
          containerRef.current.style.width  = `${newW}px`;
          containerRef.current.style.height = `${newH}px`;
        }
      }
    };

    const onUp = (e: MouseEvent) => {
      if (isDragging.current) {
        isDragging.current = false;
        moveWindow(win.id, e.clientX - dragOffset.current.x, Math.max(0, e.clientY - dragOffset.current.y));
      } else if (isResizing.current) {
        const r = isResizing.current;
        isResizing.current = null;
        const { newX, newY, newW, newH } = applyResize(r, e.clientX, e.clientY);
        resizeWindow(win.id, newX, newY, newW, newH);
      }
    };

    document.addEventListener('mousemove', onMove);
    document.addEventListener('mouseup', onUp);
    return () => {
      document.removeEventListener('mousemove', onMove);
      document.removeEventListener('mouseup', onUp);
    };
  }, [win.id, moveWindow, resizeWindow]);

  if (win.minimized) return null;

  const isMaximized = win.maximized;
  const containerStyle: React.CSSProperties = isMaximized
    ? { position: 'fixed', left: 0, top: 0, width: '100vw', height: 'calc(100vh - 40px)', zIndex: win.zIndex }
    : { position: 'absolute', left: win.x, top: win.y, width: win.width, height: win.height, zIndex: win.zIndex };

  return (
    <div
      ref={containerRef}
      onMouseDown={() => onFocus()}
      style={{ ...containerStyle, overflow: 'visible' }}
    >
      {/* ── Resize handles (8 directions) ── */}
      {!isMaximized && HANDLES.map(h => (
        <div
          key={h.id}
          onMouseDown={(e) => handleResizeStart(e, h.id)}
          style={{
            position: 'absolute',
            zIndex: 20,
            cursor: h.cursor,
            ...h.style,
          }}
        />
      ))}

      {/* ── Actual window chrome ── */}
      <div style={{
        position: 'absolute', inset: 0,
        display: 'flex', flexDirection: 'column',
        borderRadius: isMaximized ? 0 : '8px 8px 4px 4px',
        boxShadow: isMaximized ? 'none' : [
          '0 0 0 1px rgba(255,255,255,0.28)',
          '0 0 0 2px rgba(50,110,220,0.55)',
          '0 0 0 3px rgba(0,0,0,0.15)',
          '0 14px 48px rgba(0,0,0,0.58)',
          '0 4px 12px rgba(0,0,0,0.35)',
        ].join(', '),
        overflow: 'hidden',
        animation: 'fadeIn 0.16s ease-out',
      }}>
        {/* Title bar */}
        <div
          onMouseDown={handleTitleMouseDown}
          style={{
            position: 'relative', flexShrink: 0,
            height: 32, display: 'flex', alignItems: 'center',
            justifyContent: 'space-between', padding: '0 4px 0 8px',
            background: 'linear-gradient(180deg, #5f9fd8 0%, #3c80c4 30%, #2669b8 65%, #1a59ac 100%)',
            borderBottom: '1px solid rgba(0,0,0,0.35)',
            cursor: 'default', userSelect: 'none',
            borderRadius: isMaximized ? 0 : '7px 7px 0 0',
          }}
        >
          <div style={{
            position: 'absolute', top: 0, left: 0, right: 0,
            height: '54%', pointerEvents: 'none',
            background: 'linear-gradient(180deg, rgba(255,255,255,0.32) 0%, rgba(255,255,255,0.06) 100%)',
            borderRadius: isMaximized ? 0 : '7px 7px 0 0',
          }} />
          <div style={{ display: 'flex', alignItems: 'center', gap: 5, flex: 1, overflow: 'hidden', position: 'relative', zIndex: 1 }}>
            <span style={{ fontSize: 14, lineHeight: 1, flexShrink: 0 }}>
              {APP_ICONS[win.appKind] ?? '📱'}
            </span>
            <span style={{
              color: 'white', fontSize: 12, fontWeight: 400,
              textShadow: '0 1px 2px rgba(0,0,0,0.55)',
              overflow: 'hidden', whiteSpace: 'nowrap', textOverflow: 'ellipsis',
            }}>
              {win.title}
            </span>
          </div>
          <div style={{ display: 'flex', gap: 2, position: 'relative', zIndex: 1, flexShrink: 0 }}>
            <WinCtrlBtn type="minimize" onClick={(e) => { e.stopPropagation(); onMinimize(); }} title="Minimize" />
            <WinCtrlBtn type="maximize" onClick={(e) => { e.stopPropagation(); onMaximize(); }} title={isMaximized ? 'Restore Down' : 'Maximize'} maximized={isMaximized} />
            <WinCtrlBtn type="close" onClick={(e) => { e.stopPropagation(); onClose(); }} title="Close" />
          </div>
        </div>

        {/* Window body */}
        <div style={{
          flex: 1, display: 'flex', flexDirection: 'column',
          background: '#f0f0f0', overflow: 'hidden', position: 'relative',
          borderBottom: isMaximized ? 'none' : '2px solid rgba(30,80,180,0.5)',
          borderLeft:   isMaximized ? 'none' : '2px solid rgba(30,80,180,0.4)',
          borderRight:  isMaximized ? 'none' : '2px solid rgba(30,80,180,0.4)',
        }}>
          {children}
        </div>
      </div>
    </div>
  );
}

function WinCtrlBtn({
  type, onClick, title, maximized,
}: {
  type: 'minimize' | 'maximize' | 'close';
  onClick: (e: React.MouseEvent) => void;
  title: string;
  maximized?: boolean;
}) {
  const [hovered, setHovered] = useState(false);
  const [pressed, setPressed] = useState(false);

  const getStyle = (): React.CSSProperties => {
    const base: React.CSSProperties = {
      width: type === 'close' ? 34 : 27,
      height: 22, borderRadius: 3, border: 'none',
      cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center',
      color: 'white', fontSize: type === 'close' ? 13 : 11, fontWeight: 400,
      transition: 'all 0.08s', position: 'relative', overflow: 'hidden',
    };
    if (type === 'close') {
      return {
        ...base,
        background: hovered
          ? pressed ? 'linear-gradient(180deg, #d03030 0%, #b81818 100%)' : 'linear-gradient(180deg, #f05050 0%, #d82020 45%, #b81818 100%)'
          : 'linear-gradient(180deg, #d84040 0%, #c02424 45%, #a01818 100%)',
        boxShadow: hovered ? '0 0 8px rgba(220,0,0,0.45), inset 0 1px 0 rgba(255,160,160,0.3)' : 'inset 0 1px 0 rgba(255,120,120,0.25)',
        border: `1px solid ${hovered ? '#8a0a0a' : '#7a1212'}`,
      };
    }
    return {
      ...base,
      background: hovered
        ? pressed
          ? 'linear-gradient(180deg, rgba(180,210,255,0.45) 0%, rgba(140,185,240,0.35) 100%)'
          : 'linear-gradient(180deg, rgba(210,230,255,0.55) 0%, rgba(165,205,245,0.42) 50%, rgba(130,175,235,0.52) 100%)'
        : 'linear-gradient(180deg, rgba(190,218,252,0.32) 0%, rgba(155,195,242,0.22) 50%, rgba(120,168,228,0.32) 100%)',
      boxShadow: hovered
        ? '0 0 6px rgba(80,160,255,0.3), inset 0 1px 0 rgba(255,255,255,0.4)'
        : 'inset 0 1px 0 rgba(255,255,255,0.28)',
      border: `1px solid ${hovered ? 'rgba(60,110,200,0.6)' : 'rgba(60,100,180,0.35)'}`,
    };
  };

  return (
    <button
      data-winbtn="true"
      onClick={onClick}
      onMouseDown={e => { e.stopPropagation(); setPressed(true); }}
      onMouseUp={() => setPressed(false)}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => { setHovered(false); setPressed(false); }}
      title={title}
      style={getStyle()}
    >
      <div style={{
        position: 'absolute', top: 0, left: 0, right: 0, height: '50%',
        background: 'rgba(255,255,255,0.15)', pointerEvents: 'none', borderRadius: '3px 3px 0 0',
      }} />
      <span style={{ position: 'relative', zIndex: 1, lineHeight: 1 }}>
        {type === 'minimize' && '─'}
        {type === 'maximize' && (maximized ? '❐' : '□')}
        {type === 'close' && '✕'}
      </span>
    </button>
  );
}
