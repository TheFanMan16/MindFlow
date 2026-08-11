import React from 'react';
import { reportError } from '../lib/errors';

/**
 * Last-resort crash surface. Deliberately dependency-light: it must render
 * even when the component tree that broke includes the design system's own
 * primitives, so it uses plain elements styled by token variables - no ui/
 * imports, no framer.
 */
class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null, errorInfo: null };
  }

  static getDerivedStateFromError(error) {
    // Update state so the next render will show the fallback UI
    return { hasError: true };
  }

  componentDidCatch(error, errorInfo) {
    console.error('ErrorBoundary caught an error:', error, errorInfo);
    reportError(error, { componentStack: errorInfo?.componentStack });
    this.setState({
      error: error,
      errorInfo: errorInfo,
    });
  }

  render() {
    if (this.state.hasError) {
      return (
        <div
          style={{
            width: '100%',
            height: '100vh',
            backgroundColor: 'var(--bg-canvas)',
            color: 'var(--text-primary)',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '48px',
            fontFamily: 'var(--font-sans)',
          }}
        >
          <div
            style={{
              maxWidth: '560px',
              backgroundColor: 'var(--bg-surface)',
              border: '1px solid var(--danger-line)',
              borderRadius: 'var(--r-lg)',
              padding: '32px',
            }}
          >
            <h1
              style={{
                fontSize: '24px',
                fontWeight: '600',
                letterSpacing: '-0.01em',
                marginBottom: '12px',
                color: 'var(--negative)',
              }}
            >
              Something went wrong
            </h1>
            <p
              style={{
                fontSize: '15px',
                color: 'var(--text-secondary)',
                marginBottom: '20px',
                lineHeight: '1.6',
              }}
            >
              The app hit an error it could not recover from. Reloading usually fixes it; the
              details below help if it keeps happening.
            </p>
            {this.state.error && (
              <details
                style={{
                  marginTop: '16px',
                  padding: '14px',
                  backgroundColor: 'var(--bg-canvas)',
                  border: '1px solid var(--border-line)',
                  borderRadius: 'var(--r-sm)',
                  fontSize: '13px',
                  color: 'var(--text-secondary)',
                }}
              >
                <summary
                  style={{
                    cursor: 'pointer',
                    marginBottom: '10px',
                    color: 'var(--text-primary)',
                    fontWeight: '500',
                  }}
                >
                  Error details
                </summary>
                <pre
                  style={{
                    whiteSpace: 'pre-wrap',
                    wordBreak: 'break-word',
                    fontSize: '12px',
                    fontFamily: 'var(--font-mono)',
                  }}
                >
                  {this.state.error.toString()}
                  {this.state.errorInfo && (
                    <>
                      {'\n\n'}
                      {this.state.errorInfo.componentStack}
                    </>
                  )}
                </pre>
              </details>
            )}
            <button
              onClick={() => {
                this.setState({ hasError: false, error: null, errorInfo: null });
                window.location.reload();
              }}
              style={{
                marginTop: '20px',
                backgroundColor: 'var(--accent)',
                color: 'var(--accent-ink)',
                border: 'none',
                padding: '10px 20px',
                borderRadius: 'var(--r-sm)',
                fontSize: '13px',
                fontWeight: '500',
                cursor: 'pointer',
              }}
            >
              Reload app
            </button>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}

export default ErrorBoundary;
