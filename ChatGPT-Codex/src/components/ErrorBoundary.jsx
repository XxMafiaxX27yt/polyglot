import { Component } from 'react';

/** Shows a recovery screen instead of a blank page if rendering crashes. */
export default class ErrorBoundary extends Component {
  state = { error: null };

  static getDerivedStateFromError(error) {
    return { error };
  }

  componentDidCatch(error, info) {
    console.error('Polyglot crashed while rendering:', error, info.componentStack);
  }

  render() {
    if (!this.state.error) return this.props.children;
    return (
      <div className="crash" role="alert">
        <h1>Something went wrong</h1>
        <p>Polyglot hit an unexpected error and could not show this screen. Your saved meetings and settings are safe.</p>
        <button className="btn-primary" onClick={() => window.location.reload()}>
          Reload Polyglot
        </button>
      </div>
    );
  }
}
