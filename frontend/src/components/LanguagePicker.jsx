import { useState, useEffect, useRef } from 'react';
import { Languages, Check } from 'lucide-react';
import { useI18n } from '../i18n';

/**
 * Choose a language.
 *
 * Every row is written in its own language. A reader who has landed on a page
 * they cannot read is exactly the person this control is for, and "Arabic" is
 * no use to them — العربية is. The current row keeps a tick rather than a
 * different colour, because the colour would be the only signal and the panel
 * is already low-contrast glass.
 *
 * Hidden entirely while there is one language, the same way SystemTitle hides
 * its chevron: a control that opens to reveal the thing you already have is a
 * dead control.
 */
const LanguagePicker = () => {
    const { locale, locales, setLocale, t } = useI18n();
    const [open, setOpen] = useState(false);
    const wrapRef = useRef(null);

    useEffect(() => {
        if (!open) return;
        const onDown = (e) => { if (!wrapRef.current?.contains(e.target)) setOpen(false); };
        const onKey = (e) => { if (e.key === 'Escape') setOpen(false); };
        document.addEventListener('pointerdown', onDown);
        document.addEventListener('keydown', onKey);
        return () => {
            document.removeEventListener('pointerdown', onDown);
            document.removeEventListener('keydown', onKey);
        };
    }, [open]);

    if (locales.length < 2) return null;

    return (
        <div ref={wrapRef} style={{ position: 'relative', flexShrink: 0 }}>
            <button
                onClick={() => setOpen(v => !v)}
                aria-haspopup="listbox"
                aria-expanded={open}
                aria-label={t('language.choose')}
                title={t('language.label')}
                className="flex items-center justify-center rounded-xl transition-all focus-ring"
                style={{
                    width: 36, height: 36,
                    background: open ? 'rgba(255,255,255,0.16)' : 'rgba(0,0,0,0.42)',
                    border: '1px solid rgba(255,255,255,0.16)',
                    color: 'rgba(255,255,255,0.85)',
                    backdropFilter: 'blur(14px)',
                    WebkitBackdropFilter: 'blur(14px)',
                    cursor: 'pointer',
                }}
            >
                <Languages className="h-4 w-4" aria-hidden="true" />
            </button>

            {open && (
                <div
                    role="listbox"
                    aria-label={t('language.label')}
                    className="glass animate-fade-in"
                    style={{
                        position: 'absolute', top: 'calc(100% + 8px)',
                        // Logical, so the panel hangs off the same edge of the
                        // button in both directions instead of off the screen.
                        insetInlineEnd: 0,
                        minWidth: 176, padding: 6, borderRadius: 16, zIndex: 60,
                    }}
                >
                    {locales.map(l => {
                        const active = l.code === locale;
                        return (
                            <button
                                key={l.code}
                                role="option"
                                aria-selected={active}
                                lang={l.code}
                                dir={l.dir}
                                onClick={() => { setLocale(l.code); setOpen(false); }}
                                className="w-full flex items-center justify-between gap-3 focus-ring"
                                style={{
                                    padding: '9px 11px', borderRadius: 11, border: 'none',
                                    background: active ? 'rgba(255,255,255,0.08)' : 'none',
                                    color: active ? '#fff' : 'rgba(255,255,255,0.82)',
                                    cursor: 'pointer', textAlign: 'start',
                                }}
                            >
                                <span style={{ fontSize: '0.92rem', fontWeight: 700 }}>
                                    {l.endonym}
                                </span>
                                {active && (
                                    <Check style={{ width: 14, height: 14, flexShrink: 0 }} aria-hidden="true" />
                                )}
                            </button>
                        );
                    })}
                </div>
            )}
        </div>
    );
};

export default LanguagePicker;
