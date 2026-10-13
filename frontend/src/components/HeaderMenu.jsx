import { useState, useEffect, useRef } from 'react';
import { Link } from 'react-router-dom';
import { Menu, Satellite, Star, Link2, Check, Orbit } from 'lucide-react';
import LanguagePicker from './LanguagePicker';
import { useI18n } from '../i18n';

/**
 * The mobile header's burger menu — AppShell.jsx's action icons
 * (language, share, tracker, sky) collapsed behind one button below the
 * (max-width: 767px) breakpoint, where the icon-only buttons plus the
 * wordmark measurably overflowed the header's own width (the search
 * button's right edge landed past the viewport edge). Desktop keeps
 * the original inline row untouched — this component only ever mounts on
 * mobile, gated in AppShell.jsx itself.
 *
 * Search stays outside this menu, its own always-visible icon next to the
 * burger button: it's the most frequently reached-for of the set, and it
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
const HeaderMenu = ({ onShare, copied, onSkyClick, onTrackerClick, onOpen }) => {
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
                data-on={open || undefined}
                className="chrome-btn focus-ring"
            >
                <Menu className="h-4 w-4" aria-hidden="true" />
            </button>

            {open && (
                <div
                    role="menu"
                    aria-label={t('nav.menu')}
                    className="menu animate-fade-in"
                    style={{
                        position: 'absolute', top: 'calc(100% + var(--s-2))',
                        insetInlineEnd: 0,
                        // Wide enough for "Copy a link to this view", the
                        // longest row, to stay on one line.
                        minWidth: 260,
                    }}
                >
                    <button role="menuitem" onClick={() => { onShare(); close(); }} className="menu-item focus-ring">
                        {copied
                            ? <Check aria-hidden="true" />
                            : <Link2 aria-hidden="true" />}
                        {copied ? t('nav.copied') : t('nav.copyLink')}
                    </button>

                    <Link role="menuitem" to="/satellites" onClick={(e) => { onTrackerClick(e); close(); }} className="menu-item focus-ring">
                        <Satellite aria-hidden="true" />
                        {t('nav.tracker')}
                    </Link>

                    <Link role="menuitem" to="/sky" onClick={(e) => { onSkyClick(e); close(); }} className="menu-item focus-ring">
                        <Star aria-hidden="true" />
                        {t('nav.sky')}
                    </Link>

                    <Link role="menuitem" to="/gargantua" onClick={close} className="menu-item focus-ring">
                        <Orbit aria-hidden="true" />
                        {t('nav.gargantua')}
                    </Link>

                    {/* Last: its own dropdown extends downward and must not
                        be covered by rows below it. */}
                    <LanguagePicker variant="row" />

                </div>
            )}
        </div>
    );
};

export default HeaderMenu;
