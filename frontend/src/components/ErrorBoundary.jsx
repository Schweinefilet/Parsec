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
                    gap: 'var(--s-4)',
                    padding: 'var(--s-7)',
                    textAlign: 'center',
                    color: 'var(--text-primary)',
                    background: '#05070a',
                }}
            >
                <h1 style={{ fontSize: 'var(--fs-lg)', fontWeight: 700, letterSpacing: 'var(--tr-tight)', margin: 0 }}>
                    {this.props.strings.title}
                </h1>
                <p style={{ color: 'var(--text-secondary)', fontSize: 'var(--fs-sm)', maxWidth: 460, lineHeight: 1.6, margin: 0 }}>
                    {this.props.strings.body}
                </p>
                <div className="dialog-actions" style={{ marginTop: 'var(--s-1)' }}>
                    <button
                        onClick={() => window.location.reload()}
                        className="action-btn focus-ring"
                    >
                        {this.props.strings.reload}
                    </button>
                    <button
                        onClick={() => { window.location.href = '/'; }}
                        className="action-btn focus-ring"
                        data-variant="quiet"
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
