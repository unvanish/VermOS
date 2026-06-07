import React, { useState } from 'react';
import type { DebugInfo } from '../types';

interface Props {
  debug: DebugInfo;
  onLogout: () => void;
}

export default function DebugPanel({ debug, onLogout }: Props) {
  const [open, setOpen] = useState(true);

  if (!open) {
    return (
      <button
        onClick={() => setOpen(true)}
        title="Open VermOS debug panel"
        style={{
          position: 'fixed', bottom: 48, right: 8, zIndex: 10000,
          background: 'rgba(0,0,0,0.75)', color: '#00dd44',
          border: '1px solid rgba(0,220,68,0.4)', borderRadius: 3,
          fontSize: 9, padding: '3px 7px', cursor: 'pointer',
          fontFamily: 'Consolas, "Courier New", monospace', letterSpacing: 1,
        }}
      >
        DEBUG
      </button>
    );
  }

  return (
    <div style={{
      position: 'fixed', bottom: 48, right: 8, zIndex: 10000,
      background: 'rgba(4,10,22,0.88)',
      border: '1px solid rgba(0,200,60,0.3)',
      borderRadius: 4,
      fontSize: 10,
      fontFamily: 'Consolas, "Courier New", monospace',
      padding: '8px 10px',
      minWidth: 210,
      boxShadow: '0 4px 18px rgba(0,0,0,0.5), 0 0 0 1px rgba(0,255,80,0.05)',
      lineHeight: 1.9,
      color: '#00dd44',
    }}>
      {/* Header */}
      <div style={{
        display: 'flex', justifyContent: 'space-between', alignItems: 'center',
        marginBottom: 5, paddingBottom: 5,
        borderBottom: '1px solid rgba(0,200,60,0.2)',
      }}>
        <span style={{ fontWeight: 'bold', color: '#44ff88', letterSpacing: 1 }}>VERMOS DEBUG</span>
        <button
          onClick={() => setOpen(false)}
          style={{
            background: 'none', border: 'none', color: 'rgba(0,220,68,0.6)',
            cursor: 'pointer', fontSize: 11, padding: '0 2px', lineHeight: 1,
          }}
        >✕</button>
      </div>

      <DebugRow label="MODEL" value={debug.model} color="#88ddff" />
      <DebugRow label="USER" value={debug.username ?? 'none'} />
      <DebugRow label="GENS" value={String(debug.generationCount)} color={debug.generationCount > 0 ? '#ffdd44' : undefined} />
      <DebugRow label="LAST" value={debug.lastGenTime ?? 'never'} />
      <DebugRow label="STATUS" value="● ONLINE" color="#44ff88" />

      {/* Actions */}
      <div style={{ marginTop: 7, paddingTop: 6, borderTop: '1px solid rgba(0,200,60,0.2)', display: 'flex', gap: 5 }}>
        <button
          onClick={onLogout}
          style={{
            flex: 1, background: 'none',
            border: '1px solid rgba(0,200,60,0.35)',
            color: '#00dd44', fontSize: 9, padding: '3px 0',
            cursor: 'pointer', borderRadius: 2, letterSpacing: 1,
            fontFamily: 'inherit',
          }}
          onMouseEnter={e => (e.currentTarget.style.background = 'rgba(0,200,60,0.12)')}
          onMouseLeave={e => (e.currentTarget.style.background = 'none')}
        >
          LOGOUT
        </button>
        <button
          onClick={() => window.location.reload()}
          style={{
            flex: 1, background: 'none',
            border: '1px solid rgba(0,200,60,0.35)',
            color: '#00dd44', fontSize: 9, padding: '3px 0',
            cursor: 'pointer', borderRadius: 2, letterSpacing: 1,
            fontFamily: 'inherit',
          }}
          onMouseEnter={e => (e.currentTarget.style.background = 'rgba(0,200,60,0.12)')}
          onMouseLeave={e => (e.currentTarget.style.background = 'none')}
        >
          RELOAD
        </button>
      </div>
    </div>
  );
}

function DebugRow({ label, value, color }: { label: string; value: string; color?: string }) {
  return (
    <div style={{ display: 'flex', gap: 6 }}>
      <span style={{ color: 'rgba(0,200,60,0.55)', width: 48, flexShrink: 0 }}>{label}:</span>
      <span style={{
        color: color ?? '#00dd44',
        overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
        flex: 1,
      }}>
        {value}
      </span>
    </div>
  );
}
