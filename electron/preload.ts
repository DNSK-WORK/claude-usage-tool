import { contextBridge, ipcRenderer } from 'electron';

export interface ClaudeMaxUsage {
  standard: { used: number; limit: number; percentage: number };
  advanced: { used: number; limit: number; percentage: number };
  bars?: Array<{ used: number; limit: number; percentage: number; label?: string; context?: string }>;
  resetDate: string | null;
  lastUpdated: string;
  isAuthenticated: boolean;
  plan?: string;
  email?: string;
}

export interface BillingInfo {
  creditBalance: number | null;
  currency: string;
  lastUpdated: string;
}

export interface RefreshData {
  claudeUsage: ClaudeMaxUsage | null;
  billingInfo: BillingInfo | null;
  timestamp: string;
}

export interface ElectronAPI {
  getClaudeMaxUsage: () => Promise<ClaudeMaxUsage | null>;
  isClaudeAuthenticated: () => Promise<boolean>;
  openClaudeLogin: () => Promise<boolean>;
  openPlatformLogin: () => Promise<boolean>;
  refreshAll: () => Promise<void>;
  onDataRefresh: (callback: (data: RefreshData) => void) => () => void;
}

// Auto-resize window to fit content
function setupAutoResize() {
  const observer = new ResizeObserver(() => {
    const root = document.getElementById('root');
    if (root) {
      const height = root.scrollHeight;
      ipcRenderer.send('app:resize', height);
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
};

contextBridge.exposeInMainWorld('electronAPI', electronAPI);
