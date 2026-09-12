import * as Astronomy from 'astronomy-engine';
import * as THREE from 'three';

// The night sky's live orientation, and which way the viewer is looking.
//
// Two pieces of state, both read every frame by the render loop and neither
// of them React state, the same reasoning as simTime.js and driftControl.js:
// the scene is built once in an effect with an empty dependency list, and
// nothing here may cause that effect to re-run.
//
// ── The sky rotation ─────────────────────────────────────────────────────
//
// Star positions are baked once, at catalog load, as J2000 equatorial (EQJ)
// unit vectors (see utils/skyCatalog.js) and never touched again. What
// changes is a single 3x3 rotation — recomputed whenever the observer's
// location or the simulated date changes, cheap enough to just do every
// frame while the clock is live or being scrubbed — that carries EQJ
// straight into this scene's coordinate space. The vertex shader multiplies
// every star by this one matrix; thousands of stars rotate as a side effect
// of the ordinary draw call, and the Sun/Moon/planets (added in a later
// phase) go through the same matrix so the whole sky moves together by
// construction rather than by keeping several rotations in sync by hand.
//
// Two changes of basis are folded into it:
//
//   EQJ -> HOR   astronomy-engine's own Rotation_EQJ_HOR(date, observer).
//                HOR's axes, confirmed empirically against
//                Astronomy.VectorFromHorizon rather than assumed from prose
//                documentation: +x = north, +y = west, +z = zenith.
//
//   HOR -> scene  this module's choice, so the scene reads as an ordinary
//                three.js one (+Y up) and an unrotated camera faces north:
//                  scene.x = east    (= -HOR.y)
//                  scene.y = zenith  (=  HOR.z)
//                  scene.z = south   (= -HOR.x)
//
// The combined matrix is built by running the three EQJ basis vectors
// through Astronomy.RotateVector and relabelling the result, then reading
// the three answers off as the matrix's columns — rather than hand-deriving
// one composed 3x3 by transposing astronomy-engine's own row/column
// convention, which is exactly the kind of place a silent sign error hides.
// skyRotation.test.js pins the result against independent Astronomy.Horizon
// calls for real stars, not just against this module's own arithmetic.
//
// ── The look direction ───────────────────────────────────────────────────
//
// Azimuth (compass degrees, unclamped, wraps) and altitude (clamped so the
// ground stays reachable without an invisible wall) — set by dragging or
// nudging, read every frame to orient the camera. See NightSky3D.jsx for how
// azimuth (compass: 0=N, 90=E clockwise) becomes a three.js yaw: the scene's
// +Z is south, and a positive rotation about +Y sweeps +X *toward* +Z (east
// toward south, i.e. clockwise-from-north only once negated) — so the yaw
// applied to the camera is -azimuth, not azimuth.

const ALT_MIN = -10;
const ALT_MAX = 90;

/** Where the view starts, and what "Look north" (NightSkyPanel.jsx) returns to. */
export const DEFAULT_AZIMUTH = 0;
export const DEFAULT_ALTITUDE = 15;

let azimuth = DEFAULT_AZIMUTH; // degrees, compass convention: 0 = north, 90 = east
let altitude = DEFAULT_ALTITUDE; // degrees above the horizon

const rotMatrix = new THREE.Matrix3();
let rotationReady = false;

const listeners = new Set();
const notify = () => listeners.forEach(fn => fn());

const _eqjX = new Astronomy.Vector(1, 0, 0, 0);
const _eqjY = new Astronomy.Vector(0, 1, 0, 0);
const _eqjZ = new Astronomy.Vector(0, 0, 1, 0);

/** astronomy-engine's HOR axes (x=north, y=west, z=zenith) -> this scene's. */
function horToScene(hor) {
    return { x: -hor.y, y: hor.z, z: -hor.x };
}

/**
 * Recompute the EQJ -> scene rotation for one observer at one instant.
 * Three Astronomy.RotateVector calls, not one per star — call this once per
 * location/date change, or once a frame while time is live/scrubbing.
 */
export function updateSkyRotation(date, observer) {
    const R = Astronomy.Rotation_EQJ_HOR(date, observer);
    const cx = horToScene(Astronomy.RotateVector(R, _eqjX));
    const cy = horToScene(Astronomy.RotateVector(R, _eqjY));
    const cz = horToScene(Astronomy.RotateVector(R, _eqjZ));
    // Matrix3.set() takes its nine arguments in row-major order regardless
    // of how it stores them — n_ij is genuinely row i, column j — so this is
    // just "the three columns we computed, written out as rows of an
    // argument list", not a transpose.
    rotMatrix.set(
        cx.x, cy.x, cz.x,
        cx.y, cy.y, cz.y,
        cx.z, cy.z, cz.z,
    );
    rotationReady = true;
}

/** The live EQJ -> scene rotation. Identity (and meaningless) until the first updateSkyRotation(). */
export const getSkyRotation = () => rotMatrix;
export const isSkyRotationReady = () => rotationReady;

export const getAzimuth = () => azimuth;
export const getAltitude = () => altitude;

export function setLookDirection(az, alt) {
    const nextAz = ((az % 360) + 360) % 360;
    const nextAlt = Math.max(ALT_MIN, Math.min(ALT_MAX, alt));
    if (nextAz === azimuth && nextAlt === altitude) return;
    azimuth = nextAz;
    altitude = nextAlt;
    notify();
}

export function nudgeLookDirection(dAz, dAlt) {
    setLookDirection(azimuth + dAz, altitude + dAlt);
}

export function subscribeLook(fn) {
    listeners.add(fn);
    return () => listeners.delete(fn);
}

/** Test seam. */
export function __resetSkyRotation() {
    azimuth = DEFAULT_AZIMUTH;
    altitude = DEFAULT_ALTITUDE;
    rotMatrix.identity();
    rotationReady = false;
    listeners.clear();
}
