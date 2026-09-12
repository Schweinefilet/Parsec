// Display preferences for the night-sky scene — a taste setting, so it is
// persisted, the same shape as driftControl.js: a module singleton the
// render loop reads every frame (not React state, the scene effect must not
// re-run), with a subscribe so the settings drawer's own controls stay in
// sync without owning the value themselves.
//
// Three settings:
//   linesVisible  — the constellation figures, on by default.
//   twinkle       — on by default, but only takes effect where the device
//                   tier and prefers-reduced-motion already allow it (see
//                   NightSky3D.jsx) — this is a preference within that
//                   ceiling, not a way to force twinkle on for someone who
//                   asked their OS to reduce motion.
//   density       — 0..1, "how much light pollution": scales how many of the
//                   tier's star budget actually show, brightest first (the
//                   catalog is already sorted that way — see
//                   build-sky-catalog.mjs), so turning it down doesn't
//                   change *which* stars are visible, only how many.

const STORAGE_KEY = 'p4rsec.nightSky';

const DEFAULTS = { linesVisible: true, twinkle: true, density: 1 };

function load() {
    try {
        const s = JSON.parse(window.localStorage.getItem(STORAGE_KEY));
        if (s && typeof s.linesVisible === 'boolean' && typeof s.twinkle === 'boolean'
            && Number.isFinite(s.density)) {
            return { linesVisible: s.linesVisible, twinkle: s.twinkle, density: clamp01(s.density) };
        }
    } catch { /* fall through to defaults */ }
    return { ...DEFAULTS };
}

const clamp01 = (v) => (v < 0 ? 0 : v > 1 ? 1 : v);

let settings = load();
const listeners = new Set();
const notify = () => listeners.forEach(fn => fn());

function persist() {
    try { window.localStorage.setItem(STORAGE_KEY, JSON.stringify(settings)); }
    catch { /* a preference we cannot save is still a preference for this session */ }
}

/** The current settings, `{ linesVisible, twinkle, density }`. */
export const getNightSkySettings = () => settings;

export function setLinesVisible(value) {
    if (value === settings.linesVisible) return;
    settings = { ...settings, linesVisible: !!value };
    persist();
    notify();
}

export function setTwinkleEnabled(value) {
    if (value === settings.twinkle) return;
    settings = { ...settings, twinkle: !!value };
    persist();
    notify();
}

export function setStarDensity(value) {
    const next = clamp01(Number(value));
    if (next === settings.density) return;
    settings = { ...settings, density: next };
    persist();
    notify();
}

export function resetNightSkySettings() {
    settings = { ...DEFAULTS };
    persist();
    notify();
}

export function subscribeNightSkySettings(fn) {
    listeners.add(fn);
    return () => listeners.delete(fn);
}

/** Test seam. */
export function __resetNightSkySettingsStore() {
    settings = { ...DEFAULTS };
    listeners.clear();
}
