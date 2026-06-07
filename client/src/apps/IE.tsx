import React, { useCallback, useEffect, useRef, useState } from 'react';
import DOMPurify from 'dompurify';
import { api } from '../api';
import type { WindowState } from '../types';

interface Props { win: WindowState; onGenerated?: () => void; }
interface HistEntry { url: string; html: string; title: string; }

interface TabState {
  id: string;
  histIdx: number;
  hist: HistEntry[];
  currentUrl: string;
  urlInput: string;
  onPage: boolean;
  pageHtml: string;      // source-of-truth for back/forward & tab-switch re-render
  pageTitle: string;
  loading: boolean;
  progress: number;
  status: string;
}

let _tabSeq = 0;
function makeTabId() { return `ietab-${++_tabSeq}`; }
function createTab(): TabState {
  return {
    id: makeTabId(),
    histIdx: -1, hist: [],
    currentUrl: 'http://www.google.com/',
    urlInput: 'http://www.google.com/',
    onPage: false, pageHtml: '',
    pageTitle: 'Google',
    loading: false, progress: 0, status: 'Done',
  };
}

// ── Client-side page cache ──────────────────────────────────────────────────
const iePageCache = new Map<string, { html: string; title: string }>();

// ── HTML block extractor (for streaming progressive render) ─────────────────
const VOID_TAGS = new Set(['area','base','br','col','embed','hr','img','input','link','meta','param','source','track','wbr']);
function extractTopLevelBlocks(html: string): { blocks: string[]; remainder: string } {
  const blocks: string[] = [];
  let pos = 0, depth = 0, blockStart = 0, processedEnd = 0;
  while (pos < html.length) {
    if (html[pos] !== '<') { pos++; continue; }
    if (html.startsWith('<!--', pos)) {
      const end = html.indexOf('-->', pos + 4); if (end === -1) break; pos = end + 3; continue;
    }
    let tagEnd = pos + 1; let inQ: string | null = null;
    while (tagEnd < html.length) {
      const ch = html[tagEnd];
      if (inQ) { if (ch === inQ) inQ = null; }
      else if (ch === '"' || ch === "'") { inQ = ch; }
      else if (ch === '>') break;
      tagEnd++;
    }
    if (tagEnd >= html.length) break;
    const inner = html.slice(pos + 1, tagEnd);
    const isClose = inner.trimStart()[0] === '/';
    const rawName = inner.replace(/^[/\s]*/, '').replace(/[\s/>].*/, '').toLowerCase();
    const isSelf = inner.trimEnd().endsWith('/') || VOID_TAGS.has(rawName);
    if (!isClose && !isSelf && /^[a-z]/.test(rawName)) {
      if (depth === 0) blockStart = pos; depth++;
    } else if (isClose && /^[a-z]/.test(rawName) && depth > 0) {
      depth--;
      if (depth === 0) {
        const block = html.slice(blockStart, tagEnd + 1);
        if (block.trim()) blocks.push(block);
        processedEnd = tagEnd + 1; blockStart = tagEnd + 1;
      }
    }
    pos = tagEnd + 1;
  }
  return { blocks, remainder: html.slice(processedEnd) };
}

function titleFromHtml(html: string, url: string): string {
  const h1 = html.match(/<h1[^>]*>(.*?)<\/h1>/is)?.[1]?.replace(/<[^>]+>/g,'').trim();
  if (h1) return h1;
  try {
    const u = new URL(url);
    const dom = u.hostname.replace(/^www\./, '');
    return dom.split('.').slice(0,-1).map(p => p[0].toUpperCase()+p.slice(1)).join(' ') || dom;
  } catch { return 'Webpage'; }
}

