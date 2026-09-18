import { useRef, useEffect, useCallback, useState } from 'react';
import { useSpaceStrip } from '../hooks/useSpaceStrip';
import { useI18n } from '../i18n';

const SCROLL_SPEED = 0.45;

const SpaceCell = ({ label, value, unit }) => (
    <div className="ticker-cell flex items-baseline gap-2.5 flex-shrink-0">
        <span className="label">{label}</span>
        {value != null ? (
            <span className="flex items-baseline gap-1">
                <span style={{
                    fontSize: 'var(--fs-sm)', fontWeight: 700,
                    fontVariantNumeric: 'tabular-nums', color: 'var(--text-primary)',
                }}>
                    {value}
                </span>
                {unit && (
                    <span style={{ fontSize: 'var(--fs-tiny)', color: 'var(--text-tertiary)' }}>
                        {unit}
                    </span>
                )}
            </span>
        ) : (
            <span className="animate-pulse" style={{ fontSize: 'var(--fs-xs)', color: 'var(--text-tertiary)' }}>···</span>
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
    const { t } = useI18n();
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
            // A band, not a card. It runs the full width of the window, so a
            // rounded rectangle with a border all the way round only ever had
            // two of its corners on screen and read as a slab that had been cut
            // off at both ends. Hairlines top and bottom make it a rule through
            // the page instead, and .edge-fade-x dissolves the readings into the
            // background at both ends rather than guillotining them.
            className="ticker-band edge-fade-x overflow-hidden select-none ltr-figure"
            style={{ cursor: 'grab' }}
            onPointerDown={handlePointerDown}
            onPointerMove={handlePointerMove}
            onPointerUp={handlePointerUp}
            onPointerCancel={handlePointerUp}
            aria-label={t('ticker.aria')}
        >
            <div ref={trackRef} className="flex" style={{ willChange: 'transform' }}>
                {Array.from({ length: copies }, (_, copy) =>
                    cells.map(cell => (
                        <SpaceCell
                            key={`${cell.key}-${copy}`}
                            label={t(cell.label)}
                            value={cell.valueKey
                                ? t(cell.valueKey)
                                : cell.value + (cell.suffixKey ? t(cell.suffixKey) : '')}
                            unit={cell.unit ? t(cell.unit) : undefined}
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
