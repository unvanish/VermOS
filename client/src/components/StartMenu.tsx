import React, { useEffect, useRef, useState } from 'react';

interface Props {
  onOpenApp: (appKind: string, prompt?: string) => void;
  onClose: () => void;
  username: string;
  onLogout: () => void;
}

const PINNED_APPS = [
  { kind: 'browser',    label: 'Internet Explorer', icon: '🌐' },
  { kind: 'notepad',    label: 'Notepad',            icon: '📝' },
  { kind: 'calculator', label: 'Calculator',         icon: '🧮' },
  { kind: 'paint',      label: 'Paint',              icon: '🎨' },
  { kind: 'terminal',   label: 'Command Prompt',     icon: '⌨️' },
];

const RIGHT_LINKS = [
  { label: 'Documents',         icon: '📁',  prompt: 'Windows 7 Documents folder' },
  { label: 'Pictures',          icon: '🖼️', prompt: 'Windows 7 Pictures viewer' },
  { label: 'Music',             icon: '🎵',  prompt: 'Windows Media Player' },
  { label: 'Computer',          icon: '💻',  prompt: 'Windows Explorer - My Computer' },
  { label: 'Control Panel',     icon: '🎛️', prompt: 'Windows 7 Control Panel' },
  { label: 'Devices & Printers',icon: '🖨️', prompt: 'Windows 7 Devices and Printers' },
  { label: 'Default Programs',  icon: '⚙️',  prompt: 'Windows 7 Default Programs' },
  { label: 'Help and Support',  icon: '❓',  prompt: 'Windows 7 Help and Support Center' },
];

