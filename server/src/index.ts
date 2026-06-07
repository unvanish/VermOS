import path from 'path';
import express, { Request, Response, NextFunction } from 'express';
import session from 'express-session';
import cors from 'cors';
import dotenv from 'dotenv';

dotenv.config();

// Augment express-session with VermOS session fields
declare module 'express-session' {
  interface SessionData {
    authenticated: boolean;
    username: string;
  }
}

const app = express();
const PORT = parseInt(process.env.PORT || '3001', 10);

// Hardcoded prototype credentials — server-side only, never sent to client
const VALID_USERNAME = 'vermcool';
const VALID_PASSWORD = 'VermLoveDestin123';

// OpenRouter config
const OPENROUTER_URL = 'https://openrouter.ai/api/v1/chat/completions';
const MODEL = 'deepseek/deepseek-v4-flash';

const SYSTEM_PROMPT = `You are VermOS — a Windows 7-era application generator. Your output runs in a sandboxed iframe with full JavaScript execution.

CRITICAL: Respond with ONLY valid JSON. No markdown, no code fences, no extra text.

JSON schema (all fields required):
{
  "title": "window title text",
  "appKind": "custom",
  "stateSummary": "1 sentence describing what was generated",
  "html": "COMPLETE HTML DOCUMENT — rules below",
  "css": "",
  "suggestedActions": []
}

━━ HTML FIELD — ABSOLUTE RULES ━━
1. ALWAYS start with <!DOCTYPE html> and include a complete <html><head>...</head><body>...</body></html> structure.
2. USE SINGLE QUOTES for ALL HTML attribute values: style='color:red' onclick='fn()'   — NEVER double quotes in attributes.
3. USE SINGLE QUOTES or template literals in JavaScript strings: let x = 'hello'  const y = \`world\`
4. The html field MUST contain a real, working application. NEVER return empty html, raw text, or prose descriptions.
5. NEVER say "this would show..." — BUILD the actual thing.

━━ CRITICAL — NO WINDOW CHROME ━━
NEVER include a window title bar, caption bar, or minimize/maximize/close buttons anywhere in your HTML.
The VermOS window system already wraps your output in a window with its own title bar and controls.
Your HTML is ONLY the interior content of the window — the body/content area, nothing else.

━━ WINDOWS 7 STYLE ━━
body: background:#f0f0f0; font-family:'Segoe UI',Tahoma,sans-serif; margin:0; padding:8px;
Buttons: background:linear-gradient(180deg,#f5f5f5,#ddd); border:1px solid #aaa; border-radius:3px; padding:4px 14px; cursor:pointer;
Toolbars/panels: background:#e8e8e8; border-bottom:1px solid #bbb; padding:4px 8px;
Section headers (e.g. toolbar strip or panel heading): background:linear-gradient(180deg,#4a90d4,#2060b0); color:white; padding:6px 12px;

━━ FOR GAMES (Connect 4, Chess, Minesweeper, Solitaire, Snake, Tic-Tac-Toe etc.) ━━
• Implement FULL game logic in <script>
• Render board/grid as HTML table or CSS grid with working onclick= handlers
• Track full game state in JavaScript variables
• Implement win detection, turn alternation, score keeping
• Include a restart/new game button

━━ FOR UTILITIES (Calculator, Clock, Timer, Calendar, Unit Converter) ━━
• Implement REAL logic: calculator does arithmetic, clock shows current time with setInterval, timer counts down
• All buttons trigger real state changes

━━ FOR CONTENT APPS (File Explorer, Email, Media Player, Social Media) ━━
• Invent convincing fake data (filenames, emails, posts, songs)
• Make UI interactions work: clicking a file opens it, clicking compose shows a form, etc.

NEVER use fetch(), XMLHttpRequest, or external URLs — the sandbox blocks network access.
Fake data is encouraged and expected.`;


// Dedicated system prompt for browser page generation — web aesthetic, href-based navigation
// Used for the non-streaming JSON path (cache fallback)
const BROWSER_SYSTEM_PROMPT = `You are VermOS — a generative web-history simulator inside a fake Internet Explorer 8 browser.
Respond with ONLY valid JSON (no markdown, no fences):
{ "title":"...", "appKind":"browser", "stateSummary":"...", "html":"...body HTML only...", "css":"", "suggestedActions":[] }
All navigation links MUST use <a href="...">. Search forms: <form><input type="search" name="q"><button type="submit">. Inline styles only.`;

