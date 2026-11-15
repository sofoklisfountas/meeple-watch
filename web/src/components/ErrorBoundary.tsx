import { Component, type ReactNode } from 'react';

/** Shows what went wrong instead of a blank page. */
export class ErrorBoundary extends Component<{ children: ReactNode }, { error: Error | null }> {
  state = { error: null as Error | null };
  static getDerivedStateFromError(error: Error) {
    return { error };
  }
  render() {
    if (!this.state.error) return this.props.children;
    return (
      <div className="mx-auto max-w-lg p-6">
        <h1 className="text-lg font-semibold">Something went wrong</h1>
        <pre className="mt-3 whitespace-pre-wrap rounded-lg bg-red-50 p-3 text-xs text-red-800 select-text dark:bg-red-950/40 dark:text-red-200">
          {this.state.error.message}
          {'\n\n'}
          {this.state.error.stack?.split('\n').slice(0, 5).join('\n')}
        </pre>
        <button className="mt-4 rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-accent-fg" onClick={() => location.reload()}>
          Reload
        </button>
      </div>
    );
  }
}
