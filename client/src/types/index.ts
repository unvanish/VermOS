export interface AppJSON {
  title: string;
  appKind: 'calculator' | 'notepad' | 'browser' | 'paint' | 'terminal' | 'custom';
  stateSummary: string;
  html: string;
  css?: string;
  suggestedActions: Array<{ label: string; event: string }>;
}

export interface WindowState {
  id: string;
  title: string;
  appKind: string;
  x: number;
  y: number;
  width: number;
  height: number;
  minimized: boolean;
  maximized: boolean;
  zIndex: number;
  appData: AppJSON | null;
  loading: boolean;
  error: string | null;
}

export interface DesktopApp {
  id: string;
  label: string;
  icon: string;
  appKind: string;
}

export interface AuthState {
  authenticated: boolean;
  username: string | null;
  loading: boolean;
}

export interface DebugInfo {
  model: string;
  username: string | null;
  lastGenTime: string | null;
  generationCount: number;
}