// Used for the streaming path — AI returns raw HTML with no JSON wrapper
const STREAM_BROWSER_SYSTEM_PROMPT = `You are VermOS — generating a webpage for a fake Internet Explorer 8 browser running in a retro OS.

Return ONLY raw HTML body content. NO JSON. NO code fences. NO explanation. Start immediately with an HTML tag.

STRUCTURE — use SEPARATE flat top-level elements (not one giant wrapper div):
<header style="...">nav bar</header>
<div style="...">hero / banner</div>
<div style="...">main content articles</div>
<aside style="...">sidebar</aside>
<footer style="...">footer links</footer>

NAVIGATION (critical):
- Every nav link, article title, sidebar link, footer link → <a href="..."> with absolute path or full URL
- Search forms → <form><input type="search" name="q" value="..."><button type="submit">Search</button></form>
- Include 10–15 clickable links total

STYLE: inline CSS only, no external resources, no <script> tags, no <link> tags.
Match the site's authentic 2008–2012 branding and color scheme.
Generate realistic fake content — article titles, bylines, dates, teasers.`;

// Fast model for search suggestions — minimal tokens needed
const SUGGESTIONS_MODEL = 'meta-llama/llama-3.1-8b-instruct';

// --- In-memory generation cache ---

const MAX_CACHE = 200;
const genCache = new Map<string, AppJSON>();

function getCached(key: string): AppJSON | undefined {
  return genCache.get(key);
}

function putCached(key: string, val: AppJSON): void {
  if (genCache.size >= MAX_CACHE) {
    const oldest = genCache.keys().next().value;
    if (oldest !== undefined) genCache.delete(oldest);
  }
  genCache.set(key, val);
}

// --- Middleware ---

// Serve built React client in production (before CORS so static assets bypass CORS checks)
app.use(express.static(path.join(__dirname, '../../client/dist')));

// Accept localhost (dev) and production domains
app.use(cors({
  origin: (origin, callback) => {
    if (!origin || /^http:\/\/localhost(:\d+)?$/.test(origin) || /\.railway\.app$/.test(origin) || /crazy\.rip$/.test(origin)) {
      callback(null, true);
    } else {
      callback(new Error(`CORS: origin ${origin} not allowed`));
    }
  },
  credentials: true,
}));

app.use(express.json({ limit: '2mb' }));

app.use(session({
  secret: process.env.SESSION_SECRET || 'vermos-dev-secret-replace-in-production',
  resave: false,
  saveUninitialized: false,
  cookie: {
    httpOnly: true,
    sameSite: 'lax',
    secure: false, // must be true in production with HTTPS
    maxAge: 24 * 60 * 60 * 1000, // 24 hours
  },
}));

// --- Auth middleware ---

function requireAuth(req: Request, res: Response, next: NextFunction): void {
  if (!req.session.authenticated) {
    res.status(401).json({ error: 'Unauthorized — please log in' });
    return;
  }
  next();
}

// --- OpenRouter integration ---

