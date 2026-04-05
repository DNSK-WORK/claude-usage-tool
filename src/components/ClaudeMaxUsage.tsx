import { useState } from 'react';
import type { ClaudeMaxUsage as ClaudeMaxUsageType, UsageBar as UsageBarType, BarHistory, BurnRateInfo } from '../types';

interface Props {
  usage: ClaudeMaxUsageType | null;
  onLogin: () => void;
  loading: boolean;
  history?: BarHistory[];
  burnRates?: BurnRateInfo[];
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

function Sparkline({ readings, color }: { readings: Array<{ ts: number; pct: number }>; color: string }) {
  if (readings.length < 2) return null;

  const W = 60, H = 18;
  const minPct = Math.min(...readings.map(r => r.pct));
  const maxPct = Math.max(...readings.map(r => r.pct));
  const range = maxPct - minPct;

  // Flat line: draw a centered horizontal line
  if (range === 0) {
    const y = (H / 2).toFixed(1);
    return (
      <svg width={W} height={H} style={{ display: 'block', overflow: 'visible' }}>
        <line x1="0" y1={y} x2={W} y2={y} stroke={color} strokeWidth="1.5" opacity={0.4} />
        <circle cx={W} cy={y} r="2" fill={color} opacity={0.7} />
      </svg>
    );
  }

  const points = readings.map((r, i) => {
    const x = readings.length === 1 ? W / 2 : (i / (readings.length - 1)) * W;
    const y = H - ((r.pct - minPct) / range) * (H - 2) - 1;
    return `${x.toFixed(1)},${y.toFixed(1)}`;
  }).join(' ');

  const last = readings[readings.length - 1];
  const lastX = readings.length === 1 ? W / 2 : W;
  const lastY = H - ((last.pct - minPct) / range) * (H - 2) - 1;

  return (
    <svg width={W} height={H} style={{ display: 'block', overflow: 'visible' }}>
      <polyline
        points={points}
        fill="none"
        stroke={color}
        strokeWidth="1.5"
        strokeLinejoin="round"
        strokeLinecap="round"
        opacity={0.7}
      />
      <circle cx={lastX.toFixed(1)} cy={lastY.toFixed(1)} r="2" fill={color} opacity={0.9} />
    </svg>
  );
}

function formatEta(etaMinutes: number): string {
  if (etaMinutes < 1) return '<1min to limit';
  if (etaMinutes < 60) return `~${Math.round(etaMinutes)}min to limit`;
  const h = Math.floor(etaMinutes / 60);
  const m = Math.round(etaMinutes % 60);
  return m > 0 ? `~${h}hr ${m}min to limit` : `~${h}hr to limit`;
}

function UsageBarComponent({
  bar,
  label,
  resetInfo,
  readings,
  burnRate,
}: {
  bar: UsageBarType;
  label: string;
  resetInfo?: string;
  readings?: Array<{ ts: number; pct: number }>;
  burnRate?: BurnRateInfo;
}) {
  const [copied, setCopied] = useState(false);
  const displayLabel = bar.label || label;
  const percentage = Math.round(bar.percentage);
  const barColor = getBarColor(percentage);
  const isCritical = percentage >= 90;
  const showBurnRate = burnRate && burnRate.etaMinutes !== null && burnRate.ratePerHour >= 0.1;

  function handleCopy() {
    const text = resetInfo
      ? `${displayLabel}: ${percentage}% (${resetInfo})`
      : `${displayLabel}: ${percentage}%`;
    navigator.clipboard.writeText(text).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    });
  }

  return (
    <div style={{ marginBottom: 14 }}>
      {/* Label row */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
        <span style={{ fontSize: 13, color: 'var(--text-primary)', fontWeight: 500 }}>
          {displayLabel}
        </span>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          {readings && readings.length >= 3 && (
            <Sparkline readings={readings} color={barColor} />
          )}
          <span
            onClick={handleCopy}
            title="Click to copy"
            style={{
              fontSize: 14, fontWeight: 600,
              color: copied ? 'var(--bar-green)' : getPercentColor(percentage),
              fontFeatureSettings: '"tnum"',
              cursor: 'pointer',
              userSelect: 'none',
            }}
          >
            {copied ? 'Copied' : `${percentage}%`}
          </span>
        </div>
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

      {/* Reset info + burn rate */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        {resetInfo && (
          <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>{resetInfo}</div>
        )}
        {showBurnRate && (
          <div style={{ fontSize: 11, color: 'var(--text-muted)', marginLeft: 'auto' }}>
            {formatEta(burnRate!.etaMinutes!)}
            <span style={{ opacity: 0.6 }}> · +{burnRate!.ratePerHour.toFixed(1)}%/hr</span>
          </div>
        )}
      </div>
    </div>
  );
}

export function ClaudeMaxUsage({ usage, onLogin, loading, history, burnRates }: Props) {
  if (!usage?.isAuthenticated) {
    return (
      <div className="section">
        <div style={{ textAlign: 'center', padding: '20px 0' }}>
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

  // Show re-login prompt if authenticated state is stale (no bars)
  const hasData = (usage.bars?.length ?? 0) > 0 || usage.standard.percentage > 0;
  if (!loading && !hasData) {
    return (
      <div className="section">
        <div style={{ textAlign: 'center', padding: '16px 0' }}>
          <p style={{ color: 'var(--text-secondary)', marginBottom: 12, fontSize: 13 }}>
            No usage data — session may have expired
          </p>
          <button className="btn btn-primary" onClick={onLogin} style={{ fontSize: 13, padding: '8px 16px' }}>
            Re-login to Claude
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

  const getResetInfo = (bar: UsageBarType): string | undefined => bar.context || undefined;

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
        bars.map((bar, index) => {
          const label = getLabel(bar, index);
          const readings = history?.find(h => h.label === label)?.readings;
          const burnRate = burnRates?.find(b => b.label === label);
          return (
            <UsageBarComponent
              key={index}
              bar={bar}
              label={label}
              resetInfo={getResetInfo(bar)}
              readings={readings}
              burnRate={burnRate}
            />
          );
        })
      )}
    </div>
  );
}
