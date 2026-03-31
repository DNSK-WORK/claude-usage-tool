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
  });
  const [saved, setSaved] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    window.electronAPI.getSettings().then(s => {
      setSettings(s);
      setLoading(false);
    });
  }, []);

  async function handleSave() {
    await window.electronAPI.setSetting('telegramBotToken', settings.telegramBotToken);
    await window.electronAPI.setSetting('telegramChatId', settings.telegramChatId);
    await window.electronAPI.setSetting('notificationThresholds', settings.notificationThresholds);
    await window.electronAPI.setSetting('refreshInterval', settings.refreshInterval);
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
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

  if (loading) return <div className="section"><div className="loading">Loading...</div></div>;

  return (
    <div className="section" style={{ padding: '12px 16px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
        <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-primary)' }}>Settings</span>
        <button className="btn-icon" onClick={onClose} style={{ fontSize: 13 }}>✕</button>
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
        <div>
          <label style={labelStyle}>Chat ID</label>
          <input
            type="text"
            value={settings.telegramChatId}
            onChange={e => setSettings(s => ({ ...s, telegramChatId: e.target.value }))}
            placeholder="987654321"
            style={inputStyle}
          />
        </div>
      </div>

      {/* Thresholds */}
      <div style={{ marginBottom: 12 }}>
        <label style={labelStyle}>Alert Thresholds (%, comma-separated)</label>
        <input
          type="text"
          value={settings.notificationThresholds.join(', ')}
          onChange={e => {
            const vals = e.target.value.split(',')
              .map(v => parseInt(v.trim()))
              .filter(v => !isNaN(v) && v > 0 && v <= 100);
            setSettings(s => ({ ...s, notificationThresholds: vals }));
          }}
          placeholder="80, 90"
          style={inputStyle}
        />
      </div>

      {/* Refresh interval */}
      <div style={{ marginBottom: 16 }}>
        <label style={labelStyle}>Refresh Interval (seconds)</label>
        <input
          type="number"
          min={10}
          max={3600}
          value={settings.refreshInterval}
          onChange={e => setSettings(s => ({ ...s, refreshInterval: parseInt(e.target.value) || 60 }))}
          style={inputStyle}
        />
      </div>

      <button
        className="btn btn-primary"
        onClick={handleSave}
        style={{ width: '100%', fontSize: 13, padding: '8px 0' }}
      >
        {saved ? 'Saved ✓' : 'Save'}
      </button>
    </div>
  );
}
