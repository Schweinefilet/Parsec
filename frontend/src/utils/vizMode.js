// The gravity overlay: off, the warped grid, or the field lines.
//
// Same shape as scaleMode.js — a module singleton the render loop reads every
// frame, with an eased weight per layer so switching crossfades instead of
// cutting. Not React state: the scene effect must never re-run, and a 380ms
// fade is not twenty-three renders. The UI mirrors the value into local state
// via subscribeViz, the way the scale toggle does.

export const VIZ_OFF = 0;
export const VIZ_GRID = 1;
export const VIZ_FIELD = 2;

const ORDER = [VIZ_OFF, VIZ_GRID, VIZ_FIELD];
const FADE_MS = 380;

let mode = VIZ_OFF;

// One eased weight per drawable layer (the grid, the lines). `from`/`to`/`at`
// is a tiny tween: reversing mid-fade re-reads the current value as the new
// `from`, so a fast off→grid→field never jumps.
const grid = { from: 0, to: 0, at: -Infinity };
const field = { from: 0, to: 0, at: -Infinity };

const listeners = new Set();
const notify = () => listeners.forEach(fn => fn());
const clamp01 = (t) => (t < 0 ? 0 : t > 1 ? 1 : t);
const ease = (t) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);

function weightNow(layer, now) {
    return layer.from + (layer.to - layer.from) * ease(clamp01((now - layer.at) / FADE_MS));
}

/** VIZ_OFF | VIZ_GRID | VIZ_FIELD — the selected mode, not the fade state. */
export const getVizMode = () => mode;

/** 0..1 opacity for VIZ_GRID or VIZ_FIELD right now, easing across a switch. */
export function vizWeight(layer, now = Date.now()) {
    return weightNow(layer === VIZ_GRID ? grid : field, now);
}

/** True while a crossfade is still running. */
export const isVizSettling = (now = Date.now()) =>
    now < Math.max(grid.at, field.at) + FADE_MS;

export function setVizMode(next, now = Date.now()) {
    if (next === mode) return;
    mode = next;
    for (const [id, layer] of [[VIZ_GRID, grid], [VIZ_FIELD, field]]) {
        layer.from = weightNow(layer, now);
        layer.to = mode === id ? 1 : 0;
        layer.at = now;
    }
    notify();
}

/** Off → grid → field → off. What the toolbar pill does. */
export function cycleVizMode() {
    setVizMode(ORDER[(ORDER.indexOf(mode) + 1) % ORDER.length]);
}

export function subscribeViz(fn) {
    listeners.add(fn);
    return () => listeners.delete(fn);
}

/** Test seam. */
export function __resetViz() {
    mode = VIZ_OFF;
    grid.from = grid.to = field.from = field.to = 0;
    grid.at = field.at = -Infinity;
    listeners.clear();
}
