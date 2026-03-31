export interface UsageBar {
  used: number;
  limit: number;
  percentage: number;
  label?: string;
  context?: string;
}

export interface ClaudeMaxUsage {
  standard: UsageBar;
  advanced: UsageBar;
  bars?: UsageBar[];
  resetDate: string | null;
  lastUpdated: string;
  isAuthenticated: boolean;
  plan?: string;
  email?: string;
}

export interface LogEntry {
  timestamp: string;
  message: string;
}

export interface BarReading {
  ts: number;   // unix ms
  pct: number;  // percentage 0-100
}

export interface BarHistory {
  label: string;
  readings: BarReading[];
}

export interface BurnRateInfo {
  label: string;
  ratePerHour: number;    // % per hour (positive = growing)
  etaMinutes: number | null; // null if not growing or > 24hr
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
  refreshInterval: number; // seconds
}

export interface RefreshData {
  claudeUsage: ClaudeMaxUsage | null;
  timestamp: string;
  logs?: LogEntry[];
  history?: BarHistory[];
  burnRates?: BurnRateInfo[];
  apiCost?: ApiCostSummary | null;
}

// Window type augmentation for Electron API
declare global {
  interface Window {
    electronAPI: {
      getClaudeMaxUsage: () => Promise<ClaudeMaxUsage | null>;
      isClaudeAuthenticated: () => Promise<boolean>;
      openClaudeLogin: () => Promise<boolean>;
      refreshAll: () => Promise<void>;
      onDataRefresh: (callback: (data: RefreshData) => void) => () => void;
      getSettings: () => Promise<AppSettings>;
      setSetting: (key: keyof AppSettings, value: AppSettings[keyof AppSettings]) => Promise<void>;
    };
  }
}

export {};
