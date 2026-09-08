// The clock the solar system runs on.
//
// Every position in the scene is computed from a date, so the whole system
// becomes explorable in time simply by changing which date that is. This holds
// one simulated instant and how fast it advances, and the render loop reads it
// each frame — imperatively, so scrubbing through a decade doesn't re-render
// React 60 times a second.
//
// Rate is expressed as simulated seconds per real second: 1 is live, 86400
// means a day passes each second, negatives run backwards, 0 is paused.

export const RATES = [
    { value: 1,        label: 'Live',     short: 'Live' },
    { value: 3600,     label: '1 hour/s', short: '1h/s' },
    { value: 86400,    label: '1 day/s',  short: '1d/s' },
    { value: 604800,   label: '1 week/s', short: '1w/s' },
    { value: 2629800,  label: '1 month/s', short: '1mo/s' },
    { value: 31557600, label: '1 year/s', short: '1y/s' },
];

// How far from now the scrubber can reach, in days
export const RANGE_DAYS = 3652;   // ±10 years

const DAY_MS = 86400000;

let rate = 1;            // simulated seconds per real second
let paused = false;
let anchorReal = Date.now();   // real clock when the current segment began
let anchorSim = Date.now();    // simulated clock at that same moment

// A guided return to the present. "Back to now" could snap — resetToNow() does
// — but winding the clock back over a few seconds lets you watch the planets
// walk to where they actually are, which reads far better than a jump when the
// clock has been parked years out. While a glide runs it owns simNow(): the
// offset from real time decays from where it started to zero on an ease.
let glideFrom = 0;      // offset (sim − real, ms) at the moment the glide began
let glideStart = 0;     // real clock when it began
let glideMs = 0;        // glide duration; 0 when not gliding

const listeners = new Set();
const notify = () => listeners.forEach(fn => fn());

// easeInOutCubic — flat at both ends, so the wind-back starts and finishes
// gently and there is no visible pop as it hands back to the live clock.
const ease = (p) => (p < 0.5 ? 4 * p * p * p : 1 - Math.pow(-2 * p + 2, 3) / 2);

/**
 * How far through the current glide (0–1), or null if none is running.
 *
 * Finalises itself on arrival: clears the glide and re-anchors to the live
 * clock, so the caller after it sees a plain live state. No notify — the
 * readout's own interval picks the change up.
 */
function glideProgress(realNow = Date.now()) {
    if (!glideMs) return null;
    const p = (realNow - glideStart) / glideMs;
    if (p >= 1) {
        glideMs = 0;
        rate = 1;
        paused = false;
        anchorReal = realNow;
        anchorSim = realNow;
        return null;
    }
    return p < 0 ? 0 : p;
}

/** True while "Back to now" is still winding the clock in. */
export const isGliding = (realNow = Date.now()) => glideProgress(realNow) !== null;

/** Re-anchor so the simulated instant is continuous across a rate change. */
function reanchor(at = Date.now()) {
    anchorSim = simNow(at);
    anchorReal = at;
    glideMs = 0;   // any manual control cancels a glide in progress
}

/** The simulated instant, in epoch ms. */
export function simNow(realNow = Date.now()) {
    const p = glideProgress(realNow);
    if (p !== null) return realNow + glideFrom * (1 - ease(p));
    if (paused) return anchorSim;
    if (rate === 1) return anchorSim + (realNow - anchorReal);
    return anchorSim + (realNow - anchorReal) * rate;
}

/** Simulated Date — allocates, so prefer simNow() inside a render loop. */
export function simDate(realNow = Date.now()) {
    return new Date(simNow(realNow));
}

export const getRate = () => rate;
export const isPaused = () => paused;
/**
 * True when the clock is simply following the real one. A glide back to now is
 * deliberately not live yet — the scene keys "keep the planets moving" off
 * this, and the whole point of the wind-back is that they move.
 */
export const isLive = () =>
    !paused && rate === 1 && !isGliding() && Math.abs(simNow() - Date.now()) < 1000;

export function setRate(next) {
    reanchor();
    rate = next;
    paused = false;
    notify();
}

export function setPaused(next) {
    reanchor();
    paused = next;
    notify();
}

export function togglePaused() {
    setPaused(!paused);
}

/** Jump to an absolute instant, leaving the rate alone. */
export function setSimTime(ms) {
    glideMs = 0;   // a scrub cancels a wind-back
    anchorSim = ms;
    anchorReal = Date.now();
    notify();
}

/** Jump to a whole number of days from the real present. */
export function setOffsetDays(days) {
    setSimTime(Date.now() + days * DAY_MS);
}

/** Days between the simulated instant and now — what the scrubber shows. */
export function offsetDays(realNow = Date.now()) {
    return (simNow(realNow) - realNow) / DAY_MS;
}

/** Back to the present, running live — immediately, no wind-back. */
export function resetToNow() {
    glideMs = 0;
    rate = 1;
    paused = false;
    anchorReal = Date.now();
    anchorSim = anchorReal;
    notify();
}

/**
 * Return to the present over `durationMs`, winding the scene back as it goes.
 *
 * Falls through to an instant reset when there is nothing to wind (already
 * within a second of now), when asked for no duration (a caller honouring
 * prefers-reduced-motion), or when pressed a second time mid-glide — "just get
 * there".
 */
export function glideToNow(durationMs = 5000, realNow = Date.now()) {
    if (durationMs <= 0 || isGliding(realNow)) { resetToNow(); return; }
    const offset = simNow(realNow) - realNow;
    if (Math.abs(offset) < 1000) { resetToNow(); return; }
    glideFrom = offset;
    glideStart = realNow;
    glideMs = durationMs;
    rate = 1;
    paused = false;
    // Where the glide hands back to, so the instant it finishes is coherent
    // even if nothing reads the clock on that exact frame.
    anchorReal = realNow;
    anchorSim = realNow;
    notify();
}

/** Subscribe to control changes (not to the clock ticking). */
export function subscribe(fn) {
    listeners.add(fn);
    return () => listeners.delete(fn);
}

/** Test seam. */
export function __reset() {
    rate = 1;
    paused = false;
    glideMs = 0;
    anchorReal = Date.now();
    anchorSim = anchorReal;
    listeners.clear();
}
