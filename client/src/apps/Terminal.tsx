import React, { useEffect, useRef, useState } from 'react';
import { api } from '../api';
import type { WindowState } from '../types';

interface Props { win: WindowState; onGenerated?: () => void; }

// Fake filesystem
const FS: Record<string, string[]> = {
  'C:\\': ['Users', 'Windows', 'Program Files', 'Program Files (x86)', 'PerfLogs'],
  'C:\\Users\\': ['vermcool', 'Public', 'Default', 'All Users'],
  'C:\\Users\\vermcool\\': ['Desktop', 'Documents', 'Downloads', 'Pictures', 'Music', 'Videos', 'AppData', 'Favorites'],
  'C:\\Users\\vermcool\\Desktop\\': ['VermOS.lnk', 'Internet Explorer.lnk', 'Recycle Bin.lnk'],
  'C:\\Users\\vermcool\\Documents\\': ['README.txt', 'Budget 2009.xlsx', 'My Novel Draft.docx', 'passwords.txt', 'todo_list.txt'],
  'C:\\Users\\vermcool\\Downloads\\': ['setup_chrome_installer.exe', 'vacation_photo_2008.jpg', 'winamp589.exe', 'funny_cat.gif'],
  'C:\\Windows\\System32\\': ['cmd.exe', 'notepad.exe', 'calc.exe', 'mspaint.exe', 'explorer.exe', 'taskmgr.exe'],
};

const IPCONFIG = [
  'Windows IP Configuration',
  '',
  'Ethernet adapter Local Area Connection:',
  '   Connection-specific DNS Suffix  . : localdomain',
  '   IPv4 Address. . . . . . . . . . . : 192.168.1.105',
  '   Subnet Mask . . . . . . . . . . . : 255.255.255.0',
  '   Default Gateway . . . . . . . . . : 192.168.1.1',
  '',
  'Tunnel adapter isatap.localdomain:',
  '   Media State . . . . . . . . . . . : Media disconnected',
  '   Connection-specific DNS Suffix  . : localdomain',
  '',
];

const TASKLIST = [
  'Image Name                     PID Session Name    Mem Usage',
  '========================= ======== ============ ============',
  'System Idle Process              0 Services            24 K',
  'System                           4 Services           476 K',
  'smss.exe                       348 Services           924 K',
  'csrss.exe                      528 Services         6,188 K',
  'wininit.exe                    588 Services         3,468 K',
  'services.exe                   672 Services         6,180 K',
  'lsass.exe                      680 Services         9,232 K',
  'explorer.exe                  2948 Console         47,816 K',
  'iexplore.exe                  3140 Console        124,456 K',
  'mspaint.exe                   3512 Console         18,320 K',
  'notepad.exe                   3688 Console          5,432 K',
  'calc.exe                      3720 Console          6,848 K',
  '',
];

const SYSINFO = [
  'Host Name:                 DESKTOP-VERMOS',
  'OS Name:                   Microsoft Windows 7 Ultimate',
  'OS Version:                6.1.7601 Service Pack 1 Build 7601',
  'OS Manufacturer:           Microsoft Corporation',
  'OS Configuration:          Standalone Workstation',
  'OS Build Type:             Multiprocessor Free',
  'Registered Owner:          vermcool',
  'Registered Organization:   VermOS Industries',
  'Product ID:                00426-OEM-8992662-00400',
  'Original Install Date:     6/5/2026, 3:10:00 AM',
  'System Boot Time:          6/5/2026, 3:10:04 AM',
  'System Manufacturer:       VermOS Hardware Inc.',
  'System Model:              VermOS Virtual PC',
  'System Type:               x64-based PC',
  'Processor(s):              1 Processor(s) Installed.',
  '                           [01]: Intel64 Family 6 Model 58 Stepping 9 GenuineIntel ~2900 Mhz',
  'BIOS Version:              VermOS BIOS v1.0, 6/5/2026',
  'Total Physical Memory:     4,096 MB',
  'Available Physical Memory: 2,048 MB',
  '',
];

function normalize(d: string): string {
  return d.replace(/\/$/, '').toUpperCase();
}

function ping(host: string | undefined): string[] {
  if (!host) return ['Bad parameter.', ''];
  const ms = () => Math.floor(Math.random() * 30) + 5;
  const ip = `192.168.1.${Math.floor(Math.random() * 100) + 100}`;
  return [
    ``,
    `Pinging ${host} [${ip}] with 32 bytes of data:`,
    `Reply from ${ip}: bytes=32 time=${ms()}ms TTL=128`,
    `Reply from ${ip}: bytes=32 time=${ms()}ms TTL=128`,
    `Reply from ${ip}: bytes=32 time=${ms()}ms TTL=128`,
    `Reply from ${ip}: bytes=32 time=${ms()}ms TTL=128`,
    ``,
    `Ping statistics for ${ip}:`,
    `    Packets: Sent = 4, Received = 4, Lost = 0 (0% loss),`,
    `Approximate round trip times in milli-seconds:`,
    `    Minimum = ${ms()}ms, Maximum = ${ms()}ms, Average = ${ms()}ms`,
    ``,
  ];
}

