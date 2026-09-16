import * as THREE from 'three';
import { magvar } from 'magvar';

// The phone's own compass + tilt, turned into the azimuth/altitude/roll the
// AR sky view aims its camera with — dragging's replacement, not a rival
// coordinate system. Everything downstream of getOrientationHeading() /
// getOrientationAltitude() is the same code a dragged heading already fed.
//
// ── One rotation, not three loose angles ─────────────────────────────────
//
// The whole module is built on a single idea: DeviceOrientationEvent's
// alpha/beta/gamma are a *decomposition* of one physical rotation, and the
// only safe thing to do with them is put them straight back together into
// that rotation and ask questions of it. Every earlier version of this file
// instead pulled heading out of one hand-derived trig expression, altitude
// out of a second (or out of the accelerometer entirely), and left roll on
// the floor — three answers that were separately plausible and jointly
// describing no orientation any phone could actually be in.
//
// The composition is the one the DeviceOrientation Event Specification
// defines, in the Earth frame it defines it in (x = east, y = north,
// z = up), as intrinsic Z-X'-Y'':
//
//     R = Rz(alpha) . Rx(beta) . Ry(gamma)          (device -> ENU)
//
// R's columns are where the device's own axes point: x = the right edge,
// y = the top edge, z = out through the screen. So the *back* camera — the
// one AR is looking through — faces device -z, and everything the view
// needs is read off R directly:
//
//     forward = R . (0, 0, -1)     where the camera points
//     screenUp = R . u_screen      which way is up on the glass
//
//     heading  = atan2(forward.east, forward.north)     (0=N, 90=E)
//     altitude = atan2(forward.up, |forward.horizontal|)
//     roll     = the spin of screenUp about forward (see rollFrom() below)
//
// `u_screen` is the top of the *screen* in device axes, which is the top of
// the device only while the page is portrait: `screen.orientation.angle`
// rotates it, the same compensation three.js's own (now removed)
// DeviceOrientationControls applied as a post-multiplied Z rotation.
//
// ── The bug this replaces, and why its tests agreed with it ──────────────
//
// The previous heading formula un-negated its east component relative to
// the matrix above, on the strength of a unit test asserting that alpha=90
// should read as heading 90. It should read 270. Alpha is a *counter*-
// clockwise rotation about the up axis (the spec's frame is right-handed
// with z up), and compass bearings run clockwise, so a flat or upright
// phone satisfies heading = 360 - alpha, not heading = alpha. Getting that
// backwards mirrors the entire sky across the north-south line: Orion sits
// where it would if you were facing the opposite way, and every attempt to
// chase it by flipping some *other* sign (5.3.4 through 5.3.13, most of
// which landed in the changelog) moved the error around without removing
// it. Four cardinal directions "agreeing" on the wrong answer is what a
// mirror looks like; it is not the corroboration it was read as.
//
// Altitude had a matching pair of problems — a formula that read flat-on-
// the-table as +90 (the back camera is on the underside; it faces the
// floor, so that is -90) and a literal `ALTITUDE_OFFSET = -180` bolted on
// top to cancel it. In the app's own default AR pose, phone upright and
// level, the two composed to a reported altitude of -180 degrees, which as
// a camera pitch means "looking at the horizon behind you, upside down."
// Both are gone: altitude is now asin(forward.up), and nothing is added to
// it.
//
// ── Why this is stable where beta/gamma were not ─────────────────────────
//
// A real-device report ("the scene tweaks out after pointing the phone all
// the way up", "can't do one complete revolution without it losing track")
// was correctly diagnosed as the Euler decomposition degenerating near
// beta = +/-90 — which is exactly the AR holding pose — and then fixed in
// the wrong place, by reaching for the accelerometer for altitude alone.
//
// The degeneracy is real but it is a property of the *representation*, not
// of the rotation. Near beta = +/-90 the browser can report wildly
// different (alpha, gamma) pairs for two physically identical attitudes,
// and any formula that reads either angle on its own inherits that noise —
// but the pairs are correlated, and R composed from them is the same
// rotation either way, to within sensor noise. Reassembling R first and
// only then extracting angles is what makes the singularity stop mattering,
// which is also why no confidence gate, pole freeze or heading-candidate
// flip survives in this file: those were all treatments for a symptom this
// formulation does not produce. (It is the same reason native ARCore/
// ARKit-style code reads a fused quaternion; the web just makes you
// reassemble it yourself on the WebKit side, where the Generic Sensor API's
// AbsoluteOrientationSensor has never shipped.)
//
// Smoothing follows from the same principle: the EMA now runs on the
// quaternion itself (slerp), not on three angles independently. Angles
// smoothed separately drift off the unit sphere in exactly the region where
// they disagree most — near the zenith, heading and roll each swing fast
// while the rotation they jointly describe barely moves — and the result
// wobbles. Slerping interpolates along the actual rotation, so a fast
// pass through the pole stays a fast pass through the pole.
//
// The accelerometer path is gone with it. Besides being unnecessary once
// the rotation is intact, `accelerationIncludingGravity` disagrees on sign
// between iOS and everything else, which the previous code had baked to one
// platform (see 5.3.2: fixed by flipping the sign against one real device,
// which silently inverted the other platform). One fewer sensor, one fewer
// permission prompt, one fewer convention to be wrong about.
//
// ── Absolute north, per platform ─────────────────────────────────────────
//
// Only alpha's *zero point* varies by platform, so that is the only thing
// treated per-platform here:
//
//   * Chrome/Android fires `deviceorientationabsolute`, whose alpha is
//     already earth-referenced. Nothing to correct.
//   * iOS Safari never sets the absolute flag and its alpha starts from
//     wherever the device happened to be pointing; what it does give is
//     `webkitCompassHeading`, a genuine magnetic bearing. Rather than
//     substituting that for the camera's heading (it is a bearing for one
//     device axis, not for wherever the camera points, so substituting it
//     is only right while the phone is upright), it is used to solve for
//     the constant `alphaOffset` that makes the *rotation* north-
//     referenced. The fast motion keeps coming from R; the compass only
//     anchors it, so it is smoothed over a much longer time constant.
//     Which device axis that bearing belongs to changes with tilt — iOS
//     reports for whichever of the device's top edge or back camera is
//     nearer horizontal, which is precisely why earlier versions saw it
//     "switch reference at 45 and 135 degrees" (the two axes are
//     orthogonal, so they swap over exactly there). solveAlphaOffset()
//     picks the same way, so the switch is a non-event rather than a
//     180-degree jump to be caught and undone.
//   * Anything else (plain `deviceorientation`, no absolute flag, no
//     webkitCompassHeading) has no north at all. The reading is used as-is
//     and the manual calibration offset is what makes that usable.
//
// Every one of those is *magnetic*, so the WMM declination correction
// (`magvar`, WMM 2025-2030, MIT, no runtime deps) still applies on top of
// all three. It uses the real current date, deliberately: the correction is
// for where the magnetometer physically is now, not for whatever date the
// star field has been scrubbed to. The model epoch needs revisiting after
// 2030.

