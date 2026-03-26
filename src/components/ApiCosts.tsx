import type { BillingInfo } from '../types';

interface Props {
  billingInfo: BillingInfo | null;
  loading: boolean;
  onPlatformLogin: () => void;
}

function getBalanceColor(balance: number): string {
  if (balance <= 1) return 'var(--error)';
  if (balance <= 5) return 'var(--warning)';
  return 'var(--text-primary)';
}

export function ApiCosts({ billingInfo, loading, onPlatformLogin }: Props) {
  if (loading && !billingInfo) {
    return (
      <div className="section" style={{ padding: '12px 16px' }}>
        <div className="section-title">API Credit</div>
        <div className="loading">Loading...</div>
      </div>
    );
  }

  if (!billingInfo || billingInfo.creditBalance === null) {
    return (
      <div className="section" style={{ padding: '12px 16px' }}>
        <div className="section-title">API Credit</div>
        <div style={{
          background: 'var(--bg-tertiary)',
          borderRadius: 10,
          padding: 16,
          textAlign: 'center',
        }}>
          <p style={{ color: 'var(--text-secondary)', marginBottom: 12, fontSize: 12 }}>
            Login to Claude Platform to see your API credit balance
          </p>
          <button className="btn btn-primary" onClick={onPlatformLogin} style={{ fontSize: 12, padding: '6px 14px' }}>
            Login to Platform
          </button>
        </div>
      </div>
    );
  }

  const balance = billingInfo.creditBalance;
  const isLow = balance <= 5;

  return (
    <div className="section" style={{ padding: '12px 16px' }}>
      <div className="section-title">API Credit</div>
      <div style={{
        background: 'var(--bg-tertiary)',
        borderRadius: 10,
        padding: 16,
        textAlign: 'center',
        border: isLow ? '1px solid var(--warning)' : '1px solid transparent',
      }}>
        <div style={{
          fontSize: 30,
          fontWeight: 500,
          color: getBalanceColor(balance),
          marginBottom: 4,
          letterSpacing: '-0.5px',
          fontFeatureSettings: '"tnum"',
        }}>
          US${balance.toFixed(2)}
        </div>
        <div style={{
          fontSize: 12,
          color: isLow ? 'var(--warning)' : 'var(--text-muted)',
          fontWeight: isLow ? 500 : 400,
        }}>
          {isLow ? 'Low Balance' : 'Remaining Balance'}
        </div>
      </div>
    </div>
  );
}
