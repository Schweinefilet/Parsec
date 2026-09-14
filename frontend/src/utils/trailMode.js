// Whether planets leave a trail behind them on their orbit — a simple on/off,
// same shape as vizMode.js/scaleMode.js: a module singleton the render loop
// reads, not React state, since the scene effect must never re-run for it.
// Not persisted (matching vizMode.js, not driftControl.js) — this is a
// decorative view toggle in the same family as the gravity overlay, not a
// standing preference like drift rate. On by default, per request — every
// fresh visitor sees trails without having to find the toggle first.

let on = true;

const listeners = new Set();
const notify = () => listeners.forEach(fn => fn());

export const getTrailsOn = () => on;

export function setTrailsOn(next) {
    if (next === on) return;
    on = next;
    notify();
}

export function toggleTrails() {
    setTrailsOn(!on);
}

export function subscribeTrails(fn) {
    listeners.add(fn);
    return () => listeners.delete(fn);
}

/** Test seam. */
export function __resetTrails() {
    on = true;
    listeners.clear();
}