// ── Static Google 2011 home ─────────────────────────────────────────────────
function GoogleHome({ onSearch }: { onSearch: (q: string) => void }) {
  const [q, setQ] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);
  useEffect(() => { setTimeout(() => inputRef.current?.focus(), 80); }, []);
  const submit = (e: React.FormEvent) => { e.preventDefault(); if (q.trim()) onSearch(q.trim()); };
  return (
    <div style={{ width:'100%', height:'100%', background:'#fff', fontFamily:'Arial,sans-serif', display:'flex', flexDirection:'column', overflow:'auto' }}>
      <div style={{ display:'flex', justifyContent:'flex-end', padding:'8px 16px 4px', gap:14, fontSize:13 }}>
        {['+You','Search','Images','Maps','Shopping','More ▾'].map(l => <span key={l} style={{ color:'#666' }}>{l}</span>)}
        <span style={{ color:'#ccc' }}>|</span>
        <span style={{ color:'#1155cc', cursor:'pointer' }}>Sign in</span>
      </div>
      <div style={{ flex:1, display:'flex', flexDirection:'column', alignItems:'center', justifyContent:'center', paddingBottom:100 }}>
        <div style={{ marginBottom:26, userSelect:'none', fontSize:92, fontWeight:'bold', letterSpacing:-3 }}>
          {[['G','#3366cc'],['o','#cc0000'],['o','#f90'],['g','#3366cc'],['l','#090'],['e','#cc0000']].map(([ch,c],i) => (
            <span key={i} style={{ color: c as string }}>{ch}</span>
          ))}
        </div>
        <form onSubmit={submit} style={{ width:500, display:'flex', flexDirection:'column', alignItems:'center', gap:16 }}>
          <input ref={inputRef} value={q} onChange={e => setQ(e.target.value)}
            style={{ width:'100%', height:34, padding:'5px 12px', border:'1px solid #d9d9d9', borderRadius:2, fontSize:16, outline:'none', boxShadow:'0 1px 3px rgba(0,0,0,0.12)', fontFamily:'Arial,sans-serif' }}
            onFocus={e => { e.target.style.border='1px solid #4d90fe'; e.target.style.boxShadow='0 0 0 1px #4d90fe,0 1px 3px rgba(0,0,0,0.1)'; }}
            onBlur={e => { e.target.style.border='1px solid #d9d9d9'; e.target.style.boxShadow='0 1px 3px rgba(0,0,0,0.12)'; }}
          />
          <div style={{ display:'flex', gap:10 }}>
            <GBtn type="submit">Google Search</GBtn>
            <GBtn type="button" onClick={() => q.trim() && onSearch(q.trim())}>I'm Feeling Lucky</GBtn>
          </div>
        </form>
        <div style={{ marginTop:28, fontSize:13, color:'#666' }}>
          Google offered in:{' '}
          {['Español','Français','Deutsch','Italiano','Português','日本語','한국어'].map((l,i) => (
            <React.Fragment key={l}>{i > 0 && ' '}<span style={{ color:'#1155cc', cursor:'pointer' }} onClick={() => onSearch(`Google in ${l}`)}>{l}</span></React.Fragment>
          ))}
        </div>
      </div>
      <div style={{ borderTop:'1px solid #ebebeb', background:'#f1f1f1', padding:'10px 20px', display:'flex', justifyContent:'space-between', alignItems:'center', fontSize:13, color:'#777', flexShrink:0 }}>
        <div style={{ display:'flex', gap:20 }}>
          {['Advertising','Business','About'].map(l => <span key={l} style={{ cursor:'pointer' }} onClick={() => onSearch(l+' - Google')}>{l}</span>)}
        </div>
        <span>United States</span>
        <div style={{ display:'flex', gap:20 }}>
          {['Privacy','Terms','Settings'].map(l => <span key={l} style={{ cursor:'pointer' }}>{l}</span>)}
        </div>
      </div>
    </div>
  );
}
function GBtn({ children, type, onClick }: { children: React.ReactNode; type?: 'submit'|'button'; onClick?: () => void }) {
  const [h, setH] = useState(false);
  return (
    <button type={type||'button'} onClick={onClick} onMouseEnter={() => setH(true)} onMouseLeave={() => setH(false)}
      style={{ padding:'7px 18px', fontSize:13, cursor:'pointer', background:h?'#f0f0f0':'#f5f5f5', border:'1px solid #d9d9d9', borderRadius:3, color:'#333', boxShadow:'0 1px 1px rgba(0,0,0,0.1)', fontFamily:'Arial,sans-serif' }}
    >{children}</button>
  );
}

