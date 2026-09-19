import { useState, useEffect } from 'react';
import { Orbit, Pause, Ruler, Waves, Waypoints, ChevronDown } from 'lucide-react';
import DriftSliders from './DriftSliders';
import { cycleScaleStage, SCALE_COMPRESSED, SCALE_DISTANCES, SCALE_SIZES } from '../utils/scaleMode';
import { cycleVizMode, VIZ_OFF, VIZ_GRID, VIZ_FIELD } from '../utils/vizMode';
import { toggleTrails } from '../utils/trailMode';
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
    display: 'flex', alignItems: 'center', gap: 'var(--s-2)', width: '100%',
    padding: '10px var(--s-3)', borderRadius: 'var(--r-sm)',
    background: active ? 'rgba(var(--accent-warm-rgb), 0.15)' : 'rgba(255,255,255,0.06)',
    border: `1px solid ${active ? 'rgba(var(--accent-warm-rgb), 0.36)' : 'var(--hairline-hi)'}`,
    color: active ? 'var(--accent-warm)' : 'rgba(255,255,255,0.84)',
    fontSize: 'var(--fs-label)', fontWeight: 700,
    letterSpacing: 'var(--tr-label)', textTransform: 'uppercase',
    lineHeight: 1.3, textAlign: 'start', cursor: 'pointer',
    transition: 'background var(--t-base) var(--ease-out), border-color var(--t-base) var(--ease-out), color var(--t-base) var(--ease-out)',
});

