// Shared IPC types — used by preload.ts and mirrored in src/types/index.ts
// When changing these, update src/types/index.ts to match.

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
  creditBalance: number | null;
  hasAdminKey: boolean;
  lastUpdated?: string;
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
  timestamp: string;
  history?: BarHistory[];
  burnRates?: BurnRateInfo[];
  apiCost?: ApiCostSummary | null;
  fetchError?: string | null;
}
