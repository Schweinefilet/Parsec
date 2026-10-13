// Two black holes spiralling together, for /exotic/binary. Units: G = c = 1
// and the pair's total mass M = 1.
//
// There is no closed-form spacetime for two holes, so this is an
// approximation, and the page says so. Each ray is bent by the sum of two
// Schwarzschild pulls written in the form that makes one of them exact:
//
//   d²x/dλ² = −3 m h² x / r⁵,   h = |x × dx/dλ|
//
// is a central force under which u = 1/r obeys u'' + u = 3m u², the
// Schwarzschild photon orbit equation, so a single hole on its own bends
// light exactly right: the photon sphere at 3m, the shadow edge at 3√3 m,
// the weak-field deflection 4m/b. Two of them are superposed, each using
// the ray's position relative to it. Near either hole the other is a small
// correction and the answer is close to right; between them, where it isn't,
// it is the qualitative picture people draw: two shadows, each lensed into
// a crescent by the other, and an eyebrow of light between.
//
// The holes are frozen while a ray is in flight (light crosses the system in
// a few dozen M, the orbit takes hundreds), and move from frame to frame on
// a Newtonian orbit shrinking by gravitational radiation (Peters 1964).
// `binaryAcceleration` is the shader's `pull`, line for line.

/** Separation the inspiral starts from, in M. */
export const START_SEPARATION = 10;
/** Where the two horizons would all but touch: the merger, for our purposes. */
export const MERGE_SEPARATION = 2.6;
/** Remnant mass: roughly 5% of the pair radiates away as gravitational waves. */
export const REMNANT_MASS = 0.95;

/**
 * Acceleration of a ray at `x` with velocity `v` from holes of mass m[i] at
 * c[i]. Returns 0 inside any horizon; the caller stops the ray there anyway.
 */
export function binaryAcceleration(x, v, holes) {
    const out = [0, 0, 0];
    for (const { c, m } of holes) {
        const d = [x[0] - c[0], x[1] - c[1], x[2] - c[2]];
        const r2 = d[0] * d[0] + d[1] * d[1] + d[2] * d[2];
        const hx = d[1] * v[2] - d[2] * v[1];
        const hy = d[2] * v[0] - d[0] * v[2];
        const hz = d[0] * v[1] - d[1] * v[0];
        const h2 = hx * hx + hy * hy + hz * hz;
        const k = (-3 * m * h2) / (r2 * r2 * Math.sqrt(r2));
        out[0] += k * d[0];
        out[1] += k * d[1];
        out[2] += k * d[2];
    }
    return out;
}

function rk4(x, v, holes, h) {
    const add = (u, k, s) => u.map((q, i) => q + s * k[i]);
    const a1 = binaryAcceleration(x, v, holes);
    const x2 = add(x, v, h / 2), v2 = add(v, a1, h / 2);
    const a2 = binaryAcceleration(x2, v2, holes);
    const x3 = add(x, v2, h / 2), v3 = add(v, a2, h / 2);
    const a3 = binaryAcceleration(x3, v3, holes);
    const x4 = add(x, v3, h), v4 = add(v, a3, h);
    const a4 = binaryAcceleration(x4, v4, holes);
    return {
        x: x.map((q, i) => q + (h / 6) * (v[i] + 2 * v2[i] + 2 * v3[i] + v4[i])),
        v: v.map((q, i) => q + (h / 6) * (a1[i] + 2 * a2[i] + 2 * a3[i] + a4[i])),
    };
}

/** Step: proportional to the distance to the nearer hole, like stepSize in kerr.js. */
export function binaryStep(dNear, scale) {
    return scale * Math.min(Math.max(dNear - 1, 0.08), 30);
}

/** Follow a ray until it falls into a hole or escapes past `escape`. */
export function traceBinaryRay(pos, dir, holes, { escape = 1.01 * Math.hypot(...pos), scale = 0.03, maxSteps = 40000 } = {}) {
    let x = pos.slice();
    let v = dir.slice();
    for (let n = 0; n < maxSteps; n++) {
        let near = Infinity;
        for (const { c, m } of holes) {
            const d = Math.hypot(x[0] - c[0], x[1] - c[1], x[2] - c[2]);
            if (d < 2 * m) return { fate: 'captured', x, v, steps: n };
            near = Math.min(near, d / m);
        }
        if (Math.hypot(...x) > escape && x[0] * v[0] + x[1] * v[1] + x[2] * v[2] > 0) {
            return { fate: 'escaped', x, v, steps: n };
        }
        ({ x, v } = rk4(x, v, holes, binaryStep(near, scale) * Math.min(...holes.map(hh => hh.m))));
    }
    return { fate: 'unfinished', x, v, steps: maxSteps };
}

/**
 * Peters' (1964) shrinking circular orbit: da/dt = −(64/5) m₁m₂M / a³, so
 *   a(t) = (a₀⁴ − (256/5) m₁m₂M t)^¼
 * and the pair merges after T = 5a₀⁴ / (256 m₁m₂M).
 */
export function petersSeparation(t, a0, m1, m2) {
    const k = (256 / 5) * m1 * m2 * (m1 + m2);
    return Math.pow(Math.max(a0 ** 4 - k * t, 0), 0.25);
}
export function petersMergeTime(a0, m1, m2) {
    return (5 * a0 ** 4) / (256 * m1 * m2 * (m1 + m2));
}

/** Orbital angular velocity at separation a: Kepler, ω = √(M/a³). */
export function orbitalOmega(a, M = 1) {
    return Math.sqrt(M / (a * a * a));
}

/** Where the two holes are for separation `a` and orbital phase `phase`. */
export function holePositions(a, phase, m1, m2) {
    const M = m1 + m2;
    const c = Math.cos(phase), s = Math.sin(phase);
    return [
        { c: [(m2 / M) * a * c, (m2 / M) * a * s, 0], m: m1 },
        { c: [-(m1 / M) * a * c, -(m1 / M) * a * s, 0], m: m2 },
    ];
}

/**
 * Gravitational-wave frequency at separation a, in hertz for a pair of
 * total mass `solarMasses`: twice the orbital frequency. For the readout.
 */
export const SECONDS_PER_M_SUN = 4.925491e-6;
export function gwFrequency(a, solarMasses) {
    return (2 * orbitalOmega(a)) / (2 * Math.PI * SECONDS_PER_M_SUN * solarMasses);
}