interface Message {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

interface AppJSON {
  title: string;
  appKind: string;
  stateSummary: string;
  html: string;
  css?: string;
  suggestedActions: Array<{ label: string; event: string }>;
}

async function callOpenRouter(messages: Message[]): Promise<string> {
  const apiKey = process.env.OPENROUTER_API_KEY;
  if (!apiKey) {
    throw new Error('OPENROUTER_API_KEY is not configured. Check server/.env');
  }

  const response = await fetch(OPENROUTER_URL, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${apiKey}`,
      'HTTP-Referer': 'http://localhost:5173',
      'X-Title': 'VermOS',
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: MODEL,
      messages,
      response_format: { type: 'json_object' }, // prevents markdown fences around JSON
      max_tokens: 8192,  // raised — full HTML docs with JS can be long
      temperature: 0.75,
    }),
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`OpenRouter ${response.status}: ${text}`);
  }

  const data = await response.json() as {
    choices: Array<{ message: { content: string } }>;
  };

  if (!data.choices?.[0]?.message?.content) {
    throw new Error('Empty response from OpenRouter');
  }

  return data.choices[0].message.content;
}

// Validate and repair the html field of an AppJSON response.
// Catches the most common AI failure modes: empty html, raw prose, markdown fences.
function repairAppHtml(data: AppJSON): AppJSON {
  let html = (data.html ?? '').trim();

  // Strip any accidental markdown code fences
  html = html.replace(/^```(?:html|HTML)?\r?\n?/, '').replace(/\r?\n?```\s*$/, '').trim();

  // If AI returned a JSON object as the html field value, try to extract html from it
  if (html.startsWith('{')) {
    try {
      const inner = JSON.parse(html) as Record<string, unknown>;
      if (typeof inner.html === 'string') html = (inner.html as string).trim();
    } catch { /* not JSON, leave as-is */ }
  }

  // If still no HTML tags at all (raw prose / description), wrap it in a styled error page
  if (html && !/<[a-zA-Z]/.test(html)) {
    const safe = html.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
    html = `<!DOCTYPE html><html><head><meta charset='utf-8'><style>body{font-family:'Segoe UI',Tahoma,sans-serif;background:#f0f0f0;padding:20px;margin:0;white-space:pre-wrap;font-size:12px;line-height:1.5;}</style></head><body>${safe}</body></html>`;
  }

  // If html is empty, generate a visible error state
  if (!html) {
    html = `<!DOCTYPE html><html><head><meta charset='utf-8'><style>body{display:flex;align-items:center;justify-content:center;height:100vh;margin:0;background:#f0f0f0;font-family:'Segoe UI',Tahoma,sans-serif;}</style></head><body><div style='text-align:center;color:#888'><div style='font-size:48px;margin-bottom:12px'>⚠️</div><p>Generation was incomplete. Open a new window and try again.</p></div></body></html>`;
  }

  return { ...data, html };
}

// Wraps callOpenRouter with one JSON repair attempt on parse failure
async function callWithRepair(messages: Message[]): Promise<AppJSON> {
  const raw = await callOpenRouter(messages);

  try {
    return JSON.parse(raw) as AppJSON;
  } catch {
    console.warn('[VermOS] JSON parse failed, attempting repair...');

    const repairMessages: Message[] = [
      ...messages,
      { role: 'assistant', content: raw },
      {
        role: 'user',
        content: 'Your previous response was not valid JSON. Return ONLY the raw JSON object — no markdown, no ``` fences, no explanation. Just the JSON.',
      },
    ];

    const fixed = await callOpenRouter(repairMessages);
    return JSON.parse(fixed) as AppJSON; // propagates if still bad
  }
}

// Seed descriptions for built-in apps
// NOTE: calculator and paint are now fully client-side — no seed needed.
// browser, notepad, terminal generate only CONTENT (the chrome is hardcoded in React).
const APP_SEEDS: Record<string, string> = {
  notepad: `Generate ONLY the text body content for a Windows 7 Notepad file.
No HTML structure, menus, or chrome — the React component provides all that.
Return the content in the html field as preformatted text inside a <pre> or plain paragraphs.
Make the content interesting: a fake README, diary entry, code snippet, secret document, or to-do list.`,

  browser: `Generate ONLY the inner page content (no browser chrome) for the VermOS Internet Explorer home page at http://vermos.local/
Make it look like the MSN/IE default home page circa 2009: news headlines, weather widget, search box, featured links.
Use a clean layout with a light blue/white color scheme. Include realistic fake news headlines and links.`,

  terminal: `Generate terminal output showing the result of running "dir" in C:\\Users\\vermcool on Windows 7.
Return it in the html field as a <pre> block with monospace styling, black background, white/gray text.
Show realistic file listings with dates, sizes, and Windows-style directory format.`,
};

// --- Routes ---

// POST /api/login
app.post('/api/login', (req: Request, res: Response) => {
  const { username, password } = req.body as { username?: string; password?: string };

  if (!username || !password) {
    res.status(400).json({ error: 'Username and password required' });
    return;
  }

  if (username === VALID_USERNAME && password === VALID_PASSWORD) {
    req.session.authenticated = true;
    req.session.username = username;
    console.log(`[VermOS] Login: ${username}`);
    res.json({ success: true, username });
  } else {
    console.log(`[VermOS] Failed login attempt for: ${username}`);
    res.status(401).json({ error: 'Invalid username or password' });
  }
});

// POST /api/logout
app.post('/api/logout', (req: Request, res: Response) => {
  const username = req.session.username;
  req.session.destroy((err) => {
    if (err) {
      res.status(500).json({ error: 'Logout failed' });
      return;
    }
    console.log(`[VermOS] Logout: ${username}`);
    res.json({ success: true });
  });
});

// GET /api/me
app.get('/api/me', (req: Request, res: Response) => {
  if (req.session.authenticated) {
    res.json({ authenticated: true, username: req.session.username });
  } else {
    res.json({ authenticated: false });
  }
});

// POST /api/generate-app (requires auth)
app.post('/api/generate-app', requireAuth, async (req: Request, res: Response) => {
  const { appKind = 'custom', prompt } = req.body as { appKind?: string; prompt?: string };

  // Browser pages use a dedicated web-content prompt; all other apps use the Windows 7 app prompt
  const isBrowser = appKind === 'browser';
  const systemPrompt = isBrowser ? BROWSER_SYSTEM_PROMPT : SYSTEM_PROMPT;

  const userMessage = isBrowser
    ? (prompt ?? APP_SEEDS.browser)
    : prompt
      ? `Generate the content area for a Windows 7-era application: "${prompt}". Output only the interior UI — no window frame, no title bar, no min/max/close buttons. Be creative and invent realistic fake content.`
      : (APP_SEEDS[appKind] ?? `Generate a ${appKind} application for Windows 7. Make it look realistic and include fake content.`);

  // Check cache before hitting the AI
  const cacheKey = `${appKind}::${userMessage}`;
  const cached = getCached(cacheKey);
  if (cached) {
    console.log(`[VermOS] Cache hit: "${cached.title}"`);
    res.json(cached);
    return;
  }

  const messages: Message[] = [
    { role: 'system', content: systemPrompt },
    { role: 'user', content: userMessage },
  ];

  try {
    const raw = await callWithRepair(messages);
    const appData = repairAppHtml(raw);
    if (raw.html !== appData.html) console.warn(`[VermOS] HTML was repaired for "${appData.title}"`);
    putCached(cacheKey, appData);
    console.log(`[VermOS] Generated: "${appData.title}" (${appData.appKind})`);
    res.json(appData);
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    console.error('[VermOS] Generation failed:', message);
    res.status(500).json({ error: 'App generation failed', message });
  }
});

// POST /api/app-event (requires auth)
app.post('/api/app-event', requireAuth, async (req: Request, res: Response) => {
  const { appKind, stateSummary, event, currentHtml, currentCss } = req.body as {
    appKind: string;
    stateSummary: string;
    event: string;
    currentHtml?: string;
    currentCss?: string;
  };

  // Truncate HTML context to avoid ballooning token usage
  const htmlSnippet = currentHtml ? currentHtml.substring(0, 600) : '';

  const userMessage = `App type: ${appKind}
Current state: ${stateSummary}
HTML context (first 600 chars): ${htmlSnippet}
${currentCss ? `CSS context: ${currentCss.substring(0, 200)}` : ''}

User action: "${event}"

Update the application state in response to this action. Maintain visual and logical continuity — don't redesign the whole app unless the action warrants it. If the user clicked a calculator button, update the display. If they typed in a field, reflect that. Keep the same overall layout.`;

  const messages: Message[] = [
    { role: 'system', content: SYSTEM_PROMPT },
    { role: 'user', content: userMessage },
  ];

  try {
    const appData = await callWithRepair(messages);
    console.log(`[VermOS] Event "${event}" → "${appData.stateSummary}"`);
    res.json(appData);
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    console.error('[VermOS] Event failed:', message);
    res.status(500).json({ error: 'Event processing failed', message });
  }
});

// POST /api/stream-browser-page (requires auth) — SSE stream of raw HTML tokens
app.post('/api/stream-browser-page', requireAuth, async (req: Request, res: Response) => {
  const { prompt } = req.body as { prompt: string };

  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  res.setHeader('X-Accel-Buffering', 'no'); // disable nginx buffering if present
  res.flushHeaders();

  let upstreamReader: ReadableStreamDefaultReader<Uint8Array> | null = null;

  // Clean up if the client disconnects mid-stream
  req.on('close', () => { upstreamReader?.cancel().catch(() => {}); });

  const apiKey = process.env.OPENROUTER_API_KEY;
  if (!apiKey) {
    res.write('event: error\ndata: {"message":"OPENROUTER_API_KEY not set"}\n\n');
    res.end();
    return;
  }

  try {
    const upstream = await fetch(OPENROUTER_URL, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'HTTP-Referer': 'http://localhost:5173',
        'X-Title': 'VermOS',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: MODEL,
        messages: [
          { role: 'system', content: STREAM_BROWSER_SYSTEM_PROMPT },
          { role: 'user',   content: prompt },
        ],
        stream: true,
        max_tokens: 3500,
        temperature: 0.8,
      }),
    });

    if (!upstream.ok) {
      const txt = await upstream.text();
      res.write(`event: error\ndata: ${JSON.stringify({ message: `API ${upstream.status}: ${txt.slice(0,120)}` })}\n\n`);
      res.end();
      return;
    }

    upstreamReader = upstream.body!.getReader();
    const decoder = new TextDecoder();
    let sseBuffer = '';

    while (true) {
      const { done, value } = await upstreamReader.read();
      if (done) break;

      sseBuffer += decoder.decode(value, { stream: true });
      const lines = sseBuffer.split('\n');
      sseBuffer = lines.pop() ?? '';

      for (const line of lines) {
        if (!line.startsWith('data: ')) continue;
        const payload = line.slice(6).trim();
        if (payload === '[DONE]') {
          res.write('data: [DONE]\n\n');
          res.end();
          return;
        }
        try {
          const parsed = JSON.parse(payload) as { choices?: Array<{ delta?: { content?: string } }> };
          const token = parsed.choices?.[0]?.delta?.content;
          if (token) {
            // Forward as a compact SSE event
            res.write(`data: ${JSON.stringify({ t: token })}\n\n`);
          }
        } catch { /* skip malformed lines */ }
      }
    }

    res.write('data: [DONE]\n\n');
    res.end();
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Stream error';
    if (!res.writableEnded) {
      res.write(`event: error\ndata: ${JSON.stringify({ message })}\n\n`);
      res.end();
    }
    console.error('[VermOS] Stream error:', message);
  }
});

