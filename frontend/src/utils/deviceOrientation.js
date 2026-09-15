import { magvar } from 'magvar';

// The phone's own compass + tilt, turned into the same azimuth/altitude
// utils/skyRotation.js already accepts from a drag — this is AR mode's
// input, dragging's replacement, not a rival coordinate system. Everything
// downstream of getOrientationHeading()/getOrientationAltitude() is
// unchanged: setLookDirection(), applyLook(), the crosshair constellation
// lookup, all of it already worked for a dragged heading and don't know or
// care that this one came from a sensor instead.
//
// ── Signal priority ──────────────────────────────────────────────────────
//
// Three possible sources for a MAGNETIC heading, tried in order:
//
//   1. `webkitCompassHeading` — iOS Safari's own pre-computed heading, sent
//      alongside a plain `deviceorientation` event. Already screen-
//      orientation-compensated by iOS itself, already in this app's own
//      convention (0=N, 90=E, clockwise) — used directly, never re-derived
//      from alpha/beta/gamma on this path. Confirmed via Apple's own
//      documentation to be relative to *magnetic* north, not true north
//      (unlike its name might suggest), so it still needs the same
//      declination correction as the other two sources below.
//   2. `deviceorientationabsolute` (Chrome/Android) — already
//      earth-referenced; alpha here is trustworthy, so heading comes from
//      the Euler-angle formula below fed with this event's own alpha.
//   3. Plain `deviceorientation` with no absolute flag and no
//      webkitCompassHeading — alpha here is only relative to wherever the
//      sensor happened to be pointed when tracking started, not to
//      magnetic north at all. Used anyway as a best-effort source (the
//      alternative is no heading whatsoever), leaning on the manual
//      calibration-offset drag (see nudgeCalibrationOffset) to absorb
//      whatever the result is off by.
//
// ── The Euler-angle formula ──────────────────────────────────────────────
//
// Not re-derived by hand from Wikipedia trig — sign/axis errors are exactly
// the kind of bug that only shows up with a real device in hand, and there
// is no substitute here (see the module's own tests: they pin the *logic*,
// not whether it points at the real sky). This is the rotation-matrix
// construction the DeviceOrientation Event Specification's own non-
// normative appendix gives for device-frame -> Earth-frame (Earth frame:
// x=East, y=North, z=up), the same lineage three.js's now-removed
// DeviceOrientationControls.js and most other "hold the phone up" demos
// build on — but NOT trusted at face value; see the note below on what
// changed after testing:
//
//   Earth.x (East)  =  cos(a)sin(g) + cos(g)sin(a)sin(b)
//   Earth.y (North) = -(sin(a)sin(g) - cos(a)cos(g)sin(b))
//   Earth.z (Up)    = -(cos(b)cos(g))
//
// (a=alpha, b=beta, g=gamma, all radians). This is close to, but not
// exactly, "column 3 of the device->Earth rotation matrix, negated" — the
// derivation that motivated the North and Up signs (the back camera looks
// out -Z in the device's own frame, so the matrix's third column, which
// transforms +Z, gets negated throughout). A first pass negated East the
// same uniform way and the unit tests below caught it immediately: alpha
// 0/180 (N/S) came out right but 90/270 (E/W) came out swapped — a mirror
// across the N/S axis, not a random bug, which is what a lopsided
// East-only sign error looks like. Dropping the negation on East alone
// (keeping it on North and Up) makes all four cardinal directions agree at
// once; four independent points landing on the fix is a much stronger
// signal than the original derivation's own internal algebra was.
//
// heading  = atan2(Earth.x, Earth.y), the compass convention (0=N, 90=E)
// altitude = asin(Earth.z)  — note this has NO alpha term at all, so it is
//            identical regardless of which heading source above is used,
//            and unaffected by alpha being unreliable on the relative-only
//            path.
//
// Verified against hand-worked special cases before trusting it: beta=90°
// (phone held vertical, "magic window" position) + gamma=0 gives altitude
// 0° looking at whatever alpha says, matching the physical picture exactly;
// beta=0° (flat on a table, screen up) gives altitude -90° (the back
// camera, on the underside, faces straight down through the table);
// beta=180° (flat, screen down) gives altitude +90° (zenith). All three
// match the geometry by hand, independent of the formula's own algebra.
//
// ── Magnetic declination ─────────────────────────────────────────────────
//
// Every source above is magnetic-referenced, not true-north-referenced —
// off by a location-dependent amount (currently a few degrees to over ten,
// depending where on Earth). Corrected via the `magvar` package (WMM
// 2025-2030, MIT, zero runtime dependencies) using the *real* current date
// (`magvar()` always uses "now" internally, not this app's own scrubbable
// simulated clock — the correction is for where the phone's magnetometer
// physically is right now, not for whatever date the star field has been
// wound to). Sign convention confirmed against NOAA's own documentation:
// declination is positive when magnetic north sits *east* of true north,
// and true heading = magnetic heading + declination. WMM 2025-2030 will
// need swapping for a newer model epoch after 2030 — magvar's own README
// versioning is the thing to watch.
//
// ── No roll, ever ─────────────────────────────────────────────────────────
//
// Same invariant skyRotation.js's own header states for the dragged view:
// this scene never introduces roll. AR mode only ever reports heading
// (yaw) and altitude (pitch) — gamma still feeds the altitude formula
// above (tilting the phone sideways does change how far "up" the camera
// is pointed), but nothing here extracts or applies a separate roll to the
// renderer. A phone held with a deliberate sideways tilt will read a
// slightly different altitude than if held level, which is a known,
// accepted v1 simplification, not a bug — see the implementation plan.
//
// ── Not verified against real hardware ───────────────────────────────────
//
// Unlike milestone 1 (capability gate, permission flow, camera
// compositing — confirmed working on a real iPhone), this module's actual
// math has only been checked against hand-worked geometric special cases
// and unit-test fixtures, at the user's explicit direction to keep
// building without a real-device round trip each milestone. The
// calibration-offset drag exists specifically so a real, in-the-field sign
// or offset error is a quick manual correction rather than an unusable
// feature — but it should still be checked against reality at the next
// opportunity.
//
// ── Altitude from gravity, not beta/gamma — why, and why it's still here ──
//
// A real-device report ("the scene tweaks out after pointing the phone all
// the way up", "can't do one complete revolution without it losing track")
// pointed at a well-documented, genuine limitation of the alpha/beta/gamma
// Euler decomposition DeviceOrientationEvent hands us: it becomes unstable
// and can jump discontinuously exactly near beta = +/-90 degrees — which is
// this app's own default AR holding orientation ("magic window", phone
// upright, looking at the horizon), not a rare edge case reached only by
// pointing at the zenith. This is the actual answer to "how does Google do
// it and we can't": native apps (and ARCore) read a hardware-fused rotation
// vector as a quaternion, which has no such singularity, ever. The web's
// equivalent — the Generic Sensor API's AbsoluteOrientationSensor, which
// also exposes a raw quaternion — exists on Chrome/Android, but WebKit has
// never implemented it, so it is not reachable from an iPhone no matter
// which browser app wraps it.
//
// What *is* reachable everywhere DeviceOrientationEvent is: the raw
// accelerometer, via a separate `devicemotion` event's own
// accelerationIncludingGravity. That single physical vector — which way
// gravity pulls, expressed in the device's own axes — never passes through
// any Euler decomposition at all, so it carries none of the beta=90
// instability. altitudeFromGravity() below derives altitude from it
// directly and is preferred whenever a motion reading is available,
// verified against the exact same three hand-worked cases
// altitudeFromBetaGamma() already was (see its own header): flat screen-up,
// flat screen-down, and upright. Heading is a separate problem — a truly
// gravity-and-magnetometer "tilt-compensated" heading needs a raw
// magnetometer reading the web does not expose, so the Euler-angle
// (headingFromEuler) and webkitCompassHeading paths for heading are
// unchanged; only altitude, which every path already depends on regardless
// of heading source, gets the more robust signal.
//
// The real-device round trip this needed did happen, fast: the very first
// version had gz's sign backwards (see altitudeFromGravity's own header),
// which read as "looking down behaves like looking up" — a real device is
// genuinely the only way that particular bug surfaces, since
// accelerationIncludingGravity's sign convention is a widely documented
// point of confusion the spec text and hand-worked geometry alike can't
// substitute for. Fixed and reasoned through independently (two separate
// physical rotations checked by hand, not just re-reading the same
// algebra), but still worth another real-device pass to confirm.
//
// ── Heading through the pole: a real fix, then a real regression ──────────
//
// A real-device report: pitching smoothly from the horizon, up through
// "pointing straight at the sky", and on to the horizon on the opposite
// side made the compass reading flip by ~180° partway through and stay
// wrong — north read as south — until the phone was brought back toward
// level. The first attempt at a fix (still visible in this file's git
// history) diagnosed this as heading being inherently unmeasurable right at
// the pole — true, in the limit: headingFromEuler's own east/north satisfy
// east^2 + north^2 = cos^2(altitude), which does shrink to zero exactly at
// altitude=+/-90 — and "fixed" it by fading the heading EMA's own weight to
// zero as |altitude| approached 90, freezing heading while the device
// passed through the danger zone and letting it resume once altitude
// receded back out.
//
// That fix was itself the bug, and a worse one than the original: proven by
// simulation (feed a smooth, physically-continuous beta sweep from 150° up
// through 180° and out to -150° through both the gated and ungated EMA) —
// freezing heading for even a narrow band, then releasing it, hands the
// ordinary shortestDelta()-based EMA a *sudden*, roughly-180°-wide gap to
// close instead of the small, sample-to-sample steps it's designed for.
// 180° is exactly the one distance where "shortest way around" is
// ambiguous, and the tie-break resolves it the same way every time given
// the same inputs — so the smoothed heading swept through the *wrong* three
// quarters of the compass (peak deviation from the true raw heading over
// 150° in simulation, versus under 60° — ordinary smoothing lag — with the
// gate removed entirely) before landing on the right answer. That reads as
// exactly what was reported: the compass visibly spinning through north,
// west and south while the device was already past the pole and altitude
// was tracking down correctly the whole time.
//
// The part the first fix got wrong: headingFromEuler does not need
// protecting from the pole, because it already degrades gracefully well
// before reaching it, for any physically realistic hand grip. Confirmed
// algebraically and by simulation: holding gamma at exactly 0 (a
// mathematically perfect, roll-free pitch) does make heading a genuine step
// function — alpha on one side of beta=180, alpha+180 on the other, an
// instantaneous flip with nothing in between — but gamma=0 *exactly* is not
// a real physical grip; any real, even slightly imperfect roll (gamma=2°
// was enough in simulation) turns that instantaneous step into a smooth
// ramp through the full 45°→90°→135°→180°→225°-style intermediate values
// over roughly the last 30° of approach and departure on either side of the
// pole — plenty of range for this module's own sample-rate and EMA to track
// like any other continuous motion, no special-casing required. The
// "east/north shrink to zero, atan2 is unstable" argument is still
// literally true in the zero-gamma limit; it just isn't the failure mode a
// held phone actually produces.
//
// So: no confidence gate. webkitCompassHeading is left exactly as it always
// was too — there's no evidence it needed one, and the demonstrated failure
// mode above (freeze, then an ambiguous 180°-ish catch-up) would apply to
// any heading source fed through this same EMA, not something specific to
// the Euler formula. If a real device someday shows heading noise right at
// the pole that this reasoning doesn't cover, the fix is not to freeze the
// EMA again — see the paragraph above for exactly how that goes wrong.

