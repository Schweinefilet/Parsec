import { useState, useEffect } from 'react';
import { RotateCcw } from 'lucide-react';
import {
    getDrift, setDriftAxis, resetDrift, subscribeDrift, DRIFT_DEFAULTS,
} from '../utils/driftControl';
import { useI18n } from '../i18n';

/**
 * The heading (label + reset), the two bipolar sliders, and the paused note —
 * the shared core of the phone's DriftPanel popover and the desktop ScenePanel
 * drawer. The store is the module singleton in utils/driftControl; this mirrors
 * it for the inputs and writes back on change. Nudging a slider while the drift
 * is off turns it back on through `onWake` — adjusting a motion you cannot see
 * is pointless.
 *
 * Pinned `direction: ltr`: a slider's left is its negative end in every
 * language, the same way the time transport does not reverse.
 */
const AXES = ['yaw', 'pitch'];
const LABEL_KEY = { yaw: 'scene.driftYaw', pitch: 'scene.driftPitch' };

const DriftSliders = ({ driftOn, onWake }) => {
    const { t } = useI18n();
    const [axes, setAxes] = useState(getDrift);

    useEffect(() => subscribeDrift(() => setAxes({ ...getDrift() })), []);

    const change = (axis, value) => {
        if (!driftOn) onWake?.();
        setDriftAxis(axis, value);
    };

    const atDefaults = AXES.every(a => axes[a] === DRIFT_DEFAULTS[a]);

    return (
        <div style={{ direction: 'ltr' }}>
            <div style={{
                display: 'flex', alignItems: 'baseline', justifyContent: 'space-between',
                marginBottom: 'var(--s-2)',
            }}>
                <span className="label drawer-subtitle" style={{ margin: 0 }}>
                    {t('scene.cameraDrift')}
                </span>
                <button
                    onClick={resetDrift}
                    disabled={atDefaults}
                    className="flex items-center gap-1 focus-ring"
                    style={{
                        fontSize: 'var(--fs-label)', fontWeight: 700, letterSpacing: '0.04em',
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
                    <span className="drawer-field" style={{ marginBottom: 3 }}>
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
                <p className="drawer-note">
                    {t('scene.driftPaused')}
                </p>
            )}
        </div>
    );
};

export default DriftSliders;
