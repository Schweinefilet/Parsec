import { useState, useEffect, useRef, useCallback } from 'react';
import { Play, Pause, Rewind, FastForward, RotateCcw, Clock } from 'lucide-react';
import {
    RATES, RANGE_DAYS, simDate, getRate, isPaused, isLive,
    setRate, togglePaused, resetToNow, setOffsetDays, offsetDays, subscribe,
} from '../utils/simTime';
import { useIsMobile } from '../hooks/useMediaQuery';

const fmtDate = (d) => d.toLocaleDateString(undefined, {
    day: 'numeric', month: 'short', year: 'numeric',
});
const fmtTime = (d) => d.toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' });

function offsetLabel(days) {
    const a = Math.abs(days);
    if (a < 1) return 'now';
    const dir = days > 0 ? 'ahead' : 'ago';
    if (a < 45) return `${Math.round(a)} day${Math.round(a) === 1 ? '' : 's'} ${dir}`;
    if (a < 700) return `${Math.round(a / 30.44)} months ${dir}`;
    return `${(a / 365.25).toFixed(1)} years ${dir}`;
}

const btn = (active) => ({
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    width: 30, height: 30, borderRadius: 9, flexShrink: 0, cursor: 'pointer',
    background: active ? 'rgba(255,255,255,0.18)' : 'transparent',
    border: '1px solid ' + (active ? 'rgba(255,255,255,0.28)' : 'transparent'),
    color: active ? '#fff' : 'rgba(255,255,255,0.72)',
});

/**
 * Scrub the solar system through time.
 *
 * Positions already come from a date, so this only has to change which date.
 * The readout is driven by its own interval rather than by the render loop —
 * the scene reads the clock imperatively and never needs React to keep up.
 */
