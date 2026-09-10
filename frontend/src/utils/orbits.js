import * as THREE from 'three';
import * as Astronomy from 'astronomy-engine';
import { ORBITAL_PERIODS } from '../data/solarSystemBodies';

// Orbit geometry and position maths.
//
// Planets use astronomy-engine's HelioVector, so where a planet sits on screen
// matches where it actually is today. Small bodies use J2000 Keplerian
// elements. In both cases the direction is real and only the radius is
// compressed to fit the view.

export const ORBIT_EPOCH_MS = Date.UTC(2000, 0, 1, 12, 0, 0);
export const ORBIT_BASE_OPACITY = 0.27;
export const ORBIT_HOVER_OPACITY = 0.86;
// How far a hovered orbit ring moves from white toward the body's own colour.
// Half: enough to say "this ring belongs to that planet" without the ring
// turning into a second coloured object competing with the planet itself.
export const ORBIT_HOVER_TINT = 0.5;
export const ORBIT_TUBE_RADIUS = 0.28;
export const PLANET_EMISSIVE_INTENSITY = 0.08;



export function computePlanetPos(name, orbitR, date = new Date()) {
    try {
        const vec  = Astronomy.HelioVector(name, date);
        const dist = Math.sqrt(vec.x * vec.x + vec.y * vec.y + vec.z * vec.z);
        if (dist === 0) return { x: orbitR, y: 0, z: 0 };
        return {
            x:  (vec.x / dist) * orbitR,
            y:  (vec.z / dist) * orbitR,
            z:  (vec.y / dist) * orbitR,
        };
    } catch {
        return { x: orbitR, y: 0, z: 0 };
    }
}

// Sample the real orbit path via HelioVector over one full period
export function buildOrbitPoints(name, orbitR) {
    const period = ORBITAL_PERIODS[name];
    const now = Date.now();
    const N = 256;
    const pts = [];
    for (let i = 0; i < N; i++) {
        const date = new Date(now + (i / N) * period * 86400000);
        const p = computePlanetPos(name, orbitR, date);
        pts.push(new THREE.Vector3(p.x, p.y, p.z));
    }
    return pts;
}

// Six sides rather than eight. A ring is drawn a couple of pixels wide, so
// the cross-section is never resolved — what six costs instead is a width
// that wanders by about 13% as the tube twists, against 8%, and what it buys
// is a quarter off the build, which is paid on a frame the camera is moving.
export function buildOrbitTube(points, tubeRadius = ORBIT_TUBE_RADIUS, segments = 256, radial = 6) {
    const curve = new THREE.CatmullRomCurve3(points, true);
    return new THREE.TubeGeometry(curve, segments, tubeRadius, radial, true);
}

// ── Keplerian orbit helpers ────────────────────────────────────────────────

export const DEG2RAD = Math.PI / 180;

export function solveKepler(M, e) {
    let E = M;
    for (let j = 0; j < 12; j++) E -= (E - e * Math.sin(E) - M) / (1 - e * Math.cos(E));
    return E;
}

function _perifocalBasis(nodeRad, iRad, periRad) {
    const cN = Math.cos(nodeRad), sN = Math.sin(nodeRad);
    const cP = Math.cos(periRad), sP = Math.sin(periRad);
    const cI = Math.cos(iRad),    sI = Math.sin(iRad);
    return {
        Px:  cN*cP - sN*sP*cI,  Py:  sN*cP + cN*sP*cI,  Pz: sP*sI,
        Qx: -cN*sP - sN*cP*cI,  Qy: -sN*sP + cN*cP*cI,  Qz: cP*sI,
    };
}

// Position in scene units at a given date using J2000 keplerian elements.
// sceneScale: scene-units / AU based on each body's semi-major axis.
export function keplerianScenePos(el, sceneScale, date = new Date()) {
    const t = (date - ORBIT_EPOCH_MS) / 86400000;
    const n = (2 * Math.PI) / el.period;
    const M = ((el.M0 ?? 0) + n * t);
    const Mnorm = ((M % (2 * Math.PI)) + 2 * Math.PI) % (2 * Math.PI);
    const E  = solveKepler(Mnorm, el.e);
    const nu = 2 * Math.atan2(Math.sqrt(1 + el.e) * Math.sin(E / 2), Math.sqrt(1 - el.e) * Math.cos(E / 2));
    const r  = el.a * (1 - el.e * Math.cos(E));
    const px = r * Math.cos(nu), py = r * Math.sin(nu);
    const b  = _perifocalBasis(el.node * DEG2RAD, el.i * DEG2RAD, el.peri * DEG2RAD);
    return {
        x: (px * b.Px + py * b.Qx) * sceneScale,
        y: (px * b.Pz + py * b.Qz) * sceneScale,   // ecliptic Z → scene Y
        z: (px * b.Py + py * b.Qy) * sceneScale,   // ecliptic Y → scene Z
    };
}

// 3D keplerian orbit ring, sampled in true anomaly for correct ellipse shape.
export function buildKeplerOrbitPoints(el, sceneScale, N = 360) {
    const b   = _perifocalBasis(el.node * DEG2RAD, el.i * DEG2RAD, el.peri * DEG2RAD);
    const pts = [];
    for (let j = 0; j <= N; j++) {
        const nu = (j / N) * 2 * Math.PI;
        const r  = el.a * (1 - el.e * el.e) / (1 + el.e * Math.cos(nu));
        const px = r * Math.cos(nu), py = r * Math.sin(nu);
        pts.push(new THREE.Vector3(
            (px * b.Px + py * b.Qx) * sceneScale,
            (px * b.Pz + py * b.Qz) * sceneScale,
            (px * b.Py + py * b.Qy) * sceneScale,
        ));
    }
    return pts;
}

// Scene-units/AU scale factor for each body, derived by linear interpolation
// of the same compressed scale the planets use.

// Mean obliquity of the J2000 ecliptic, radians — the tilt between the
// celestial equator and the ecliptic (from astronomy-engine's Rotation_EQJ_ECL).
const OBLIQUITY_J2000 = 0.40909260059599012;

/**
 * Quaternion that lays a flat XZ plane — the belts, the gravity grid — onto
 * the ecliptic, the plane the planets are drawn orbiting in.
 *
 * `HelioVector` gives J2000 *equatorial* coordinates, so a body orbiting in
 * the ecliptic lands in scene space tilted by the obliquity of the ecliptic
 * (~23.44°) about the scene x-axis, which is the vernal-equinox direction.
 * This is exactly that: it points the plane's normal at the ecliptic pole,
 * `(0, cos ε, sin ε)` in scene coords.
 *
 * An earlier version derived the normal from two Mars samples, which folded
 * Mars's own 1.85° orbital inclination into the result and left the grid a
 * couple of degrees off the planets' plane.
 */
export function eclipticQuaternion() {
    return new THREE.Quaternion().setFromUnitVectors(
        new THREE.Vector3(0, 1, 0),
        new THREE.Vector3(0, Math.cos(OBLIQUITY_J2000), Math.sin(OBLIQUITY_J2000)),
    );
}

// Probe positions and their flown tracks live in utils/probeTracks.js, which
// reads the baked Horizons ephemeris rather than interpolating two endpoints.
export { probeScenePos, probeDistanceAU } from './probeTracks';
