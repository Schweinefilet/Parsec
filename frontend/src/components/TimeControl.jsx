import { useState, useEffect, useLayoutEffect, useRef, useCallback } from 'react';
import { Play, Pause, Rewind, FastForward, RotateCcw, Clock, ChevronsLeft } from 'lucide-react';
import {
    RATES, RANGE_DAYS, simDate, getRate, isPaused, isLive,
    setRate, togglePaused, glideToNow, setOffsetDays, offsetDays, setSimTime, subscribe,
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

/**
 * yyyy-mm-dd in the viewer's own local time, for `<input type="date">`'s
 * `value`/`min`/`max`.
 *
 * Not `date.toISOString().slice(0, 10)` — that goes through UTC first, which
 * silently steps the date a day off from what fmtDate() (local-time
 * toLocaleDateString) and the picker itself both show, for anyone west of
 * Greenwich past 4pm or so, or east of it before sunrise.
 */
function toISODateLocal(date) {
    const y = date.getFullYear();
    const m = String(date.getMonth() + 1).padStart(2, '0');
    const d = String(date.getDate()).padStart(2, '0');
    return `${y}-${m}-${d}`;
}

// The transport's two step buttons walk one shared ladder: RATES' own
// magnitudes mirrored negative and laid out ascending from full reverse to
// full forward. "Slower" used to bottom out at Live and clamp there — now it
// keeps going, past a stop, into reverse, up to the same 1-year/s the fast
// side already reaches.
const SIGNED_RATES = [...RATES].reverse().map(r => -r.value).concat(RATES.map(r => r.value));

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
const TimeControl = ({ hidden, focused }) => {
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
    // scrub. A focused object gets neither — it collapses to the small pill
    // so it doesn't compete with the thing you flew to.
    const [open, setOpen] = useState(() => !focused && (roomy || isMobile));
    const dragRef = useRef(false);
    const dateInputRef = useRef(null);

    // Collapse the moment an object is focused; expand the moment you leave.
    // Guarded to actual *transitions* in `focused` (not every render) so it
    // doesn't fight a manual toggle made while already focused, and doesn't
    // clobber the roomy/mobile default above on first mount.
    const wasFocusedRef = useRef(focused);
    useEffect(() => {
        if (wasFocusedRef.current === focused) return;
        wasFocusedRef.current = focused;
        setOpen(!focused);
    }, [focused]);

    // ── Smooth collapse/expand of the pill itself ───────────────────────────
    // The compact and open renderings are two entirely different DOM trees
    // (a single small button vs. the full transport), so a plain state swap
    // pops instantly — there's nothing shared to CSS-transition between them.
    // A lightweight FLIP: lock the container to its old pixel width the
    // instant the new content lands, then animate to the new content's
    // natural width next frame, then let it go back to auto so later
    // reflows (a locale switch, a resize) aren't pinned to a stale value.
    const pillRef = useRef(null);
    const prevWidthRef = useRef(null);
    const isFirstRef = useRef(true);

    // Keep the last *settled* width current on every render so the effect
    // below always has an accurate "before" to animate from — separate from
    // that effect so updating it doesn't retrigger it. Skipped on the render
    // where `open` itself just changed: the DOM above has already swapped to
    // the new content by the time any layout effect runs (React mutates the
    // DOM before layout effects fire, full stop — nothing here can observe
    // the pre-swap layout), so measuring on that render would silently
    // record the *new* width as the "before" and erase the real one, and the
    // transition below would have nothing to animate from.
    const freshTrackerOpenRef = useRef(open);
    useLayoutEffect(() => {
        const openJustChanged = freshTrackerOpenRef.current !== open;
        freshTrackerOpenRef.current = open;
        const el = pillRef.current;
        if (el && !openJustChanged && !el.style.width) {
            prevWidthRef.current = el.getBoundingClientRect().width;
        }
    });

    // The width itself is plain DOM, not React state — a state-driven "pin
    // to the old width, then move to the new one" needs the browser to
    // actually paint the first before the second lands, and nothing
    // guarantees that (confirmed empirically: even a requestAnimationFrame
    // apart, the two collapsed into one jump in headless Chrome). Direct
    // style writes plus a forced reflow between them are what make the
    // browser commit to the first before the second is applied.
    //
    // The target width has to be measured *before* pinning to the old one,
    // not after: `scrollWidth` reports the larger of "space the content
    // needs" and "the box's own current width" — it can tell you a box wants
    // to be bigger, never that it would be happy being smaller than
    // whatever it's currently pinned to. Measuring it after locking to the
    // (larger, pre-collapse) `fromWidth` always read back close to
    // `fromWidth` itself, which is what the instant jump on every collapse
    // traced back to.
    useLayoutEffect(() => {
        const el = pillRef.current;
        if (!el) return undefined;
        if (isFirstRef.current) { isFirstRef.current = false; return undefined; }
        const fromWidth = prevWidthRef.current;
        if (fromWidth == null) return undefined;

        if (reducedMotion) {
            prevWidthRef.current = el.getBoundingClientRect().width;
            return undefined;
        }

        const toWidth = el.getBoundingClientRect().width;
        el.style.width = `${fromWidth}px`;
        void el.offsetWidth;
        el.style.width = `${toWidth}px`;
        prevWidthRef.current = toWidth;

        const doneTimer = setTimeout(() => { el.style.width = ''; }, 400);
        return () => clearTimeout(doneTimer);
    }, [open, reducedMotion]);

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

    // Opens the native calendar rather than just focusing the field: clicking
    // a date input's own text in Chrome/Firefox only opens it if you land
    // exactly on the tiny calendar-icon glyph — everywhere else in the field
    // just selects a segment for typing. showPicker() is the one call that
    // reliably opens it from anywhere else in the input, which is the whole
    // point of making the visible date itself the click target. Phones
    // already open their native date sheet on focus regardless, and a browser
    // without showPicker() still gets a focused, keyboard-editable field.
    const openDatePicker = useCallback(() => {
        const el = dateInputRef.current;
        if (!el) return;
        if (typeof el.showPicker === 'function') {
            try { el.showPicker(); return; } catch { /* fall through to focus */ }
        }
        el.focus();
    }, []);

    // <input type="date"> only ever carries a calendar date, so a pick has to
    // borrow the clock face (hour/minute/etc.) from wherever the simulated
    // time already was — otherwise choosing a new date would silently also
    // reset the time of day to midnight, which is not what picking a *date*
    // should do.
    const onPickDate = useCallback((e) => {
        const picked = e.target.valueAsDate;   // UTC midnight of the picked day
        if (!picked) return;
        const cur = simDate();
        const next = new Date(
            picked.getUTCFullYear(), picked.getUTCMonth(), picked.getUTCDate(),
            cur.getHours(), cur.getMinutes(), cur.getSeconds(), cur.getMilliseconds(),
        );
        setSimTime(next.getTime());
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
        const i = SIGNED_RATES.indexOf(rate);
        const cur = i === -1 ? SIGNED_RATES.indexOf(rate < 0 ? -1 : 1) : i;
        const next = SIGNED_RATES[Math.max(0, Math.min(SIGNED_RATES.length - 1, cur + dir))];
        setRate(next);
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

    // Same ±10-year reach as the scrubber (RANGE_DAYS), so the picker never
    // offers a date the slider itself couldn't represent.
    const pickerMin = toISODateLocal(new Date(Date.now() - RANGE_DAYS * 86400000));
    const pickerMax = toISODateLocal(new Date(Date.now() + RANGE_DAYS * 86400000));

    return (
        <div
            className="transition-opacity duration-500"
            data-coach="time"
            style={{
                position: 'absolute',
                // On desktop this lands on the page's content spine — the same
                // column the wordmark above and the catalog below sit on — so
                // the transport reads as part of the layout rather than as
                // something stuck to the window. The phone keeps its own tight
                // gutter: there is no column to agree with on a 390px screen.
                insetInlineStart: isMobile ? 12 : 'var(--scene-inset)',
                bottom: isMobile ? 12 : 'var(--scene-baseline)',
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
                ref={pillRef}
                style={{
                    display: 'flex', alignItems: 'center', gap: 6,
                    padding: '7px 10px',
                    borderRadius: 'var(--r-full)',
                    // The shared chrome recipe — the same scrim, hairline and
                    // blur as the header buttons, the scene chips and the edge
                    // tab, so the bottom bar and the top bar read as one
                    // material rather than as two near-misses.
                    background: 'var(--chrome-bg)',
                    border: '1px solid var(--chrome-border)',
                    backdropFilter: 'var(--blur-chrome)',
                    WebkitBackdropFilter: 'var(--blur-chrome)',
                    boxShadow: 'var(--sh-2)',
                    overflow: 'hidden',
                    // No `width` here on purpose — the collapse/expand effect
                    // above drives it directly on the DOM node, and leaving
                    // it out of this object is what stops React's own style
                    // reconciliation from fighting that on an unrelated
                    // re-render (the 250ms clock tick, say).
                    transition: reducedMotion ? 'none' : 'width 320ms cubic-bezier(0.32,0.72,0,1)',
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
                            <div style={{ display: 'flex', alignItems: 'baseline', gap: 5 }}>
                                <div style={{ position: 'relative' }}>
                                    <button
                                        type="button"
                                        onClick={openDatePicker}
                                        className="num-run"
                                        aria-label={t('time.pickDate')}
                                        title={t('time.pickDate')}
                                        style={{
                                            display: 'block',
                                            background: 'none', border: 0, padding: 0, margin: 0,
                                            fontSize: 12, fontWeight: 700, color: '#fff',
                                            fontVariantNumeric: 'tabular-nums', whiteSpace: 'nowrap',
                                            cursor: 'pointer',
                                        }}
                                    >
                                        {fmtDate(date)}
                                    </button>
                                    {/* Invisible, but a real focusable input — not
                                        display:none — so showPicker()/focus() above
                                        has something to act on. Sized and placed
                                        over the button rather than the other way
                                        around so the visible text stays the
                                        locale-aware fmtDate() string instead of the
                                        date input's own browser-locale formatting. */}
                                    <input
                                        ref={dateInputRef}
                                        type="date"
                                        value={toISODateLocal(date)}
                                        min={pickerMin}
                                        max={pickerMax}
                                        onChange={onPickDate}
                                        tabIndex={-1}
                                        aria-hidden="true"
                                        style={{
                                            position: 'absolute', inset: 0,
                                            width: '100%', height: '100%',
                                            opacity: 0, border: 0, padding: 0, margin: 0,
                                            pointerEvents: 'none',
                                        }}
                                    />
                                </div>
                                {/* Read-only — there's no equivalent "pick a
                                    time" gesture, so unlike the date this isn't
                                    a button, just the clock face the date above
                                    is at. */}
                                <span className="num-run" style={{
                                    fontSize: 10.5, fontWeight: 600, color: 'rgba(255,255,255,0.5)',
                                    fontVariantNumeric: 'tabular-nums', whiteSpace: 'nowrap',
                                }}>
                                    {fmtTime(date)}
                                </span>
                            </div>
                            <div style={{
                                fontSize: 9.5, color: 'rgba(255,255,255,0.45)', whiteSpace: 'nowrap',
                            }}>
                                {live
                                    ? t('time.live')
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
