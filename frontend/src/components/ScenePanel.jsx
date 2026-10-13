import { useState, useEffect } from 'react';
import { Orbit, Pause, Ruler, Waves, Waypoints } from 'lucide-react';
import EdgeTab from './EdgeTab';
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
                transition: 'opacity var(--t-slower) var(--ease-out)',
            }}
            inert={disabled || undefined}
        >
            <div style={{ position: 'relative' }}>
                {/* The tab comes first in the DOM so a keyboard opening it then
                    tabs straight into the controls, not past them. Its place on
                    screen is set by position, not order. */}
                <EdgeTab
                    open={open}
                    reduced={reduced}
                    onClick={toggleOpen}
                    aria-expanded={open}
                    aria-label={t(open ? 'scene.viewOptionsClose' : 'scene.viewOptions')}
                    title={t(open ? 'scene.viewOptionsClose' : 'scene.viewOptions')}
                    data-coach="tab"
                    style={{
                        position: 'absolute', top: '50%',
                        insetInlineStart: open ? '100%' : 0,
                        transform: 'translateY(-50%)',
                        transition: tabSlide,
                    }}
                />

                <div
                    role="group"
                    aria-label={t('scene.viewOptions')}
                    aria-hidden={!open || undefined}
                    inert={!open || undefined}
                    className="drawer drawer-edge"
                    style={{
                        width: 246, maxWidth: '82vw',
                        maxHeight: 'calc(var(--app-vh, 100vh) - 96px)',
                        pointerEvents: open ? 'auto' : 'none',
                        transform: open ? 'translateX(0)' : hiddenX,
                        transition: slide,
                    }}
                >
                    <p className="label drawer-title">
                        {t('scene.viewOptions')}
                    </p>

                    <button
                        onClick={onToggleDrift}
                        aria-pressed={!autoRotate}
                        aria-label={t(autoRotate ? 'scene.driftingAria' : 'scene.heldStillAria')}
                        className="opt-row focus-ring"
                    >
                        {autoRotate
                            ? <Orbit aria-hidden="true" />
                            : <Pause aria-hidden="true" />}
                        {t(autoRotate ? 'scene.drifting' : 'scene.heldStill')}
                    </button>

                    <div style={{ marginTop: 'var(--s-3)' }}>
                        <DriftSliders driftOn={autoRotate} onWake={onWakeDrift} />
                    </div>

                    <hr className="drawer-rule" />

                    <button
                        onClick={cycleScaleStage}
                        aria-pressed={scaleStage !== SCALE_COMPRESSED}
                        aria-label={t('scene.scaleAria', { state: t(scaleLabel) })}
                        className="opt-row focus-ring"
                    >
                        <Ruler aria-hidden="true" />
                        {t(scaleLabel)}
                    </button>

                    <button
                        onClick={cycleVizMode}
                        aria-pressed={vizMode !== VIZ_OFF}
                        aria-label={t('scene.gravityAria', { state: t(gravState) })}
                        className="opt-row focus-ring"
                    >
                        <Waves aria-hidden="true" />
                        {vizMode === VIZ_OFF
                            ? t('scene.gravity')
                            : `${t('scene.gravity')} · ${t(gravState)}`}
                    </button>

                    <button
                        onClick={toggleTrails}
                        aria-pressed={trailsOn}
                        aria-label={t(trailsOn ? 'scene.trailsOnAria' : 'scene.trailsOffAria')}
                        className="opt-row focus-ring"
                    >
                        <Waypoints aria-hidden="true" />
                        {t('scene.trails')}
                    </button>
                </div>
            </div>
        </div>
    );
};

export default ScenePanel;
