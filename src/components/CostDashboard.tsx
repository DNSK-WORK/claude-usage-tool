import type { ApiCostSummary } from '../types';

interface Props {
  apiCost: ApiCostSummary | null;
}

function formatCost(amount: number): string {
  if (amount === 0) return '$0.00';
  if (amount < 0.01) return '<$0.01';
  return `$${amount.toFixed(2)}`;
}

function shortModelName(model: string): string {
  return model
    .replace('claude-', '')
    .replace(/-\d{8}$/, '')  // strip date suffix
    .replace(/-latest$/, '');
}

export function CostDashboard({ apiCost }: Props) {
  if (!apiCost?.hasAdminKey) {
    return (
      <div className="section">
        <div style={{ textAlign: 'center', padding: '20px 16px' }}>
          <div style={{ fontSize: 13, color: 'var(--text-secondary)', marginBottom: 8 }}>
            Add an Admin API key to see cost data
          </div>
          <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>
            Open ⚙ Settings and paste your key from<br />
            console.anthropic.com/settings/admin-keys
          </div>
        </div>
      </div>
    );
  }

  const entries = Object.entries(apiCost.byModel)
    .sort(([, a], [, b]) => b - a)
    .filter(([, cost]) => cost > 0);

  const maxCost = entries[0]?.[1] || 1;

  const lastUpdatedStr = apiCost.lastUpdated
    ? new Date(apiCost.lastUpdated).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit', hour12: false })
    : null;

  return (
    <div className="section" style={{ padding: '12px 16px' }}>
      {/* Total + credit balance */}
      <div style={{
        display: 'flex', justifyContent: 'space-between', alignItems: 'baseline',
        marginBottom: 14, paddingBottom: 10,
        borderBottom: '1px solid var(--border)',
      }}>
        <div>
          <div style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 2 }}>30-day spend</div>
          <div style={{ fontSize: 22, fontWeight: 700, color: 'var(--text-primary)', fontFeatureSettings: '"tnum"' }}>
            {formatCost(apiCost.totalCost)}
          </div>
        </div>
        {apiCost.creditBalance !== null && (
          <div style={{ textAlign: 'right' }}>
            <div style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 2 }}>credit balance</div>
            <div style={{ fontSize: 15, fontWeight: 600, color: 'var(--bar-green)', fontFeatureSettings: '"tnum"' }}>
              ${apiCost.creditBalance.toFixed(2)}
            </div>
          </div>
        )}
      </div>

      {/* Per-model breakdown */}
      {entries.length === 0 ? (
        <div style={{ fontSize: 13, color: 'var(--text-muted)', padding: '8px 0' }}>
          No usage in the last 30 days
        </div>
      ) : (
        entries.map(([model, cost]) => (
          <div key={model} style={{ marginBottom: 10 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
              <span style={{ fontSize: 12, color: 'var(--text-secondary)' }}>
                {shortModelName(model)}
              </span>
              <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-primary)', fontFeatureSettings: '"tnum"' }}>
                {formatCost(cost)}
              </span>
            </div>
            <div style={{ height: 3, borderRadius: 2, background: 'var(--bg-tertiary)' }}>
              <div style={{
                height: '100%', borderRadius: 2,
                background: 'var(--accent)',
                width: `${(cost / maxCost) * 100}%`,
                opacity: 0.8,
              }} />
            </div>
          </div>
        ))
      )}

      {lastUpdatedStr && (
        <div style={{ fontSize: 10, color: 'var(--text-muted)', marginTop: 8, opacity: 0.6 }}>
          Updated {lastUpdatedStr} · refreshes every 5 cycles
        </div>
      )}
    </div>
  );
}
