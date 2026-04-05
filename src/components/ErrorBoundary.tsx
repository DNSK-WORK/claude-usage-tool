import { Component, ErrorInfo, ReactNode } from 'react';

interface Props { children: ReactNode; }
interface State { error: Error | null; }

export class ErrorBoundary extends Component<Props, State> {
  state: State = { error: null };

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error('ErrorBoundary caught:', error, info.componentStack);
  }

  render() {
    if (this.state.error) {
      return (
        <div style={{
          display: 'flex', flexDirection: 'column', alignItems: 'center',
          justifyContent: 'center', height: '100vh', padding: 24,
          background: 'var(--bg-primary, #1a1a1a)', color: 'var(--text-primary, #fff)',
          fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
          textAlign: 'center', gap: 12,
        }}>
          <div style={{ fontSize: 28 }}>⚠️</div>
          <div style={{ fontSize: 14, fontWeight: 600 }}>Something went wrong</div>
          <div style={{ fontSize: 11, color: '#888', maxWidth: 260, wordBreak: 'break-word' }}>
            {this.state.error.message}
          </div>
          <button
            onClick={() => location.reload()}
            style={{
              marginTop: 8, padding: '6px 16px', fontSize: 12, borderRadius: 6,
              background: '#d97706', color: '#fff', border: 'none', cursor: 'pointer',
            }}
          >
            Reload
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}