function dirListing(path: string): string[] {
  const norm = normalize(path) + '\\';
  const entries = FS[norm] ?? FS[(norm.endsWith('\\') ? norm : norm + '\\')] ?? [];
  if (entries.length === 0) {
    return [`Volume in drive C is VERMOS`, `Volume Serial Number is 4A2F-B8C1`, ``, ` Directory of ${path}`, ``, `File Not Found`, ``];
  }
  const lines = [
    ` Volume in drive C is VERMOS`,
    ` Volume Serial Number is 4A2F-B8C1`,
    ``,
    ` Directory of ${path}`,
    ``,
    new Date().toLocaleDateString() + '  ' + new Date().toLocaleTimeString() + '    <DIR>          .',
    new Date().toLocaleDateString() + '  ' + new Date().toLocaleTimeString() + '    <DIR>          ..',
  ];
  entries.forEach(e => {
    const isDir = !e.includes('.');
    lines.push(`${new Date().toLocaleDateString()}  ${new Date().toLocaleTimeString()}  ${isDir ? '   <DIR>         ' : '        12,345 '} ${e}`);
  });
  lines.push(``, `  ${entries.filter(e => e.includes('.')).length} File(s)    ${Math.floor(Math.random() * 100000)} bytes`, `  ${entries.filter(e => !e.includes('.')).length} Dir(s)  ${Math.floor(Math.random() * 50000)}MB free`, ``);
  return lines;
}

