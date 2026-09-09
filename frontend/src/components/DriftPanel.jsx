import { useState, useEffect, useRef } from 'react';
import { SlidersHorizontal, RotateCcw } from 'lucide-react';
import {
    getDrift, setDriftAxis, resetDrift, subscribeDrift, DRIFT_DEFAULTS,
} from '../utils/driftControl';
import { useI18n } from '../i18n';

/**
 * The three sliders that set the idle camera drift — yaw, pitch, roll.
 *
 * A small icon button that opens a glass popover, sitting next to the
 * Drifting / Held still pill. The store is a module singleton the scene reads
 * every frame (utils/driftControl); this only mirrors it for the inputs and
 * writes back on change. Nudging any slider while the drift is off turns it
 * back on, via `onWake` — adjusting a motion you cannot see is pointless.
 */
const AXES = ['yaw', 'pitch', 'roll'];
const LABEL_KEY = { yaw: 'scene.driftYaw', pitch: 'scene.driftPitch', roll: 'scene.driftRoll' };

const DriftPanel = ({ driftOn, onWake, disabled }) => {
    const { t } = useI18n();
    const [open, setOpen] = useState(false);
    const [axes, setAxes] = useState(getDrift);
    const wrapRef = useRef(null);

    useEffect(() => subscribeDrift(() => setAxes({ ...getDrift() })), []);

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

    // Close if the whole control gets disabled (scrolled away / a body focused).
    useEffect(() => { if (disabled) setOpen(false); }, [disabled]);

    const change = (axis, value) => {
        if (!driftOn) onWake?.();
        setDriftAxis(axis, value);
    };

    const atDefaults = AXES.every(a => axes[a] === DRIFT_DEFAULTS[a]);

    return (
        <div ref={wrapRef} style={{ position: 'relative', flexShrink: 0 }}>
            <button
                onClick={() => setOpen(v => !v)}
                aria-haspopup="dialog"
                aria-expanded={open}
                aria-label={t('scene.driftAdjust')}
                title={t('scene.driftAdjust')}
                inert={disabled || undefined}
                className="flex items-center justify-center rounded-full transition-opacity duration-700 focus-ring"
                style={{
                    width: 30, height: 30,
                    background: open ? 'rgba(255,255,255,0.16)' : 'rgba(0,0,0,0.42)',
                    border: '1px solid rgba(255,255,255,0.16)',
                    color: 'rgba(255,255,255,0.78)',
                    backdropFilter: 'blur(14px)',
                    WebkitBackdropFilter: 'blur(14px)',
                    cursor: 'pointer',
                    opacity: disabled ? 0 : 1,
                    pointerEvents: disabled ? 'none' : 'auto',
                }}
            >
                <SlidersHorizontal style={{ width: 13, height: 13 }} aria-hidden="true" />
            </button>

            {open && (
                <div
                    role="dialog"
                    aria-label={t('scene.cameraDrift')}
                    className="glass animate-fade-in"
                    style={{
                        position: 'absolute',
                        bottom: 'calc(100% + 8px)',
                        insetInlineStart: 0,
                        width: 232, maxWidth: 'calc(100vw - 28px)',
                        padding: '12px 14px', borderRadius: 14, zIndex: 60,
                        direction: 'ltr',
                    }}
                >
                    <div style={{
                        display: 'flex', alignItems: 'baseline', justifyContent: 'space-between',
                        marginBottom: 8,
                    }}>
                        <span style={{
                            fontSize: 10, fontWeight: 800, letterSpacing: '0.12em',
                            textTransform: 'uppercase', color: 'rgba(255,255,255,0.62)',
                        }}>
                            {t('scene.cameraDrift')}
                        </span>
                        <button
                            onClick={resetDrift}
                            disabled={atDefaults}
                            className="flex items-center gap-1 focus-ring"
                            style={{
                                fontSize: 10, fontWeight: 700, letterSpacing: '0.04em',
                                color: atDefaults ? 'rgba(255,255,255,0.28)' : 'rgba(255,255,255,0.66)',
                                background: 'none', border: 'none', padding: '2px 3px',
                                cursor: atDefaults ? 'default' : 'pointer',
                            }}
                        >
                            <RotateCcw style={{ width: 11, height: 11 }} aria-hidden="true" />
                            {t('scene.driftReset')}
                        </button>
                    </div>

                    {AXES.map(axis => (
                        <label key={axis} style={{ display: 'block', margin: '9px 0' }}>
                            <span style={{
                                display: 'block', fontSize: 11, fontWeight: 600,
                                color: 'rgba(255,255,255,0.82)', marginBottom: 3,
                            }}>
                                {t(LABEL_KEY[axis])}
                            </span>
                            <input
                                type="range"
                                className="drift-slider"
                                min={-1}
                                max={1}
                                step={0.01}
                                value={axes[axis]}
                                onChange={(e) => change(axis, Number(e.target.value))}
                                aria-label={t(LABEL_KEY[axis])}
                                aria-valuetext={
                                    axes[axis] === 0
                                        ? t('scene.driftCentre')
                                        : `${axes[axis] > 0 ? '+' : ''}${Math.round(axes[axis] * 100)}%`
                                }
                            />
                        </label>
                    ))}

                    {!driftOn && (
                        <p style={{
                            fontSize: 9.5, color: 'rgba(255,255,255,0.4)', marginTop: 6, lineHeight: 1.4,
                        }}>
                            {t('scene.driftPaused')}
                        </p>
                    )}
                </div>
            )}
        </div>
    );
};

export default DriftPanel;