const DEG2RAD = Math.PI / 180;
const RAD2DEG = 180 / Math.PI;

// Exponential-moving-average time constant, in milliseconds — how long the
// smoothed orientation takes to close roughly two-thirds of the gap to a new
// raw reading. Weighted by the *actual* elapsed time between samples rather
// than applied flat per event, because sensor events are not evenly spaced:
// real devices batch and throttle them under exactly the load this feature
// creates (camera passthrough plus WebGL plus sensor processing on one main
// thread), so the gap between two swings between a few milliseconds and
// several hundred. A flat per-event weight bakes in a different effective
// time constant every time that gap changes size — a burst lets raw noise
// through nearly undamped, a delivery gap leaves the average stranded and
// then needs several steps to claw back — which read as jumpiness and lag
// respectively. Time weighting collapses both into one fix.
const TAU_MS = 120;

// The compass anchor (iOS) is a constant being estimated, not a motion
// being tracked, so it is smoothed an order of magnitude slower than the
// rotation itself. Fast enough to settle within a couple of seconds, slow
// enough that a transient disagreement at iOS's own reference switch never
// visibly yaws the sky.
const OFFSET_TAU_MS = 2000;

const _euler = new THREE.Euler();
const _raw = new THREE.Quaternion();
const _forward = new THREE.Vector3();
const _screenUp = new THREE.Vector3();
const _topAxis = new THREE.Vector3();
const _up0 = new THREE.Vector3();
const _right0 = new THREE.Vector3();