const DEG2RAD = Math.PI / 180;
const RAD2DEG = 180 / Math.PI;

// Exponential-moving-average time constant, in milliseconds — how long it
// takes the smoothed heading/altitude to close roughly two-thirds of the
// gap to a new raw reading. This used to be a flat per-*event* weight
// (0.15, applied in full on every sample regardless of how much real time
// it covered) on the reasoning that there was no render-loop frame time to
// normalize against, the way utils/simTime.js's own `ease()` does — but
// sensor events are not actually evenly spaced in practice. Real devices
// batch and throttle them under load (exactly the load this feature
// itself creates: camera passthrough plus WebGL plus sensor processing all
// competing for the same main thread), so the gap between two events
// swings between a few milliseconds and several hundred. A flat per-event
// weight bakes in a *different* effective time constant every time that
// gap changes size: a burst of closely-spaced events let raw sensor noise
// through nearly undamped (each one still gets the full 15%, so five
// events in 10ms move the average more than five events *should* in that
// little real time), which is what reads as jumpiness, while a gap in
// delivery leaves the average stuck since nothing arrives to nudge it,
// then several more flat-weighted steps are needed to claw back to
// wherever the phone actually is by the time events resume — which is
// what reads as lag. Weighting by the *actual* elapsed time between
// samples (below) collapses both symptoms into one fix: a burst is
// correctly damped because almost no time passed, and a gap is correctly
// caught up in a single larger step because a lot of time did.
const TAU_MS = 120;