const ScenePanel = ({ autoRotate, onToggleDrift, onWakeDrift, onOpen, scaleStage, vizMode, trailsOn, disabled }) => {
    const { t, rtl } = useI18n();
    const reduced = useReducedMotion();
    const [open, setOpen] = useState(false);
    const toggleOpen = () => { if (!open) onOpen?.(); setOpen((v) => !v); };

    // Collapse when the whole thing goes away (a body focused, or the page
    // scrolled past the hero) so it isn't sitting open behind the fade next time.
    useEffect(() => { if (disabled) setOpen(false); }, [disabled]);

    useEffect(() => {
        if (!open) return;
        const onKey = (e) => { if (e.key === 'Escape') setOpen(false); };
        document.addEventListener('keydown', onKey);
        return () => document.removeEventListener('keydown', onKey);
    }, [open]);

    // Cycled compressed → true distances → true distances and sizes, the same
    // shape the gravity row below already uses: the label carries the state,
    // because a cycle button otherwise gives no clue what it does.
    const scaleLabel = scaleStage === SCALE_SIZES ? 'scene.trueDistancesSizes'
        : scaleStage === SCALE_DISTANCES ? 'scene.trueDistances'
            : 'scene.compressedDistances';

    const slide = reduced ? 'none' : 'transform 320ms var(--ease-glide), inset-inline-start 320ms var(--ease-glide)';
    // The tab carries its own hover treatment (opacity — see .edge-tab), and
    // an inline `transition` replaces the class's outright rather than
    // adding to it, so both halves have to be named here.
    const tabSlide = reduced
        ? 'none'
        : `${slide}, opacity var(--t-base) var(--ease-out)`;
    const hiddenX = rtl ? 'translateX(100%)' : 'translateX(-100%)';

    // The handle mark is the focused-object sheet's pull handle laid on its
    // side: two ChevronDown, overlapped and widened by scaleX(1.5), each turned
    // a quarter turn so the pair reads as » / «. It points into the scene when
    // closed and back at the edge when open; the direction lives in the
    // rotation, so a right-to-left layout just flips which way "into the scene"
    // is. The heavier chevron sits on the far side from the screen edge.
    const chevDeg = (open === rtl) ? -90 : 90;
    // The row is pinned `direction: ltr`, so the first icon is always the
    // visual left and the second the visual right. The screen edge the tab is
    // flush against is the left in a left-to-right layout, the right in Arabic
    // — and the heavier chevron goes on the far side from it.
    const chevLeft  = rtl ? 0.80 : 0.40;
    const chevRight = rtl ? 0.40 : 0.80;

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
                {/* Bare chevrons, no rail. 5.7.0 put this on a boxed plate flush
                    to the window edge for affordance; asked to take the box
                    back off, since a docked rail read as chrome sitting on
                    top of the scene rather than as part of it. Legibility now
                    comes from a drop-shadow behind the ink (see .edge-tab in
                    index.css) instead of a background plate. It still bobs
                    while closed. */}
                <button
                    onClick={toggleOpen}
                    aria-expanded={open}
                    aria-label={t(open ? 'scene.viewOptionsClose' : 'scene.viewOptions')}
                    title={t(open ? 'scene.viewOptionsClose' : 'scene.viewOptions')}
                    data-coach="tab"
                    className="edge-tab focus-ring"
                    style={{
                        position: 'absolute', top: '50%',
                        insetInlineStart: open ? '100%' : 0,
                        transform: 'translateY(-50%)',
                        transition: tabSlide,
                    }}
                >
                    {/* Bob + fade while closed — the sheet handle's animation,
                        turned sideways (edgeTabBob) so it nudges the way the
                        chevron points. On its own wrapper so it doesn't fight
                        the transforms below. */}
                    <span
                        style={{
                            display: 'block', pointerEvents: 'none',
                            '--bob-x': rtl ? '-4px' : '4px',
                            animation: (open || reduced)
                                ? 'none'
                                : 'edgeTabBob 1.8s ease-in-out infinite',
                        }}
                    >
                        {/* The focused-object sheet's pull handle — two rounded
                            ChevronDown, bright then dim, widened by scaleX(1.5)
                            and turned by chevDeg so the pair reads » / «. Each
                            icon overflows a tight wrapper so the row's width is
                            the ink, not the icon's empty 44px box. `direction:
                            ltr` keeps it from reversing in Arabic. */}
                        <span
                            aria-hidden="true"
                            style={{ display: 'flex', alignItems: 'center', direction: 'ltr' }}
                        >
                            <span style={{
                                width: 13, height: 30, flexShrink: 0,
                                display: 'flex', alignItems: 'center', justifyContent: 'center',
                            }}>
                                <ChevronDown style={{
                                    width: 34, height: 34, flexShrink: 0,
                                    color: `rgba(255,255,255,${chevLeft})`,
                                    transform: `rotate(${chevDeg}deg) scaleX(1.5)`,
                                    transition: 'transform 0.35s ease',
                                }} />
                            </span>
                            <span style={{
                                width: 13, height: 30, flexShrink: 0, marginInlineStart: -3,
                                display: 'flex', alignItems: 'center', justifyContent: 'center',
                            }}>
                                <ChevronDown style={{
                                    width: 34, height: 34, flexShrink: 0,
                                    color: `rgba(255,255,255,${chevRight})`,
                                    transform: `rotate(${chevDeg}deg) scaleX(1.5)`,
                                    transition: 'transform 0.35s ease',
                                }} />
                            </span>
                        </span>
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
                        border: '1px solid var(--chrome-border)',
                        borderInlineStart: 'none',
                        backdropFilter: 'var(--blur-chrome)',
                        WebkitBackdropFilter: 'var(--blur-chrome)',
                        boxShadow: 'var(--sh-3)',
                        // Square against the window edge it slides out of,
                        // rounded on the side facing the scene — the same
                        // shape rule as the tab that opens it.
                        borderStartStartRadius: 0, borderEndStartRadius: 0,
                        borderStartEndRadius: 'var(--r-lg)', borderEndEndRadius: 'var(--r-lg)',
                        pointerEvents: open ? 'auto' : 'none',
                        transform: open ? 'translateX(0)' : hiddenX,
                        transition: slide,
                    }}
                >
                    <p className="label" style={{
                        color: 'rgba(255,255,255,0.5)',
                        margin: '0 0 var(--s-3)',
                        paddingBottom: 'var(--s-2)',
                        borderBottom: '1px solid var(--hairline)',
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
                        onClick={cycleScaleStage}
                        aria-pressed={scaleStage !== SCALE_COMPRESSED}
                        aria-label={t('scene.scaleAria', { state: t(scaleLabel) })}
                        className="focus-ring"
                        style={rowBtn(scaleStage !== SCALE_COMPRESSED)}
                    >
                        <Ruler style={{ width: 13, height: 13 }} aria-hidden="true" />
                        {t(scaleLabel)}
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

                    <button
                        onClick={toggleTrails}
                        aria-pressed={trailsOn}
                        aria-label={t(trailsOn ? 'scene.trailsOnAria' : 'scene.trailsOffAria')}
                        className="focus-ring"
                        style={{ ...rowBtn(trailsOn), marginTop: 8 }}
                    >
                        <Waypoints style={{ width: 13, height: 13 }} aria-hidden="true" />
                        {t('scene.trails')}
                    </button>
                </div>
            </div>
        </div>
    );
};

export default ScenePanel;
