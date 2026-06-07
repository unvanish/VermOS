import React, { useCallback, useEffect, useRef, useState } from 'react';

type Tool = 'pencil' | 'eraser' | 'fill' | 'line' | 'rect' | 'ellipse' | 'select';
type Size = 1 | 2 | 3 | 5 | 8;

// Standard Windows 7 Paint color palette
const PALETTE = [
  '#000000','#808080','#800000','#808000','#008000','#008080','#000080','#800080',
  '#c0c0c0','#ffffff','#ff0000','#ffff00','#00ff00','#00ffff','#0000ff','#ff00ff',
  '#804000','#804040','#004080','#408000','#004040','#400080','#000040','#804080',
  '#ff8040','#ff8080','#80ff80','#80ffff','#8080ff','#ff80ff','#804040','#408080',
];

function floodFill(ctx: CanvasRenderingContext2D, x: number, y: number, fillColorHex: string) {
  const img = ctx.getImageData(0, 0, ctx.canvas.width, ctx.canvas.height);
  const { data, width, height } = img;
  const i0 = (Math.floor(y) * width + Math.floor(x)) * 4;
  const tr = data[i0], tg = data[i0+1], tb = data[i0+2], ta = data[i0+3];

  const fc = parseInt(fillColorHex.slice(1), 16);
  const fr = (fc >> 16) & 0xff, fg = (fc >> 8) & 0xff, fb = fc & 0xff;
  if (tr === fr && tg === fg && tb === fb && ta === 255) return;

  const stack = [[Math.floor(x), Math.floor(y)]];
  const seen = new Set<number>();
  while (stack.length) {
    const [cx, cy] = stack.pop()!;
    const idx = (cy * width + cx) * 4;
    if (cx < 0 || cy < 0 || cx >= width || cy >= height) continue;
    if (seen.has(idx)) continue;
    if (data[idx] !== tr || data[idx+1] !== tg || data[idx+2] !== tb || data[idx+3] !== ta) continue;
    seen.add(idx);
    data[idx] = fr; data[idx+1] = fg; data[idx+2] = fb; data[idx+3] = 255;
    stack.push([cx+1,cy],[cx-1,cy],[cx,cy+1],[cx,cy-1]);
  }
  ctx.putImageData(img, 0, 0);
}