// ── URL helpers ─────────────────────────────────────────────────────────────
const IE_MENUS = ['File','Edit','View','Favorites','Tools','Help'];
const FAKE_FAVS = ['MSN.com','Google','YouTube','Wikipedia','Yahoo! Mail','CNN.com','ESPN.com','Amazon.com','eBay','Weather.com'];
function isUrl(s: string) { return /^https?:\/\//i.test(s)||/^www\./i.test(s)||/^[a-z0-9-]+\.[a-z]{2,}/i.test(s); }
function normalizeUrl(s: string) { const t=s.trim(); return /^https?:\/\//i.test(t)?t:'http://'+t; }
function resolveHref(href: string, base: string): string|null {
  if (!href) return null;
  const h = href.trim();
  if (!h||h.startsWith('#')||/^(javascript|mailto|tel):/.test(h)) return null;
  if (/^https?:\/\//i.test(h)) return h;
  if (h.startsWith('//')) return 'http:'+h;
  if (h.startsWith('/')) { try { const u=new URL(base); return u.origin+h; } catch { return base.split('/').slice(0,3).join('/')+h; } }
  try { return new URL(h,base).href; } catch { return h; }
}
function buildPrompt(input: string): { url: string; prompt: string } {
  const t = input.trim();
  if (isUrl(t)) {
    const url = normalizeUrl(t);
    let domain = '', path = '/', formContext = '', cleanUrl = url;
    try {
      const u = new URL(url);
      domain = u.hostname;
      path = u.pathname || '/';
      const params: Record<string, string> = {};
      u.searchParams.forEach((v, k) => { params[k] = v; });
      // Non-search params = form submission data; 'q' param = search query, pass through as-is
      if (!('q' in params) && Object.keys(params).length > 0) {
        cleanUrl = u.origin + u.pathname;
        const fieldDesc = Object.entries(params)
          .map(([k, v]) => /pass|pwd|secret/i.test(k) ? `${k}="[provided]"` : `${k}="${v}"`)
          .join(', ');
        formContext = `\nUser just submitted a form with: ${fieldDesc}\nGenerate the resulting page after this action (e.g. if login → show the user signed in with their username visible in the nav; if checkout → show order confirmation; if registration → show welcome page). Reflect the submitted values naturally in the content.`;
      }
    } catch {
      domain = url.replace(/^https?:\/\//,'').split('/')[0];
      path = url.replace(/^https?:\/\/[^/]+/,'') || '/';
    }
    return { url: cleanUrl, prompt: `URL: ${cleanUrl}\nSite: ${domain}  Path: ${path}${formContext}\nGenerate this page. Include nav, content, sidebar, footer with proper <a href> links.` };
  }
  return {
    url: `http://www.google.com/search?q=${encodeURIComponent(t)}`,
    prompt: `URL: http://www.google.com/search?q=${encodeURIComponent(t)}\nQuery: "${t}"\nGenerate Google search results page circa 2010. Include: search form, 8 result listings with linked titles, green URLs, gray snippets, pagination.`,
  };
}
const ALLOWED_TAGS = ['div','span','p','a','b','i','u','strong','em','br','hr','s','sup','sub','table','thead','tbody','tfoot','tr','th','td','ul','ol','li','dl','dt','dd','h1','h2','h3','h4','h5','h6','pre','code','blockquote','figure','figcaption','img','svg','path','rect','circle','ellipse','line','polyline','g','defs','form','input','button','select','option','textarea','label','section','article','nav','header','footer','main','aside'];
const ALLOWED_ATTR = ['class','id','style','href','src','alt','title','width','height','type','placeholder','value','name','target','rel','checked','disabled','colspan','rowspan','align','valign','viewBox','fill','stroke','stroke-width','d','cx','cy','r','rx','ry','x','y','data-action'];
const SHADOW_CSS = `:host{display:block;width:100%;height:100%;overflow:auto;font-family:Arial,sans-serif;font-size:14px;background:#fff;}*{box-sizing:border-box;}a{color:#1155cc;text-decoration:underline;cursor:pointer;}a:visited{color:#609;}a:hover{color:#cc0000;}img{max-width:100%;height:auto;}input,button,select,textarea{font-family:inherit;}button,a{cursor:pointer;}form input[type=search],form input[type=text]{padding:3px 6px;border:1px solid #ccc;border-radius:2px;}`;

// ── Streaming HTML cleanup ──────────────────────────────────────────────────
function cleanStreamedHtml(raw: string): string {
  let h = raw.trim();
  // Strip markdown code fences
  h = h.replace(/^```(?:html)?\r?\n?/i, '').replace(/\r?\n?```\s*$/i, '').trim();
  // If AI returned JSON, extract html field
  if (h.startsWith('{')) {
    try { const p = JSON.parse(h) as Record<string, unknown>; if (typeof p.html === 'string') h = (p.html as string).trim(); } catch { /* not JSON */ }
  }
  // Wrap bare text in a div
  if (h && !/<[a-zA-Z]/.test(h)) {
    h = `<div style='padding:24px;font-family:Arial;font-size:14px;line-height:1.6;'>${h.replace(/\n/g,'<br>')}</div>`;
  }
  return h;
}

// ── Main IEApp component ────────────────────────────────────────────────────
export function IEApp({ win, onGenerated }: Props) {
  const [tabs, setTabs]         = useState<TabState[]>(() => [createTab()]);
  const [activeTabId, setActiveTabId] = useState(() => tabs[0].id);
  const [menuOpen, setMenuOpen] = useState<string|null>(null);
  const [faveOpen, setFaveOpen] = useState(false);

  // Refs keyed by tab ID
  const shadowRootsRef   = useRef(new Map<string, ShadowRoot>());
  const streamAbortsRef  = useRef(new Map<string, AbortController>());
  const curUrlRefs       = useRef(new Map<string, string>());
  const suppressRef      = useRef(new Set<string>()); // tab IDs whose next pageHtml render should be skipped
  const tabsRef          = useRef(tabs);
  useEffect(() => { tabsRef.current = tabs; }, [tabs]);

  // Navigate refs per tab (so shadow DOM event handlers always call latest version)
  const navigateRefMap = useRef(new Map<string, (url: string) => void>());

  const activeTab = tabs.find(t => t.id === activeTabId) ?? tabs[0];
  const showHome  = !activeTab.onPage && activeTab.histIdx === -1;

  const updateTab = useCallback((tabId: string, updates: Partial<TabState>) => {
    setTabs(prev => prev.map(t => t.id === tabId ? { ...t, ...updates } : t));
  }, []);

  const getSR = (tabId: string) => shadowRootsRef.current.get(tabId) ?? null;

  // ── Shadow DOM event delegation (set up once per tab's shadow root) ────────
  const setupShadowEvents = useCallback((tabId: string, sr: ShadowRoot) => {
    sr.addEventListener('click', (e: Event) => {
      const target = e.target as Element;
      const a = target.closest('a');
      if (a) {
        const resolved = resolveHref(a.getAttribute('href')||'', curUrlRefs.current.get(tabId)||'');
        if (resolved) { e.preventDefault(); e.stopPropagation(); navigateRefMap.current.get(tabId)?.(resolved); return; }
      }
      const actionEl = target.closest('[data-action]');
      if (actionEl) {
        const action = actionEl.getAttribute('data-action')||'';
        if (action.startsWith('navigate:')) navigateRefMap.current.get(tabId)?.(action.slice(9));
      }
    });
    sr.addEventListener('submit', (e: Event) => {
      e.preventDefault();
      const form = e.target as HTMLFormElement;
      const currentUrl = curUrlRefs.current.get(tabId) || '';

      // Collect all named, filled form fields — skip submit/button/reset controls
      const fields: Record<string, string> = {};
      for (const el of Array.from(form.elements)) {
        const inp = el as HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement;
        const type = (inp as HTMLInputElement).type?.toLowerCase() || '';
        if (inp.name && inp.value.trim() && !['submit', 'button', 'reset', 'image'].includes(type)) {
          fields[inp.name] = inp.value.trim();
        }
      }

      // Search forms (search input or name="q", no password field) → treat as site/web search
      const searchEl = form.querySelector<HTMLInputElement>('input[type="search"], input[name="q"]');
      if (searchEl && !form.querySelector('input[type="password"]')) {
        const q = searchEl.value.trim();
        if (q) navigateRefMap.current.get(tabId)?.(q);
        return;
      }

      // Resolve the form's action URL
      const rawAction = (form.getAttribute('action') || '').trim();
      let destUrl: string;
      if (rawAction && rawAction !== '#') {
        destUrl = resolveHref(rawAction, currentUrl) || currentUrl;
      } else {
        // No explicit action: login/auth forms go to site root, others stay on current URL
        const hasPassword = !!form.querySelector('input[type="password"]');
        if (hasPassword) {
          try { destUrl = new URL(currentUrl).origin + '/'; } catch { destUrl = currentUrl; }
        } else {
          destUrl = currentUrl;
        }
      }

      // Bust cache so the destination generates a fresh context-aware page
      iePageCache.delete(destUrl.toLowerCase());

      // Append form data as query params — buildPrompt reads these to inject generation context
      const paramStr = new URLSearchParams(fields).toString();
      const navUrl = paramStr ? `${destUrl}${destUrl.includes('?') ? '&' : '?'}${paramStr}` : destUrl;
      navigateRefMap.current.get(tabId)?.(navUrl);
    });
  }, []);

  // ── Shadow DOM block injection helpers ────────────────────────────────────
  const initSR = useCallback((tabId: string) => {
    const sr = getSR(tabId); if (!sr) return;
    sr.innerHTML = `<style>${SHADOW_CSS}</style><div id='ie-content' style='min-height:100%;'></div>`;
  }, []);

  const injectBlock = useCallback((tabId: string, blockHtml: string) => {
    const sr = getSR(tabId); if (!sr) return;
    let cont = sr.querySelector<HTMLElement>('#ie-content');
    if (!cont) { initSR(tabId); cont = sr.querySelector<HTMLElement>('#ie-content')!; }
    const clean = DOMPurify.sanitize(blockHtml, { ALLOWED_TAGS, ALLOWED_ATTR, ALLOW_DATA_ATTR: true, FORBID_TAGS: ['script','iframe','object','embed','link','meta','base'] });
    const wrap = document.createElement('div');
    wrap.innerHTML = clean;
    while (wrap.firstChild) cont.appendChild(wrap.firstChild);
  }, [initSR]);

  // ── Re-render active tab's shadow DOM on tab switch or back/forward ────────
  useEffect(() => {
    const sr = getSR(activeTabId); if (!sr) return;
    if (!activeTab.onPage || !activeTab.pageHtml || activeTab.loading) return;
    if (suppressRef.current.has(activeTabId)) { suppressRef.current.delete(activeTabId); return; }
    const clean = DOMPurify.sanitize(activeTab.pageHtml, { ALLOWED_TAGS, ALLOWED_ATTR, ALLOW_DATA_ATTR: true, FORBID_TAGS: ['script','iframe','object','embed','link','meta','base'] });
    sr.innerHTML = `<style>${SHADOW_CSS}</style><div id='ie-content' style='min-height:100%;'>${clean}</div>`;
  }, [activeTab.pageHtml, activeTab.onPage, activeTab.loading, activeTabId]); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Core navigation ────────────────────────────────────────────────────────
  const navigateTo = useCallback(async (tabId: string, input: string) => {
    if (!input.trim()) return;
    const { url, prompt } = buildPrompt(input);

    // Abort any existing stream for this tab
    streamAbortsRef.current.get(tabId)?.abort();
    const abort = new AbortController();
    streamAbortsRef.current.set(tabId, abort);
    curUrlRefs.current.set(tabId, url);

    const currentHistIdx = tabsRef.current.find(t => t.id === tabId)?.histIdx ?? -1;

    updateTab(tabId, { urlInput: url, currentUrl: url, onPage: true, loading: true, progress: 15, status: `Connecting to ${url.replace(/^https?:\/\//,'').split('/')[0]}…`, pageHtml: '' });
    initSR(tabId);

    // ── Cache hit ────────────────────────────────────────────────────────────
    const cacheKey = url.toLowerCase();
    const cached = iePageCache.get(cacheKey);
    if (cached) {
      updateTab(tabId, {
        pageHtml: cached.html, pageTitle: cached.title,
        loading: false, progress: 100, status: 'Done',
        histIdx: currentHistIdx + 1,
        hist: [...(tabsRef.current.find(t=>t.id===tabId)?.hist??[]).slice(0, currentHistIdx+1), { url, html: cached.html, title: cached.title }],
      });
      setTimeout(() => updateTab(tabId, { progress: 0 }), 400);
      return;
    }

    // ── Stream from server ───────────────────────────────────────────────────
    try {
      updateTab(tabId, { progress: 30 });
      const response = await fetch('/api/stream-browser-page', {
        method: 'POST', credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ prompt }),
        signal: abort.signal,
      });
      if (!response.ok || !response.body) throw new Error(`HTTP ${response.status}`);

      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let sseBuffer = '', htmlBuffer = '', fullHtml = '';
      let firstBlock = true;

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        sseBuffer += decoder.decode(value, { stream: true });
        const lines = sseBuffer.split('\n');
        sseBuffer = lines.pop() ?? '';

        for (const line of lines) {
          if (!line.startsWith('data: ')) continue;
          const data = line.slice(6).trim();
          if (data === '[DONE]') { sseBuffer = '[DONE]'; break; }
          try {
            const { t: token } = JSON.parse(data) as { t?: string };
            if (!token) continue;
            fullHtml += token; htmlBuffer += token;
            const { blocks, remainder } = extractTopLevelBlocks(htmlBuffer);
            htmlBuffer = remainder;
            for (const block of blocks) {
              if (firstBlock) {
                firstBlock = false;
                updateTab(tabId, { loading: false, progress: 100, status: 'Loading…' });
                initSR(tabId);
              }
              injectBlock(tabId, block);
            }
          } catch { /* skip */ }
        }
        if (sseBuffer === '[DONE]') break;
      }

      // Flush remaining buffer
      const cleaned = cleanStreamedHtml(htmlBuffer.trim() ? htmlBuffer : fullHtml);
      if (firstBlock && cleaned) { initSR(tabId); injectBlock(tabId, cleaned); firstBlock = false; }
      else if (htmlBuffer.trim()) injectBlock(tabId, htmlBuffer);

      // Finalize tab state
      const finalHtml = cleaned || fullHtml;
      const title = titleFromHtml(finalHtml, url);
      iePageCache.set(cacheKey, { html: finalHtml, title });
      suppressRef.current.add(tabId); // shadow DOM already built — skip the pageHtml useEffect
      updateTab(tabId, {
        loading: false, progress: 100, status: 'Done',
        pageHtml: finalHtml, pageTitle: title,
        histIdx: currentHistIdx + 1,
        hist: [...(tabsRef.current.find(t=>t.id===tabId)?.hist??[]).slice(0, currentHistIdx+1), { url, html: finalHtml, title }],
      });
      setTimeout(() => updateTab(tabId, { progress: 0 }), 600);
      onGenerated?.();

    } catch (err) {
      if ((err as Error).name === 'AbortError') return;
      // Fallback to non-streaming JSON endpoint
      try {
        const data = await api.generateApp('browser', prompt);
        iePageCache.set(cacheKey, { html: data.html, title: data.title });
        updateTab(tabId, {
          pageHtml: data.html, pageTitle: data.title,
          loading: false, progress: 100, status: 'Done',
          histIdx: currentHistIdx + 1,
          hist: [...(tabsRef.current.find(t=>t.id===tabId)?.hist??[]).slice(0, currentHistIdx+1), { url, html: data.html, title: data.title }],
        });
        onGenerated?.();
      } catch (err2) {
        const errHtml = `<div style='padding:24px;font-family:Arial;'><h2 style='color:#900'>This page cannot be displayed</h2><p style='color:#555;margin-top:8px'>Could not load <b>${url}</b></p><p style='color:#888;font-size:12px;margin-top:12px'>${(err2 as Error).message}</p></div>`;
        updateTab(tabId, { pageHtml: errHtml, pageTitle: 'Navigation Canceled', loading: false, status: 'Error on page' });
      }
    }
  }, [updateTab, initSR, injectBlock, onGenerated]);

  // Keep per-tab navigate refs fresh
  useEffect(() => {
    tabs.forEach(t => {
      navigateRefMap.current.set(t.id, (url: string) => navigateTo(t.id, url));
    });
  }, [tabs, navigateTo]);

  // ── Tab management ─────────────────────────────────────────────────────────
  const openNewTab = useCallback(() => {
    const t = createTab();
    setTabs(prev => [...prev, t]);
    setActiveTabId(t.id);
  }, []);

  const closeTab = useCallback((tabId: string) => {
    setTabs(prev => {
      if (prev.length === 1) return [createTab()]; // never close last tab
      const newTabs = prev.filter(t => t.id !== tabId);
      setActiveTabId(cur => cur === tabId ? newTabs[Math.max(0, prev.findIndex(t=>t.id===tabId)-1)].id : cur);
      return newTabs;
    });
    streamAbortsRef.current.get(tabId)?.abort();
    shadowRootsRef.current.delete(tabId);
  }, []);

  const switchTab = useCallback((tabId: string) => { setActiveTabId(tabId); }, []);

  // ── Per-tab nav actions ────────────────────────────────────────────────────
  const goBack = () => {
    const tab = activeTab;
    if (tab.histIdx > 0) {
      const e = tab.hist[tab.histIdx - 1];
      curUrlRefs.current.set(tab.id, e.url);
      updateTab(tab.id, { histIdx: tab.histIdx - 1, pageHtml: e.html, pageTitle: e.title, urlInput: e.url, currentUrl: e.url, status: 'Done' });
    } else if (tab.histIdx === 0) {
      curUrlRefs.current.set(tab.id, 'http://www.google.com/');
      updateTab(tab.id, { histIdx: -1, onPage: false, urlInput: 'http://www.google.com/', currentUrl: 'http://www.google.com/', pageTitle: 'Google', status: 'Done' });
    }
  };
  const goForward = () => {
    const tab = activeTab;
    if (tab.histIdx < tab.hist.length - 1) {
      const e = tab.hist[tab.histIdx + 1];
      curUrlRefs.current.set(tab.id, e.url);
      updateTab(tab.id, { histIdx: tab.histIdx + 1, pageHtml: e.html, pageTitle: e.title, urlInput: e.url, currentUrl: e.url, status: 'Done' });
    }
  };
  const refresh = () => {
    if (!activeTab.onPage || activeTab.loading) return;
    iePageCache.delete(activeTab.currentUrl.toLowerCase());
    navigateTo(activeTabId, activeTab.currentUrl);
  };
  const goHome = () => {
    streamAbortsRef.current.get(activeTabId)?.abort();
    curUrlRefs.current.set(activeTabId, 'http://www.google.com/');
    updateTab(activeTabId, { histIdx: -1, onPage: false, urlInput: 'http://www.google.com/', currentUrl: 'http://www.google.com/', pageTitle: 'Google', status: 'Done', loading: false });
  };
  const onUrlKey = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') { e.preventDefault(); navigateTo(activeTabId, activeTab.urlInput); }
  };

  useEffect(() => {
    if (!menuOpen && !faveOpen) return;
    const h = () => { setMenuOpen(null); setFaveOpen(false); };
    setTimeout(() => document.addEventListener('mousedown', h), 0);
    return () => document.removeEventListener('mousedown', h);
  }, [menuOpen, faveOpen]);

  const canBack = activeTab.histIdx >= 0;
  const canFwd  = activeTab.histIdx < activeTab.hist.length - 1;

  return (
    <div style={{ display:'flex', flexDirection:'column', height:'100%', background:'#f0f0f0', fontFamily:"'Segoe UI',Tahoma,sans-serif" }}
         onMouseDown={() => { setMenuOpen(null); setFaveOpen(false); }}>

      {/* ── Menu bar ────────────────────────────────────────────────────────── */}
      <div style={{ display:'flex', background:'#f0f0f0', borderBottom:'1px solid #d0d0d0', flexShrink:0 }}
           onMouseDown={e => e.stopPropagation()}>
        {IE_MENUS.map(name => (
          <div key={name} style={{ position:'relative' }}>
            <div onMouseDown={() => setMenuOpen(m => m===name?null:name)}
              style={{ padding:'3px 8px', fontSize:12, cursor:'default', userSelect:'none', background:menuOpen===name?'#3399ff':'transparent', color:menuOpen===name?'white':'#000' }}>
              {name}
            </div>
            {menuOpen === name && (
              <IEMenu name={name} onNavigate={url => navigateTo(activeTabId, url)} onClose={() => setMenuOpen(null)}
                onDeleteHistory={() => { updateTab(activeTabId, { hist:[], histIdx:-1, onPage:false }); iePageCache.clear(); setMenuOpen(null); }} />
            )}
          </div>
        ))}
      </div>

      {/* ── Navigation toolbar ──────────────────────────────────────────────── */}
      <div style={{ display:'flex', alignItems:'center', gap:3, padding:'3px 6px', background:'#f0f0f0', borderBottom:'1px solid #d0d0d0', flexShrink:0 }}>
        <IEBtn onClick={goBack}    disabled={!canBack||activeTab.loading} title="Back">◀</IEBtn>
        <IEBtn onClick={goForward} disabled={!canFwd||activeTab.loading}  title="Forward">▶</IEBtn>
        <IEBtn onClick={refresh}   disabled={activeTab.loading||!activeTab.onPage} title="Refresh">↻</IEBtn>
        <IEBtn onClick={goHome}    title="Home">🏠</IEBtn>

        <div style={{ flex:1, display:'flex', alignItems:'center', background:'white', border:'1px solid #999', borderRadius:1, padding:'1px 2px', gap:2 }}>
          <div style={{ width:16, textAlign:'center', fontSize:12, flexShrink:0, opacity:activeTab.loading?0.5:1 }}>{activeTab.loading?'⌛':'🌐'}</div>
          <input value={activeTab.urlInput}
            onChange={e => updateTab(activeTabId, { urlInput: e.target.value })}
            onKeyDown={onUrlKey} onFocus={e => e.target.select()}
            style={{ flex:1, border:'none', outline:'none', fontSize:13, padding:'1px 4px', fontFamily:"'Segoe UI',Tahoma,sans-serif", background:'transparent' }}
          />
          <button onClick={() => navigateTo(activeTabId, activeTab.urlInput)} title="Go"
            style={{ width:22, height:22, border:'1px solid #bbb', borderRadius:2, cursor:'pointer', background:'linear-gradient(180deg,#f8f8f8,#e0e0e0)', fontSize:11, flexShrink:0 }}>▶</button>
        </div>

        <div style={{ position:'relative' }} onMouseDown={e => e.stopPropagation()}>
          <IEBtn onClick={() => setFaveOpen(f => !f)} title="Favorites">★</IEBtn>
          {faveOpen && (
            <div style={{ position:'fixed', background:'white', border:'1px solid #999', boxShadow:'2px 2px 6px rgba(0,0,0,0.2)', zIndex:9999, width:200, maxHeight:280, overflowY:'auto', fontSize:12 }}>
              {FAKE_FAVS.map(f => (
                <div key={f} onMouseDown={() => { setFaveOpen(false); navigateTo(activeTabId, f); }}
                  style={{ padding:'5px 12px', cursor:'default' }}
                  onMouseEnter={e => { e.currentTarget.style.background='#3399ff'; e.currentTarget.style.color='white'; }}
                  onMouseLeave={e => { e.currentTarget.style.background=''; e.currentTarget.style.color=''; }}>
                  ⭐ {f}
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* ── Progress bar ────────────────────────────────────────────────────── */}
      {activeTab.progress > 0 && (
        <div style={{ height:3, background:'#e0e0e0', flexShrink:0 }}>
          <div style={{ height:'100%', width:`${activeTab.progress}%`, background:'#3399ff', transition:'width 0.3s' }} />
        </div>
      )}

      {/* ── Tab bar ─────────────────────────────────────────────────────────── */}
      <div style={{ display:'flex', alignItems:'flex-end', background:'#dce8f8', borderBottom:'1px solid #a8c0e0', padding:'3px 4px 0', gap:2, flexShrink:0, overflow:'hidden' }}>
        {tabs.map(tab => {
          const isActive = tab.id === activeTabId;
          const tabTitle = tab.pageTitle.replace(/ - Windows Internet Explorer$/,'').slice(0, 22) || 'New Tab';
          return (
            <div key={tab.id} onClick={() => switchTab(tab.id)}
              style={{
                display:'flex', alignItems:'center', gap:4,
                padding:'3px 8px 3px 8px', fontSize:11,
                background: isActive ? 'white' : 'linear-gradient(180deg,#d4e4f8,#bcd0ec)',
                border:'1px solid #a0b8d8',
                borderBottom: isActive ? '1px solid white' : '1px solid #a0b8d8',
                borderRadius:'4px 4px 0 0',
                cursor:'default', userSelect:'none',
                maxWidth:160, minWidth:70,
                color: isActive ? '#000' : '#444',
                boxShadow: isActive ? 'none' : 'inset 0 1px 0 rgba(255,255,255,0.5)',
                position:'relative', zIndex: isActive ? 2 : 1,
              }}>
              <span style={{ fontSize:11, flexShrink:0 }}>{tab.loading ? '⌛' : '🌐'}</span>
              <span style={{ overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap', flex:1, fontSize:11 }}>{tabTitle}</span>
              {tabs.length > 1 && (
                <button onClick={e => { e.stopPropagation(); closeTab(tab.id); }}
                  style={{ background:'none', border:'none', cursor:'pointer', fontSize:10, padding:'0 1px', color:'#888', lineHeight:1, flexShrink:0 }}
                  onMouseEnter={e => (e.currentTarget.style.color='#c00')}
                  onMouseLeave={e => (e.currentTarget.style.color='#888')}
                >✕</button>
              )}
            </div>
          );
        })}
        {/* New tab button */}
        <button onClick={openNewTab}
          style={{ padding:'2px 8px', fontSize:14, background:'none', border:'1px solid transparent', borderRadius:'4px 4px 0 0', cursor:'pointer', color:'#556', lineHeight:1, alignSelf:'flex-end', marginBottom:0 }}
          onMouseEnter={e => { e.currentTarget.style.background='rgba(255,255,255,0.6)'; e.currentTarget.style.borderColor='#a0b8d8'; }}
          onMouseLeave={e => { e.currentTarget.style.background='none'; e.currentTarget.style.borderColor='transparent'; }}
          title="New tab (Ctrl+T)">+</button>
      </div>

      {/* ── Favorites bar ───────────────────────────────────────────────────── */}
      <div style={{ display:'flex', alignItems:'center', gap:2, padding:'2px 6px', background:'#f5f5f5', borderBottom:'1px solid #e0e0e0', flexShrink:0, overflow:'hidden' }}>
        {['MSN.com','Google','YouTube','eBay','CNN.com'].map(f => (
          <button key={f} onMouseDown={() => navigateTo(activeTabId, f)} style={{ fontSize:11, padding:'1px 8px', cursor:'default', borderRadius:2, whiteSpace:'nowrap', background:'linear-gradient(180deg,#f5f5f5,#e8e8e8)', border:'1px solid #d0d0d0', fontFamily:"'Segoe UI',Tahoma,sans-serif", color:'#000' }}>⭐ {f}</button>
        ))}
        <div style={{ color:'#999', fontSize:11, marginLeft:4 }}>» Add to Favorites</div>
      </div>

      {/* ── Content area ────────────────────────────────────────────────────── */}
      <div style={{ flex:1, overflow:'hidden', position:'relative', background:'white' }}>
        {/* Loading overlay — shown until first streaming block arrives */}
        {activeTab.loading && (
          <div style={{ position:'absolute', inset:0, background:'rgba(255,255,255,0.92)', zIndex:5, display:'flex', alignItems:'center', justifyContent:'center', flexDirection:'column', gap:10 }}>
            <div style={{ fontSize:13, color:'#555' }}>Loading {activeTab.currentUrl.replace(/^https?:\/\//,'').split('/')[0]}…</div>
            <div style={{ width:200, height:6, background:'#e0e0e0', border:'1px solid #ccc', borderRadius:2, overflow:'hidden' }}>
              <div style={{ width:`${Math.max(activeTab.progress,15)}%`, height:'100%', background:'linear-gradient(90deg,#3399ff,#66bbff)', transition:'width 0.3s' }} />
            </div>
          </div>
        )}

        {/* Google home page */}
        {showHome && <GoogleHome onSearch={q => navigateTo(activeTabId, q)} />}

        {/* One shadow DOM host per tab — hidden when not active */}
        {tabs.map(tab => (
          <div key={tab.id}
            ref={el => {
              if (el && !shadowRootsRef.current.has(tab.id)) {
                const sr = el.attachShadow({ mode: 'open' });
                shadowRootsRef.current.set(tab.id, sr);
                setupShadowEvents(tab.id, sr);
              }
            }}
            style={{ width:'100%', height:'100%', display: tab.id === activeTabId && tab.onPage ? 'block' : 'none' }}
          />
        ))}
      </div>

      {/* ── Status bar ──────────────────────────────────────────────────────── */}
      <div style={{ borderTop:'1px solid #d0d0d0', background:'#f0f0f0', display:'flex', justifyContent:'space-between', alignItems:'center', fontSize:11, padding:'1px 8px', flexShrink:0 }}>
        <span>{activeTab.status}</span>
        <div style={{ display:'flex', gap:12, color:'#666' }}>
          <span>🌐 Internet</span><span>🔒 Protected Mode: Off</span><span>100%</span>
        </div>
      </div>
    </div>
  );
}

function IEBtn({ children, onClick, disabled, title }: { children: React.ReactNode; onClick: () => void; disabled?: boolean; title?: string }) {
  const [h, setH] = useState(false);
  return (
    <button onClick={onClick} disabled={disabled} title={title}
      onMouseEnter={() => setH(true)} onMouseLeave={() => setH(false)}
      style={{ width:24, height:24, fontSize:13, cursor:disabled?'default':'pointer', background:h&&!disabled?'linear-gradient(180deg,#e8f0ff,#c8d8f0)':'transparent', border:h&&!disabled?'1px solid #9ab0d0':'1px solid transparent', borderRadius:2, opacity:disabled?0.4:1, display:'flex', alignItems:'center', justifyContent:'center', flexShrink:0 }}
    >{children}</button>
  );
}

function IEMenu({ name, onNavigate, onClose, onDeleteHistory }: { name: string; onNavigate: (url: string) => void; onClose: () => void; onDeleteHistory: () => void }) {
  type MI = string | [string, string?];
  const map: Record<string, MI[]> = {
    File: [['New Tab','Ctrl+T'],['New Window','Ctrl+N'],'─',['Save Page As...','Ctrl+S'],'─',['Print...','Ctrl+P'],'─',['Close','Alt+F4']],
    Edit: [['Cut','Ctrl+X'],['Copy','Ctrl+C'],['Paste','Ctrl+V'],'─',['Find on this page...','Ctrl+F'],['Select All','Ctrl+A']],
    View: [['Toolbars'],['Status Bar'],'─',['Go To'],'─',['Zoom'],'─',['Source'],'─',['Full Screen','F11']],
    Favorites: [['Add to Favorites...','Ctrl+D'],['Organize Favorites...'],'─',...(FAKE_FAVS as MI[])],
    Tools: [['Delete Browsing History...','Ctrl+Shift+Del'],['InPrivate Browsing','Ctrl+Shift+P'],'─',['Pop-up Blocker'],['SmartScreen Filter'],'─',['Internet Options']],
    Help: [['Help Topics','F1'],["What's New in Internet Explorer"],'─',['About Internet Explorer']],
  };
  const items: MI[] = map[name] ?? [];
  const action = (item: string) => {
    if (name==='Tools' && item==='Delete Browsing History...') onDeleteHistory();
    else if (name==='Tools' && item==='Internet Options') alert('Internet Options\n\nHome page: http://www.google.com/\nSecurity: Medium-high\nPrivacy: Medium');
    else if (name==='Favorites' && FAKE_FAVS.includes(item)) { onNavigate(item); onClose(); }
    else if (name==='Help' && item==='About Internet Explorer') alert('Windows Internet Explorer 8\nVersion 8.0.7600.16385\nVermOS Edition');
    else onClose();
  };
  return (
    <div style={{ position:'fixed', background:'white', border:'1px solid #999', boxShadow:'2px 2px 6px rgba(0,0,0,0.2)', zIndex:9999, minWidth:220, fontSize:12, padding:'3px 0' }}>
      {items.map((item, i) => {
        if (item==='─') return <div key={i} style={{ height:1, background:'#e0e0e0', margin:'3px 0' }} />;
        const [label, shortcut] = Array.isArray(item)?item:[item as string,undefined];
        return (
          <div key={i} onMouseDown={() => action(label)}
            style={{ padding:'4px 20px 4px 16px', cursor:'default', display:'flex', justifyContent:'space-between', gap:20 }}
            onMouseEnter={e => { e.currentTarget.style.background='#3399ff'; e.currentTarget.style.color='white'; }}
            onMouseLeave={e => { e.currentTarget.style.background=''; e.currentTarget.style.color=''; }}>
            <span>{label}</span>
            {shortcut && <span style={{ opacity:0.65, fontSize:11 }}>{shortcut}</span>}
          </div>
        );
      })}
    </div>
  );
}
