# VermOS

A browser-based AI-generated operating system with a Windows 7/Aero aesthetic. After logging in, users can open any application imaginable — the AI generates convincing fake Windows 7-era app UIs in real time.

## Quick Start

```bash
# 1. Install everything (root postinstall handles client + server)
npm install

# 2. Configure environment
cp .env.example server/.env
# Edit server/.env and set OPENROUTER_API_KEY

# 3. Run
npm run dev
```

Open **http://localhost:5173**

## Login

| Field    | Value                |
|----------|----------------------|
| Username | `vermcool`           |
| Password | `VermLoveDestin123`  |

## Environment Variables (`server/.env`)

| Variable              | Required | Description                      |
|-----------------------|----------|----------------------------------|
| `OPENROUTER_API_KEY`  | Yes      | Your OpenRouter API key          |
| `SESSION_SECRET`      | Yes      | Random string for cookie signing |
| `PORT`                | No       | Server port (default: 3001)      |

## How It Works

1. User logs in — credentials checked server-side, HTTP-only session cookie set
2. Desktop loads with built-in app icons + Start menu with App Search
3. Opening any app sends `POST /api/generate-app` to the Express backend
4. Backend calls OpenRouter (`deepseek/deepseek-v4-flash`) with a structured prompt
5. Model returns JSON: `{ title, appKind, stateSummary, html, css, suggestedActions }`
6. Frontend sanitizes HTML with DOMPurify and renders it in a Shadow DOM container
7. User interactions (button clicks) send `POST /api/app-event` for real-time state updates

## App Search

Open the Start menu and type literally anything in the search box — the AI will generate whatever app you describe. Examples:
- "Spotify circa 2006"
- "NASA mission control software"
- "A stock market terminal from 1998"
- "Pokémon save file editor"

## Security

- OpenRouter API key lives only in `server/.env` — never bundled into client code
- All AI routes (`/api/generate-app`, `/api/app-event`) require an authenticated session
- Generated HTML is sanitized with DOMPurify and isolated in Shadow DOM
- Session cookie: `httpOnly: true`, `sameSite: 'lax'`

## Architecture

```
VermOS/
├── server/src/index.ts     # Express: auth, OpenRouter proxy, all routes
└── client/src/
    ├── App.tsx             # Auth gate: calls /api/me on load
    ├── api.ts              # Typed fetch helpers (credentials: 'include')
    ├── hooks/useWindows.ts # Zustand window manager
    └── components/
        ├── LoginScreen.tsx # Windows 7-style login
        ├── Desktop.tsx     # Main orchestrator
        ├── Window.tsx      # Draggable window with Aero chrome
        ├── AppWindow.tsx   # Shadow DOM + DOMPurify renderer
        ├── Taskbar.tsx     # Glass taskbar with clock
        ├── StartMenu.tsx   # Program list + App Search
        └── DebugPanel.tsx  # Developer overlay
```
