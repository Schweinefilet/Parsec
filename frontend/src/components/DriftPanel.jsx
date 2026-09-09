import { useState, useEffect, useRef } from 'react';
import { SlidersHorizontal } from 'lucide-react';
import DriftSliders from './DriftSliders';
import { useI18n } from '../i18n';

/**
 * The camera-drift sliders as a popover — the phone layout's home for them,
 * next to the Drifting / Held still pill. The desktop layout puts the same
 * DriftSliders inline in the ScenePanel drawer instead.
 *
 * A small icon button that opens a glass popover; DriftSliders does the rest
 * (it talks to the utils/driftControl singleton directly).
 */
const DriftPanel = ({ driftOn, onWake, disabled }) => {
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

    // Close if the whole control gets disabled (scrolled away / a body focused).
    useEffect(() => { if (disabled) setOpen(false); }, [disabled]);

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
                        // The toolbar container is pointer-events:none (so a drag
                        // that misses a pill still orbits the scene); the popover
                        // has to opt back in or its sliders are dead.
                        pointerEvents: 'auto',
                    }}
                >
                    <DriftSliders driftOn={driftOn} onWake={onWake} />
                </div>
            )}
        </div>
    );
};

export default DriftPanel;
