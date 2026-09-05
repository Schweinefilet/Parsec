import { Component } from 'react';

/**
 * Top-level safety net. Without it, one thrown render — a lost WebGL context on
 * a phone, a malformed catalog entry — leaves the user on a black screen with
 * no explanation and no way out.
 */
class ErrorBoundary extends Component {
    constructor(props) {
        super(props);
        this.state = { error: null };
    }

    static getDerivedStateFromError(error) {
        return { error };
    }

    componentDidCatch(error, info) {
        console.error('[Parsec] Unhandled error:', error, info?.componentStack);
    }

    render() {
        if (!this.state.error) return this.props.children;

        return (
            <div
                role="alert"
                style={{
                    minHeight: 'var(--app-vh, 100vh)',
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: 18,
                    padding: 32,
                    textAlign: 'center',
                    color: '#fff',
                    background: '#05070a',
                }}
            >
                <h1 style={{ fontSize: '1.4rem', fontWeight: 800, margin: 0 }}>
                    Something went wrong
                </h1>
                <p style={{ color: 'rgba(255,255,255,0.62)', maxWidth: 460, lineHeight: 1.6, margin: 0 }}>
                    The 3D view failed to render. This is usually a graphics problem on
                    the device rather than anything you did — reloading normally fixes it.
                </p>
                <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', justifyContent: 'center' }}>
                    <button
                        onClick={() => window.location.reload()}
                        style={{
                            padding: '10px 20px', borderRadius: 12, cursor: 'pointer',
                            background: 'rgba(255,255,255,0.12)',
                            border: '1px solid rgba(255,255,255,0.22)',
                            color: '#fff', fontWeight: 700, fontSize: '0.85rem',
                        }}
                    >
                        Reload
                    </button>
                    <button
                        onClick={() => { window.location.href = '/'; }}
                        style={{
                            padding: '10px 20px', borderRadius: 12, cursor: 'pointer',
                            background: 'transparent',
                            border: '1px solid rgba(255,255,255,0.18)',
                            color: 'rgba(255,255,255,0.75)', fontWeight: 700, fontSize: '0.85rem',
                        }}
                    >
                        Back to the solar system
                    </button>
                </div>
            </div>
        );
    }
}

export default ErrorBoundary;
