import { create } from 'zustand';
import type { WindowState, AppJSON } from '../types';

const TASKBAR_HEIGHT = 40;
const CASCADE_STEP = 28;
const INITIAL_OFFSET = { x: 90, y: 50 };
const DEFAULT_SIZE = { width: 720, height: 520 };

interface WindowsStore {
  windows: WindowState[];
  maxZIndex: number;
  openWindow: (appKind: string, title: string) => string;
  closeWindow: (id: string) => void;
  minimizeWindow: (id: string) => void;
  maximizeWindow: (id: string) => void;
  restoreWindow: (id: string) => void;
  focusWindow: (id: string) => void;
  moveWindow: (id: string, x: number, y: number) => void;
  resizeWindow: (id: string, x: number, y: number, width: number, height: number) => void;
  setWindowData: (id: string, data: AppJSON) => void;
  setWindowLoading: (id: string, loading: boolean) => void;
  setWindowError: (id: string, error: string | null) => void;
}

export const useWindowsStore = create<WindowsStore>((set, get) => ({
  windows: [],
  maxZIndex: 100,

  openWindow(appKind, title) {
    const id = crypto.randomUUID();
    const { windows, maxZIndex } = get();
    const slot = windows.length % 8;
    const x = INITIAL_OFFSET.x + slot * CASCADE_STEP;
    const y = INITIAL_OFFSET.y + slot * CASCADE_STEP;
    const newZ = maxZIndex + 1;

    set(state => ({
      windows: [...state.windows, {
        id, title, appKind,
        x, y,
        width: DEFAULT_SIZE.width,
        height: DEFAULT_SIZE.height,
        minimized: false,
        maximized: false,
        zIndex: newZ,
        appData: null,
        loading: true,
        error: null,
      }],
      maxZIndex: newZ,
    }));

    return id;
  },

  closeWindow(id) {
    set(state => ({ windows: state.windows.filter(w => w.id !== id) }));
  },

  minimizeWindow(id) {
    set(state => ({
      windows: state.windows.map(w => w.id === id ? { ...w, minimized: true } : w),
    }));
  },

  maximizeWindow(id) {
    const newZ = get().maxZIndex + 1;
    set(state => ({
      windows: state.windows.map(w =>
        w.id === id ? { ...w, maximized: !w.maximized, minimized: false, zIndex: newZ } : w
      ),
      maxZIndex: newZ,
    }));
  },

  restoreWindow(id) {
    const newZ = get().maxZIndex + 1;
    set(state => ({
      windows: state.windows.map(w =>
        w.id === id ? { ...w, minimized: false, zIndex: newZ } : w
      ),
      maxZIndex: newZ,
    }));
  },

  focusWindow(id) {
    const { maxZIndex, windows } = get();
    const win = windows.find(w => w.id === id);
    if (!win || win.zIndex === maxZIndex) return; // already on top
    const newZ = maxZIndex + 1;
    set(state => ({
      windows: state.windows.map(w => w.id === id ? { ...w, zIndex: newZ } : w),
      maxZIndex: newZ,
    }));
  },

  moveWindow(id, x, y) {
    const clampedY = Math.max(0, Math.min(y, window.innerHeight - TASKBAR_HEIGHT - 30));
    set(state => ({
      windows: state.windows.map(w =>
        w.id === id ? { ...w, x, y: clampedY } : w
      ),
    }));
  },

  resizeWindow(id, x, y, width, height) {
    const MIN_W = 300, MIN_H = 200;
    const clampedY = Math.max(0, Math.min(y, window.innerHeight - TASKBAR_HEIGHT - 30));
    set(state => ({
      windows: state.windows.map(w =>
        w.id === id ? {
          ...w,
          x: width < MIN_W ? w.x : x,
          y: height < MIN_H ? w.y : clampedY,
          width: Math.max(MIN_W, width),
          height: Math.max(MIN_H, height),
        } : w
      ),
    }));
  },

  setWindowData(id, data) {
    set(state => ({
      windows: state.windows.map(w =>
        w.id === id ? { ...w, appData: data, title: data.title, loading: false, error: null } : w
      ),
    }));
  },

  setWindowLoading(id, loading) {
    set(state => ({
      windows: state.windows.map(w => w.id === id ? { ...w, loading } : w),
    }));
  },

  setWindowError(id, error) {
    set(state => ({
      windows: state.windows.map(w =>
        w.id === id ? { ...w, error, loading: false } : w
      ),
    }));
  },
}));
