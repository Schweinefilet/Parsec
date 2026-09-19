// The hand-off from the solar-system scene into /satellites: fly to the ISS,
// hold on it, then pull back until Earth fills the frame at exactly the size
// the tracker's own globe draws it — and cross-fade the two together.
//
// Same reasoning as utils/skyEntry.js: two scenes share one sequence across a
// route change that unmounts one of them, so the state is a module singleton
// rather than React state. SolarSystem3D.jsx owns the camera work (the one
// place with Earth's live matrixWorld), TrackerHandoff.jsx owns the cut, and
// SatelliteGlobe.jsx reads the arrival pose on the far side. Neither end
// needs the other's internals, only these phases.
//
// Where this differs from the sky dive, and why it can cross-fade instead of
// fading through black: /sky changes subject, so there is nothing to match
// and a curtain is the honest answer. Here both sides are drawing the same
// lit sphere, so the cut can be between two frames that are genuinely the
// same picture. Three things have to line up for that, and all three are
// arranged rather than hoped for:
//
//   1. Size. The globe frames Earth across a fixed fraction of its vertical
//      field of view; FRAME_FRACTION is that number, and the solar scene
//      solves its own distance for the same fraction at its own fov. See
//      handoffDistance().
//   2. Orientation. Both scenes put the sub-solar point (utils/subsolar.js)
//      at the centre of the frame — the globe by aiming there, the solar
//      scene by turning Earth so that point faces its own Sun and flying the
//      camera down the sun line. Same ground, same continents, and the
//      terminator lands on the limb in both.
//   3. Roll. Both put Earth's north pole at screen-up.
//
// What is left over is the last rendered frame of the solar scene, captured
// at the moment the pose is reached and handed over as a still for the
// tracker page to cross-fade out from underneath its own globe. A snapshot
// rather than two live canvases: keeping SolarSystem3D mounted across the
// swap would mean a second WebGL context and a routing change, for a beat
// that lasts a third of a second and is a dissolve between two still-matching
// images anyway.

export const IDLE = 'idle';
export const ARMED = 'armed';        // click landed; navigating to /object/iss
export const APPROACHING = 'approaching'; // the scene has it: holding on the ISS, then pulling back
export const HANDOFF = 'handoff';    // pose reached, frame captured — TrackerHandoff navigates
export const SETTLING = 'settling';  // on /satellites: the globe is full-bleed, easing into its card

// What fraction of the viewport's vertical field of view Earth's disc spans
// at the hand-off. Read off SatelliteGlobe's own framing — a 38° camera at
// 3.89 Earth radii — so the tracker page keeps the composition it already
// had, and the solar scene is the side that solves for it.
export const FRAME_FRACTION = 0.784;

/** Camera distance, in Earth radii, that frames the disc across FRAME_FRACTION of a `fovDeg` camera. */
export function handoffDistance(fovDeg) {
    const half = (FRAME_FRACTION * fovDeg * Math.PI) / 360;
    return 1 / Math.sin(half);
}

// Longer than skyEntry's: this sequence waits on the ISS fly-in, which at
// true sizes is the app's slowest (SolarSystem3D's focusFlySeconds is 2.4s
// there), then a hold and a pull-back on top.
const WATCHDOG_MS = 11000;

let phase = IDLE;
let snapshot = null;   // dataURL of the solar scene's last frame, or null
let satId = null;      // which craft /satellites should open on
let globeReady = false;
let watchdog = null;

const listeners = new Set();
const notify = () => listeners.forEach(fn => fn());

function clearWatchdog() {
    if (watchdog !== null) { clearTimeout(watchdog); watchdog = null; }
}

/**
 * Starts the sequence. A no-op while one is already in flight.
 * `sat` is the craft to open the tracker on, or null for its own default.
 */
export function armTrackerEntry(sat = null) {
    if (phase !== IDLE) return;
    satId = sat;
    snapshot = null;
    globeReady = false;
    phase = ARMED;
    clearWatchdog();
    watchdog = setTimeout(() => {
        // Same failsafe as skyEntry's: if the scene never picks the flag up —
        // no ISS mesh, a stalled mount, an edge case that isn't a plain
        // refocus-away — still land the visitor on the tracker rather than
        // stranding the click that asked for it.
        if (phase !== IDLE && phase !== HANDOFF && phase !== SETTLING) setTrackerPhase(HANDOFF);
    }, WATCHDOG_MS);
    notify();
}

export const getTrackerPhase = () => phase;
export const getTrackerSnapshot = () => snapshot;
export const getTrackerSatId = () => satId;

/** True while the tracker page should mount in its arrival state rather than its resting one. */
export const isTrackerArriving = () => phase === HANDOFF || phase === SETTLING;

/** SolarSystem3D hands the captured frame over with the pose it was captured at. */
export function setTrackerSnapshot(dataUrl) {
    snapshot = dataUrl;
}

export function setTrackerPhase(next) {
    if (next === phase) return;
    phase = next;
    if (next === IDLE) { snapshot = null; satId = null; globeReady = false; clearWatchdog(); }
    notify();
}

/**
 * Whether the tracker's globe has drawn a frame worth cross-fading to.
 *
 * The cut is a dissolve between two pictures of the same thing, which only
 * works if the second one exists. Earth's textures are the same files the
 * solar scene just used, so they come from cache — but "from cache" is still
 * a decode away, and starting the dissolve before it lands would fade a
 * matched frame into a black sphere. SatelliteGlobe raises this the frame
 * after its day map is applied; TrackerHandoff waits on it, with its own
 * timeout in case it never comes.
 */
export const isTrackerGlobeReady = () => globeReady;

export function markTrackerGlobeReady() {
    if (globeReady) return;
    globeReady = true;
    notify();
}

/** Cancels an in-flight sequence — refocused away, or the scene unmounted mid-flight. */
export function resetTrackerEntry() {
    setTrackerPhase(IDLE);
}

export function subscribeTracker(fn) {
    listeners.add(fn);
    return () => listeners.delete(fn);
}

/** Test seam. */
export function __resetTrackerEntry() {
    phase = IDLE;
    snapshot = null;
    satId = null;
    globeReady = false;
    clearWatchdog();
    listeners.clear();
}