/** The smoothed device -> ENU rotation: the one piece of real state here. */
const orientation = new THREE.Quaternion();

let heading = 0;     // magnetic heading of the camera axis, degrees, derived
let altitude = 0;    // degrees above the horizon, derived
let roll = 0;        // degrees of screen spin about the camera axis, derived
let smoothed = false;   // false until the first real sample seeds the rotation
let lastSampleAt = 0;   // ms, same clock as event.timeStamp — see timeWeight()

let alphaOffset = 0;      // degrees to subtract from a derived heading (iOS)
let alphaOffsetReady = false;

let calibrationAz = 0;  // manual correction, added on top of the sensor reading
let calibrationAlt = 0;

let declinationDeg = 0; // magnetic -> true north, for the observer's location
let declinationLat = null;
let declinationLon = null;

let tracking = false;
let receivedAbsolute = false; // once true, the plain listener defers to it
let sourceIsAbsolute = false; // whether the reading currently in use is earth-referenced

const listeners = new Set();
const notify = () => listeners.forEach(fn => fn());

function norm360(deg) {
    return ((deg % 360) + 360) % 360;
}

// Shortest-angle delta — the same trick NightSky3D.jsx's own startPanTo uses
// for its eased constellation pan. Smoothing a compass bearing with a plain
// lerp snaps the long way around the 0/360 seam half the time (350 -> 10
// would "smooth" through 180 instead of through 0).
function shortestDelta(from, to) {
    return (((to - from) % 360) + 540) % 360 - 180;
}

/** Wall-clock ms, same clock a real event's own timeStamp uses (both are
 *  DOMHighResTimeStamps) — the fallback for the (test-only) fixtures that
 *  don't carry one. */
function now() {
    return typeof performance !== 'undefined' && typeof performance.now === 'function'
        ? performance.now()
        : Date.now();
}

/**
 * EMA weight for a sample arriving `dt` ms after the last one, given time
 * constant `tauMs` — the continuous-time exponential-smoothing formula, so
 * the *rate* of convergence stays the same however irregularly samples
 * actually arrive (see TAU_MS's own header for why that matters here).
 * dt <= 0 (a malformed or out-of-order timestamp) returns 0: no movement,
 * rather than letting a negative dt invert the exponent into a weight
 * greater than 1 and overshoot the target.
 */
function timeWeight(dt, tauMs) {
    return dt > 0 ? 1 - Math.exp(-dt / tauMs) : 0;
}

/**
 * How far the page's layout has been rotated away from the device's natural
 * orientation, in degrees. Only this decides where "up the screen" is in
 * device axes, which is the only thing screen rotation changes for us — the
 * back camera points out of the same physical face either way.
 */
function screenAngle() {
    if (typeof window === 'undefined') return 0;
    const a = window.screen?.orientation?.angle;
    if (Number.isFinite(a)) return a;
    // Pre-16.4 Safari, and anything else without the Screen Orientation API.
    return Number.isFinite(window.orientation) ? window.orientation : 0;
}

/**
 * The spec's device -> ENU rotation, Rz(alpha) . Rx(beta) . Ry(gamma), as a
 * quaternion. three.js's Euler order string is the matrix multiplication
 * order left to right, so 'ZXY' with (x=beta, y=gamma, z=alpha) is exactly
 * that product — the same composition three.js's own DeviceOrientationControls
 * expressed as `euler.set(beta, alpha, -gamma, 'YXZ')` in a Y-up/Z-south
 * world, relabelled into the frame the spec itself uses.
 */
function rotationFrom(alphaDeg, betaDeg, gammaDeg, out) {
    _euler.set(betaDeg * DEG2RAD, gammaDeg * DEG2RAD, alphaDeg * DEG2RAD, 'ZXY');
    return out.setFromEuler(_euler);
}

/** Compass bearing (0=N, 90=E) of an ENU vector's horizontal part. */
function bearingOf(v) {
    return norm360(Math.atan2(v.x, v.y) * RAD2DEG);
}

