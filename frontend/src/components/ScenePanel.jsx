import { useState, useEffect } from 'react';
import { Orbit, Pause, Ruler, Waves, ChevronDown } from 'lucide-react';
import DriftSliders from './DriftSliders';
import { toggleTrueScale } from '../utils/scaleMode';
import { cycleVizMode, VIZ_OFF, VIZ_GRID, VIZ_FIELD } from '../utils/vizMode';
import { useReducedMotion } from '../hooks/useMediaQuery';
import { useI18n } from '../i18n';

/**
 * The desktop home for the scene toggles — drift, layout, gravity — folded into
 * a drawer against the leading edge, collapsed by default behind a chevron tab.
 * The bottom bar was growing a pill per feature; this keeps the hero clean and
 * gives the controls somewhere to live as more arrive.
 *
 * The phone keeps its own fold-behind-one-button treatment (see CategoryBrowser)
 * — a left drawer fights the thumb there. Everything here reads the same module
 * singletons the pills did: scaleMode, vizMode, driftControl. Drift on/off is
 * React state owned by the page, so it comes in as a prop.
 */
const rowBtn = (active) => ({
    display: 'flex', alignItems: 'center', gap: 8, width: '100%',
    padding: '9px 11px', borderRadius: 10,
    background: active ? 'rgba(255,209,102,0.16)' : 'rgba(255,255,255,0.06)',
    border: `1px solid ${active ? 'rgba(255,209,102,0.34)' : 'rgba(255,255,255,0.13)'}`,
    color: active ? '#ffd166' : 'rgba(255,255,255,0.84)',
    fontSize: 10, fontWeight: 700, letterSpacing: '0.1em', textTransform: 'uppercase',
    lineHeight: 1.25, textAlign: 'start', cursor: 'pointer',
});

