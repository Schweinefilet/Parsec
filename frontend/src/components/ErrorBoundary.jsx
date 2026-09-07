import { Component } from 'react';
import { useI18n } from '../i18n';

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
        console.error('[P4RSEC] Unhandled error:', error, info?.componentStack);
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
                    {this.props.strings.title}
                </h1>
                <p style={{ color: 'rgba(255,255,255,0.62)', maxWidth: 460, lineHeight: 1.6, margin: 0 }}>
                    {this.props.strings.body}
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
                        {this.props.strings.reload}
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
                        {this.props.strings.backHome}
                    </button>
                </div>
            </div>
        );
    }
}

/**
 * The strings, fetched by a function component and handed down.
 *
 * An error boundary has to be a class — there is no hook equivalent of
 * getDerivedStateFromError — and a class cannot call useI18n. This wrapper is
 * the seam. It also means the boundary itself keeps no dependency on the
 * translator, so a failure inside i18n still renders an apology in English.
 */
const LocalizedErrorBoundary = ({ children }) => {
    const { t } = useI18n();
    return (
        <ErrorBoundary strings={{
            title: t('error.title'),
            body: t('error.body'),
            reload: t('error.reload'),
            backHome: t('error.backHome'),
        }}>
            {children}
        </ErrorBoundary>
    );
};

export default LocalizedErrorBoundary;
