import React from 'react';
import { reportError } from '../lib/errors';

/**
 * Last-resort crash surface - the app-level error state. Deliberately
 * dependency-light: it must render even when the component tree that broke
 * includes the design system's own primitives, so it uses plain elements
 * with compiled token classes - no ui/ imports, no framer. (Tailwind's
 * output is static CSS resolving to the same tokens.css variables, so it
 * shares no failure mode with the React tree that just crashed.)
 *
 * The fallback follows the error-state contract: one sentence naming what
 * broke (the thrown message, verbatim), one action that resolves it
 * (Reload app - the single accent CTA on this screen). The component stack
 * stays behind a collapsed <details> because it is diagnostic signal, not
 * decoration. The reload button hovers to accent-hover, presses to
 * accent-press, and takes the app-wide focus ring - nothing local overrides
 * it.
 */
class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null, errorInfo: null };
  }

  static getDerivedStateFromError(error) {
    // Capture the error here too, so the very first fallback paint can
    // already name what broke (componentDidCatch lands a tick later).
    return { hasError: true, error };
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
      const message = (this.state.error?.message || String(this.state.error || ''))
        .trim()
        .replace(/\.$/, '');
      return (
        <div className="flex h-screen w-full flex-col items-center justify-center bg-canvas p-12 font-sans text-primary">
          <div className="w-full max-w-[560px] rounded-lg border border-line bg-surface p-8 shadow-edge">
            <h1 className="mb-3 text-title text-negative">The app crashed</h1>
            <p className="mb-5 text-body text-secondary">
              {message
                ? `MindFlow hit an error it could not recover from: ${message}.`
                : 'MindFlow hit an error it could not recover from.'}
            </p>
            <button
              type="button"
              onClick={() => {
                this.setState({ hasError: false, error: null, errorInfo: null });
                window.location.reload();
              }}
              className="inline-flex h-10 items-center justify-center rounded-sm bg-accent px-5
                         text-body-sm font-medium text-on-accent transition-colors duration-micro
                         hover:bg-accent-hover active:bg-accent-press"
            >
              Reload app
            </button>
            {this.state.error && (
              <details className="mt-5 rounded-sm border border-line bg-canvas p-3.5 text-body-sm text-secondary">
                <summary className="cursor-pointer font-medium text-primary">
                  Error details
                </summary>
                <pre className="mt-2.5 whitespace-pre-wrap break-words font-mono text-label-sm font-normal">
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
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}

export default ErrorBoundary;
