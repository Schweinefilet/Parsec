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

const listeners = new Set();
const notify = () => listeners.forEach(fn => fn());

/** Re-anchor so the simulated instant is continuous across a rate change. */
function reanchor(at = Date.now()) {
    anchorSim = simNow(at);
    anchorReal = at;
}

/** The simulated instant, in epoch ms. */
export function simNow(realNow = Date.now()) {
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
/** True when the clock is simply following the real one. */
export const isLive = () => !paused && rate === 1 && Math.abs(simNow() - Date.now()) < 1000;

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

/** Back to the present, running live. */
export function resetToNow() {
    rate = 1;
    paused = false;
    anchorReal = Date.now();
    anchorSim = anchorReal;
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
    anchorReal = Date.now();
    anchorSim = anchorReal;
    listeners.clear();
}
