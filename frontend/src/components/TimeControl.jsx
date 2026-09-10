import { useState, useEffect, useRef, useCallback } from 'react';
import { Play, Pause, Rewind, FastForward, RotateCcw, Clock, ChevronsLeft } from 'lucide-react';
import {
    RATES, RANGE_DAYS, simDate, getRate, isPaused, isLive,
    setRate, togglePaused, glideToNow, setOffsetDays, offsetDays, subscribe,
} from '../utils/simTime';
import { useIsMobile, useHasRoomForTimeline, useReducedMotion } from '../hooks/useMediaQuery';
import { useI18n } from '../i18n';

/**
 * "3 days ago", and its equivalent elsewhere.
 *
 * Both halves are slots, not a concatenation: English puts the preposition
 * after the amount and Arabic puts it before, so the order belongs to the
 * locale's `time.offset` string rather than to this function. The amount goes
 * through the plural tables for the same reason — Arabic needs a different
 * word for two days, for five, and for thirty.
 */
function offsetLabel(days, t) {
    const a = Math.abs(days);
    if (a < 1) return t('time.now');
    const direction = t(days > 0 ? 'time.ahead' : 'time.ago');
    const amount = a < 45  ? t('time.days',   { count: Math.round(a) })
        : a < 700 ? t('time.months', { count: Math.round(a / 30.44) })
        : t('time.years', { count: Number((a / 365.25).toFixed(1)) });
    return t('time.offset', { amount, direction });
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
    const { t, date: fmtDate, time: fmtTime } = useI18n();
    const isMobile = useIsMobile();
    const roomy = useHasRoomForTimeline();
    const reducedMotion = useReducedMotion();
    const [, force] = useState(0);
    // Open where there is room for it. Expanded, this is around 500px of
    // control anchored bottom-left, and on a mid-width desktop it reaches the
    // middle of the screen and sits on top of what is centred there — so that
    // band opens on request. A roomy desktop has the room; a phone gets it
    // open too, where the compact build is narrow and it's the primary way to
    // scrub.
    const [open, setOpen] = useState(() => roomy || isMobile);
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

    // "Back to now" winds the scene home over five seconds so the planets are
    // seen to move; reduced motion gets the same destination with no travel.
    const backToNow = useCallback(() => {
        glideToNow(reducedMotion ? 0 : 5000);
    }, [reducedMotion]);

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
        ? t('time.paused')
        : rate === 1
            ? t('time.realTime')
            : (rate < 0 ? '−' : '') + (RATES.find(r => r.value === Math.abs(rate))?.short ?? '');

    // Collapsible everywhere. It is a wide control sitting across the bottom of
    // the scene, and sometimes you want to look at the scene.
    const compact = !open;

    return (
        <div
            className="transition-opacity duration-500"
            data-coach="time"
            style={{
                position: 'absolute',
                insetInlineStart: isMobile ? 12 : 20,
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
                        aria-label={t('time.open')}
                        style={{ ...btn(!live), width: 'auto', padding: '0 8px', gap: 6, display: 'flex' }}
                    >
                        <Clock style={{ width: 14, height: 14 }} />
                        <span style={{ fontSize: 11, fontWeight: 700, whiteSpace: 'nowrap' }}>
                            {live ? t('time.live') : fmtDate(date)}
                        </span>
                    </button>
                ) : (
                    <>
                        {/* The transport follows the page direction: in a
                            right-to-left layout the row reverses (rewind moves to
                            the right, where the past is) and the two arrow icons
                            mirror with it via `flip-rtl`. Play/pause is symmetric
                            and stays put. */}
                        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                            <button onClick={() => stepRate(-1)} style={btn(false)} aria-label={t('time.slower')}>
                                <Rewind className="flip-rtl" style={{ width: 15, height: 15 }} />
                            </button>
                            <button
                                onClick={togglePaused}
                                style={btn(paused)}
                                aria-label={t(paused ? 'time.resume' : 'time.pause')}
                            >
                                {paused
                                    ? <Play style={{ width: 15, height: 15 }} />
                                    : <Pause style={{ width: 15, height: 15 }} />}
                            </button>
                            <button
                                onClick={() => stepRate(1)}
                                style={btn(false)}
                                aria-label={t('time.faster')}
                                data-coach="ff"
                            >
                                <FastForward className="flip-rtl" style={{ width: 15, height: 15 }} />
                            </button>
                        </div>

                        <div style={{ width: 1, height: 22, background: 'rgba(255,255,255,0.14)', margin: '0 2px' }} />

                        <div style={{ minWidth: isMobile ? 96 : 132, lineHeight: 1.15 }}>
                            <div className="num-run" style={{
                                fontSize: 12, fontWeight: 700, color: '#fff',
                                fontVariantNumeric: 'tabular-nums', whiteSpace: 'nowrap',
                            }}>
                                {fmtDate(date)}
                            </div>
                            <div style={{
                                fontSize: 9.5, color: 'rgba(255,255,255,0.45)', whiteSpace: 'nowrap',
                            }}>
                                {live
                                    ? t('time.liveAt', { time: fmtTime(date) })
                                    : t('time.rateAndOffset', {
                                        rate: rateLabel, offset: offsetLabel(off, t),
                                    })}
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
                            onPointerDown={() => { dragRef.current = true; }}
                            onPointerUp={() => { dragRef.current = false; }}
                            onPointerCancel={() => { dragRef.current = false; }}
                            aria-label={t('time.scrub')}
                            aria-valuetext={fmtDate(date)}
                            style={{ width: isMobile ? 100 : 168, accentColor: '#9fc4ff' }}
                        />

                        <button
                            onClick={backToNow}
                            style={{ ...btn(false), opacity: live ? 0.35 : 1 }}
                            disabled={live}
                            aria-label={t('time.backToNow')}
                            title={t('time.backToNow')}
                        >
                            <RotateCcw style={{ width: 14, height: 14 }} />
                        </button>

                        <button
                            onClick={() => setOpen(false)}
                            style={{ ...btn(false), width: 26 }}
                            aria-label={t('time.collapse')}
                            title={t('time.collapseTitle')}
                        >
                            {/* Points at the corner this collapses into, which
                                is the corner the reading starts at — so it does
                                flip. The transport group above does not: it runs
                                along the timeline, the same way in every
                                language. */}
                            <ChevronsLeft className="flip-rtl" style={{ width: 15, height: 15 }} />
                        </button>
                    </>
                )}
            </div>
        </div>
    );
};

export default TimeControl;