export default function StartMenu({ onOpenApp, onClose, username, onLogout }: Props) {
  const [query, setQuery]             = useState('');
  const [suggestions, setSuggestions] = useState<string[]>([]);
  const [loadingSugg, setLoadingSugg] = useState(false);
  const [suggFocused, setSuggFocused] = useState(-1);
  const inputRef    = useRef<HTMLInputElement>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    const t = setTimeout(() => inputRef.current?.focus(), 60);
    return () => clearTimeout(t);
  }, []);

  // Debounced suggestion fetch — triggers 1 second after the user stops typing
  useEffect(() => {
    setSuggestions([]);
    setSuggFocused(-1);
    if (debounceRef.current) clearTimeout(debounceRef.current);

    if (!query.trim()) { setLoadingSugg(false); return; }

    debounceRef.current = setTimeout(async () => {
      setLoadingSugg(true);
      try {
        const resp = await fetch('/api/search-suggestions', {
          method: 'POST',
          credentials: 'include',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ query: query.trim() }),
        });
        const data = await resp.json() as { suggestions?: string[] };
        setSuggestions(data.suggestions ?? []);
      } catch {
        setSuggestions([]);
      } finally {
        setLoadingSugg(false);
      }
    }, 1000);

    return () => { if (debounceRef.current) clearTimeout(debounceRef.current); };
  }, [query]);

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    const q = query.trim();
    if (!q) return;
    onOpenApp('custom', q);
    onClose();
  };

  const launch = (kind: string, prompt?: string) => {
    onOpenApp(kind, prompt);
    onClose();
  };

  const pickSuggestion = (s: string) => {
    onOpenApp('custom', s);
    onClose();
  };

  // Keyboard navigation through suggestions
  const onKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (!suggestions.length) return;
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setSuggFocused(i => Math.min(i + 1, suggestions.length - 1));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setSuggFocused(i => Math.max(i - 1, -1));
    } else if (e.key === 'Enter' && suggFocused >= 0) {
      e.preventDefault();
      pickSuggestion(suggestions[suggFocused]);
    }
  };

  const hasSuggestions = suggestions.length > 0 || loadingSugg;

  return (
    <div
      data-startmenu="true"
      style={{
        position: 'fixed', bottom: 40, left: 0,
        width: 504,
        // Expand height when suggestions are showing
        height: hasSuggestions ? 504 : 456,
        display: 'flex',
        borderRadius: '8px 8px 0 0',
        overflow: 'hidden',
        boxShadow: '0 -6px 28px rgba(0,0,0,0.7), 0 0 0 1px rgba(255,255,255,0.12)',
        zIndex: 9998,
        animation: 'slideUpMenu 0.14s ease-out',
        transition: 'height 0.12s ease',
      }}
    >
      {/* LEFT PANE */}
      <div style={{
        width: 268,
        background: 'linear-gradient(180deg, #1a2e62 0%, #0f1e48 100%)',
        display: 'flex', flexDirection: 'column',
        borderRight: '1px solid rgba(255,255,255,0.07)',
      }}>
        {/* Pinned / recent */}
        <div style={{ padding: '8px 0 4px', borderBottom: '1px solid rgba(255,255,255,0.08)', flex: 1, overflow: 'auto' }}>
          <div style={{ padding: '4px 14px 6px', fontSize: 10, color: 'rgba(255,255,255,0.4)', fontWeight: 600, letterSpacing: 1, textTransform: 'uppercase' }}>
            Pinned Programs
          </div>
          {PINNED_APPS.map(app => (
            <MenuAppBtn key={app.kind} icon={app.icon} label={app.label} onClick={() => launch(app.kind)} />
          ))}
          <div style={{ height: 1, background: 'rgba(255,255,255,0.08)', margin: '8px 0' }} />
          <div style={{ padding: '0 14px 4px', fontSize: 10, color: 'rgba(255,255,255,0.4)', fontWeight: 600, letterSpacing: 1, textTransform: 'uppercase' }}>
            App Search
          </div>
          <div style={{ padding: '0 10px 6px', fontSize: 11, color: 'rgba(255,255,255,0.38)', lineHeight: 1.5 }}>
            Search below to open <em>any</em> app — the AI will generate it for you.
          </div>
        </div>

        {/* Search box + suggestion dropdown */}
        <div style={{
          padding: '8px 8px 10px',
          background: 'rgba(0,0,0,0.28)',
          borderTop: '1px solid rgba(255,255,255,0.07)',
          position: 'relative',
        }}>
          {/* Suggestions dropdown — appears ABOVE the search box */}
          {hasSuggestions && (
            <div style={{
              position: 'absolute', bottom: '100%', left: 8, right: 8,
              background: 'rgba(10,20,60,0.97)',
              border: '1px solid rgba(255,255,255,0.18)',
              borderRadius: '4px 4px 0 0',
              overflow: 'hidden',
              boxShadow: '0 -4px 16px rgba(0,0,0,0.5)',
            }}>
              {loadingSugg && (
                <div style={{ padding: '8px 12px', fontSize: 11, color: 'rgba(255,255,255,0.4)', display: 'flex', alignItems: 'center', gap: 6 }}>
                  <span style={{ animation: 'spin 0.8s linear infinite', display: 'inline-block' }}>⟳</span>
                  Generating suggestions…
                </div>
              )}
              {suggestions.map((s, i) => (
                <div
                  key={s}
                  onMouseDown={() => pickSuggestion(s)}
                  onMouseEnter={() => setSuggFocused(i)}
                  style={{
                    padding: '7px 12px',
                    fontSize: 12,
                    cursor: 'default',
                    display: 'flex', alignItems: 'center', gap: 8,
                    background: suggFocused === i ? 'rgba(60,120,220,0.5)' : 'transparent',
                    color: 'white',
                    transition: 'background 0.08s',
                    userSelect: 'none',
                  }}
                >
                  <span style={{ fontSize: 13, opacity: 0.7 }}>🔍</span>
                  <span>{s}</span>
                </div>
              ))}
            </div>
          )}

          <form onSubmit={handleSearch}>
            <div style={{ position: 'relative' }}>
              <span style={{
                position: 'absolute', left: 9, top: '50%', transform: 'translateY(-50%)',
                color: 'rgba(255,255,255,0.45)', fontSize: 13, pointerEvents: 'none',
              }}>🔍</span>
              <input
                ref={inputRef}
                value={query}
                onChange={e => setQuery(e.target.value)}
                onKeyDown={onKeyDown}
                placeholder="Search programs and files…"
                style={{
                  width: '100%', height: 30, paddingLeft: 30, paddingRight: query ? 32 : 8,
                  background: 'rgba(255,255,255,0.08)',
                  border: '1px solid rgba(255,255,255,0.22)',
                  borderRadius: 2, color: 'white', fontSize: 12,
                  fontFamily: "'Segoe UI', Tahoma, sans-serif",
                  outline: 'none',
                }}
                onFocus={e => (e.currentTarget.style.borderColor = 'rgba(80,160,255,0.6)')}
                onBlur={e => (e.currentTarget.style.borderColor = 'rgba(255,255,255,0.22)')}
              />
              {query && (
                <button type="submit" style={{
                  position: 'absolute', right: 4, top: '50%', transform: 'translateY(-50%)',
                  background: 'rgba(60,120,220,0.6)', border: '1px solid rgba(80,140,255,0.4)',
                  borderRadius: 2, color: 'white', fontSize: 11,
                  padding: '1px 7px', cursor: 'pointer', fontFamily: 'inherit',
                }}>▶</button>
              )}
            </div>
          </form>
        </div>
      </div>

      {/* RIGHT PANE */}
      <div style={{
        flex: 1,
        background: 'linear-gradient(180deg, #2c519e 0%, #1c3d88 60%, #152e70 100%)',
        display: 'flex', flexDirection: 'column',
      }}>
        {/* User header */}
        <div style={{
          padding: '12px 14px',
          background: 'rgba(0,0,0,0.18)',
          borderBottom: '1px solid rgba(255,255,255,0.1)',
          display: 'flex', alignItems: 'center', gap: 10,
        }}>
          <div style={{
            width: 38, height: 38, borderRadius: 3,
            background: 'linear-gradient(135deg, #5080c4, #2850a4)',
            border: '2px solid rgba(255,255,255,0.3)',
            display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 22,
          }}>👤</div>
          <div>
            <div style={{ color: 'white', fontSize: 14, fontWeight: 400 }}>{username}</div>
            <div style={{ color: 'rgba(255,255,255,0.45)', fontSize: 10 }}>VermOS User</div>
          </div>
        </div>

        <div style={{ flex: 1, overflow: 'auto', padding: '6px 0' }}>
          {RIGHT_LINKS.map(item => (
            <button key={item.label} onClick={() => launch('custom', item.prompt)}
              style={{
                display: 'flex', alignItems: 'center', gap: 10,
                width: '100%', padding: '7px 14px',
                background: 'none', border: 'none', cursor: 'pointer',
                color: 'white', fontSize: 12, textAlign: 'left',
                fontFamily: "'Segoe UI', Tahoma, sans-serif", transition: 'background 0.08s',
              }}
              onMouseEnter={e => (e.currentTarget.style.background = 'rgba(255,255,255,0.13)')}
              onMouseLeave={e => (e.currentTarget.style.background = 'none')}
            >
              <span style={{ fontSize: 15, width: 20, textAlign: 'center' }}>{item.icon}</span>
              {item.label}
            </button>
          ))}
        </div>

        <div style={{
          padding: '7px 12px',
          borderTop: '1px solid rgba(255,255,255,0.1)',
          display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: 4,
          background: 'rgba(0,0,0,0.2)',
        }}>
          <span style={{ color: 'rgba(255,255,255,0.55)', fontSize: 11, marginRight: 6 }}>Shut down</span>
          <ShutdownBtn icon="⏻" title="Log out" onClick={onLogout} />
          <div style={{ width: 1, height: 18, background: 'rgba(255,255,255,0.2)', margin: '0 2px' }} />
          <ShutdownBtn icon="🔒" title="Lock" onClick={onClose} />
          <ShutdownBtn icon="↺" title="Restart" onClick={onClose} />
        </div>
      </div>
    </div>
  );
}