const TimeControl = ({ hidden }) => {
    const isMobile = useIsMobile();
    const [, force] = useState(0);
    const [open, setOpen] = useState(false);
    const [dragging, setDragging] = useState(false);
    const dragRef = useRef(false);

    // Repaint the readout a few times a second; the scene doesn't wait on this
    useEffect(() => {
        const tick = () => force(n => n + 1);
        const iv = setInterval(tick, 250);
        const unsub = subscribe(tick);
        return () => { clearInterval(iv); unsub(); };
    }, []);

    const onScrub = useCallback((e) => {
        setOffsetDays(Number(e.target.value));
    }, []);

    const date = simDate();
    const rate = getRate();
    const paused = isPaused();
    const live = isLive();
    const off = offsetDays();
    // While dragging, trust the slider; otherwise follow the clock
    const sliderValue = dragRef.current ? undefined : Math.max(-RANGE_DAYS, Math.min(RANGE_DAYS, off));

    const stepRate = (dir) => {
        const i = RATES.findIndex(r => r.value === Math.abs(rate));
        const next = RATES[Math.max(0, Math.min(RATES.length - 1, (i < 0 ? 0 : i) + dir))];
        setRate(rate < 0 ? -next.value : next.value);
    };

    // "Live" would be misleading once the clock has been jumped to another
    // date, even though the rate is still 1x
    const rateLabel = paused
        ? 'paused'
        : rate === 1
            ? 'real time'
            : (rate < 0 ? '−' : '') + (RATES.find(r => r.value === Math.abs(rate))?.short ?? '');

    const compact = isMobile && !open;

    return (
        <div
            className="transition-opacity duration-500"
            style={{
                position: 'absolute',
                left: isMobile ? 12 : 20,
                bottom: isMobile ? 12 : 18,
                // Above the detail sheet (z-index 12): that sheet's container
                // spans the full width even though its card is centred, so at a
                // lower index it silently swallowed every click down here.
                zIndex: 14,
                opacity: hidden ? 0 : 1,
                pointerEvents: hidden ? 'none' : 'auto',
                maxWidth: 'calc(100vw - 24px)',
            }}
            inert={hidden || undefined}
        >
            <div
                style={{
                    display: 'flex', alignItems: 'center', gap: 6,
                    padding: compact ? '6px 10px' : '7px 10px',
                    borderRadius: 999,
                    background: 'rgba(6,8,12,0.72)',
                    border: '1px solid rgba(255,255,255,0.14)',
                    backdropFilter: 'blur(14px)',
                    WebkitBackdropFilter: 'blur(14px)',
                }}
            >
                {compact ? (
                    <button
                        onClick={() => setOpen(true)}
                        aria-label="Open time controls"
                        style={{ ...btn(!live), width: 'auto', padding: '0 8px', gap: 6, display: 'flex' }}
                    >
                        <Clock style={{ width: 14, height: 14 }} />
                        <span style={{ fontSize: 11, fontWeight: 700, whiteSpace: 'nowrap' }}>
                            {live ? 'Live' : fmtDate(date)}
                        </span>
                    </button>
                ) : (
                    <>
                        <button onClick={() => stepRate(-1)} style={btn(false)} aria-label="Slower">
                            <Rewind style={{ width: 15, height: 15 }} />
                        </button>
                        <button
                            onClick={togglePaused}
                            style={btn(paused)}
                            aria-label={paused ? 'Resume time' : 'Pause time'}
                        >
                            {paused
                                ? <Play style={{ width: 15, height: 15 }} />
                                : <Pause style={{ width: 15, height: 15 }} />}
                        </button>
                        <button onClick={() => stepRate(1)} style={btn(false)} aria-label="Faster">
                            <FastForward style={{ width: 15, height: 15 }} />
                        </button>

                        <div style={{ width: 1, height: 22, background: 'rgba(255,255,255,0.14)', margin: '0 2px' }} />

                        <div style={{ minWidth: isMobile ? 96 : 132, lineHeight: 1.15 }}>
                            <div style={{
                                fontSize: 12, fontWeight: 700, color: '#fff',
                                fontVariantNumeric: 'tabular-nums', whiteSpace: 'nowrap',
                            }}>
                                {fmtDate(date)}
                            </div>
                            <div style={{
                                fontSize: 9.5, color: 'rgba(255,255,255,0.45)', whiteSpace: 'nowrap',
                            }}>
                                {live ? `${fmtTime(date)} · live` : `${rateLabel} · ${offsetLabel(off)}`}
                            </div>
                        </div>

                        <input
                            type="range"
                            className="time-scrub"
                            min={-RANGE_DAYS}
                            max={RANGE_DAYS}
                            step={1}
                            value={sliderValue}
                            onChange={onScrub}
                            onPointerDown={() => { dragRef.current = true; setDragging(true); }}
                            onPointerUp={() => { dragRef.current = false; setDragging(false); }}
                            onPointerCancel={() => { dragRef.current = false; setDragging(false); }}
                            aria-label="Scrub through time"
                            aria-valuetext={fmtDate(date)}
                            style={{ width: isMobile ? 100 : 168, accentColor: '#9fc4ff' }}
                        />

                        <button
                            onClick={resetToNow}
                            style={{ ...btn(false), opacity: live ? 0.35 : 1 }}
                            disabled={live}
                            aria-label="Back to now"
                            title="Back to now"
                        >
                            <RotateCcw style={{ width: 14, height: 14 }} />
                        </button>

                        {isMobile && (
                            <button
                                onClick={() => setOpen(false)}
                                style={{ ...btn(false), width: 24 }}
                                aria-label="Close time controls"
                            >
                                <span style={{ fontSize: 15, lineHeight: 1 }}>×</span>
                            </button>
                        )}
                    </>
                )}
            </div>

            {!compact && dragging && (
                <p style={{
                    margin: '6px 0 0', textAlign: 'center', fontSize: 10,
                    color: 'rgba(255,255,255,0.5)',
                }}>
                    {offsetLabel(off)}
                </p>
            )}
        </div>
    );
};

export default TimeControl;
