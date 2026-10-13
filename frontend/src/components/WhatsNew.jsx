import { useEffect } from 'react';
import { X } from 'lucide-react';
import { WHATS_NEW } from '../data/whatsNew';
import { useI18n } from '../i18n';

/**
 * The "what's new" panel behind the version number in the header — a curated,
 * plain-language history for a visitor. The entries (data/whatsNew.js) are
 * English; only the frame is translated, so the panel forces `direction: ltr`.
 */
const WhatsNew = ({ open, onClose, currentVersion }) => {
    const { t } = useI18n();

    useEffect(() => {
        if (!open) return undefined;
        const onKey = (e) => { if (e.key === 'Escape') onClose(); };
        document.addEventListener('keydown', onKey);
        const prev = document.body.style.overflow;
        document.body.style.overflow = 'hidden';
        return () => {
            document.removeEventListener('keydown', onKey);
            document.body.style.overflow = prev;
        };
    }, [open, onClose]);

    if (!open) return null;

    return (
        <div
            role="dialog"
            aria-modal="true"
            aria-label={t('whatsNew.title')}
            onClick={onClose}
            style={{
                position: 'fixed', inset: 0, zIndex: 120,
                direction: 'ltr',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                padding: '4vh 16px',
                background: 'rgba(2,4,8,0.74)',
                backdropFilter: 'blur(4px)', WebkitBackdropFilter: 'blur(4px)',
            }}
        >
            <div
                className="glass animate-fade-in"
                onClick={(e) => e.stopPropagation()}
                style={{
                    width: 'min(560px, 100%)', maxHeight: '100%',
                    display: 'flex', flexDirection: 'column',
                    overflow: 'hidden',
                }}
            >
                <div style={{
                    display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                    gap: 'var(--s-3)', padding: 'var(--s-4) var(--s-4) var(--s-4) var(--s-5)',
                    borderBottom: '1px solid var(--hairline)',
                }}>
                    <h2 style={{
                        margin: 0, fontSize: 'var(--fs-md)', fontWeight: 700,
                        color: 'var(--text-primary)', letterSpacing: 'var(--tr-tight)',
                    }}>
                        {t('whatsNew.title')}
                    </h2>
                    <button
                        onClick={onClose}
                        aria-label={t('whatsNew.close')}
                        className="chrome-btn focus-ring"
                    >
                        <X className="h-4 w-4" aria-hidden="true" />
                    </button>
                </div>

                <div style={{ overflowY: 'auto', overscrollBehavior: 'contain', padding: '2px var(--s-5) var(--s-5)' }}>
                    {WHATS_NEW.map((rel, ri) => (
                        <section
                            key={rel.version}
                            style={{
                                padding: '16px 0',
                                borderBottom: ri < WHATS_NEW.length - 1
                                    ? '1px solid var(--hairline)' : 'none',
                            }}
                        >
                            <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--s-2)', marginBottom: 'var(--s-2)' }}>
                                <span
                                    data-latin
                                    style={{
                                        fontSize: 'var(--fs-xs)', fontWeight: 700, letterSpacing: '0.06em',
                                        padding: '2px 8px', borderRadius: 999,
                                        fontVariantNumeric: 'tabular-nums',
                                        background: rel.version === currentVersion
                                            ? 'rgba(var(--accent-warm-rgb), 0.16)' : 'rgba(255,255,255,0.07)',
                                        color: rel.version === currentVersion
                                            ? 'var(--accent-warm)' : 'rgba(255,255,255,0.6)',
                                    }}
                                >
                                    {rel.version}
                                </span>
                                {rel.version === currentVersion && (
                                    <span style={{ fontSize: 'var(--fs-tiny)', color: 'var(--text-tertiary)' }}>
                                        {t('whatsNew.current')}
                                    </span>
                                )}
                            </div>
                            <ul style={{
                                margin: 0, paddingInlineStart: 18,
                                listStyleType: 'disc', color: 'rgba(var(--accent-warm-rgb), 0.6)',
                            }}>
                                {rel.changes.map((c, i) => (
                                    <li key={i} style={{
                                        display: 'list-item', margin: i ? '7px 0 0' : 0,
                                        fontSize: 'var(--fs-sm)', lineHeight: 1.5,
                                        color: 'var(--text-secondary)',
                                    }}>
                                        {c}
                                    </li>
                                ))}
                            </ul>
                        </section>
                    ))}
                </div>
            </div>
        </div>
    );
};

export default WhatsNew;
