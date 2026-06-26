import { Component, type ErrorInfo, type ReactNode } from 'react';
import { chunkErrorMessage, isChunkLoadError } from '../utils/lazyWithRetry';

interface Props {
  children: ReactNode;
}

interface State {
  error: Error | null;
}

export default class RouteErrorBoundary extends Component<Props, State> {
  state: State = { error: null };

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  componentDidCatch(error: Error, info: ErrorInfo): void {
    console.error('Route render error:', error, info.componentStack);
  }

  render() {
    if (this.state.error) {
      const chunkError = isChunkLoadError(chunkErrorMessage(this.state.error));

      if (chunkError) {
        return (
          <div className="container py-4" role="alert">
            <h2 className="h5 mb-2">גרסה חדשה של האתר זמינה</h2>
            <p className="text-muted small mb-3">
              העמוד נטען מגרסה ישנה. רענון יטען את הגרסה העדכנית.
            </p>
            <button
              type="button"
              className="btn btn-success"
              onClick={() => window.location.reload()}
            >
              רענן עמוד
            </button>
          </div>
        );
      }

      return (
        <div className="container py-4" role="alert">
          <h2 className="h5 text-danger mb-2">שגיאה בטעינת העמוד</h2>
          <p className="text-muted small mb-3">{this.state.error.message}</p>
          <button
            type="button"
            className="btn btn-success"
            onClick={() => this.setState({ error: null })}
          >
            נסה שוב
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}
