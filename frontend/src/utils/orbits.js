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

export function buildOrbitTube(points, tubeRadius = ORBIT_TUBE_RADIUS, segments = 256) {
    const curve = new THREE.CatmullRomCurve3(points, true);
    return new THREE.TubeGeometry(curve, segments, tubeRadius, 8, true);
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

/**
 * Quaternion that rotates the XZ plane onto the ecliptic.
 *
 * Derived from two Mars position samples 90 days apart: the cross product of
 * the two unit directions is the orbital plane normal in scene space, so the
 * asteroid and Kuiper belts end up in the same plane as the orbit rings rather
 * than an assumed flat XZ. Falls back to identity if the ephemeris throws.
 */
export function eclipticQuaternion(date = new Date()) {
    const quat = new THREE.Quaternion();
    try {
        const toSceneUnit = (v) => {
            const d = Math.sqrt(v.x * v.x + v.y * v.y + v.z * v.z);
            return new THREE.Vector3(v.x / d, v.z / d, v.y / d);
        };
        const a = toSceneUnit(Astronomy.HelioVector('Mars', date));
        const b = toSceneUnit(Astronomy.HelioVector('Mars', new Date(date.getTime() + 90 * 86400000)));
        const normal = new THREE.Vector3().crossVectors(a, b).normalize();
        if (normal.y < 0) normal.negate();          // keep it north-facing
        quat.setFromUnitVectors(new THREE.Vector3(0, 1, 0), normal);
    } catch { /* identity */ }
    return quat;
}

// Probe positions and their flown tracks live in utils/probeTracks.js, which
// reads the baked Horizons ephemeris rather than interpolating two endpoints.
export { probeScenePos, probeDistanceAU } from './probeTracks';
