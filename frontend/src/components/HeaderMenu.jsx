import { useState, useEffect, useRef } from 'react';
import { Link } from 'react-router-dom';
import { Menu, Eye as EyeIcon, Star, Scale, Link2, Check } from 'lucide-react';
import LanguagePicker from './LanguagePicker';
import { useI18n } from '../i18n';

const rowStyle = {
    display: 'flex', alignItems: 'center', gap: 10, width: '100%',
    padding: '10px 12px', borderRadius: 10, border: 'none', background: 'none',
    color: 'rgba(255,255,255,0.9)', fontSize: '0.92rem', fontWeight: 700,
    textAlign: 'start', textDecoration: 'none', cursor: 'pointer', whiteSpace: 'nowrap',
};

/**
 * The mobile header's burger menu — AppShell.jsx's five action icons
 * (language, share, tonight, sky, compare) collapsed behind one button
 * below the (max-width: 767px) breakpoint, where the six icon-only buttons
 * plus the wordmark measurably overflowed the header's own width (the
 * search button's right edge landed past the viewport edge). Desktop keeps
 * the original inline row untouched — this component only ever mounts on
 * mobile, gated in AppShell.jsx itself.
 *
 * Search stays outside this menu, its own always-visible icon next to the
 * burger button: it's the most frequently reached-for of the six, and it
 * already has its own expand-in-place behaviour (replaces the header row
 * with a full-width input) — nesting it here would cost every search an
 * extra tap for no benefit.
 *
 * Shaped like LanguagePicker.jsx's own icon-button-that-opens-a-panel
 * pattern (down to reusing its exact outside-click/Escape handling), since
 * that is already "a 36×36 glass button anchored to a dropdown hanging off
 * itself" — the closer structural match for a header item than
 * ScenePanel.jsx/NightSkyPanel.jsx's edge-anchored scene drawers, which are
 * built around sitting flush with a vertical screen edge, not a header row.
 */
const HeaderMenu = ({ onShare, copied, onSkyClick, onOpen }) => {
    const { t } = useI18n();
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

    const close = () => setOpen(false);
    // Mirrors ScenePanel.jsx/NightSkyPanel.jsx's own toggleOpen: fires only
    // on the transition into open, so AppShell's first-visit coach mark can
    // end itself the moment someone finds this on their own — a visitor who
    // already opened it once doesn't need to be told it's there.
    const toggleOpen = () => { if (!open) onOpen?.(); setOpen(v => !v); };

    return (
        <div ref={wrapRef} style={{ position: 'relative', flexShrink: 0 }}>
            <button
                onClick={toggleOpen}
                data-coach="menu"
                aria-haspopup="true"
                aria-expanded={open}
                aria-label={open ? t('nav.menuClose') : t('nav.menu')}
                title={t('nav.menu')}
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
                <Menu className="h-4 w-4" aria-hidden="true" />
            </button>

            {open && (
                <div
                    role="menu"
                    aria-label={t('nav.menu')}
                    className="glass animate-fade-in"
                    style={{
                        position: 'absolute', top: 'calc(100% + 8px)',
                        insetInlineEnd: 0,
                        // Wide enough for "Copy a link to this view", the
                        // longest row, to stay on one line.
                        minWidth: 260, padding: 6, borderRadius: 16, zIndex: 60,
                        display: 'flex', flexDirection: 'column', gap: 2,
                    }}
                >
                    <LanguagePicker variant="row" />

                    <button role="menuitem" onClick={() => { onShare(); close(); }} style={rowStyle}>
                        {copied
                            ? <Check style={{ width: 15, height: 15, flexShrink: 0 }} aria-hidden="true" />
                            : <Link2 style={{ width: 15, height: 15, flexShrink: 0 }} aria-hidden="true" />}
                        {copied ? t('nav.copied') : t('nav.copyLink')}
                    </button>

                    <Link role="menuitem" to="/tonight" onClick={close} style={rowStyle}>
                        <EyeIcon style={{ width: 15, height: 15, flexShrink: 0 }} aria-hidden="true" />
                        {t('nav.tonight')}
                    </Link>

                    <Link role="menuitem" to="/sky" onClick={(e) => { onSkyClick(e); close(); }} style={rowStyle}>
                        <Star style={{ width: 15, height: 15, flexShrink: 0 }} aria-hidden="true" />
                        {t('nav.sky')}
                    </Link>

                    <Link role="menuitem" to="/compare" onClick={close} style={rowStyle}>
                        <Scale style={{ width: 15, height: 15, flexShrink: 0 }} aria-hidden="true" />
                        {t('nav.compare')}
                    </Link>
                </div>
            )}
        </div>
    );
};

export default HeaderMenu;
