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
                data-on={open}
                className="chip chip-icon focus-ring"
                style={{
                    opacity: disabled ? 0 : 1,
                    pointerEvents: disabled ? 'none' : 'auto',
                }}
            >
                <SlidersHorizontal aria-hidden="true" />
            </button>

            {open && (
                <div
                    role="dialog"
                    aria-label={t('scene.cameraDrift')}
                    className="drawer animate-fade-in"
                    style={{
                        position: 'absolute',
                        bottom: 'calc(100% + var(--s-2))',
                        insetInlineStart: 0,
                        width: 246, maxWidth: 'calc(100vw - 28px)',
                        zIndex: 60,
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