/**
 * Degrees of screen spin about the camera axis, measured from the upright
 * hold — what has to be applied as the camera's own Z rotation for the
 * rendered sky to stay glued to the camera image when the phone is tilted.
 *
 * Derived, rather than taken as "gamma", from the two vectors that actually
 * matter: where up-the-screen points (`up`) versus where it *would* point at
 * this same heading and altitude with the phone held level. That reference
 * pair is built from the heading/altitude being reported rather than from
 * the world's up axis, which is what keeps this finite at the zenith: the
 * two ill-conditioned quantities there are heading and roll, and building
 * the reference from the same (possibly arbitrary) heading makes roll absorb
 * exactly the error heading introduced, leaving the composed camera
 * orientation right either way.
 */
function rollFrom(up, headingDeg, altitudeDeg) {
    const h = headingDeg * DEG2RAD;
    const a = altitudeDeg * DEG2RAD;
    const sinH = Math.sin(h); const cosH = Math.cos(h);
    const sinA = Math.sin(a); const cosA = Math.cos(a);
    _up0.set(-sinH * sinA, -cosH * sinA, cosA);
    _right0.set(cosH, -sinH, 0);
    return Math.atan2(-up.dot(_right0), up.dot(_up0)) * RAD2DEG;
}

/**
 * The correction that turns iOS's arbitrary alpha zero into true magnetic
 * north, as degrees to subtract from a bearing derived from the rotation.
 *
 * `webkitCompassHeading` is a bearing for one device axis, and which axis
 * changes with tilt: iOS reports for whichever of the device's top edge or
 * its back camera is nearer horizontal (a compass held flat reads off its
 * top edge; held up to look through, off its camera). Picking the same way
 * here makes the handover a non-event — of two orthogonal axes at least one
 * always has a horizontal component of 1/sqrt(2) or better, so there is no
 * degenerate case to guard, and near the crossover the two bearings agree
 * anyway.
 */
function solveAlphaOffset(camAxis, topAxis, webkitHeading) {
    const camFlat = Math.hypot(camAxis.x, camAxis.y);
    const topFlat = Math.hypot(topAxis.x, topAxis.y);
    const axis = camFlat >= topFlat ? camAxis : topAxis;
    return shortestDelta(0, bearingOf(axis) - webkitHeading);
}

/**
 * The shared event handler, exercised directly by tests (see
 * __injectOrientationEvent) so a fixture can be a plain object rather than
 * a real DeviceOrientationEvent — jsdom has no meaningful support for
 * constructing or dispatching those. Returns whether the event actually had
 * usable data (onAbsoluteEvent uses this to decide whether the absolute
 * stream has proven itself yet, rather than latching onto an empty event).
 */
