// How big an object actually is, in kilometres.
//
// The catalog carries size as prose — "71,492 km", "~715 km", "2.38 R⊕",
// "58 cm" — because that is what belongs on the page. Comparing two bodies
// needs a number, and this is where the prose becomes one.
//
// Reading the existing rows rather than adding a second radius field to every
// object is deliberate: two copies of a number drift, and the one on screen is
// the one people would notice was wrong. objectSize.test.js pins the parse for
// every object in the catalog, so an edit that breaks it fails the build rather
// than silently changing a comparison.

const EARTH_RADIUS_KM = 6371;
const JUPITER_RADIUS_KM = 69911;

// Polar flattening, (a − c) / a. It only matters for bodies spinning fast
// enough to bulge, but for those it matters a lot: the catalog quotes
// equatorial radii, and cubing Jupiter's makes it 1,413 Earths by volume when
// the answer every textbook prints is 1,321. Anything absent here is treated
// as a sphere, which for a moon or a rocky planet it may as well be.
const FLATTENING = {
    jupiter: 0.06487,
    saturn:  0.09796,
    uranus:  0.02293,
    neptune: 0.01708,
    earth:   0.00335,
    mars:    0.00589,
};

// Only these units make an object comparable to another body. Light-years —
// which is how the deep-sky objects are measured — are excluded on purpose:
// Andromeda beside Earth is not a comparison, it is a rounding error.
const UNITS_KM = {
    km: 1,
    m: 0.001,
    cm: 0.00001,
};

const SIZE_LABEL = /radius|diameter|dimensions/i;
// "Apparent Diameter" is an angle on the sky, and a telescope's "Mirror
// Diameter" is a component, not the spacecraft. Neither is the object's size.
const NOT_A_SIZE = /apparent|mirror/i;

/**
 * Physical radius in km, or null when the catalog has no usable one.
 *
 * Handles the formats actually in use: thousands separators, a leading ~ for
 * approximate figures, ranges like "3.5–8.5 m" (midpoint), a trailing
 * parenthetical, diameters (halved), and exoplanet radii given in Earth or
 * Jupiter radii.
 */
export function radiusKm(object) {
    const rows = object?.stats?.find(s => s.section === 'Physical')?.rows ?? [];
    const row = rows.find(r => SIZE_LABEL.test(r.label) && !NOT_A_SIZE.test(r.label));
    if (!row) return null;

    const text = String(row.value);

    // Exoplanets are quoted against Earth or Jupiter rather than in km
    const relative = /([\d.]+)\s*R(?:⊕|J|Jup|_?jup)/i.exec(text);
    if (relative) {
        const n = parseFloat(relative[1]);
        if (!Number.isFinite(n)) return null;
        return n * (/R(?:J|Jup)/i.test(relative[0]) ? JUPITER_RADIUS_KM : EARTH_RADIUS_KM);
    }

    const num = (v) => parseFloat(String(v).replace(/,/g, ''));

    // A triaxial body is quoted as "1,960 × 1,518 × 996 km" — three full axes.
    // Taking one of them is wrong in either direction, so use the geometric
    // mean of the three semi-axes, which is the radius of the sphere of the
    // same volume and the figure such bodies are normally listed by.
    const axes = /^[~\s]*([\d,.]+(?:\s*[×x]\s*[\d,.]+)+)\s*(km|cm|m)\b/i.exec(text);
    if (axes) {
        const parts = axes[1].split(/\s*[×x]\s*/).map(num).filter(Number.isFinite);
        if (parts.length >= 2) {
            const unit = UNITS_KM[axes[2].toLowerCase()];
            const product = parts.reduce((a, v) => a * (v / 2), 1);
            return product ** (1 / parts.length) * unit;
        }
    }

    // Otherwise: the first number (or range) followed by a length unit
    const m = /(~?)([\d,]+(?:\.\d+)?)(?:\s*[–-]\s*([\d,]+(?:\.\d+)?))?\s*(km|cm|m)\b/i.exec(text);
    if (!m) return null;
    const lo = num(m[2]);
    const hi = m[3] != null ? num(m[3]) : null;
    if (!Number.isFinite(lo)) return null;
    const value = hi != null && Number.isFinite(hi) ? (lo + hi) / 2 : lo;

    const km = value * UNITS_KM[m[4].toLowerCase()];
    // A "Dimensions" or "Diameter" row is the whole width; radius is half
    return /diameter|dimensions/i.test(row.label) ? km / 2 : km;
}

/** Everything in the catalog that can be put beside another body to scale. */
export function isComparable(object) {
    const r = radiusKm(object);
    return r != null && r > 0;
}

/**
 * Volume in km³, from the equatorial radius and the body's flattening.
 *
 * An oblate spheroid, not a sphere: (4/3)·π·a²·c. Null when there is no
 * usable size.
 */
export function volumeKm3(object) {
    const a = radiusKm(object);
    if (a == null) return null;
    const c = a * (1 - (FLATTENING[object.id] ?? 0));
    return (4 / 3) * Math.PI * a * a * c;
}

/** How many of the smaller body fit inside the larger, by volume. */
export function volumeRatio(bigger, smaller) {
    const vb = volumeKm3(bigger);
    const vs = volumeKm3(smaller);
    if (!vb || !vs) return null;
    return vb / vs;
}
