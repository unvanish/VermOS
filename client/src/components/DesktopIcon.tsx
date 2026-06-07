import React, { useState } from 'react';

interface Props {
  label: string;
  icon: string;
  onOpen: () => void;
}

export default function DesktopIcon({ label, icon, onOpen }: Props) {
  const [selected, setSelected] = useState(false);
  const [hovered, setHovered] = useState(false);

  return (
    <div
      onClick={() => setSelected(s => !s)}
      onDoubleClick={onOpen}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => { setHovered(false); setSelected(false); }}
      style={{
        display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 5,
        width: 80, padding: '6px 4px',
        borderRadius: 4,
        background: selected
          ? 'rgba(48,110,255,0.38)'
          : hovered
          ? 'rgba(48,110,255,0.18)'
          : 'transparent',
        outline: selected ? '1px dotted rgba(255,255,255,0.75)' : 'none',
        cursor: 'default', userSelect: 'none',
        transition: 'background 0.08s',
      }}
    >
      {/* Icon */}
      <div style={{
        fontSize: 40, lineHeight: 1,
        filter: selected ? 'drop-shadow(0 0 6px rgba(80,160,255,0.7))' : 'none',
        transition: 'filter 0.1s',
      }}>
        {icon}
      </div>

      {/* Label */}
      <span style={{
        color: 'white', fontSize: 11.5, textAlign: 'center',
        textShadow: '0 1px 3px rgba(0,0,0,0.9), 0 0 6px rgba(0,0,0,0.7)',
        lineHeight: 1.3, wordBreak: 'break-word', maxWidth: '100%',
        background: selected ? 'rgba(48,110,255,0.6)' : 'transparent',
        padding: selected ? '1px 4px' : '0',
        borderRadius: 2,
        display: 'block',
      }}>
        {label}
      </span>
    </div>
  );
}
