import { Component, type ErrorInfo, type ReactNode } from 'react';

interface State {
  error: Error | null;
}

/** Catches a crash while drawing the screen and offers a reload instead of a blank page. */
export class ErrorBoundary extends Component<{ children: ReactNode }, State> {
  state: State = { error: null };

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error('Enyalië hit an error while rendering:', error, info.componentStack);
  }

  render() {
    if (!this.state.error) return this.props.children;
    return (
      <div className="crash" role="alert">
        <p className="notice-title">Enyalië hit an error and stopped drawing this screen.</p>
        <p>Your decks are saved on this device. Reloading usually fixes this.</p>
        <pre className="crash-detail">{this.state.error.message}</pre>
        <button type="button" className="btn btn-primary" onClick={() => window.location.reload()}>
          reload
        </button>
      </div>
    );
  }
}
