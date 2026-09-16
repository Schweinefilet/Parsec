// How the view moves on its own when nobody is touching it.
//
// The scene has always drifted — a slow turntable spin with a hint of vertical
// sway. This exposes that as two axes the reader sets with sliders: yaw (the
// spin) and pitch (a nod). Each is a signed rate in -1..1 and runs
// indefinitely in whichever direction; the scene keeps pitch inside a band
// around the equator rather than letting it somersault (see below).
//
// A module singleton the render loop reads every frame — not React state, the
// scene effect must not re-run — and a taste setting, so it is persisted. The
// UI mirrors it with subscribeDrift, the way the other scene toggles do.
//
// ── There used to be a third axis, and it was a bug ──────────────────────
//
// Roll (a lean about the view axis) was a slider here until 5.5.0. It is gone
// on request, and it was also load-bearing for a real defect: the scene keeps
// the horizon level by rolling the camera back toward world-up whenever the
// roll slider sits centred, which is where it sat for everyone who never
// touched it. Pitch drifting "indefinitely" meant the camera eventually
// somersaulted over a pole — about four minutes at the default 0.143, which
// is exactly the "left idle for long enough" in the report — and a camera
// that has just been carried over the pole is upside down relative to world
// up. The levelling correction then saw a ~180 degree error and drove at it,
// spinning the whole scene; past the pole the yaw axis has flipped too, so
// the tumble fed itself instead of settling. Removing the slider is half the
// fix; the scene's own pitch band (a pendulum that turns around before the
// pole, at a rate already eased to nothing) is the other half, and either one
// alone would leave the other failure reachable.

const STORAGE_KEY = 'p4rsec.drift';

/** The out-of-the-box drift: a gentle diagonal turntable. */
export const DRIFT_DEFAULTS = { yaw: 0.195, pitch: 0.143 };

/** Peak angular velocity each axis reaches at |slider| = 1, radians/second. */
export const DRIFT_MAX = { yaw: 0.04, pitch: 0.05 };

const AXES = ['yaw', 'pitch'];
const clamp = (v) => (v < -1 ? -1 : v > 1 ? 1 : v);

function load() {
    try {
        const s = JSON.parse(window.localStorage.getItem(STORAGE_KEY));
        // Reads only the axes that still exist, so a `roll` left in storage by
        // a version that had one is ignored rather than treated as corrupt —
        // the yaw/pitch a reader had set are still theirs.
        if (s && AXES.every(k => Number.isFinite(s[k]))) {
            return { yaw: clamp(s.yaw), pitch: clamp(s.pitch) };
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

/** The current slider values, `{ yaw, pitch }` in -1..1. */
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
});

// ── The pitch band ───────────────────────────────────────────────────────
//
// Pitch is a pendulum, not a somersault (see the header). The scene owns the
// vectors; this owns the decision, so the rule that keeps the camera away
// from the poles is pinned by tests rather than living only inside a render
// loop nothing can call.
//
// PITCH_LIMIT is sin(elevation), so 0.94 is a little over 70° — a wide margin
// both from the degenerate "level is undefined looking straight down" case
// and from the much earlier point where the roll corrector starts making
// large corrections at all. PITCH_EASE, about 50°, is where slowing begins,
// so the turnaround is a long glide rather than a bounce.
export const PITCH_LIMIT = 0.94;
export const PITCH_EASE = 0.77;

/**
 * One frame of the pitch pendulum.
 *
 * @param {number} sinElev  the camera's elevation above the target's
 *   equatorial plane, as a sine — the scene reads this straight off the
 *   normalised target→camera vector's Y.
 * @param {number} elevPerRad  how sinElev changes per radian of positive
 *   pitch rotation. The scene passes `-cameraUp.y`: rotating the view vector
 *   about the camera's right axis moves it toward -up.
 * @param {number} rate  the unbanded rate this frame would apply, rad/s.
 * @param {number} dir  +1 or -1, which way the pendulum is currently swinging.
 * @returns {{rate: number, dir: number}} the rate to actually apply and the
 *   direction to carry into the next frame.
 */
export function pitchPendulum(sinElev, elevPerRad, rate, dir) {
    const moving = elevPerRad * rate * dir;
    // Heading back toward the equator is always free: the band exists to stop
    // the camera leaving, never to stop it coming home.
    if (moving * sinElev <= 0) return { rate: rate * dir, dir };

    const away = Math.abs(sinElev);
    const taper = clamp01((PITCH_LIMIT - away) / (PITCH_LIMIT - PITCH_EASE));
    // Turn around just inside the limit rather than at it: the taper makes
    // the approach asymptotic, so a threshold sitting exactly on the limit
    // would never be crossed and pitch would simply stop there instead of
    // swinging back.
    const next = away > PITCH_LIMIT * 0.995 ? -dir : dir;
    return { rate: rate * next * taper, dir: next };
}

function clamp01(v) {
    return v < 0 ? 0 : v > 1 ? 1 : v;
}

export function subscribeDrift(fn) {
    listeners.add(fn);
    return () => listeners.delete(fn);
}

/** Test seam. */
export function __resetDriftStore() {
    axes = { ...DRIFT_DEFAULTS };
    listeners.clear();
}
