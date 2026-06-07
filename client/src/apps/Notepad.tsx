import React, { useCallback, useEffect, useRef, useState } from 'react';
import type { WindowState } from '../types';
import { useWindowsStore } from '../hooks/useWindows';

interface Props { win: WindowState; }

type MenuItem =
  | { label: string; shortcut?: string; action: () => void; checked?: boolean; disabled?: boolean }
  | 'sep';

function extractText(html: string): string {
  try {
    const d = document.createElement('div');
    d.innerHTML = html;
    // Prefer <pre> content (new seed style)
    const pre = d.querySelector('pre');
    if (pre) return pre.innerText || pre.textContent || '';
    // Fall back to text only if it doesn't look like full UI HTML
    const text = d.innerText || d.textContent || '';
    // If text starts with common menu labels, it's UI HTML — skip it
    if (/^(File|Edit|View|Format|Help|Tools|Favorites)/i.test(text.trim())) return '';
    return text;
  } catch { return ''; }
}

const INITIAL = `Welcome to VermOS Notepad
========================

This is a fully functional text editor.
Try the File, Edit, and Format menus above.

Tips:
  Ctrl+S  — Save (downloads as .txt)
  Ctrl+A  — Select all
  Ctrl+F  — Find
  F5      — Insert date and time
  Ctrl+Z  — Undo
`;

