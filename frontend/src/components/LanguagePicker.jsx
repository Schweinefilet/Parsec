import { useState, useEffect, useRef } from 'react';
import { Languages, Check } from 'lucide-react';
import { useI18n } from '../i18n';
import { useDockSuspend } from './dockContext';

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
 *
 * `variant="row"` (HeaderMenu.jsx's mobile burger menu) swaps only the
 * trigger — a full-width labelled row instead of a standalone 36×36 icon
 * button — so it sits flush among that menu's other full-width rows rather
 * than as a stray square. Everything below the trigger (open state, the
 * outside-click/Escape handling, the dropdown itself) is untouched by the
 * variant: language-switching stays defined in exactly one place regardless
 * of where the control is mounted.
 */
const LanguagePicker = ({ variant = 'icon' }) => {
    const { locale, locales, setLocale, t } = useI18n();
    const [open, setOpen] = useState(false);
    const wrapRef = useRef(null);
    const setDockSuspended = useDockSuspend();

    // On the icon variant this sits inside the header's FloatingDock. The
    // dropdown hangs below the button as `position: absolute`, but is still
    // a DOM descendant of it — so without this, hovering the language list
    // keeps feeding the dock's pointer-follow swell, resizing the button
    // mid-menu and dragging the dropdown anchored to it sideways. `undefined`
    // outside a dock (the burger-menu `variant="row"`) makes this a no-op.
    useEffect(() => {
        setDockSuspended?.(open);
        return () => setDockSuspended?.(false);
    }, [open, setDockSuspended]);

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
            {variant === 'row' ? (
                <button
                    onClick={() => setOpen(v => !v)}
                    aria-haspopup="listbox"
                    aria-expanded={open}
                    aria-label={t('language.choose')}
                    className="menu-item focus-ring"
                >
                    <Languages aria-hidden="true" />
                    {t('language.label')}
                </button>
            ) : (
                <button
                    onClick={() => setOpen(v => !v)}
                    aria-haspopup="listbox"
                    aria-expanded={open}
                    aria-label={t('language.choose')}
                    title={t('language.label')}
                    data-on={open || undefined}
                    className="chrome-btn focus-ring"
                >
                    <Languages className="h-4 w-4" aria-hidden="true" />
                </button>
            )}

            {open && (
                <div
                    role="listbox"
                    aria-label={t('language.label')}
                    className="menu animate-fade-in"
                    style={{
                        position: 'absolute', top: 'calc(100% + var(--s-2))',
                        // Logical, so the panel hangs off the same edge of the
                        // button in both directions instead of off the screen.
                        insetInlineEnd: 0,
                        minWidth: 176,
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
                                className="menu-item focus-ring"
                                style={{ justifyContent: 'space-between' }}
                            >
                                <span>{l.endonym}</span>
                                {active && (
                                    <Check aria-hidden="true" />
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
