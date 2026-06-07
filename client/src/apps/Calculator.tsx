import React, { useCallback, useEffect, useState } from 'react';

// --- Pure calculator logic, no AI involved ---

type BtnStyle = 'num' | 'op' | 'fn' | 'mem' | 'eq';

const COLORS: Record<BtnStyle, React.CSSProperties> = {
  num: { background: 'linear-gradient(180deg,#f5f5f5 0%,#dedede 100%)', border: '1px solid #b0b0b0', color: '#000' },
  op:  { background: 'linear-gradient(180deg,#ebebeb 0%,#d0d0d0 100%)', border: '1px solid #b0b0b0', color: '#000' },
  fn:  { background: 'linear-gradient(180deg,#e8e8e8 0%,#d0d0d0 100%)', border: '1px solid #aaa',    color: '#000' },
  mem: { background: 'linear-gradient(180deg,#e0e0e0 0%,#c8c8c8 100%)', border: '1px solid #aaa',    color: '#555' },
  eq:  { background: 'linear-gradient(180deg,#d4e8f8 0%,#a8ccec 100%)', border: '1px solid #6ea8d4', color: '#000' },
};

function Btn({ label, onClick, bs, gridStyle }: {
  label: string; onClick: () => void;
  bs: BtnStyle; gridStyle?: React.CSSProperties;
}) {
  const [pressed, setPressed] = useState(false);
  return (
    <button
      onMouseDown={() => setPressed(true)}
      onMouseUp={() => { setPressed(false); onClick(); }}
      onMouseLeave={() => setPressed(false)}
      style={{
        ...COLORS[bs],
        ...gridStyle,
        fontSize: 12, fontFamily: "'Segoe UI', Tahoma, sans-serif",
        cursor: 'default', userSelect: 'none',
        boxShadow: pressed ? 'inset 0 1px 3px rgba(0,0,0,0.25)' : 'inset 0 1px 0 rgba(255,255,255,0.8)',
        borderRadius: 2,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        filter: pressed ? 'brightness(0.92)' : 'none',
        transition: 'filter 0.05s',
      }}
    >
      {label}
    </button>
  );
}

function calc(a: number, op: string, b: number): number {
  switch (op) {
    case '+': return a + b;
    case '-': return a - b;
    case '*': return a * b;
    case '/': return b === 0 ? Infinity : a / b;
    default: return b;
  }
}

function fmt(n: number): string {
  if (!isFinite(n)) return n > 0 ? 'Overflow' : 'Overflow';
  if (isNaN(n)) return 'Not a number';
  if (Number.isInteger(n) && Math.abs(n) < 1e15) return String(n);
  const s = parseFloat(n.toPrecision(14)).toString();
  return s;
}

