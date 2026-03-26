import type { ClaudeMaxUsage as ClaudeMaxUsageType, UsageBar as UsageBarType } from '../types';

interface Props {
  usage: ClaudeMaxUsageType | null;
  onLogin: () => void;
  loading: boolean;
}

function getBarColor(percentage: number): string {
  if (percentage >= 90) return 'var(--bar-red)';
  if (percentage >= 75) return 'var(--bar-orange)';
  if (percentage >= 50) return 'var(--bar-yellow)';
  return 'var(--bar-green)';
}

function getPercentColor(percentage: number): string {
  if (percentage >= 90) return 'var(--error)';
  if (percentage >= 75) return 'var(--bar-orange)';
  return 'var(--text-primary)';
}

function UsageBarComponent({
  bar,
  label,
  resetInfo
}: {
  bar: UsageBarType;
  label: string;
  resetInfo?: string;
}) {
  const displayLabel = bar.label || label;
  const percentage = Math.round(bar.percentage);
  const barColor = getBarColor(percentage);
  const isCritical = percentage >= 90;

  return (
    <div style={{ marginBottom: 14 }}>
      {/* Label row */}
      <div style={{
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 6,
      }}>
        <span style={{
          fontSize: 13,
          color: 'var(--text-primary)',
          fontWeight: 500,
        }}>
          {displayLabel}
        </span>
        <span style={{
          fontSize: 14,
          fontWeight: 600,
          color: getPercentColor(percentage),
          fontFeatureSettings: '"tnum"',
        }}>
          {percentage}%
        </span>
      </div>

      {/* Progress bar */}
      <div className="progress-bar" style={{ height: 6, borderRadius: 3, marginBottom: 4 }}>
        <div
          className={`progress-fill ${isCritical ? 'bar-critical' : ''}`}
          style={{
            width: `${Math.min(bar.percentage, 100)}%`,
            background: barColor,
            height: '100%',
            borderRadius: 3,
          }}
        />
      </div>

      {/* Reset info */}
      {resetInfo && (
        <div style={{
          fontSize: 11,
          color: 'var(--text-muted)',
        }}>
          {resetInfo}
        </div>
      )}
    </div>
  );
}

export function ClaudeMaxUsage({ usage, onLogin, loading }: Props) {
  if (!usage?.isAuthenticated) {
    return (
      <div className="section">
        <div style={{
          textAlign: 'center',
          padding: '20px 0',
        }}>
          <div style={{ fontSize: 24, marginBottom: 10 }}>Claude</div>
          <p style={{ color: 'var(--text-secondary)', marginBottom: 14, fontSize: 13 }}>
            Login to Claude to see your subscription usage
          </p>
          <button className="btn btn-primary" onClick={onLogin} style={{ fontSize: 13, padding: '8px 16px' }}>
            Login to Claude
          </button>
        </div>
      </div>
    );
  }

  if (loading && !usage) {
    return (
      <div className="section">
        <div className="loading">Loading...</div>
      </div>
    );
  }

  const bars = usage.bars && usage.bars.length > 0
    ? usage.bars
    : [usage.standard, usage.advanced].filter(b => b.percentage > 0 || b.limit > 0);

  const getResetInfo = (bar: UsageBarType): string | undefined => {
    if (bar.context) return bar.context;
    return undefined;
  };

  const getLabel = (bar: UsageBarType, index: number): string => {
    if (bar.label) return bar.label;
    const defaultLabels = ['Current Session', 'All models', 'Sonnet only', 'Extra usage'];
    return defaultLabels[index] || `Usage ${index + 1}`;
  };

  return (
    <div className="section" style={{ padding: '12px 16px' }}>
      {bars.length === 0 ? (
        <div style={{ color: 'var(--text-muted)', fontSize: 13, padding: '10px 0' }}>
          No usage data available
        </div>
      ) : (
        bars.map((bar, index) => (
          <UsageBarComponent
            key={index}
            bar={bar}
            label={getLabel(bar, index)}
            resetInfo={getResetInfo(bar)}
          />
        ))
      )}
    </div>
  );
}
