import React from 'react';

export default class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null };
  }
  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }
  componentDidCatch(error, info) {
    if (typeof console !== 'undefined' && console.error) console.error(error, info);
  }
  render() {
    if (this.state.hasError) {
      return (
        <div style={{ padding: 24, fontFamily: 'system-ui, Arial', color: 'var(--color-text-primary)' }}>
          <h2 style={{ marginBottom: 12 }}>Ocorreu um erro na página</h2>
          <div style={{ marginBottom: 16, color: 'var(--color-text-secondary)' }}>{String(this.state.error || '')}</div>
          <div style={{ display: 'flex', gap: 12 }}>
            <a href="/login" style={{ padding: '8px 12px', background: 'var(--color-primary)', color: '#fff', borderRadius: 6, textDecoration: 'none' }}>Ir para Login</a>
            <button onClick={() => window.location.reload()} style={{ padding: '8px 12px', background: 'var(--color-bg-tertiary)', color: 'var(--color-text-primary)', borderRadius: 6, border: '1px solid var(--color-border)' }}>Recarregar</button>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}
