import { useState, useEffect, useCallback } from 'react';
import { ClaudeMaxUsage } from './components/ClaudeMaxUsage';
import { CostDashboard } from './components/CostDashboard';
import { Settings } from './components/Settings';
import { ErrorBoundary } from './components/ErrorBoundary';
import type { ClaudeMaxUsage as ClaudeMaxUsageType, RefreshData, LogEntry, BarHistory, BurnRateInfo, ApiCostSummary } from './types';

const isElectron = typeof window !== 'undefined' && window.electronAPI !== undefined;

type Tab = 'usage' | 'cost';

function App() {
  const [claudeUsage, setClaudeUsage] = useState<ClaudeMaxUsageType | null>(null);
  const [, setLastUpdated] = useState<Date | null>(null);
  const [loading, setLoading] = useState(true);
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [showLogs, setShowLogs] = useState(false);
  const [activeTab, setActiveTab] = useState<Tab>('usage');
  const [showSettings, setShowSettings] = useState(false);
  const [history, setHistory] = useState<BarHistory[]>([]);
  const [burnRates, setBurnRates] = useState<BurnRateInfo[]>([]);
  const [apiCost, setApiCost] = useState<ApiCostSummary | null>(null);
  const [fetchError, setFetchError] = useState<string | null>(null);
  const [telegramError, setTelegramError] = useState<string | null>(null);
  const [refreshInterval, setRefreshInterval] = useState(60);

  const refreshData = useCallback(async () => {
    if (!isElectron) { setLoading(false); return; }
    setLoading(true);
    try { await window.electronAPI.refreshAll(); }
    catch (error) { console.error('Failed to refresh:', error); }
    setLoading(false);
  }, []);

  useEffect(() => {
    if (!isElectron) { setLoading(false); return; }
    window.electronAPI.getSettings().then(s => setRefreshInterval(s.refreshInterval));
    refreshData();
    const unsubscribe = window.electronAPI.onDataRefresh((data: RefreshData) => {
      setClaudeUsage(data.claudeUsage);
      setLastUpdated(new Date(data.timestamp));
      if (data.logs) setLogs(data.logs);
      if (data.history) setHistory(data.history);
      if (data.burnRates) setBurnRates(data.burnRates);
      if (data.apiCost !== undefined) setApiCost(data.apiCost ?? null);
      setFetchError(data.fetchError ?? null);
      setLoading(false);
    });
    const unsubTelegram = window.electronAPI.onTelegramError((msg: string) => {
      setTelegramError(msg);
      setTimeout(() => setTelegramError(null), 8000);
    });
    return () => { unsubscribe(); unsubTelegram(); };
  }, [refreshData]);

  const handleLogin = async () => {
    if (!isElectron) return;
    const success = await window.electronAPI.openClaudeLogin();
    if (success) refreshData();
  };

  if (!isElectron) {
    return (
      <div className="panel" style={{ width: 340, padding: 24, textAlign: 'center' }}>
        <h3 style={{ marginBottom: 12 }}>Claude Usage Tool</h3>
        <p style={{ color: 'var(--text-secondary)', fontSize: 13 }}>This app must be run inside Electron.</p>
        <p style={{ color: 'var(--text-muted)', fontSize: 12, marginTop: 8 }}>
          Run: <code>npm run electron:dev</code>
        </p>
      </div>
    );
  }

  const planName = claudeUsage?.plan || 'Max';
  const email = claudeUsage?.email;
  const hasAdminKey = apiCost?.hasAdminKey ?? false;

  return (
    <div className="panel" style={{ width: 340 }}>
      {/* Header */}
      <div className="section" style={{
        display: 'flex', justifyContent: 'space-between', alignItems: 'center',
        background: 'var(--bg-secondary)', padding: '12px 16px',
      }}>
        <div>
          <div style={{ fontWeight: 600, fontSize: 15, display: 'flex', alignItems: 'center', gap: 8 }}>
            <span>Claude</span>
            <span style={{
              fontSize: 11, background: 'var(--accent)', color: 'white',
              padding: '2px 8px', borderRadius: 4, fontWeight: 600,
            }}>
              {planName}
            </span>
          </div>
          {email && (
            <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 3 }}>{email}</div>
          )}
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          {/* Settings gear */}
          <button
            className="btn-icon"
            onClick={() => setShowSettings(s => !s)}
            title="Settings"
            style={{ opacity: showSettings ? 1 : 0.6 }}
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="12" cy="12" r="3"/>
              <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"/>
            </svg>
          </button>
          {/* Refresh */}
          <button
            className="btn-icon"
            onClick={refreshData}
            disabled={loading}
            title="Refresh"
            style={{
              opacity: loading ? 0.5 : 1,
              transition: 'transform 0.3s ease',
              transform: loading ? 'rotate(180deg)' : 'rotate(0deg)',
            }}
          >
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <polyline points="23 4 23 10 17 10"/>
              <polyline points="1 20 1 14 7 14"/>
              <path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15"/>
            </svg>
          </button>
        </div>
      </div>

      {/* Error banner */}
      {fetchError && !showSettings && (
        <div style={{
          background: '#78350f', borderBottom: '1px solid #92400e',
          padding: '6px 16px', display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        }}>
          <span style={{ fontSize: 11, color: '#fde68a' }}>
            {fetchError} — showing cached data
          </span>
          <button className="btn-icon" style={{ fontSize: 11, color: '#fde68a', opacity: 0.8 }} onClick={refreshData}>
            Retry
          </button>
        </div>
      )}

      {/* Telegram error banner — auto-dismisses after 8s */}
      {telegramError && !showSettings && (
        <div style={{
          background: '#78350f', borderBottom: '1px solid #92400e',
          padding: '6px 16px', display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        }}>
          <span style={{ fontSize: 11, color: '#fde68a' }}>📬 {telegramError}</span>
          <button className="btn-icon" style={{ fontSize: 11, color: '#fde68a', opacity: 0.8 }} onClick={() => setTelegramError(null)}>✕</button>
        </div>
      )}

      {/* Settings panel (replaces content) */}
      {showSettings ? (
        <Settings onClose={() => {
          setShowSettings(false);
          window.electronAPI.getSettings().then(s => setRefreshInterval(s.refreshInterval));
        }} />
      ) : (
        <>
          {/* Tabs — only show Cost tab if admin key configured */}
          {hasAdminKey && (
            <div style={{
              display: 'flex',
              borderBottom: '1px solid var(--border)',
              background: 'var(--bg-secondary)',
            }}>
              {(['usage', 'cost'] as Tab[]).map(tab => (
                <button
                  key={tab}
                  onClick={() => setActiveTab(tab)}
                  style={{
                    flex: 1, padding: '7px 0', fontSize: 12, fontWeight: 500,
                    background: 'none', border: 'none', cursor: 'pointer',
                    color: activeTab === tab ? 'var(--text-primary)' : 'var(--text-muted)',
                    borderBottom: activeTab === tab ? '2px solid var(--accent)' : '2px solid transparent',
                    textTransform: 'capitalize',
                  }}
                >
                  {tab}
                </button>
              ))}
            </div>
          )}

          {/* Content */}
          {activeTab === 'usage' || !hasAdminKey ? (
            <ClaudeMaxUsage
              usage={claudeUsage}
              onLogin={handleLogin}
              loading={loading}
              history={history}
              burnRates={burnRates}
            />
          ) : (
            <CostDashboard apiCost={apiCost} />
          )}

          {/* Footer */}
          <div style={{
            padding: '8px 16px 10px', fontSize: 11,
            color: 'var(--text-muted)', borderTop: '1px solid var(--border)',
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span>Auto-refresh {refreshInterval}s</span>
              <button
                className="btn-icon"
                onClick={() => setShowLogs(!showLogs)}
                style={{ fontSize: 11, padding: '2px 6px' }}
              >
                {showLogs ? 'Hide' : 'Log'}
              </button>
            </div>
            {showLogs && logs.length > 0 && (
              <div style={{
                fontFamily: 'SF Mono, Menlo, monospace', fontSize: 10, lineHeight: 1.5,
                maxHeight: 100, overflowY: 'auto', background: 'var(--bg-tertiary)',
                borderRadius: 6, padding: '8px 10px', marginTop: 6,
              }}>
                {logs.map((log, i) => {
                  const time = new Date(log.timestamp).toLocaleTimeString('en-GB', {
                    hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false,
                  });
                  return (
                    <div key={i} style={{ opacity: 0.5 + (i / logs.length) * 0.5 }}>
                      {time} {log.message}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
}

function AppWithBoundary() {
  return (
    <ErrorBoundary>
      <App />
    </ErrorBoundary>
  );
}

export default AppWithBoundary;
