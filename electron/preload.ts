import { contextBridge, ipcRenderer } from 'electron';
import type {
  ClaudeMaxUsage,
  RefreshData,
  AppSettings,
} from './sharedTypes';

export type { ClaudeMaxUsage, RefreshData, AppSettings };

export interface ElectronAPI {
  getClaudeMaxUsage: () => Promise<ClaudeMaxUsage | null>;
  isClaudeAuthenticated: () => Promise<boolean>;
  openClaudeLogin: () => Promise<boolean>;
  openPlatformLogin: () => Promise<boolean>;
  refreshAll: () => Promise<void>;
  onDataRefresh: (callback: (data: RefreshData) => void) => () => void;
  onTelegramError: (callback: (message: string) => void) => () => void;
  getSettings: () => Promise<AppSettings>;
  setSetting: (key: string, value: unknown) => Promise<void>;
  testTelegram: () => Promise<{ ok: boolean; error?: string }>;
}

// Auto-resize window to fit content
function setupAutoResize() {
  const observer = new ResizeObserver(() => {
    const root = document.getElementById('root');
    if (root) {
      const height = root.scrollHeight;
      try { ipcRenderer.send('app:resize', height); } catch { /* window closing */ }
    }
  });

  window.addEventListener('DOMContentLoaded', () => {
    const root = document.getElementById('root');
    if (root) {
      observer.observe(root);
    }
  });
}

setupAutoResize();

const electronAPI: ElectronAPI = {
  getClaudeMaxUsage: () => ipcRenderer.invoke('claude-max:get-usage'),
  isClaudeAuthenticated: () => ipcRenderer.invoke('claude-max:is-authenticated'),
  openClaudeLogin: () => ipcRenderer.invoke('claude-max:login'),
  openPlatformLogin: () => ipcRenderer.invoke('platform:login'),
  refreshAll: () => ipcRenderer.invoke('app:refresh-all'),
  onDataRefresh: (callback: (data: RefreshData) => void) => {
    const listener = (_event: Electron.IpcRendererEvent, data: RefreshData) => callback(data);
    ipcRenderer.on('app:data-updated', listener);
    return () => {
      ipcRenderer.removeListener('app:data-updated', listener);
    };
  },
  onTelegramError: (callback: (message: string) => void) => {
    const listener = (_event: Electron.IpcRendererEvent, message: string) => callback(message);
    ipcRenderer.on('telegram:error', listener);
    return () => { ipcRenderer.removeListener('telegram:error', listener); };
  },
  getSettings: () => ipcRenderer.invoke('settings:get'),
  setSetting: (key: string, value: unknown) => ipcRenderer.invoke('settings:set', key, value),
  testTelegram: () => ipcRenderer.invoke('telegram:test'),
};

contextBridge.exposeInMainWorld('electronAPI', electronAPI);
