// Catches a view that fails to render, reports it, and offers a reload
// instead of leaving the page blank.
import { Component, type ErrorInfo, type ReactNode } from 'react';
import { reportError } from '../lib/errorReporting';

export default class ErrorBoundary extends Component<{ children: ReactNode }, { failed: boolean }> {
  state = { failed: false };

  static getDerivedStateFromError() {
    return { failed: true };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    reportError(error, { kind: 'boundary', component_stack: info.componentStack ?? undefined });
  }

  render() {
    if (!this.state.failed) return this.props.children;
    return (
      <section className="signin" role="alert">
        <h1>Something went wrong</h1>
        <p className="muted">Hot Mess hit a problem showing this page. We've been told about it.</p>
        <button className="button" type="button" onClick={() => location.reload()}>Reload</button>
      </section>
    );
  }
}