let magHeading = 0;     // magnetic heading, degrees, smoothed
let altitude = 0;       // degrees above horizon, smoothed
let smoothed = false;   // false until the first real sample seeds the EMA
let lastSampleAt = 0;   // ms, same clock as event.timeStamp — see timeWeight()

// Most recent usable accelerationIncludingGravity, device-local axes — null
// until the first real devicemotion sample arrives (or if motion permission
// was never granted/the browser never fires it), in which case altitude
// falls back to the beta/gamma formula. See the module header's own section
// on why this is preferred when available.
let lastGravity = null;

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

// Shortest-angle delta — the same trick NightSky3D.jsx's own startPanTo
// already uses for its eased constellation pan. Smoothing a compass heading
// with a plain lerp snaps the long way around the 0/360 seam half the time
// (350 -> 10 would "smooth" through 180 instead of through 0).
function shortestDelta(from, to) {
    return (((to - from) % 360) + 540) % 360 - 180;
}

function emaHeading(current, target, weight) {
    return norm360(current + shortestDelta(current, target) * weight);
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

/** Degrees above the horizon. No alpha term — identical regardless of
 *  which heading source below actually supplied the compass reading.
 *  Uses atan2 rather than asin so pitch continues smoothly through and
 *  past the zenith (+90°) rather than folding back down. */
function altitudeFromBetaGamma(betaDeg, gammaDeg) {
    const beta = betaDeg * DEG2RAD;
    // gamma is intentionally ignored here: this continuation follows the
    // device's pitch angle directly, while gravity remains the preferred
    // roll-invariant source whenever motion data is available.
    void gammaDeg;
    return -Math.atan2(-Math.cos(beta), Math.sin(beta)) * RAD2DEG;
}

/**
 * Degrees above the horizon, from the device's own raw gravity reading
 * (devicemotion's accelerationIncludingGravity, device-local axes: x right,
 * y up the screen, z out of the screen face) rather than from beta/gamma —
 * see the module header for why. The device's back camera points along
 * local (0,0,-1); gravity's reaction, normalized, IS local "up" with no
 * decomposition needed to get there, so altitude is just the angle between
 * the two: asin(dot((0,0,-1), normalize(g))).
 *
 * Uses atan2(gz, gHoriz) rather than asin(gz/mag) so that pitching the
 * camera past the vertical/perpendicular line (+90° zenith) continues
 * smoothly past +90° instead of reversing direction and decreasing back down.
 *
 * Returns null for a degenerate reading (near-zero magnitude — momentary
 * free-fall, or no real data yet) so the caller can fall back rather than
 * feed atan2() a divide-by-zero.
 */
function altitudeFromGravity(gx, gy, gz) {
    const mag = Math.sqrt(gx * gx + gy * gy + gz * gz);
    if (!(mag > 1e-6)) return null;
    const gHoriz = (gy >= 0 ? 1 : -1) * Math.sqrt(gx * gx + gy * gy);
    return -Math.atan2(gz, gHoriz) * RAD2DEG;
}

/** Magnetic heading (0=N, 90=E) from raw Euler angles — only used when
 *  nothing has already handed over a heading directly (webkitCompassHeading
 *  or event.absolute's own semantics). See the module header for the
 *  formula's derivation and the special cases it was checked against. */
function headingFromEuler(alphaDeg, betaDeg, gammaDeg) {
    const alpha = alphaDeg * DEG2RAD;
    const beta = betaDeg * DEG2RAD;
    const gamma = gammaDeg * DEG2RAD;
    const cA = Math.cos(alpha); const sA = Math.sin(alpha);
    const sB = Math.sin(beta); // cos(beta) does not appear in either component below
    const cG = Math.cos(gamma); const sG = Math.sin(gamma);
    // East un-negated, North negated relative to the matrix's own third
    // column — not a uniform "-column3" as the naive derivation suggests.
    // Caught by the unit tests below (alpha=90 came out as 270, a mirror
    // across the N/S axis: East and North were both being negated
    // uniformly, which is right for North but wrong for East), verified
    // against four independent alpha values rather than curve-fit to one.
    const east = cA * sG + cG * sA * sB;
    const north = -(sA * sG - cA * cG * sB);
    return norm360(Math.atan2(east, north) * RAD2DEG);
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
    // physical claim — altitudeFromBetaGamma(0,0) alone comes out to -90°,
    // which is exactly the corrupted, clamped-to-the-floor reading a CDP
    // script driving real DeviceOrientation.setDeviceOrientationOverride
    // calls caught this doing before this guard existed.
    if (!hasAlpha && !hasBeta && !hasGamma && !hasWebkitHeading) return false;

    const alpha = hasAlpha ? event.alpha : 0;
    const beta = hasBeta ? event.beta : 0;
    const gamma = hasGamma ? event.gamma : 0;

    // Whether or not this particular event is flagged absolute, the formula
    // is the same — isAbsolute only records how much the result should be
    // trusted (surfaced via isOrientationAbsolute(), for a future "compass
    // may be inaccurate" affordance), not how it's computed. An unreliable
    // alpha still produces *a* number; the calibration-offset drag is what
    // makes that acceptable on the relative-only path. webkitCompassHeading
    // counts as trustworthy on its own, independent of the absolute flag —
    // iOS never sets that flag at all, but the heading itself is real.
    sourceIsAbsolute = isAbsolute || hasWebkitHeading;

    // Gravity first (see the module header), falling back to beta/gamma
    // when no motion reading has arrived yet — a denied/unsupported
    // devicemotion is a degradation, not a failure.
    const gravityAltitude = lastGravity
        ? altitudeFromGravity(lastGravity.x, lastGravity.y, lastGravity.z)
        : null;
    const rawAltitude = gravityAltitude ?? altitudeFromBetaGamma(beta, gamma);

    let rawMagHeading;
    if (hasWebkitHeading) {
        // iOS Safari's webkitCompassHeading changes reference vectors at
        // beta=45° and beta=135°. The flat-mode vector is 180° opposite the
        // portrait-mode camera vector, so compensate only between those two
        // switches; a one-sided altitude threshold leaves the second switch
        // exposed and causes another pole reversal.
        const inIosFlatMode = beta > 45 && beta < 135;
        rawMagHeading = inIosFlatMode
            ? norm360(event.webkitCompassHeading + 180)
            : event.webkitCompassHeading;
    } else {
        rawMagHeading = headingFromEuler(alpha, beta, gamma);
    }

    // event.timeStamp on a real DeviceOrientationEvent is a
    // DOMHighResTimeStamp already on the same clock as performance.now() —
    // preferred over reading the clock fresh here, since that would also
    // include however long the event sat queued before this handler ran.
    // Test fixtures can set it explicitly to get a deterministic dt; the
    // now() fallback is for the ones that don't bother, which mostly means
    // "however little real time the test itself took."
    const sampleAt = Number.isFinite(event.timeStamp) ? event.timeStamp : now();

    if (!smoothed) {
        magHeading = rawMagHeading;
        altitude = rawAltitude;
        smoothed = true;
    } else {
        const weight = timeWeight(sampleAt - lastSampleAt, TAU_MS);
        magHeading = emaHeading(magHeading, rawMagHeading, weight);
        altitude += (rawAltitude - altitude) * weight;
    }
    // Never lets the clock run backward: an out-of-order or clock-skewed
    // timestamp earlier than the last accepted one already produced a
    // weight of 0 above (no movement), and letting it overwrite
    // lastSampleAt too would inflate the *next* real sample's dt by
    // whatever gap this one opened up, double-counting the same anomaly.
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

/** Just records the latest gravity reading for altitudeFromGravity() to use
 *  on the next orientation event — devicemotion and deviceorientation are
 *  two separate, independently-timed event streams, so this doesn't itself
 *  recompute or notify anything. A motion event with no
 *  accelerationIncludingGravity at all (some devices only ever populate
 *  the gravity-excluded `acceleration` field) leaves the last good reading
 *  in place rather than clearing it. */
function handleMotion(event) {
    const g = event.accelerationIncludingGravity;
    if (!g) return;
    const x = Number.isFinite(g.x) ? g.x : 0;
    const y = Number.isFinite(g.y) ? g.y : 0;
    const z = Number.isFinite(g.z) ? g.z : 0;
    if (x === 0 && y === 0 && z === 0) return; // nothing usable — see altitudeFromGravity's own degenerate-magnitude guard
    lastGravity = { x, y, z };
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

/** Same gate as needsOrientationPermission(), for the separate
 *  DeviceMotionEvent API altitudeFromGravity's own reading depends on —
 *  iOS ties the two to independent requestPermission() statics even though
 *  its own system UI often shows one combined prompt for both. */
function needsMotionPermission() {
    return typeof window !== 'undefined'
        && typeof window.DeviceMotionEvent?.requestPermission === 'function';
}

/**
 * The actual permission-requesting call — must run inside a direct user
 * gesture handler on iOS. Resolves true when orientation tracking can
 * proceed (either granted, or nothing needed to ask in the first place).
 * Motion permission is requested too, best-effort: a denial there only
 * costs the more robust gravity-based altitude (see the module header),
 * not the whole feature, so it never turns an otherwise-successful
 * orientation grant into a reported failure.
 */
export async function requestDeviceOrientationPermission() {
    let granted = true;
    if (needsOrientationPermission()) {
        try {
            granted = (await window.DeviceOrientationEvent.requestPermission()) === 'granted';
        } catch {
            granted = false;
        }
    }
    if (needsMotionPermission()) {
        try {
            await window.DeviceMotionEvent.requestPermission();
        } catch {
            // Degrades to the beta/gamma altitude fallback — not fatal.
        }
    }
    return granted;
}

export function startDeviceOrientationTracking() {
    if (tracking || typeof window === 'undefined') return;
    tracking = true;
    smoothed = false;
    receivedAbsolute = false;
    lastGravity = null;
    window.addEventListener('deviceorientationabsolute', onAbsoluteEvent);
    window.addEventListener('deviceorientation', onRelativeEvent);
    window.addEventListener('devicemotion', handleMotion);
}

export function stopDeviceOrientationTracking() {
    if (!tracking) return;
    tracking = false;
    window.removeEventListener('deviceorientationabsolute', onAbsoluteEvent);
    window.removeEventListener('deviceorientation', onRelativeEvent);
    window.removeEventListener('devicemotion', handleMotion);
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

/** True heading: magnetic + declination + the manual calibration offset,
 *  in this app's own azimuth convention (0=N, 90=E, clockwise) — ready to
 *  hand straight to setLookDirection(), no further correction needed. */
export function getOrientationHeading() {
    return norm360(magHeading + declinationDeg + calibrationAz);
}

/** Degrees above the horizon, calibration-adjusted. setLookDirection()
 *  clamps this to skyRotation.js's own ALT_MIN/ALT_MAX, so out-of-range
 *  values here are harmless rather than needing a second clamp. */
export function getOrientationAltitude() {
    return altitude + calibrationAlt;
}

/** Whether the heading currently in use is earth-referenced (Chrome/Android
 *  deviceorientationabsolute, or iOS's webkitCompassHeading) rather than the
 *  best-effort relative-alpha fallback. Not wired into any UI yet — a hook
 *  for a future "compass may be inaccurate" affordance, not required for
 *  the sensor pipeline itself to work. */
export function isOrientationAbsolute() {
    return sourceIsAbsolute;
}

/** The drag-in-AR-mode handler: nudges the correction on top of the sensor
 *  reading rather than the reading itself, since the sensor fires far more
 *  often than a drag gesture and would otherwise overwrite a raw nudge on
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

/** Test seam: feed a plain fixture through the real devicemotion handler,
 *  same reasoning as __injectOrientationEvent above. */
export function __injectMotionEvent(event) {
    handleMotion(event);
}

/** Test seam. */
export function __resetDeviceOrientation() {
    magHeading = 0;
    altitude = 0;
    smoothed = false;
    lastSampleAt = 0;
    lastGravity = null;
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