export function TerminalApp({ win, onGenerated }: Props) {
  const [lines, setLines]     = useState<string[]>([
    'Microsoft Windows [Version 6.1.7601]',
    'Copyright (c) 2009 Microsoft Corporation.  All rights reserved.',
    '',
  ]);
  const [input, setInput]     = useState('');
  const [cwd, setCwd]         = useState('C:\\Users\\vermcool');
  const [history, setHistory] = useState<string[]>([]);
  const [histIdx, setHistIdx] = useState(-1);
  const [busy, setBusy]       = useState(false);
  const bottomRef             = useRef<HTMLDivElement>(null);
  const inputRef              = useRef<HTMLInputElement>(null);

  const prompt = `${cwd}>`;

  const addLines = (newLines: string[]) =>
    setLines(prev => [...prev, ...newLines]);

  const scrollBottom = () =>
    setTimeout(() => bottomRef.current?.scrollIntoView(), 30);

  useEffect(() => { scrollBottom(); }, [lines]);

  const runCommand = async (raw: string) => {
    const cmd = raw.trim();
    addLines([`${prompt}${cmd}`]);
    if (!cmd) { scrollBottom(); return; }

    const parts = cmd.split(/\s+/);
    const verb  = parts[0].toLowerCase();
    const arg1  = parts[1];

    setHistory(h => [cmd, ...h.slice(0, 49)]);
    setHistIdx(-1);

    let out: string[] | null = null;

    switch (verb) {
      case 'cls': case 'clear':
        setLines([]); return;
      case 'dir': case 'ls':
        out = dirListing(arg1 ? cwd + '\\' + arg1 : cwd); break;
      case 'echo':
        out = [parts.slice(1).join(' ') || '', '']; break;
      case 'cd':
        if (!arg1 || arg1 === '.') { out = ['']; break; }
        if (arg1 === '..') {
          const up = cwd.split('\\').slice(0, -1).join('\\') || 'C:\\';
          setCwd(up); out = ['']; break;
        }
        if (arg1.includes(':')) { setCwd(arg1.replace(/\\$/, '') || 'C:\\'); out = ['']; break; }
        setCwd(prev => `${prev}\\${arg1}`); out = ['']; break;
      case 'ver':
        out = ['', 'Microsoft Windows [Version 6.1.7601]', '']; break;
      case 'whoami':
        out = [`DESKTOP-VERMOS\\vermcool`, '']; break;
      case 'hostname':
        out = ['DESKTOP-VERMOS', '']; break;
      case 'date':
        out = [`The current date is: ${new Date().toLocaleDateString('en-US')}`, 'Enter the new date: (mm-dd-yy) ', '']; break;
      case 'time':
        out = [`The current time is: ${new Date().toLocaleTimeString()}`, 'Enter the new time: ', '']; break;
      case 'ipconfig':
        out = IPCONFIG; break;
      case 'ping':
        out = ping(arg1); break;
      case 'tasklist':
        out = TASKLIST; break;
      case 'systeminfo':
        out = SYSINFO; break;
      case 'path':
        out = ['PATH=C:\\Windows\\system32;C:\\Windows;C:\\Windows\\System32\\Wbem;C:\\Program Files\\Internet Explorer', '']; break;
      case 'set':
        if (!arg1) out = [
          'COMPUTERNAME=DESKTOP-VERMOS',
          'OS=Windows_NT',
          'PATHEXT=.COM;.EXE;.BAT;.CMD',
          'PROCESSOR_ARCHITECTURE=AMD64',
          'TEMP=C:\\Users\\vermcool\\AppData\\Local\\Temp',
          'USERNAME=vermcool',
          'USERPROFILE=C:\\Users\\vermcool',
          'WINDIR=C:\\Windows',
          '',
        ]; break;
      case 'type':
        if (!arg1) { out = ['The syntax of this command is incorrect.', '']; break; }
        if (arg1.toLowerCase().includes('readme'))
          out = ['VermOS - AI-powered Windows 7 simulation.', 'Made with love.', ''];
        else if (arg1.toLowerCase().includes('password'))
          out = ['Access denied.', ''];
        else
          out = [`File not found - ${arg1}`, ''];
        break;
      case 'format':
        out = ['The type of the file system is NTFS.', 'WARNING, ALL DATA ON NON-REMOVABLE DISK', 'DRIVE C: WILL BE LOST!', 'Proceed with Format (Y/N)? ... just kidding, not happening.', '']; break;
      case 'shutdown':
        out = ['', '... shutting down VermOS ...', 'Just kidding! VermOS never shuts down.', '']; break;
      case 'help': case '/?':
        out = [
          'For more information on a specific command, type HELP command-name',
          'CLS       Clears the screen.',
          'CD        Displays the name or changes the current directory.',
          'DIR       Displays a list of files and subdirectories in a directory.',
          'ECHO      Displays messages, or turns command echoing on or off.',
          'HELP      Provides Help information for Windows commands.',
          'HOSTNAME  Displays the name of the host.',
          'IPCONFIG  Display all current TCP/IP network configuration values.',
          'PATH      Displays or sets a search path for executable files.',
          'PING      Test a network connection.',
          'SET       Displays, sets, or removes Windows environment variables.',
          'SYSTEMINFO Displays machine specific properties and configuration.',
          'TASKLIST  Displays all currently running tasks.',
          'TIME      Displays or sets the system time.',
          'TYPE      Displays the contents of a text file.',
          'VER       Displays the Windows version.',
          'WHOAMI    Displays user, group and privileges information.',
          '',
        ]; break;
      default:
        // Unknown command — try AI fallback
        setBusy(true);
        try {
          const data = await api.appEvent({
            appKind: 'terminal',
            stateSummary: `User is in directory ${cwd}, running command: ${cmd}`,
            event: `terminal_command:${cmd}`,
            currentHtml: lines.slice(-10).join('\n'),
          });
          // Extract text content from AI HTML
          const div = document.createElement('div');
          div.innerHTML = data.html;
          const text = (div.innerText || div.textContent || data.stateSummary || `'${verb}' is not recognized as an internal or external command.`).split('\n');
          out = [...text, ''];
          onGenerated?.();
        } catch {
          out = [`'${verb}' is not recognized as an internal or external command,`, `operable program or batch file.`, ''];
        } finally {
          setBusy(false);
        }
    }

    if (out) addLines(out);
    scrollBottom();
  };

  const onKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      const cmd = input;
      setInput('');
      runCommand(cmd);
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      const idx = histIdx + 1;
      if (idx < history.length) { setHistIdx(idx); setInput(history[idx]); }
    } else if (e.key === 'ArrowDown') {
      e.preventDefault();
      const idx = histIdx - 1;
      if (idx < 0) { setHistIdx(-1); setInput(''); }
      else { setHistIdx(idx); setInput(history[idx]); }
    } else if (e.key === 'Tab') {
      e.preventDefault();
      // Simple tab completion
      const entries = FS[normalize(cwd) + '\\'] ?? [];
      const match = entries.find(e => e.toLowerCase().startsWith(input.toLowerCase()));
      if (match) setInput(match);
    }
  };

  return (
    <div
      style={{ display:'flex', flexDirection:'column', height:'100%', background:'#000', color:'#c0c0c0', fontFamily:'Consolas,"Courier New",monospace', fontSize:13, cursor:'text' }}
      onClick={() => inputRef.current?.focus()}
    >
      {/* Output */}
      <div style={{ flex:1, overflow:'auto', padding:'4px 6px', whiteSpace:'pre-wrap', wordBreak:'break-all' }}>
        {lines.map((l, i) => <div key={i} style={{ lineHeight:1.4 }}>{l || ' '}</div>)}
        {busy && <div style={{ color:'#aaa', animation:'none' }}>Processing...</div>}
        <div ref={bottomRef} />
      </div>
      {/* Input line */}
      <div style={{ display:'flex', padding:'2px 6px 4px', background:'#000', borderTop:'1px solid #333' }}>
        <span style={{ whiteSpace:'nowrap', marginRight:2 }}>{prompt}</span>
        <input
          ref={inputRef}
          autoFocus
          value={input}
          onChange={e => setInput(e.target.value)}
          onKeyDown={onKeyDown}
          disabled={busy}
          style={{
            flex:1, background:'transparent', border:'none', outline:'none',
            color:'#c0c0c0', fontFamily:'inherit', fontSize:'inherit', caretColor:'white',
          }}
        />
      </div>
    </div>
  );
}