function MenuAppBtn({ icon, label, onClick }: { icon: string; label: string; onClick: () => void }) {
  const [hovered, setHovered] = useState(false);
  return (
    <button onClick={onClick} onMouseEnter={() => setHovered(true)} onMouseLeave={() => setHovered(false)}
      style={{
        display: 'flex', alignItems: 'center', gap: 10,
        width: '100%', padding: '7px 14px',
        background: hovered ? 'rgba(255,255,255,0.12)' : 'none',
        border: 'none', cursor: 'pointer', color: 'white',
        fontSize: 12.5, textAlign: 'left',
        fontFamily: "'Segoe UI', Tahoma, sans-serif", transition: 'background 0.08s',
      }}>
      <span style={{ fontSize: 18, width: 24, textAlign: 'center' }}>{icon}</span>
      {label}
    </button>
  );
}

function ShutdownBtn({ icon, title, onClick }: { icon: string; title: string; onClick: () => void }) {
  const [hovered, setHovered] = useState(false);
  return (
    <button title={title} onClick={onClick}
      onMouseEnter={() => setHovered(true)} onMouseLeave={() => setHovered(false)}
      style={{
        width: 26, height: 26, borderRadius: 3,
        background: hovered
          ? 'linear-gradient(180deg, rgba(255,255,255,0.28) 0%, rgba(255,255,255,0.16) 100%)'
          : 'linear-gradient(180deg, rgba(255,255,255,0.18) 0%, rgba(255,255,255,0.08) 100%)',
        border: `1px solid ${hovered ? 'rgba(255,255,255,0.4)' : 'rgba(255,255,255,0.22)'}`,
        color: 'white', cursor: 'pointer', fontSize: 14,
        display: 'flex', alignItems: 'center', justifyContent: 'center', transition: 'all 0.1s',
      }}>
      {icon}
    </button>
  );
}
