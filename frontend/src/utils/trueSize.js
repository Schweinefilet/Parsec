// Real radii for the bodies the scene draws, and the real separations of the
// moon systems — the numbers stage 2 of scaleMode.js rescales everything to.
//
// Read out of objectCatalog.js rather than written down a second time here.
// Those are the same figures the object pages show, they have already been
// checked once, and a scene quietly disagreeing with the page beside it about
// how big Jupiter is would be worse than either being wrong alone. The catalog
// stores them as display strings, so they are parsed once at first use and
// cached; trueSize.test.js pins that every body the scene draws resolves to a
// real number, which is what stops a reworded stat row from silently dropping
// a body back to its drawn size.

import { getObjectById } from '../data/objectCatalog';

// "6,371.0 km", "~715 km". Anything carrying other units — the exoplanets
// quote radii in R⊕ and RJup — deliberately fails to parse and falls through.
const KM_VALUE = /^~?\s*([\d,]+(?:\.\d+)?)\s*km$/i;

const RADIUS_LABELS   = ['Equatorial Radius', 'Mean Radius', 'Radius'];
// Some of the small bodies are measured across rather than out — halved here
// so one number means one thing everywhere downstream.
const DIAMETER_LABELS = ['Mean Diameter', 'Diameter'];
const ORBIT_LABELS    = ['Semi-major Axis'];

function parseKm(value) {
    const m = KM_VALUE.exec(String(value ?? '').trim());
    if (!m) return null;
    const km = Number(m[1].replace(/,/g, ''));
    return Number.isFinite(km) && km > 0 ? km : null;
}

function statKm(id, labels) {
    const obj = getObjectById(id);
    if (!obj?.stats) return null;
    for (const section of obj.stats) {
        for (const row of section.rows ?? []) {
            if (labels.includes(row.label)) {
                const km = parseKm(row.value);
                if (km !== null) return km;
            }
        }
    }
    return null;
}

// The few the catalog states in a shape nothing here can read. Haumea is far
// too elongated for a single radius and its page gives the three axes instead
// — this is the geometric mean of the semi-axes that page quotes. Halley is
// its nucleus, not its coma, which the page has no row for at all. The ISS is
// half its 109 m truss, so that "radius" means the same thing here as it does
// for a sphere.
const FALLBACK_RADIUS_KM = {
    haumea: 718,
    halley: 5.5,
    iss:    0.0545,
};

// Likewise for orbits: the ISS flies about 420 km up, and what this wants is
// the distance from Earth's centre.
const FALLBACK_ORBIT_KM = {
    iss: 6791,
};

const radiusCache = new Map();
const orbitCache  = new Map();

/**
 * Real radius of a scene body, in km — null if nothing here knows it, which
 * callers read as "leave this one at its drawn size".
 */
export function bodyRadiusKm(id) {
    if (radiusCache.has(id)) return radiusCache.get(id);
    const diameter = statKm(id, DIAMETER_LABELS);
    const km = statKm(id, RADIUS_LABELS)
        ?? (diameter !== null ? diameter / 2 : null)
        ?? FALLBACK_RADIUS_KM[id]
        ?? null;
    radiusCache.set(id, km);
    return km;
}

/** Real semi-major axis of a moon's orbit around its planet, in km. */
export function moonOrbitKm(id) {
    if (orbitCache.has(id)) return orbitCache.get(id);
    const km = statKm(id, ORBIT_LABELS) ?? FALLBACK_ORBIT_KM[id] ?? null;
    orbitCache.set(id, km);
    return km;
}

/** Test seam. */
export function __clearTrueSizeCache() {
    radiusCache.clear();
    orbitCache.clear();
}
