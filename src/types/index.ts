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

export interface RefreshData {
  claudeUsage: ClaudeMaxUsage | null;
  timestamp: string;
  logs?: LogEntry[];
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
    };
  }
}

export {};