function handleOrientation(event, isAbsolute) {
    const hasAlpha = Number.isFinite(event.alpha);
    const hasBeta = Number.isFinite(event.beta);
    const hasGamma = Number.isFinite(event.gamma);
    const hasWebkitHeading = typeof event.webkitCompassHeading === 'number'
        && !Number.isNaN(event.webkitCompassHeading);

    // A genuinely empty event — seen firing periodically from headless
    // Chrome's own virtual-sensor emulation, as both deviceorientationabsolute
    // and plain deviceorientation, independent of any override actually set —
    // carries no reading at all. Defaulting one missing axis to 0 is a
    // reasonable fallback for a partial sample; defaulting all three at once
    // would silently process a "nothing to report" event as "phone lying
    // flat, facing north" (beta=gamma=alpha=0), which is a real, wrong
    // physical claim: it points the camera straight down through the floor.
    if (!hasAlpha && !hasBeta && !hasGamma && !hasWebkitHeading) return false;

    const alpha = hasAlpha ? event.alpha : 0;
    const beta = hasBeta ? event.beta : 0;
    const gamma = hasGamma ? event.gamma : 0;

    // Whether or not this particular event is flagged absolute, the rotation
    // is built the same way — isAbsolute only records how much the result
    // should be trusted (surfaced via isOrientationAbsolute(), for a future
    // "compass may be inaccurate" affordance). webkitCompassHeading counts as
    // trustworthy on its own, independent of the flag: iOS never sets the
    // flag at all, but the bearing itself is real.
    sourceIsAbsolute = isAbsolute || hasWebkitHeading;

    rotationFrom(alpha, beta, gamma, _raw);

    // event.timeStamp on a real DeviceOrientationEvent is a
    // DOMHighResTimeStamp already on the same clock as performance.now() —
    // preferred over reading the clock fresh here, since that would also
    // include however long the event sat queued before this handler ran.
    // Test fixtures can set it explicitly to get a deterministic dt; the
    // now() fallback is for the ones that don't bother, which mostly means
    // "however little real time the test itself took."
    const sampleAt = Number.isFinite(event.timeStamp) ? event.timeStamp : now();
    const dt = sampleAt - lastSampleAt;

    if (!smoothed) {
        orientation.copy(_raw);
        smoothed = true;
    } else {
        orientation.slerp(_raw, timeWeight(dt, TAU_MS));
    }

    _forward.set(0, 0, -1).applyQuaternion(orientation);
    const screenRad = screenAngle() * DEG2RAD;
    _screenUp.set(Math.sin(screenRad), Math.cos(screenRad), 0).applyQuaternion(orientation);

    const rawHeading = bearingOf(_forward);
    altitude = Math.atan2(_forward.z, Math.hypot(_forward.x, _forward.y)) * RAD2DEG;
    roll = rollFrom(_screenUp, rawHeading, altitude);

    if (hasWebkitHeading) {
        _topAxis.set(0, 1, 0).applyQuaternion(orientation);
        const target = solveAlphaOffset(_forward, _topAxis, norm360(event.webkitCompassHeading));
        if (!alphaOffsetReady) {
            alphaOffset = target;
            alphaOffsetReady = true;
        } else {
            alphaOffset += shortestDelta(alphaOffset, target) * timeWeight(dt, OFFSET_TAU_MS);
        }
    }
    heading = norm360(rawHeading - alphaOffset);

    // Never lets the clock run backward: an out-of-order or clock-skewed
    // timestamp earlier than the last accepted one already produced a weight
    // of 0 above (no movement), and letting it overwrite lastSampleAt too
    // would inflate the *next* real sample's dt by whatever gap this one
    // opened up, double-counting the same anomaly.
    lastSampleAt = Math.max(lastSampleAt, sampleAt);
    notify();
    return true;
}

function onAbsoluteEvent(event) {
    // Only latch receivedAbsolute (which shuts out the plain listener below)
    // once an absolute event has actually supplied usable data. Headless
    // Chrome's own virtual-sensor emulation dispatches an empty
    // deviceorientationabsolute (alpha/beta/gamma all null) as the very
    // first event after an override is set, before real values follow on
    // later ones — a version of this function that latched on any absolute
    // event's mere arrival shut out the plain deviceorientation listener
    // that was about to start carrying the real data, permanently. Caught
    // by a CDP script capturing actually-dispatched events rather than
    // assuming the API's behaviour from its name.
    if (handleOrientation(event, true)) receivedAbsolute = true;
}

function onRelativeEvent(event) {
    // Chrome/Android fire both deviceorientationabsolute and a plain
    // deviceorientation for the same physical sample; once the absolute
    // stream has proven itself, the redundant plain one is just noise.
    if (receivedAbsolute) return;
    handleOrientation(event, event.absolute === true);
}

/** True on iOS 13+ Safari, where orientation data is gated behind an
 *  explicit, gesture-triggered permission prompt. False (nothing to ask)
 *  everywhere else, including desktop browsers that lack the API outright —
 *  arSupport.js's isArViewerSupported() is what gates whether AR mode is
 *  offered at all; this only decides whether an extra prompt is needed. */
export function needsOrientationPermission() {
    return typeof window !== 'undefined'
        && typeof window.DeviceOrientationEvent?.requestPermission === 'function';
}

/**
 * The actual permission-requesting call — must run inside a direct user
 * gesture handler on iOS. Resolves true when orientation tracking can
 * proceed (either granted, or nothing needed to ask in the first place).
 * One prompt, for one API: the separate DeviceMotionEvent grant this used to
 * ask for alongside it went away with the accelerometer path (see the module
 * header).
 */
export async function requestDeviceOrientationPermission() {
    if (!needsOrientationPermission()) return true;
    try {
        return (await window.DeviceOrientationEvent.requestPermission()) === 'granted';
    } catch {
        return false;
    }
}