export function PaintApp() {
  const canvasRef    = useRef<HTMLCanvasElement>(null);
  const snapRef      = useRef<ImageData | null>(null);
  const startRef     = useRef<{x:number;y:number}|null>(null);
  const drawing      = useRef(false);

  const [tool, setTool]   = useState<Tool>('pencil');
  const [color, setColor] = useState('#000000');
  const [bgColor, setBgColor] = useState('#ffffff');
  const [size, setSize]   = useState<Size>(1);
  const [zoom]            = useState(1);
  const [canvasW]         = useState(800);
  const [canvasH]         = useState(480);

  // Init canvas with white
  useEffect(() => {
    const ctx = canvasRef.current?.getContext('2d');
    if (!ctx) return;
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, canvasW, canvasH);
  }, [canvasW, canvasH]);

  const getPos = (e: React.MouseEvent<HTMLCanvasElement>): {x:number;y:number} => {
    const r = canvasRef.current!.getBoundingClientRect();
    return { x: (e.clientX - r.left) / zoom, y: (e.clientY - r.top) / zoom };
  };

  const onMouseDown = useCallback((e: React.MouseEvent<HTMLCanvasElement>) => {
    const ctx = canvasRef.current?.getContext('2d');
    if (!ctx) return;
    const pos = getPos(e);
    drawing.current = true;
    startRef.current = pos;
    snapRef.current = ctx.getImageData(0, 0, canvasW, canvasH);

    if (tool === 'fill') {
      floodFill(ctx, pos.x, pos.y, e.button === 2 ? bgColor : color);
      drawing.current = false;
    } else {
      ctx.beginPath();
      ctx.moveTo(pos.x, pos.y);
    }
  }, [tool, color, bgColor, canvasW, canvasH]);

  const onMouseMove = useCallback((e: React.MouseEvent<HTMLCanvasElement>) => {
    if (!drawing.current) return;
    const ctx = canvasRef.current?.getContext('2d');
    if (!ctx) return;
    const pos = getPos(e);
    const start = startRef.current!;
    const col = e.buttons === 2 ? bgColor : color;

    if (tool === 'pencil') {
      ctx.strokeStyle = col; ctx.lineWidth = size; ctx.lineCap = 'round'; ctx.lineJoin = 'round';
      ctx.lineTo(pos.x, pos.y); ctx.stroke();
    } else if (tool === 'eraser') {
      ctx.strokeStyle = '#ffffff'; ctx.lineWidth = size * 6; ctx.lineCap = 'square';
      ctx.lineTo(pos.x, pos.y); ctx.stroke();
    } else if (['line','rect','ellipse'].includes(tool)) {
      ctx.putImageData(snapRef.current!, 0, 0);
      ctx.strokeStyle = col; ctx.lineWidth = size;
      if (tool === 'line') {
        ctx.beginPath(); ctx.moveTo(start.x, start.y); ctx.lineTo(pos.x, pos.y); ctx.stroke();
      } else if (tool === 'rect') {
        ctx.strokeRect(start.x, start.y, pos.x - start.x, pos.y - start.y);
      } else {
        const cx = (start.x+pos.x)/2, cy = (start.y+pos.y)/2;
        const rx = Math.abs(pos.x-start.x)/2, ry = Math.abs(pos.y-start.y)/2;
        ctx.beginPath(); ctx.ellipse(cx, cy, rx||1, ry||1, 0, 0, Math.PI*2); ctx.stroke();
      }
    }
  }, [tool, color, bgColor, size]);

  const onMouseUp = () => { drawing.current = false; };

  const clearCanvas = () => {
    const ctx = canvasRef.current?.getContext('2d');
    if (!ctx) return;
    ctx.fillStyle = '#ffffff'; ctx.fillRect(0, 0, canvasW, canvasH);
  };

  const saveImage = () => {
    const a = document.createElement('a');
    a.href = canvasRef.current?.toDataURL('image/png') ?? '';
    a.download = 'untitled.png';
    a.click();
  };

  const TOOLS: { id: Tool; icon: string; title: string }[] = [
    { id:'select',  icon:'⬚', title:'Select' },
    { id:'pencil',  icon:'✏️', title:'Pencil' },
    { id:'fill',    icon:'🪣', title:'Fill (Bucket)' },
    { id:'eraser',  icon:'⬜', title:'Eraser' },
    { id:'line',    icon:'╱',  title:'Line' },
    { id:'rect',    icon:'▭',  title:'Rectangle' },
    { id:'ellipse', icon:'◯',  title:'Ellipse' },
  ];

  const SIZES: Size[] = [1, 2, 3, 5, 8];

  return (
    <div style={{ display:'flex', flexDirection:'column', height:'100%', background:'#f0f0f0', fontFamily:"'Segoe UI',Tahoma,sans-serif" }}>
      {/* Ribbon/Toolbar */}
      <div style={{ background:'#dce6f0', borderBottom:'1px solid #aaa', padding:'4px 8px', display:'flex', alignItems:'center', gap:16, flexShrink:0, flexWrap:'wrap' }}>
        {/* Tools */}
        <div>
          <div style={{ fontSize:9, color:'#666', marginBottom:2, fontWeight:600 }}>TOOLS</div>
          <div style={{ display:'flex', gap:2, flexWrap:'wrap', maxWidth:120 }}>
            {TOOLS.map(t => (
              <button key={t.id} title={t.title} onClick={() => setTool(t.id)} style={{
                width:26, height:26, fontSize:14, cursor:'default', borderRadius:2,
                background: tool === t.id ? '#a8c8e8' : 'linear-gradient(180deg,#f5f5f5,#dedede)',
                border: tool === t.id ? '1px solid #5090c0' : '1px solid #aaa',
                display:'flex', alignItems:'center', justifyContent:'center',
              }}>{t.icon}</button>
            ))}
          </div>
        </div>

        {/* Divider */}
        <div style={{ width:1, height:48, background:'#bbb' }} />

        {/* Brush sizes */}
        <div>
          <div style={{ fontSize:9, color:'#666', marginBottom:2, fontWeight:600 }}>SIZE</div>
          <div style={{ display:'flex', flexDirection:'column', gap:3 }}>
            {SIZES.map(s => (
              <div key={s} onClick={() => setSize(s)} style={{ cursor:'default', display:'flex', alignItems:'center' }}>
                <div style={{
                  width: s * 2.5 + 4, height: s * 2.5 + 4,
                  background: size === s ? '#000' : '#555',
                  borderRadius:'50%',
                  border: size === s ? '1px solid #3399ff' : '1px solid transparent',
                }} />
              </div>
            ))}
          </div>
        </div>

        {/* Divider */}
        <div style={{ width:1, height:48, background:'#bbb' }} />

        {/* Color palette */}
        <div>
          <div style={{ fontSize:9, color:'#666', marginBottom:2, fontWeight:600 }}>COLORS</div>
          {/* Active colors */}
          <div style={{ position:'relative', width:36, height:36, marginBottom:4 }}>
            <div style={{ position:'absolute', top:8, left:8, width:22, height:22, background:bgColor, border:'2px solid #888' }} />
            <div
              style={{ position:'absolute', top:0, left:0, width:22, height:22, background:color, border:'2px solid #444', cursor:'default' }}
              title="Left click = foreground, right click = background"
            />
          </div>
          {/* Palette grid */}
          <div style={{ display:'grid', gridTemplateColumns:'repeat(8,1fr)', gap:1 }}>
            {PALETTE.map(c => (
              <div key={c} onClick={() => setColor(c)} onContextMenu={e => { e.preventDefault(); setBgColor(c); }}
                   title={c}
                   style={{ width:14, height:14, background:c, cursor:'default', border: c === color ? '2px solid #000' : '1px solid rgba(0,0,0,0.2)' }} />
            ))}
          </div>
        </div>

        {/* Divider */}
        <div style={{ width:1, height:48, background:'#bbb' }} />

        {/* Actions */}
        <div>
          <div style={{ fontSize:9, color:'#666', marginBottom:2, fontWeight:600 }}>FILE</div>
          <div style={{ display:'flex', flexDirection:'column', gap:3 }}>
            <PaintBtn onClick={saveImage}>Save PNG</PaintBtn>
            <PaintBtn onClick={clearCanvas}>New</PaintBtn>
          </div>
        </div>
      </div>

      {/* Canvas area */}
      <div style={{ flex:1, overflow:'auto', background:'#808080', padding:8 }}>
        <canvas
          ref={canvasRef}
          width={canvasW} height={canvasH}
          onMouseDown={onMouseDown}
          onMouseMove={onMouseMove}
          onMouseUp={onMouseUp}
          onMouseLeave={onMouseUp}
          onContextMenu={e => e.preventDefault()}
          style={{ display:'block', cursor: tool === 'fill' ? 'crosshair' : tool === 'eraser' ? 'cell' : 'crosshair', imageRendering:'pixelated' }}
        />
      </div>

      {/* Status bar */}
      <div style={{ borderTop:'1px solid #bbb', background:'#f0f0f0', fontSize:11, padding:'1px 8px', flexShrink:0 }}>
        {tool.charAt(0).toUpperCase() + tool.slice(1)} tool — left click: foreground, right click: background
      </div>
    </div>
  );
}

function PaintBtn({ children, onClick }: { children: React.ReactNode; onClick: () => void }) {
  return (
    <button onClick={onClick} style={{
      fontSize:11, padding:'2px 8px', cursor:'default', borderRadius:2,
      background:'linear-gradient(180deg,#f5f5f5,#dedede)', border:'1px solid #aaa',
      fontFamily:"'Segoe UI',Tahoma,sans-serif",
    }}>{children}</button>
  );
}
