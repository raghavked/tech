/**
 * A React error boundary with a quiet inline recovery row. Wrap a view in it; a render error in
 * that view shows one grey line with "Try again" (remounts the view) and "Reload". The boundary
 * also clears itself when `resetKey` changes, so navigating elsewhere recovers on its own.
 */
import { Component, type ErrorInfo, type ReactNode } from "react";

interface Props {
  children: ReactNode;
  /** When this changes (the route, say) a caught error is forgotten and the children render again. */
  resetKey?: string;
  /** Custom fallback; the default is a bare `<Recover />` row. */
  fallback?: (error: Error, reset: () => void) => ReactNode;
}

interface State {
  error: Error | null;
}

export class ErrorBoundary extends Component<Props, State> {
  state: State = { error: null };

  static getDerivedStateFromError(error: unknown): State {
    return { error: error instanceof Error ? error : new Error(String(error)) };
  }

  componentDidCatch(error: Error, info: ErrorInfo): void {
    console.error("[fold] view error", error, info.componentStack);
  }

  componentDidUpdate(prev: Props): void {
    if (this.state.error && prev.resetKey !== this.props.resetKey) this.setState({ error: null });
  }

  reset = (): void => this.setState({ error: null });

  render(): ReactNode {
    const { error } = this.state;
    if (!error) return this.props.children;
    return this.props.fallback ? (
      this.props.fallback(error, this.reset)
    ) : (
      <div className="column">
        <Recover error={error} onRetry={this.reset} />
      </div>
    );
  }
}

/** The recovery row: one grey sentence, the error in small faint mono, two quiet buttons. */
export function Recover({ error, onRetry }: { error: Error; onRetry: () => void }) {
  const reload = () => {
    try {
      location.reload();
    } catch {
      // ignore
    }
  };
  return (
    <div className="recover row" role="alert">
      <span className="grow">
        <span className="muted">Something went wrong in this view.</span>{" "}
        <span className="small faint mono">{error.message || String(error)}</span>
      </span>
      <button type="button" className="btn sm" onClick={onRetry}>
        Try again
      </button>
      <button type="button" className="btn ghost sm" onClick={reload}>
        Reload
      </button>
    </div>
  );
}