export function NotepadApp({ win }: Props) {
  const { closeWindow } = useWindowsStore();
  const taRef = useRef<HTMLTextAreaElement>(null);

  // Use AI-provided content if available, else default text
  const initialText = win.appData?.html
    ? extractText(win.appData.html)
    : INITIAL;

  const [text, setText]         = useState(initialText);
  const [wordWrap, setWordWrap] = useState(false);
  const [statusBar, setStatusBar] = useState(true);
  const [activeMenu, setActiveMenu] = useState<string | null>(null);
  const [title, setTitle]       = useState('Untitled - Notepad');
  const [dirty, setDirty]       = useState(false);

  // Find dialog state
  const [findOpen, setFindOpen] = useState(false);
  const [findText, setFindText] = useState('');
  const [findIdx, setFindIdx]   = useState(-1);

  // Status bar info
  const [ln, setLn]   = useState(1);
  const [col, setCol] = useState(1);

  const updateCursor = () => {
    const ta = taRef.current;
    if (!ta) return;
    const s = ta.value.substring(0, ta.selectionStart);
    const lines = s.split('\n');
    setLn(lines.length);
    setCol(lines[lines.length - 1].length + 1);
  };

  const onChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setText(e.target.value);
    setDirty(true);
    updateCursor();
  };

  const saveFile = useCallback(() => {
    const blob = new Blob([text], { type: 'text/plain' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = title.replace(' - Notepad', '') || 'Untitled';
    a.click();
    setDirty(false);
  }, [text, title]);

  const newFile = useCallback(() => {
    if (dirty && !confirm('Do you want to save changes?')) return;
    setText('');
    setTitle('Untitled - Notepad');
    setDirty(false);
  }, [dirty]);

  const insertDateTime = useCallback(() => {
    const ta = taRef.current;
    if (!ta) return;
    const dt = new Date().toLocaleString();
    const start = ta.selectionStart;
    const end = ta.selectionEnd;
    const newText = text.slice(0, start) + dt + text.slice(end);
    setText(newText);
    setTimeout(() => { ta.selectionStart = ta.selectionEnd = start + dt.length; }, 0);
  }, [text]);

  const findNext = useCallback(() => {
    if (!findText) return;
    const pos = text.indexOf(findText, findIdx + 1);
    if (pos === -1) { alert(`Cannot find "${findText}"`); return; }
    setFindIdx(pos);
    const ta = taRef.current;
    if (ta) { ta.focus(); ta.setSelectionRange(pos, pos + findText.length); }
  }, [text, findText, findIdx]);

  // Keyboard shortcuts
  useEffect(() => {
    const h = (e: KeyboardEvent) => {
      if (!taRef.current?.contains(document.activeElement) && document.activeElement !== taRef.current) return;
      if (e.ctrlKey) {
        if (e.key === 's') { e.preventDefault(); saveFile(); }
        if (e.key === 'f') { e.preventDefault(); setFindOpen(true); }
      }
      if (e.key === 'F5') { e.preventDefault(); insertDateTime(); }
    };
    window.addEventListener('keydown', h);
    return () => window.removeEventListener('keydown', h);
  }, [saveFile, insertDateTime]);

  // Close menu on outside click
  useEffect(() => {
    if (!activeMenu) return;
    const h = () => setActiveMenu(null);
    setTimeout(() => document.addEventListener('mousedown', h), 0);
    return () => document.removeEventListener('mousedown', h);
  }, [activeMenu]);

  const MENUS: Record<string, MenuItem[]> = {
    File: [
      { label: 'New',       shortcut: 'Ctrl+N', action: newFile },
      { label: 'Open...',   shortcut: 'Ctrl+O', action: () => document.getElementById('np-open-input')?.click() },
      { label: 'Save',      shortcut: 'Ctrl+S', action: saveFile },
      { label: 'Save As...', action: saveFile },
      'sep',
      { label: 'Page Setup...', action: () => {} },
      { label: 'Print...',  shortcut: 'Ctrl+P', action: () => window.print() },
      'sep',
      { label: 'Exit', action: () => {
        if (dirty && !confirm('Save changes?')) return;
        closeWindow(win.id);
      }},
    ],
    Edit: [
      { label: 'Undo',      shortcut: 'Ctrl+Z', action: () => document.execCommand('undo') },
      'sep',
      { label: 'Cut',       shortcut: 'Ctrl+X', action: () => document.execCommand('cut') },
      { label: 'Copy',      shortcut: 'Ctrl+C', action: () => document.execCommand('copy') },
      { label: 'Paste',     shortcut: 'Ctrl+V', action: () => document.execCommand('paste') },
      { label: 'Delete',    shortcut: 'Del',    action: () => document.execCommand('delete') },
      'sep',
      { label: 'Find...',   shortcut: 'Ctrl+F', action: () => setFindOpen(true) },
      { label: 'Find Next', shortcut: 'F3',     action: findNext },
      { label: 'Replace...', shortcut: 'Ctrl+H', action: () => setFindOpen(true) },
      { label: 'Go To...',  shortcut: 'Ctrl+G', action: () => {} },
      'sep',
      { label: 'Select All', shortcut: 'Ctrl+A', action: () => taRef.current?.select() },
      { label: 'Time/Date', shortcut: 'F5',      action: insertDateTime },
    ],
    Format: [
      { label: 'Word Wrap', checked: wordWrap, action: () => setWordWrap(w => !w) },
      { label: 'Font...', action: () => alert('VermOS Notepad\nFont: Consolas 12pt\n(Font settings not configurable in this version)') },
    ],
    View: [
      { label: 'Status Bar', checked: statusBar, action: () => setStatusBar(s => !s) },
    ],
    Help: [
      { label: 'View Help', action: () => {} },
      'sep',
      { label: 'About Notepad', action: () => alert('Notepad\nVermOS Edition 1.0\n\nMicrosoft Windows [Version 6.1.7601]\nFor VermOS use only') },
    ],
  };

  return (
    <div style={{ display:'flex', flexDirection:'column', height:'100%', fontFamily:"'Segoe UI',Tahoma,sans-serif" }}>
      {/* Hidden file input for Open */}
      <input id="np-open-input" type="file" accept=".txt,.md,.js,.ts,.py,.css,.html,.json" style={{ display:'none' }} onChange={e => {
        const f = e.target.files?.[0];
        if (!f) return;
        const r = new FileReader();
        r.onload = ev => { setText(String(ev.target?.result ?? '')); setTitle(`${f.name} - Notepad`); setDirty(false); };
        r.readAsText(f);
      }} />

      {/* Menu bar */}
      <div style={{ display:'flex', background:'#f0f0f0', borderBottom:'1px solid #d0d0d0', flexShrink:0 }}
           onMouseDown={e => e.stopPropagation()}>
        {Object.keys(MENUS).map(name => (
          <div key={name} style={{ position:'relative' }}>
            <div
              onMouseDown={() => setActiveMenu(a => a === name ? null : name)}
              style={{
                padding:'3px 8px', fontSize:12, cursor:'default',
                background: activeMenu === name ? '#3399ff' : 'transparent',
                color: activeMenu === name ? 'white' : '#000',
                userSelect:'none',
              }}
            >
              {name}
            </div>
            {activeMenu === name && (
              <div style={{
                position:'fixed', background:'white', border:'1px solid #999',
                boxShadow:'2px 2px 6px rgba(0,0,0,0.2)', zIndex:9999, minWidth:210,
              }}>
                {MENUS[name].map((item, i) =>
                  item === 'sep'
                    ? <div key={i} style={{ height:1, background:'#e0e0e0', margin:'3px 0' }} />
                    : <div
                        key={i}
                        onMouseDown={() => { item.action(); setActiveMenu(null); }}
                        style={{
                          padding:'4px 28px 4px 24px', fontSize:12, cursor:'default',
                          display:'flex', justifyContent:'space-between', gap:24,
                          color: item.disabled ? '#aaa' : '#000',
                          position:'relative',
                        }}
                        onMouseEnter={e => (e.currentTarget.style.background = item.disabled ? '' : '#3399ff')}
                        onMouseLeave={e => (e.currentTarget.style.background = '')}
                        onMouseOver={e => (e.currentTarget.style.color = item.disabled ? '#aaa' : 'white')}
                        onMouseOut={e => (e.currentTarget.style.color = item.disabled ? '#aaa' : '#000')}
                      >
                        {item.checked && <span style={{ position:'absolute', left:6, top:4 }}>✓</span>}
                        <span>{item.label}</span>
                        {item.shortcut && <span style={{ color:'#888', fontSize:11 }}>{item.shortcut}</span>}
                      </div>
                )}
              </div>
            )}
          </div>
        ))}
      </div>

      {/* Text area */}
      <textarea
        ref={taRef}
        value={text}
        onChange={onChange}
        onKeyUp={updateCursor}
        onClick={updateCursor}
        spellCheck={false}
        style={{
          flex:1, resize:'none', border:'none', outline:'none', padding:'4px 6px',
          fontFamily:'Consolas, "Courier New", monospace', fontSize:13, lineHeight:1.5,
          whiteSpace: wordWrap ? 'pre-wrap' : 'pre',
          overflowX: wordWrap ? 'hidden' : 'scroll',
          background:'white', color:'#000',
        }}
      />

      {/* Status bar */}
      {statusBar && (
        <div style={{
          borderTop:'1px solid #d0d0d0', background:'#f0f0f0',
          display:'flex', fontSize:11, padding:'1px 4px', gap:16, flexShrink:0,
        }}>
          <span>Ln {ln}, Col {col}</span>
          <span style={{ marginLeft:'auto' }}>100%</span>
          <span>Windows (CRLF)</span>
          <span>UTF-8</span>
        </div>
      )}

      {/* Find dialog */}
      {findOpen && (
        <div style={{
          position:'absolute', top:60, left:'50%', transform:'translateX(-50%)',
          background:'#f0f0f0', border:'1px solid #999', padding:12, zIndex:500,
          boxShadow:'2px 2px 6px rgba(0,0,0,0.3)', width:380, fontFamily:"'Segoe UI',Tahoma,sans-serif",
        }}>
          <div style={{ fontWeight:600, marginBottom:10, fontSize:12 }}>Find</div>
          <div style={{ display:'flex', alignItems:'center', gap:8, marginBottom:10 }}>
            <label style={{ fontSize:12, width:70, flexShrink:0 }}>Find what:</label>
            <input
              autoFocus value={findText}
              onChange={e => { setFindText(e.target.value); setFindIdx(-1); }}
              onKeyDown={e => e.key === 'Enter' && findNext()}
              style={{ flex:1, padding:'2px 6px', border:'1px solid #999', fontSize:12 }}
            />
          </div>
          <div style={{ display:'flex', justifyContent:'flex-end', gap:6 }}>
            <Np7Btn onClick={findNext}>Find Next</Np7Btn>
            <Np7Btn onClick={() => setFindOpen(false)}>Cancel</Np7Btn>
          </div>
        </div>
      )}
    </div>
  );
}

function Np7Btn({ children, onClick }: { children: React.ReactNode; onClick: () => void }) {
  return (
    <button onClick={onClick} style={{
      padding:'3px 16px', fontSize:12, cursor:'default',
      background:'linear-gradient(180deg,#f5f5f5,#dedede)',
      border:'1px solid #b0b0b0', borderRadius:3,
      fontFamily:"'Segoe UI',Tahoma,sans-serif",
    }}>
      {children}
    </button>
  );
}