export function startDeviceOrientationTracking() {
    if (tracking || typeof window === 'undefined') return;
    tracking = true;
    smoothed = false;
    receivedAbsolute = false;
    alphaOffset = 0;
    alphaOffsetReady = false;
    window.addEventListener('deviceorientationabsolute', onAbsoluteEvent);
    window.addEventListener('deviceorientation', onRelativeEvent);
}

export function stopDeviceOrientationTracking() {
    if (!tracking) return;
    tracking = false;
    window.removeEventListener('deviceorientationabsolute', onAbsoluteEvent);
    window.removeEventListener('deviceorientation', onRelativeEvent);
}

/** Recomputes declination only when the location actually changes — cheap,
 *  but no reason to redo the lookup every frame. Fails safe to "no
 *  correction" (0) rather than throwing, since a bad/out-of-range input
 *  should degrade to magnetic-only heading, not break AR mode outright. */
export function setDeclinationLocation(lat, lon) {
    if (lat === declinationLat && lon === declinationLon) return;
    declinationLat = lat;
    declinationLon = lon;
    try {
        const d = magvar(lat, lon);
        declinationDeg = Number.isFinite(d) ? d : 0;
    } catch {
        declinationDeg = 0;
    }
}

/** True heading of the camera axis: magnetic + declination + the manual
 *  calibration offset, in this app's own azimuth convention (0=N, 90=E,
 *  clockwise) — ready to hand straight to setLookDirection(). */
export function getOrientationHeading() {
    return norm360(heading + declinationDeg + calibrationAz);
}

/** Degrees above the horizon, calibration-adjusted: -90 at your feet, 0 at
 *  the horizon, +90 at the zenith. Never wraps past either end — the camera
 *  axis cannot point more than straight up. */
export function getOrientationAltitude() {
    return altitude + calibrationAlt;
}

/** Degrees the phone is rolled about the axis it is looking along, so the
 *  rendered sky can stay glued to the camera image rather than only lining
 *  up while the phone is held perfectly upright. Positive spins the camera's
 *  own up vector anticlockwise on screen, which is what
 *  `camera.rotation.z` under three.js's 'YXZ' order wants. */
export function getOrientationRoll() {
    return roll;
}

/** Whether the heading currently in use is earth-referenced (Chrome/Android
 *  deviceorientationabsolute, or iOS's webkitCompassHeading) rather than the
 *  best-effort relative-alpha fallback. Not wired into any UI yet — a hook
 *  for a future "compass may be inaccurate" affordance, not required for
 *  the sensor pipeline itself to work. */
export function isOrientationAbsolute() {
    return sourceIsAbsolute;
}

/** The arrow-keys-in-AR-mode handler: nudges the correction on top of the
 *  sensor reading rather than the reading itself, since the sensor fires far
 *  more often than a key press and would otherwise overwrite a raw nudge on
 *  the very next event. */
export function nudgeCalibrationOffset(dAz, dAlt) {
    calibrationAz = norm360(calibrationAz + dAz);
    calibrationAlt += dAlt;
    notify();
}

/** What NightSkyPanel's "Look north" button resets in AR mode — resetting
 *  azimuth/altitude directly would be a no-op there, immediately overwritten
 *  by the next sensor event, so "look north" means "trust the sensor again"
 *  instead. */
export function resetCalibrationOffset() {
    calibrationAz = 0;
    calibrationAlt = 0;
    notify();
}

export function subscribeDeviceOrientation(fn) {
    listeners.add(fn);
    return () => listeners.delete(fn);
}

/** Test seam: feed a plain fixture object through the real handler, as if
 *  it were a genuine deviceorientation/deviceorientationabsolute event —
 *  jsdom cannot meaningfully construct or dispatch the real thing. */
export function __injectOrientationEvent(event, { absolute = false } = {}) {
    if (absolute) onAbsoluteEvent(event);
    else onRelativeEvent(event);
}

/** Test seam. */
export function __resetDeviceOrientation() {
    orientation.identity();
    heading = 0;
    altitude = 0;
    roll = 0;
    smoothed = false;
    lastSampleAt = 0;
    alphaOffset = 0;
    alphaOffsetReady = false;
    calibrationAz = 0;
    calibrationAlt = 0;
    declinationDeg = 0;
    declinationLat = null;
    declinationLon = null;
    tracking = false;
    receivedAbsolute = false;
    sourceIsAbsolute = false;
    listeners.clear();
}
