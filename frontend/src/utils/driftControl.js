// How the view moves on its own when nobody is touching it.
//
// The scene has always drifted — a slow turntable spin with a hint of vertical
// sway. This exposes that as three axes the reader sets with sliders: yaw
// (the spin), pitch (a nod), roll (a lean). Each is a signed rate in -1..1 and
// runs indefinitely in whichever direction: pitch somersaults over the poles,
// roll spins right round, nothing reverses at a limit.
//
// A module singleton the render loop reads every frame — not React state, the
// scene effect must not re-run — and a taste setting, so it is persisted. The
// UI mirrors it with subscribeDrift, the way the other scene toggles do.

const STORAGE_KEY = 'p4rsec.drift';

/** The out-of-the-box drift: a gentle diagonal turntable, no roll. */
export const DRIFT_DEFAULTS = { yaw: 0.195, pitch: 0.143, roll: 0 };

/** Peak angular velocity each axis reaches at |slider| = 1, radians/second. */
export const DRIFT_MAX = { yaw: 0.04, pitch: 0.05, roll: 0.065 };

const AXES = ['yaw', 'pitch', 'roll'];
const clamp = (v) => (v < -1 ? -1 : v > 1 ? 1 : v);

function load() {
    try {
        const s = JSON.parse(window.localStorage.getItem(STORAGE_KEY));
        if (s && AXES.every(k => Number.isFinite(s[k]))) {
            return { yaw: clamp(s.yaw), pitch: clamp(s.pitch), roll: clamp(s.roll) };
        }
    } catch { /* fall through to defaults */ }
    return { ...DRIFT_DEFAULTS };
}

let axes = load();
const listeners = new Set();
const notify = () => listeners.forEach(fn => fn());

function persist() {
    try { window.localStorage.setItem(STORAGE_KEY, JSON.stringify(axes)); }
    catch { /* a preference we cannot save is still a preference */ }
}

/** The current slider values, `{ yaw, pitch, roll }` in -1..1. */
export const getDrift = () => axes;

/** Set one axis (-1..1, clamped). */
export function setDriftAxis(axis, value) {
    if (!AXES.includes(axis)) return;
    const next = clamp(Number(value) || 0);
    if (next === axes[axis]) return;
    axes = { ...axes, [axis]: next };
    persist();
    notify();
}

/** Back to DRIFT_DEFAULTS. */
export function resetDrift() {
    axes = { ...DRIFT_DEFAULTS };
    persist();
    notify();
}

/** Angular velocity per axis at the current settings, radians/second (signed). */
export const driftRates = () => ({
    yaw: axes.yaw * DRIFT_MAX.yaw,
    pitch: axes.pitch * DRIFT_MAX.pitch,
    roll: axes.roll * DRIFT_MAX.roll,
});

export function subscribeDrift(fn) {
    listeners.add(fn);
    return () => listeners.delete(fn);
}

/** Test seam. */
export function __resetDriftStore() {
    axes = { ...DRIFT_DEFAULTS };
    listeners.clear();
}
