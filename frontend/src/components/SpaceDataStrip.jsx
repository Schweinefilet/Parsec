import { useRef, useEffect, useCallback } from 'react';
import { useSpaceStrip } from '../hooks/useSpaceStrip';
import { useReducedMotion } from '../hooks/useMediaQuery';

const SCROLL_SPEED = 0.45;

const SpaceCell = ({ label, value, unit }) => (
    <div className="flex items-center gap-3 px-4 py-2 border-r border-white/10 flex-shrink-0">
        <span
            className="text-[11px] font-bold uppercase tracking-wider"
            style={{ color: 'var(--text-tertiary)' }}
        >
            {label}
        </span>
        {value != null ? (
            <span className="flex items-baseline gap-1">
                <span className="text-sm font-bold tabular-nums" style={{ color: 'var(--text-primary)' }}>
                    {value}
                </span>
                {unit && (
                    <span className="text-[11px]" style={{ color: 'var(--text-secondary)' }}>
                        {unit}
                    </span>
                )}
            </span>
        ) : (
            <span className="text-xs animate-pulse" style={{ color: 'var(--text-tertiary)' }}>···</span>
        )}
    </div>
);

/**
 * Live space telemetry ticker. The track holds two copies of the cell list and
 * wraps at half its scroll width, so the marquee is seamless in both directions
 * whether it is drifting on its own or being dragged.
 */
const SpaceDataStrip = () => {
    const cells = useSpaceStrip();
    const trackRef = useRef(null);
    const offsetRef = useRef(0);
    const isDragging = useRef(false);
    const dragStartX = useRef(0);
    const dragStartOffset = useRef(0);
    const rafRef = useRef(null);
    const reduceMotion = useReducedMotion();

    const normalize = useCallback((val) => {
        const track = trackRef.current;
        if (!track) return val;
        const w = track.scrollWidth / 2;
        if (w <= 0) return val;
        val = val % w;
        if (val > 0) val -= w;
        return val;
    }, []);

    useEffect(() => {
        if (reduceMotion) return;
        const tick = () => {
            if (!isDragging.current && trackRef.current) {
                offsetRef.current = normalize(offsetRef.current - SCROLL_SPEED);
                trackRef.current.style.transform = `translateX(${offsetRef.current}px)`;
            }
            rafRef.current = requestAnimationFrame(tick);
        };
        rafRef.current = requestAnimationFrame(tick);
        return () => cancelAnimationFrame(rafRef.current);
    }, [normalize, reduceMotion]);

    const handlePointerDown = useCallback(e => {
        isDragging.current = true;
        dragStartX.current = e.clientX;
        dragStartOffset.current = offsetRef.current;
        e.currentTarget.style.cursor = 'grabbing';
        e.currentTarget.setPointerCapture(e.pointerId);
    }, []);

    const handlePointerMove = useCallback(e => {
        if (!isDragging.current) return;
        const newOffset = normalize(dragStartOffset.current + (e.clientX - dragStartX.current));
        offsetRef.current = newOffset;
        if (trackRef.current) trackRef.current.style.transform = `translateX(${newOffset}px)`;
    }, [normalize]);

    const handlePointerUp = useCallback(e => {
        isDragging.current = false;
        if (e.currentTarget) e.currentTarget.style.cursor = 'grab';
    }, []);

    return (
        <div
            className="glass overflow-hidden select-none"
            style={{ padding: '4px 0', cursor: 'grab', borderRadius: 'var(--radius-card)' }}
            onPointerDown={handlePointerDown}
            onPointerMove={handlePointerMove}
            onPointerUp={handlePointerUp}
            onPointerCancel={handlePointerUp}
            aria-label="Live space telemetry"
        >
            <div ref={trackRef} className="flex" style={{ willChange: 'transform' }}>
                {[0, 1].flatMap(copy =>
                    cells.map(cell => (
                        <SpaceCell
                            key={`${cell.key}-${copy}`}
                            label={cell.label}
                            value={cell.value}
                            unit={cell.unit}
                            // The duplicate track is decoration for the marquee loop
                            aria-hidden={copy === 1}
                        />
                    ))
                )}
            </div>
        </div>
    );
};

export default SpaceDataStrip;
