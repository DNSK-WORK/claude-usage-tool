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

export interface BarReading {
  ts: number;
  pct: number;
}

export interface BarHistory {
  label: string;
  readings: BarReading[];
}

export interface BurnRateInfo {
  label: string;
  ratePerHour: number;
  etaMinutes: number | null;
}

export interface ApiCostSummary {
  totalCost: number;
  byModel: Record<string, number>;
  creditBalance: string | null;
  hasAdminKey: boolean;
}

export interface AppSettings {
  telegramBotToken: string;
  telegramChatId: string;
  notificationThresholds: number[];
  refreshInterval: number;
  adminApiKey: string;
}

export interface RefreshData {
  claudeUsage: ClaudeMaxUsage | null;
  billingInfo: BillingInfo | null;
  timestamp: string;
  history?: BarHistory[];
  burnRates?: BurnRateInfo[];
  apiCost?: ApiCostSummary | null;
  fetchError?: string | null;
}

export interface ElectronAPI {
  getClaudeMaxUsage: () => Promise<ClaudeMaxUsage | null>;
  isClaudeAuthenticated: () => Promise<boolean>;
  openClaudeLogin: () => Promise<boolean>;
  openPlatformLogin: () => Promise<boolean>;
  refreshAll: () => Promise<void>;
  onDataRefresh: (callback: (data: RefreshData) => void) => () => void;
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
  getSettings: () => ipcRenderer.invoke('settings:get'),
  setSetting: (key: string, value: unknown) => ipcRenderer.invoke('settings:set', key, value),
  testTelegram: () => ipcRenderer.invoke('telegram:test'),
};

contextBridge.exposeInMainWorld('electronAPI', electronAPI);
