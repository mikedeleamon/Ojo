import React from 'react';
import ReactDOM from 'react-dom/client';
import './index.css';
import App from './App';
import reportWebVitals from './reportWebVitals';

// ─── Error boundary — prevents blank white screen on unhandled render errors ──
class ErrorBoundary extends React.Component<
  { children: React.ReactNode },
  { error: Error | null }
> {
  constructor(props: { children: React.ReactNode }) {
    super(props);
    this.state = { error: null };
  }

  static getDerivedStateFromError(error: Error) {
    return { error };
  }

  componentDidCatch(error: Error, info: React.ErrorInfo) {
    console.error('[Ojo] Render error:', error, info.componentStack);
  }

  render() {
    if (this.state.error) {
      return (
        <div style={{
          display: 'flex', flexDirection: 'column', alignItems: 'center',
          justifyContent: 'center', minHeight: '100dvh', gap: '16px',
          padding: '32px', textAlign: 'center',
          fontFamily: 'system-ui, sans-serif', color: 'rgba(255,255,255,0.8)',
        }}>
          <svg width="40" height="40" viewBox="0 0 24 24" fill="none">
            <circle cx="12" cy="12" r="10" stroke="rgba(252,165,165,0.7)" strokeWidth="1.5"/>
            <path d="M12 8v4m0 4h.01" stroke="rgba(252,165,165,0.7)" strokeWidth="1.5" strokeLinecap="round"/>
          </svg>
          <p style={{ fontSize: '1rem', fontWeight: 500 }}>Something went wrong</p>
          <p style={{ fontSize: '0.85rem', opacity: 0.6, maxWidth: 320 }}>
            {this.state.error.message}
          </p>
          <button
            onClick={() => window.location.reload()}
            style={{
              marginTop: 8, padding: '10px 24px',
              background: 'rgba(255,255,255,0.9)', border: 'none',
              borderRadius: 999, color: '#0D1B2A',
              fontFamily: 'inherit', fontSize: '0.9rem', fontWeight: 600,
              cursor: 'pointer',
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

const root = ReactDOM.createRoot(
  document.getElementById('root') as HTMLElement
);
root.render(
  <React.StrictMode>
    <ErrorBoundary>
      <App />
    </ErrorBoundary>
  </React.StrictMode>
);

reportWebVitals();
