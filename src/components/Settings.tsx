import { useState, useEffect } from 'react';
import type { AppSettings } from '../types';

interface Props {
  onClose: () => void;
}

export function Settings({ onClose }: Props) {
  const [settings, setSettings] = useState<AppSettings>({
    telegramBotToken: '',
    telegramChatId: '',
    notificationThresholds: [80, 90],
    refreshInterval: 60,
    adminApiKey: '',
  });
  const [saved, setSaved] = useState(false);
  const [saveError, setSaveError] = useState('');
  const [loading, setLoading] = useState(true);
  const [thresholdsRaw, setThresholdsRaw] = useState('80, 90');
  const [thresholdsWarning, setThresholdsWarning] = useState('');
  const [telegramTestStatus, setTelegramTestStatus] = useState<'idle' | 'sending' | 'ok' | 'error'>('idle');
  const [telegramTestError, setTelegramTestError] = useState('');
  const [adminKeyInput, setAdminKeyInput] = useState('');
  const [adminKeyError, setAdminKeyError] = useState('');

  useEffect(() => {
    window.electronAPI.getSettings().then(s => {
      setSettings(s);
      setThresholdsRaw(s.notificationThresholds.join(', '));
      setLoading(false);
    });
  }, []);

  function handleThresholdsChange(raw: string) {
    setThresholdsRaw(raw);
    const parts = raw.split(',').map(v => v.trim()).filter(v => v !== '');
    const invalid = parts.filter(v => isNaN(parseInt(v)) || parseInt(v) <= 0 || parseInt(v) > 100);
    if (invalid.length > 0) {
      setThresholdsWarning(`Ignored: ${invalid.join(', ')} (must be 1–100)`);
    } else {
      setThresholdsWarning('');
    }
  }

  function handleAdminKeyChange(val: string) {
    setAdminKeyInput(val);
    if (val && !val.startsWith('sk-ant-admin')) {
      setAdminKeyError('Must start with sk-ant-admin');
    } else {
      setAdminKeyError('');
    }
  }

  function handleIntervalChange(raw: string) {
    const val = parseInt(raw) || 60;
    const clamped = Math.max(10, Math.min(3600, val));
    setSettings(s => ({ ...s, refreshInterval: clamped }));
  }

  async function handleSave() {
    if (adminKeyInput && !adminKeyInput.startsWith('sk-ant-admin')) {
      setSaveError('Admin key must start with sk-ant-admin');
      return;
    }
    const parsedThresholds = thresholdsRaw.split(',')
      .map(v => parseInt(v.trim()))
      .filter(v => !isNaN(v) && v > 0 && v <= 100);
    try {
      await window.electronAPI.setSetting('telegramBotToken', settings.telegramBotToken);
      await window.electronAPI.setSetting('telegramChatId', settings.telegramChatId);
      await window.electronAPI.setSetting('notificationThresholds', parsedThresholds);
      await window.electronAPI.setSetting('refreshInterval', settings.refreshInterval);
      if (adminKeyInput) {
        await window.electronAPI.setSetting('adminApiKey', adminKeyInput);
      }
      setSaveError('');
      setSaved(true);
      await window.electronAPI.refreshAll();
      setTimeout(() => { setSaved(false); onClose(); }, 1500);
    } catch (err) {
      setSaveError(err instanceof Error ? err.message : 'Save failed');
    }
  }

  async function handleTestTelegram() {
    setTelegramTestStatus('sending');
    setTelegramTestError('');
    const result = await window.electronAPI.testTelegram();
    if (result.ok) {
      setTelegramTestStatus('ok');
    } else {
      setTelegramTestStatus('error');
      setTelegramTestError(result.error || 'Unknown error');
    }
    setTimeout(() => setTelegramTestStatus('idle'), 4000);
  }

  const inputStyle: React.CSSProperties = {
    width: '100%', boxSizing: 'border-box',
    background: 'var(--bg-tertiary)',
    border: '1px solid var(--border)',
    borderRadius: 6, color: 'var(--text-primary)',
    fontSize: 12, padding: '6px 8px',
    outline: 'none', fontFamily: 'SF Mono, Menlo, monospace',
  };

  const labelStyle: React.CSSProperties = {
    fontSize: 11, color: 'var(--text-muted)',
    marginBottom: 4, display: 'block',
  };

  const warnStyle: React.CSSProperties = {
    fontSize: 10, color: '#f59e0b', marginTop: 3,
  };

  const errStyle: React.CSSProperties = {
    fontSize: 10, color: '#ef4444', marginTop: 3,
  };

  if (loading) return <div className="section"><div className="loading">Loading...</div></div>;

  return (
    <div className="section" style={{ padding: '12px 16px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
        <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-primary)' }}>Settings</span>
        <button className="btn-icon" onClick={() => onClose()} style={{ fontSize: 13 }}>✕</button>
      </div>

      {/* Telegram */}
      <div style={{ marginBottom: 12 }}>
        <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-secondary)', marginBottom: 8 }}>
          Telegram Notifications
        </div>
        <div style={{ marginBottom: 8 }}>
          <label style={labelStyle}>Bot Token</label>
          <input
            type="password"
            value={settings.telegramBotToken}
            onChange={e => setSettings(s => ({ ...s, telegramBotToken: e.target.value }))}
            placeholder="123456:ABCdef..."
            style={inputStyle}
          />
        </div>
        <div style={{ marginBottom: 6 }}>
          <label style={labelStyle}>Chat ID</label>
          <input
            type="text"
            value={settings.telegramChatId}
            onChange={e => setSettings(s => ({ ...s, telegramChatId: e.target.value }))}
            placeholder="987654321"
            style={inputStyle}
          />
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 4 }}>
          <button
            className="btn"
            onClick={handleTestTelegram}
            disabled={telegramTestStatus === 'sending'}
            style={{ fontSize: 11, padding: '4px 10px' }}
          >
            {telegramTestStatus === 'sending' ? 'Sending...' : 'Send test'}
          </button>
          {telegramTestStatus === 'ok' && (
            <span style={{ fontSize: 11, color: '#22c55e' }}>Sent ✓</span>
          )}
          {telegramTestStatus === 'error' && (
            <span style={{ fontSize: 11, color: '#ef4444', maxWidth: 160, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={telegramTestError}>
              {telegramTestError}
            </span>
          )}
        </div>
      </div>

      {/* Admin API Key */}
      <div style={{ marginBottom: 12 }}>
        <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-secondary)', marginBottom: 8 }}>
          Anthropic Admin API Key
        </div>
        {settings.adminApiKey && !adminKeyInput && (
          <div style={{ fontSize: 11, color: '#22c55e', marginBottom: 6 }}>
            Configured {settings.adminApiKey}
          </div>
        )}
        <label style={labelStyle}>
          {settings.adminApiKey ? 'Replace key' : 'Paste key to enable Cost tab'}
        </label>
        <input
          type="password"
          value={adminKeyInput}
          onChange={e => handleAdminKeyChange(e.target.value)}
          placeholder="sk-ant-admin-..."
          style={{ ...inputStyle, borderColor: adminKeyError ? '#ef4444' : undefined }}
        />
        {adminKeyError && <div style={errStyle}>{adminKeyError}</div>}
        <div style={{ fontSize: 10, color: 'var(--text-muted)', marginTop: 4 }}>
          Get from console.anthropic.com/settings/admin-keys
        </div>
      </div>

      {/* Thresholds */}
      <div style={{ marginBottom: 12 }}>
        <label style={labelStyle}>Alert Thresholds (%, comma-separated)</label>
        <input
          type="text"
          value={thresholdsRaw}
          onChange={e => handleThresholdsChange(e.target.value)}
          placeholder="80, 90"
          style={inputStyle}
        />
        {thresholdsWarning && <div style={warnStyle}>{thresholdsWarning}</div>}
      </div>

      {/* Refresh interval */}
      <div style={{ marginBottom: 16 }}>
        <label style={labelStyle}>Refresh Interval (seconds)</label>
        <input
          type="number"
          min={10}
          max={3600}
          value={settings.refreshInterval}
          onChange={e => handleIntervalChange(e.target.value)}
          style={inputStyle}
        />
        {settings.refreshInterval > 300 && (
          <div style={warnStyle}>High interval — burn rate will be less accurate</div>
        )}
      </div>

      {saveError && (
        <div style={{ ...errStyle, marginBottom: 8, fontSize: 11 }}>{saveError}</div>
      )}

      <button
        className="btn btn-primary"
        onClick={handleSave}
        disabled={!!adminKeyError}
        style={{ width: '100%', fontSize: 13, padding: '8px 0' }}
      >
        {saved ? 'Saved ✓' : 'Save'}
      </button>
    </div>
  );
}