export function CalculatorApp() {
  const [disp, setDisp]           = useState('0');
  const [expr, setExpr]           = useState('');
  const [op1, setOp1]             = useState<number | null>(null);
  const [operator, setOperator]   = useState<string | null>(null);
  const [replace, setReplace]     = useState(false);
  const [memory, setMemory]       = useState(0);

  const digit = useCallback((d: string) => {
    setDisp(prev => {
      if (replace) { setReplace(false); return d === '.' ? '0.' : d; }
      if (d === '.') return prev.includes('.') ? prev : prev + '.';
      if (prev === '0') return d;
      if (prev.replace(/[.-]/g, '').length >= 16) return prev;
      return prev + d;
    });
  }, [replace]);

  const pressOp = useCallback((newOp: string) => {
    setDisp(prev => {
      const cur = parseFloat(prev);
      if (op1 !== null && operator && !replace) {
        const res = calc(op1, operator, cur);
        const s = fmt(res);
        setOp1(res);
        setOperator(newOp);
        setExpr(`${s} ${newOp}`);
        setReplace(true);
        return s;
      }
      setOp1(cur);
      setOperator(newOp);
      setExpr(`${prev} ${newOp}`);
      setReplace(true);
      return prev;
    });
  }, [op1, operator, replace]);

  const equals = useCallback(() => {
    if (op1 === null || !operator) return;
    const cur = parseFloat(disp);
    const res = calc(op1, operator, cur);
    setDisp(fmt(res));
    setExpr('');
    setOp1(null);
    setOperator(null);
    setReplace(true);
  }, [disp, op1, operator]);

  const clear    = () => { setDisp('0'); setExpr(''); setOp1(null); setOperator(null); setReplace(false); };
  const clearE   = () => { setDisp('0'); setReplace(false); };
  const backsp   = () => { if (replace) return; setDisp(d => d.length > 1 ? d.slice(0, -1) : '0'); };
  const negate   = () => setDisp(d => { const n = -parseFloat(d); return fmt(n); });
  const sqrt_fn  = () => { const n = Math.sqrt(parseFloat(disp)); setDisp(fmt(n)); setReplace(true); };
  const pct      = () => { const base = op1 ?? 0; setDisp(fmt(base * parseFloat(disp) / 100)); setReplace(true); };
  const recip    = () => { const n = parseFloat(disp); setDisp(n === 0 ? 'Cannot divide by zero' : fmt(1/n)); setReplace(true); };

  useEffect(() => {
    const h = (e: KeyboardEvent) => {
      const t = e.target as HTMLElement;
      if (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA') return;
      if ('0123456789'.includes(e.key)) digit(e.key);
      else if (e.key === '.') digit('.');
      else if (e.key === '+') pressOp('+');
      else if (e.key === '-') pressOp('-');
      else if (e.key === '*') pressOp('*');
      else if (e.key === '/') { e.preventDefault(); pressOp('/'); }
      else if (e.key === 'Enter' || e.key === '=') equals();
      else if (e.key === 'Escape') clear();
      else if (e.key === 'Backspace') backsp();
    };
    window.addEventListener('keydown', h);
    return () => window.removeEventListener('keydown', h);
  }, [digit, pressOp, equals]);

  const G = (row: number, col: number, rspan = 1, cspan = 1): React.CSSProperties => ({
    gridRow: `${row} / ${row + rspan}`, gridColumn: `${col} / ${col + cspan}`,
  });

  return (
    <div style={{ display:'flex', flexDirection:'column', height:'100%', background:'#f0f0f0', padding:6, fontFamily:"'Segoe UI',Tahoma,sans-serif" }}>
      {/* Expression line */}
      <div style={{ textAlign:'right', fontSize:11, color:'#888', height:16, paddingRight:4, overflow:'hidden', whiteSpace:'nowrap' }}>{expr}</div>
      {/* Main display */}
      <div style={{ background:'white', border:'1px solid #adadad', margin:'2px 0 6px', padding:'3px 8px', textAlign:'right', fontSize: disp.length > 13 ? 16 : 26, fontWeight:300, minHeight:42, display:'flex', alignItems:'center', justifyContent:'flex-end', overflow:'hidden' }}>
        {disp}
      </div>
      {/* Button grid - 5 cols × 6 rows */}
      <div style={{ flex:1, display:'grid', gridTemplateColumns:'repeat(5,1fr)', gridTemplateRows:'repeat(6,1fr)', gap:3 }}>
        <Btn label="MC" onClick={() => setMemory(0)}               bs="mem" gridStyle={G(1,1)} />
        <Btn label="MR" onClick={() => { setDisp(fmt(memory)); setReplace(true); }} bs="mem" gridStyle={G(1,2)} />
        <Btn label="MS" onClick={() => setMemory(parseFloat(disp))} bs="mem" gridStyle={G(1,3)} />
        <Btn label="M+" onClick={() => setMemory(m => m + parseFloat(disp))} bs="mem" gridStyle={G(1,4)} />
        <Btn label="M-" onClick={() => setMemory(m => m - parseFloat(disp))} bs="mem" gridStyle={G(1,5)} />

        <Btn label="←" onClick={backsp}    bs="fn"  gridStyle={G(2,1)} />
        <Btn label="CE" onClick={clearE}   bs="fn"  gridStyle={G(2,2)} />
        <Btn label="C"  onClick={clear}    bs="fn"  gridStyle={G(2,3)} />
        <Btn label="±"  onClick={negate}   bs="fn"  gridStyle={G(2,4)} />
        <Btn label="√"  onClick={sqrt_fn}  bs="fn"  gridStyle={G(2,5)} />

        <Btn label="7" onClick={() => digit('7')} bs="num" gridStyle={G(3,1)} />
        <Btn label="8" onClick={() => digit('8')} bs="num" gridStyle={G(3,2)} />
        <Btn label="9" onClick={() => digit('9')} bs="num" gridStyle={G(3,3)} />
        <Btn label="÷" onClick={() => pressOp('/')} bs="op" gridStyle={G(3,4)} />
        <Btn label="%" onClick={pct} bs="fn" gridStyle={G(3,5)} />

        <Btn label="4" onClick={() => digit('4')} bs="num" gridStyle={G(4,1)} />
        <Btn label="5" onClick={() => digit('5')} bs="num" gridStyle={G(4,2)} />
        <Btn label="6" onClick={() => digit('6')} bs="num" gridStyle={G(4,3)} />
        <Btn label="×" onClick={() => pressOp('*')} bs="op" gridStyle={G(4,4)} />
        <Btn label="1/x" onClick={recip} bs="fn" gridStyle={G(4,5)} />

        <Btn label="1" onClick={() => digit('1')} bs="num" gridStyle={G(5,1)} />
        <Btn label="2" onClick={() => digit('2')} bs="num" gridStyle={G(5,2)} />
        <Btn label="3" onClick={() => digit('3')} bs="num" gridStyle={G(5,3)} />
        <Btn label="−" onClick={() => pressOp('-')} bs="op" gridStyle={G(5,4)} />
        {/* = spans rows 5-6 */}
        <Btn label="=" onClick={equals} bs="eq" gridStyle={G(5,5,2,1)} />

        {/* 0 spans cols 1-2 */}
        <Btn label="0" onClick={() => digit('0')} bs="num" gridStyle={G(6,1,1,2)} />
        <Btn label="." onClick={() => digit('.')} bs="num" gridStyle={G(6,3)} />
        <Btn label="+" onClick={() => pressOp('+')} bs="op" gridStyle={G(6,4)} />
        {/* col 5 row 6 taken by = */}
      </div>
    </div>
  );
}
