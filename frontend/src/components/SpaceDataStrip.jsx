import { useRef, useEffect, useCallback, useState } from 'react';
import { useSpaceStrip } from '../hooks/useSpaceStrip';

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
 * Live space telemetry ticker.
 *
 * The strip is only 7 cells — far narrower than the full-viewport-width bar it
 * scrolls inside on any normal desktop window. Two copies wrapped at half the
 * track's width is the standard seamless-marquee trick, but it's only
 * seamless when one copy is at least as wide as the container: otherwise the
 * scrolled window runs past the end of both copies into empty track before
 * the wrap point arrives — which is the gap that opened up after the last
 * cell ("Sol Wind") until the loop caught back up with it.
 *
 * So the number of copies is measured and kept just large enough that the
 * track is always wider than (container width + one copy), comfortably
 * covering the visible window at every point in the cycle, on any screen.
 */
const SpaceDataStrip = () => {
    const cells = useSpaceStrip();
    const containerRef = useRef(null);
    const trackRef = useRef(null);
    const offsetRef = useRef(0);
    const copiesRef = useRef(2);
    const isDragging = useRef(false);
    const dragStartX = useRef(0);
    const dragStartOffset = useRef(0);
    const rafRef = useRef(null);
    const [copies, setCopies] = useState(2);

    const normalize = useCallback((val) => {
        const track = trackRef.current;
        if (!track) return val;
        const w = track.scrollWidth / copiesRef.current;
        if (w <= 0) return val;
        val = val % w;
        if (val > 0) val -= w;
        return val;
    }, []);

    // Re-measure whenever the container resizes (including the initial
    // layout), and keep the copy count just ahead of what the width needs.
    useEffect(() => {
        const container = containerRef.current;
        const track = trackRef.current;
        if (!container || !track) return;

        const recompute = () => {
            const perCopy = track.scrollWidth / copiesRef.current;
            if (perCopy <= 0) return;
            // +2 rather than +1: cell text width shifts slightly as live values
            // arrive (e.g. "···" while loading vs. "51.6°N" once loaded), and
            // the margin absorbs that without needing to recompute every tick.
            const needed = Math.min(16, Math.max(2, Math.ceil(container.clientWidth / perCopy) + 2));
            if (needed !== copiesRef.current) {
                copiesRef.current = needed;
                setCopies(needed);
            }
        };

        recompute();
        const ro = new ResizeObserver(recompute);
        ro.observe(container);
        return () => ro.disconnect();
    }, [copies]);

    // Deliberately not gated on prefers-reduced-motion. The strip holds more
    // readings than fit on screen, so stopping it hides data rather than just
    // calming the page — and it stays draggable either way. The same figures
    // are all on the ISS tracker for anyone who would rather not chase them.
    useEffect(() => {
        const tick = () => {
            if (!isDragging.current && trackRef.current) {
                offsetRef.current = normalize(offsetRef.current - SCROLL_SPEED);
                trackRef.current.style.transform = `translateX(${offsetRef.current}px)`;
            }
            rafRef.current = requestAnimationFrame(tick);
        };
        rafRef.current = requestAnimationFrame(tick);
        return () => cancelAnimationFrame(rafRef.current);
    }, [normalize]);

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
            ref={containerRef}
            className="glass overflow-hidden select-none"
            style={{ padding: '4px 0', cursor: 'grab', borderRadius: 'var(--radius-card)' }}
            onPointerDown={handlePointerDown}
            onPointerMove={handlePointerMove}
            onPointerUp={handlePointerUp}
            onPointerCancel={handlePointerUp}
            aria-label="Live space telemetry"
        >
            <div ref={trackRef} className="flex" style={{ willChange: 'transform' }}>
                {Array.from({ length: copies }, (_, copy) =>
                    cells.map(cell => (
                        <SpaceCell
                            key={`${cell.key}-${copy}`}
                            label={cell.label}
                            value={cell.value}
                            unit={cell.unit}
                            // Every copy past the first is decoration for the loop
                            aria-hidden={copy === 0 ? undefined : true}
                        />
                    ))
                )}
            </div>
        </div>
    );
};

export default SpaceDataStrip;
