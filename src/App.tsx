import { useState, useEffect, useCallback } from 'react';
import { ClaudeMaxUsage } from './components/ClaudeMaxUsage';
import type { ClaudeMaxUsage as ClaudeMaxUsageType, RefreshData, LogEntry } from './types';

const isElectron = typeof window !== 'undefined' && window.electronAPI !== undefined;

function App() {
  const [claudeUsage, setClaudeUsage] = useState<ClaudeMaxUsageType | null>(null);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);
  const [loading, setLoading] = useState(true);
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [showLogs, setShowLogs] = useState(false);

  const refreshData = useCallback(async () => {
    if (!isElectron) {
      setLoading(false);
      return;
    }
    setLoading(true);
    try {
      await window.electronAPI.refreshAll();
    } catch (error) {
      console.error('Failed to refresh:', error);
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    if (!isElectron) {
      setLoading(false);
      return;
    }

    refreshData();

    const unsubscribe = window.electronAPI.onDataRefresh((data: RefreshData) => {
      setClaudeUsage(data.claudeUsage);
      setLastUpdated(new Date(data.timestamp));
      if (data.logs) {
        setLogs(data.logs);
      }
      setLoading(false);
    });

    return () => {
      unsubscribe();
    };
  }, [refreshData]);

  const handleLogin = async () => {
    if (!isElectron) return;
    const success = await window.electronAPI.openClaudeLogin();
    if (success) {
      refreshData();
    }
  };

  if (!isElectron) {
    return (
      <div className="panel" style={{ width: 340, padding: 24, textAlign: 'center' }}>
        <h3 style={{ marginBottom: 12 }}>Claude Usage Tool</h3>
        <p style={{ color: 'var(--text-secondary)', fontSize: 13 }}>
          This app must be run inside Electron.
        </p>
        <p style={{ color: 'var(--text-muted)', fontSize: 12, marginTop: 8 }}>
          Run: <code>npm run electron:dev</code>
        </p>
      </div>
    );
  }

  const planName = claudeUsage?.plan || 'Max';
  const email = claudeUsage?.email;

  return (
    <div className="panel" style={{ width: 340 }}>
      {/* Header */}
      <div className="section" style={{
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        background: 'var(--bg-secondary)',
        padding: '12px 16px',
      }}>
        <div>
          <div style={{
            fontWeight: 600,
            fontSize: 15,
            display: 'flex',
            alignItems: 'center',
            gap: 8,
          }}>
            <span>Claude</span>
            <span style={{
              fontSize: 11,
              background: 'var(--accent)',
              color: 'white',
              padding: '2px 8px',
              borderRadius: 4,
              fontWeight: 600,
            }}>
              {planName}
            </span>
          </div>
          {email && (
            <div style={{
              fontSize: 11,
              color: 'var(--text-muted)',
              marginTop: 3,
            }}>
              {email}
            </div>
          )}
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          {lastUpdated && (
            <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>
              {lastUpdated.toLocaleTimeString('ko-KR', {
                hour: '2-digit',
                minute: '2-digit',
                hour12: false,
              })}
            </span>
          )}
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
              <polyline points="23 4 23 10 17 10"></polyline>
              <polyline points="1 20 1 14 7 14"></polyline>
              <path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15"></path>
            </svg>
          </button>
        </div>
      </div>

      {/* Usage Section */}
      <ClaudeMaxUsage
        usage={claudeUsage}
        onLogin={handleLogin}
        loading={loading}
      />

      {/* Footer */}
      <div style={{
        padding: '8px 16px 10px',
        fontSize: 11,
        color: 'var(--text-muted)',
        borderTop: '1px solid var(--border)',
      }}>
        <div style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
        }}>
          <span>Auto-refresh 60s</span>
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
            fontFamily: 'SF Mono, Menlo, monospace',
            fontSize: 10,
            lineHeight: 1.5,
            maxHeight: 100,
            overflowY: 'auto',
            background: 'var(--bg-tertiary)',
            borderRadius: 6,
            padding: '8px 10px',
            marginTop: 6,
          }}>
            {logs.map((log, i) => {
              const time = new Date(log.timestamp).toLocaleTimeString('ko-KR', {
                hour: '2-digit',
                minute: '2-digit',
                second: '2-digit',
                hour12: false
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
    </div>
  );
}

export default App;