const ScenePanel = ({ autoRotate, onToggleDrift, onWakeDrift, trueScale, vizMode, disabled }) => {
    const { t, rtl } = useI18n();
    const reduced = useReducedMotion();
    const [open, setOpen] = useState(false);

    // Collapse when the whole thing goes away (a body focused, or the page
    // scrolled past the hero) so it isn't sitting open behind the fade next time.
    useEffect(() => { if (disabled) setOpen(false); }, [disabled]);

    useEffect(() => {
        if (!open) return;
        const onKey = (e) => { if (e.key === 'Escape') setOpen(false); };
        document.addEventListener('keydown', onKey);
        return () => document.removeEventListener('keydown', onKey);
    }, [open]);

    const slide = reduced ? 'none' : 'transform 320ms cubic-bezier(0.32,0.72,0,1), inset-inline-start 320ms cubic-bezier(0.32,0.72,0,1)';
    const hiddenX = rtl ? 'translateX(100%)' : 'translateX(-100%)';

    // The handle mark is the focused-object sheet's pull handle laid on its
    // side: the exact same doubled ChevronDown (bright then dim, overlapped by
    // the same -24, widened by the same scaleX(1.5)), each turned a quarter
    // turn so the pair reads as » / «. It points into the scene when closed and
    // back at the edge when open; the direction lives in the rotation, so the
    // bright chevron stays put and a right-to-left layout just flips which way
    // "into the scene" is.
    const chevDeg = (open === rtl) ? -90 : 90;

    const gravState = vizMode === VIZ_GRID ? 'scene.gravityStateGrid'
        : vizMode === VIZ_FIELD ? 'scene.gravityStateField'
            : 'scene.gravityStateOff';

    return (
        <div
            style={{
                // Above the floating body labels (they stack up to ~24) so the
                // panel covers them cleanly when it is on their side of the
                // scene — which is the whole right half in the default view,
                // i.e. the leading edge in a right-to-left layout.
                position: 'absolute', insetInlineStart: 0, top: '50%', zIndex: 30,
                transform: 'translateY(-50%)',
                pointerEvents: 'none',
                opacity: disabled ? 0 : 1,
                transition: 'opacity 500ms ease',
            }}
            inert={disabled || undefined}
        >
            <div style={{ position: 'relative' }}>
                {/* The tab comes first in the DOM so a keyboard opening it then
                    tabs straight into the controls, not past them. Its place on
                    screen is set by position, not order. */}
                <button
                    onClick={() => setOpen(v => !v)}
                    aria-expanded={open}
                    aria-label={t(open ? 'scene.viewOptionsClose' : 'scene.viewOptions')}
                    title={t(open ? 'scene.viewOptionsClose' : 'scene.viewOptions')}
                    className="focus-ring"
                    style={{
                        position: 'absolute', top: '50%',
                        insetInlineStart: open ? '100%' : 0,
                        transform: 'translateY(-50%)',
                        transition: slide,
                        pointerEvents: 'auto',
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        overflow: 'hidden',
                        width: 32, height: 78,
                        border: '1px solid rgba(255,255,255,0.16)',
                        borderStartStartRadius: 0, borderEndStartRadius: 0,
                        borderStartEndRadius: 10, borderEndEndRadius: 10,
                        background: 'rgba(8,10,15,0.92)',
                        backdropFilter: 'blur(14px)',
                        WebkitBackdropFilter: 'blur(14px)',
                        cursor: 'pointer',
                    }}
                >
                    {/* The focused-object sheet's exact pull handle, laid on its
                        side (see chevDeg). Same two ChevronDown, same -24
                        overlap, same scaleX(1.5) widening, same two opacities;
                        `direction: ltr` so the row does not reverse in Arabic —
                        the chevrons already point the right way from chevDeg. */}
                    <span
                        aria-hidden="true"
                        style={{
                            display: 'flex', alignItems: 'center', direction: 'ltr',
                            pointerEvents: 'none', transform: 'scale(0.8)',
                        }}
                    >
                        <ChevronDown style={{
                            width: 44, height: 44, marginRight: -28, flexShrink: 0,
                            color: 'rgba(255,255,255,0.80)',
                            transform: `rotate(${chevDeg}deg) scaleX(1.5)`,
                            transition: reduced ? 'none' : 'transform 320ms ease',
                        }} />
                        <ChevronDown style={{
                            width: 44, height: 44, flexShrink: 0,
                            color: 'rgba(255,255,255,0.40)',
                            transform: `rotate(${chevDeg}deg) scaleX(1.5)`,
                            transition: reduced ? 'none' : 'transform 320ms ease',
                        }} />
                    </span>
                </button>

                <div
                    role="group"
                    aria-label={t('scene.viewOptions')}
                    aria-hidden={!open || undefined}
                    inert={!open || undefined}
                    style={{
                        width: 246, maxWidth: '82vw',
                        maxHeight: 'calc(var(--app-vh, 100vh) - 96px)',
                        overflowY: 'auto', overflowX: 'hidden', overscrollBehavior: 'contain',
                        padding: '14px 16px',
                        // Not .glass: at 8% white the small text washed out over
                        // a bright warped grid, and a body label passing behind
                        // it has to be fully hidden, not ghosted. Near-opaque,
                        // like the category bar.
                        background: 'rgba(8,10,15,0.95)',
                        border: '1px solid rgba(255,255,255,0.14)',
                        backdropFilter: 'blur(16px) saturate(140%)',
                        WebkitBackdropFilter: 'blur(16px) saturate(140%)',
                        boxShadow: '0 12px 34px rgba(0,0,0,0.5)',
                        borderStartStartRadius: 0, borderEndStartRadius: 0,
                        borderStartEndRadius: 16, borderEndEndRadius: 16,
                        pointerEvents: open ? 'auto' : 'none',
                        transform: open ? 'translateX(0)' : hiddenX,
                        transition: slide,
                    }}
                >
                    <p style={{
                        fontSize: 10, fontWeight: 800, letterSpacing: '0.14em',
                        textTransform: 'uppercase', color: 'rgba(255,255,255,0.5)',
                        margin: '0 0 10px',
                    }}>
                        {t('scene.viewOptions')}
                    </p>

                    <button
                        onClick={onToggleDrift}
                        aria-pressed={!autoRotate}
                        aria-label={t(autoRotate ? 'scene.driftingAria' : 'scene.heldStillAria')}
                        className="focus-ring"
                        style={rowBtn(!autoRotate)}
                    >
                        {autoRotate
                            ? <Orbit style={{ width: 13, height: 13 }} aria-hidden="true" />
                            : <Pause style={{ width: 13, height: 13 }} aria-hidden="true" />}
                        {t(autoRotate ? 'scene.drifting' : 'scene.heldStill')}
                    </button>

                    <div style={{ marginTop: 12 }}>
                        <DriftSliders driftOn={autoRotate} onWake={onWakeDrift} />
                    </div>

                    <div style={{ height: 1, background: 'rgba(255,255,255,0.1)', margin: '12px 0' }} />

                    <button
                        onClick={toggleTrueScale}
                        aria-pressed={trueScale}
                        aria-label={t(trueScale ? 'scene.compressedAria' : 'scene.trueScaleAria')}
                        className="focus-ring"
                        style={rowBtn(trueScale)}
                    >
                        <Ruler style={{ width: 13, height: 13 }} aria-hidden="true" />
                        {t(trueScale ? 'scene.trueDistances' : 'scene.compressedDistances')}
                    </button>

                    <button
                        onClick={cycleVizMode}
                        aria-pressed={vizMode !== VIZ_OFF}
                        aria-label={t('scene.gravityAria', { state: t(gravState) })}
                        className="focus-ring"
                        style={{ ...rowBtn(vizMode !== VIZ_OFF), marginTop: 8 }}
                    >
                        <Waves style={{ width: 13, height: 13 }} aria-hidden="true" />
                        {vizMode === VIZ_OFF
                            ? t('scene.gravity')
                            : `${t('scene.gravity')} · ${t(gravState)}`}
                    </button>
                </div>
            </div>
        </div>
    );
};

export default ScenePanel;