// POST /api/search-suggestions (requires auth) — fast autocomplete for OS search
app.post('/api/search-suggestions', requireAuth, async (req: Request, res: Response) => {
  const { query } = req.body as { query?: string };
  if (!query?.trim()) { res.json({ suggestions: [] }); return; }

  const messages: Message[] = [
    {
      role: 'system',
      content: 'You are a Windows OS search autocomplete engine. Respond with ONLY a valid JSON array of exactly 7 specific app/program name strings. No wrapper object. No explanation. Just the array. Be specific — "Spotify" not "music app".',
    },
    {
      role: 'user',
      content: `User typed "${query.trim()}" in Windows search. Suggest 7 apps/programs they might want to open.`,
    },
  ];

  try {
    const apiKey = process.env.OPENROUTER_API_KEY!;
    const response = await fetch(OPENROUTER_URL, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'HTTP-Referer': 'http://localhost:5173',
        'X-Title': 'VermOS',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: SUGGESTIONS_MODEL,
        messages,
        max_tokens: 120,
        temperature: 0.25,
      }),
    });

    const data = await response.json() as { choices?: Array<{ message?: { content?: string } }> };
    const raw = data.choices?.[0]?.message?.content ?? '[]';
    // Extract JSON array from the response (model might wrap it in backticks etc.)
    const match = raw.match(/\[[\s\S]*\]/);
    const suggestions: string[] = match ? JSON.parse(match[0]) : [];
    console.log(`[VermOS] Suggestions for "${query}": ${suggestions.slice(0,7).join(', ')}`);
    res.json({ suggestions: suggestions.slice(0, 7) });
  } catch (err) {
    console.error('[VermOS] Suggestions error:', err);
    res.json({ suggestions: [] });
  }
});

// --- Catch-all: serve React index.html for client-side routing ---
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, '../../client/dist/index.html'));
});

// --- Start server ---

const server = app.listen(PORT, () => {
  console.log(`\n╔═══════════════════════════════════════╗`);
  console.log(`║          VermOS Server v1.0           ║`);
  console.log(`╠═══════════════════════════════════════╣`);
  console.log(`║  http://localhost:${PORT}               ║`);
  console.log(`║  Model: ${MODEL.padEnd(28)} ║`);
  console.log(`║  API Key: ${process.env.OPENROUTER_API_KEY ? '✓ Configured' : '✗ NOT SET!    '}          ║`);
  console.log(`╚═══════════════════════════════════════╝\n`);
});

server.on('error', (err: NodeJS.ErrnoException) => {
  if (err.code === 'EADDRINUSE') {
    console.error(`\n✗ Port ${PORT} is already in use.`);
    console.error(`  Run this to free it:  lsof -ti:${PORT} | xargs kill -9`);
    console.error(`  Then restart:         npm run dev\n`);
  } else {
    console.error('Server error:', err);
  }
  process.exit(1);
});
