// The Kerr black hole, in the units the /gargantua shader works in (G = c = M = 1,
// so every length is in gravitational radii, GM/c²).
//
// The shader in utils/gargantuaShaders.js bends every pixel's ray through this
// spacetime on the GPU. This file is the same maths on the CPU, for two jobs:
// the page's readouts (horizon, ISCO, time dilation at the camera) and the
// tests, which trace rays here and check them against the closed-form results a
// renderer has to reproduce. A sign error in a geodesic integrator still draws a
// plausible black hole; only numbers catch it.
//
// Coordinates: Cartesian Kerr–Schild, spin along +z. The metric is
//   g_μν = η_μν + f l_μ l_ν,   f = 2r³ / (r⁴ + a²z²),
//   l_μ = (1, (rx + ay)/(r² + a²), (ry − ax)/(r² + a²), z/r)
// with r the Boyer–Lindquist radius, defined implicitly by
//   x² + y² + z² = r² + a²(1 − z²/r²).
// Unlike Boyer–Lindquist it has no singularity at the horizon, so a ray just
// keeps going in, and no pole on the spin axis, so nothing streaks there.
//
// Rays follow Hamilton's equations for H = ½ g^μν p_μ p_ν, which for this
// metric is ½(−E² + |p|² − f L²) with L = E + l·p. Both gradients are written
// out analytically (∂r/∂x and friends below) rather than by finite differences:
// three times cheaper on the GPU, and exact.

/** Thorne's 1974 limit: a disk's captured photons stop a hole spinning up past this. */
export const MAX_SPIN = 0.998;

/** The spin DNGR rendered Gargantua at for the film (James et al. 2015, §4). */
export const FILM_SPIN = 0.6;

/** Outer event horizon, r₊ = 1 + √(1 − a²). */
export function horizonRadius(a) {
    return 1 + Math.sqrt(Math.max(0, 1 - a * a));
}

/**
 * Innermost stable circular orbit for a prograde disk (Bardeen, Press &
 * Teukolsky 1972). 6 at a = 0, falling to 1 as a → 1. The disk's inner edge.
 */
export function iscoRadius(a) {
    const z1 = 1 + Math.cbrt(1 - a * a) * (Math.cbrt(1 + a) + Math.cbrt(1 - a));
    const z2 = Math.sqrt(3 * a * a + z1 * z1);
    return 3 + z2 - Math.sqrt((3 - z1) * (3 + z1 + 2 * z2));
}

/**
 * Critical impact parameters of equatorial light: a photon with |b| below
 * these is captured. Prograde (co-rotating) light gets closer, which is why a
 * spinning hole's shadow is flattened on one side.
 */
export function criticalImpact(a) {
    return {
        prograde: -a + 6 * Math.cos(Math.acos(-a) / 3),
        retrograde: a + 6 * Math.cos(Math.acos(a) / 3),
    };
}

/** Keplerian angular velocity of a prograde circular orbit, dφ/dt. */
export function keplerOmega(r, a) {
    return 1 / (Math.pow(r, 1.5) + a);
}

/**
 * dτ/dt for an observer hovering at radius r in the equatorial plane. 1 far
 * away, 0 at r = 2 (the edge of the ergosphere, past which nothing can hover).
 */
export function hoverTimeDilation(r) {
    return r <= 2 ? 0 : Math.sqrt(1 - 2 / r);
}

/**
 * dτ/dt for a circular orbit at r (the planet case: Miller's world orbits).
 * Null where no circular orbit exists.
 */
export function orbitTimeDilation(r, a) {
    const q = Math.pow(r, 1.5) - 3 * Math.sqrt(r) + 2 * a;
    if (q <= 0) return null;
    return Math.pow(r, 0.75) * Math.sqrt(q) / (Math.pow(r, 1.5) + a);
}

/** Boyer–Lindquist r and the metric pieces at a Kerr–Schild point. */
export function ksGeometry(x, y, z, a) {
    const w = x * x + y * y + z * z - a * a;
    const r2 = 0.5 * (w + Math.sqrt(w * w + 4 * a * a * z * z));
    const r = Math.sqrt(r2);
    const S = r2 + a * a;
    const Q = r2 * r2 + a * a * z * z;
    return {
        r, r2, S, Q,
        f: (2 * r2 * r) / Q,
        lx: (r * x + a * y) / S,
        ly: (r * y - a * x) / S,
        lz: z / r,
    };
}

/**
 * d/dλ of the state [x, y, z, px, py, pz] (E = 1). Mirrors `rayDeriv` in the
 * shader line for line — change one, change the other.
 */
export function rayDerivative(s, a) {
    const [x, y, z, px, py, pz] = s;
    const { r, r2, S, Q, f, lx, ly, lz } = ksGeometry(x, y, z, a);
    const L = 1 + lx * px + ly * py + lz * pz;

    // ∂r/∂xᵢ, from differentiating the implicit definition of r.
    const rx = (r2 * r * x) / Q;
    const ry = (r2 * r * y) / Q;
    const rz = (r * z * (r2 + a * a)) / Q;

    // ∂f/∂xᵢ, f = 2r³/Q.
    const c = 2 / (Q * Q);
    const r3 = r2 * r;
    const dfx = c * (3 * r2 * rx * Q - r3 * 4 * r3 * rx);
    const dfy = c * (3 * r2 * ry * Q - r3 * 4 * r3 * ry);
    const dfz = c * (3 * r2 * rz * Q - r3 * (4 * r3 * rz + 2 * a * a * z));

    // ∂L/∂xᵢ, with the momentum held fixed.
    const B = x * px + y * py;
    const A = r * B + a * (y * px - x * py);
    const S2 = S * S;
    const dLx = ((rx * B + r * px - a * py) * S - A * 2 * r * rx) / S2 - (pz * z * rx) / r2;
    const dLy = ((ry * B + r * py + a * px) * S - A * 2 * r * ry) / S2 - (pz * z * ry) / r2;
    const dLz = (rz * B * S - A * 2 * r * rz) / S2 + (pz * (r - z * rz)) / r2;

    const hL2 = 0.5 * L * L;
    const fL = f * L;
    return [
        px - fL * lx, py - fL * ly, pz - fL * lz,
        hL2 * dfx + fL * dLx, hL2 * dfy + fL * dLy, hL2 * dfz + fL * dLz,
    ];
}

/** H for a state — zero on a light ray; its drift measures integration error. */
export function hamiltonian(s, a) {
    const { f, lx, ly, lz } = ksGeometry(s[0], s[1], s[2], a);
    const L = 1 + lx * s[3] + ly * s[4] + lz * s[5];
    return 0.5 * (-1 + s[3] * s[3] + s[4] * s[4] + s[5] * s[5] - f * L * L);
}

/**
 * A light ray leaving `pos` along the unit vector `dir`: picks |p| so the
 * state is null (H = 0). Positive root of
 *   k²(1 − f(l·n)²) − 2fk(l·n) − (1 + f) = 0.
 */
export function launchRay(pos, dir, a) {
    const { f, lx, ly, lz } = ksGeometry(pos[0], pos[1], pos[2], a);
    const ln = lx * dir[0] + ly * dir[1] + lz * dir[2];
    const A = 1 - f * ln * ln;
    const B = -2 * f * ln;
    const C = -(1 + f);
    const k = (-B + Math.sqrt(B * B - 4 * A * C)) / (2 * A);
    return [pos[0], pos[1], pos[2], k * dir[0], k * dir[1], k * dir[2]];
}

/**
 * Affine step for a ray at radius r. Small near the hole, where the bending
 * happens, large far out, where nothing does. `scale` is the quality knob.
 * The shader's `stepSize` is the same function.
 */
export function stepSize(r, rh, scale) {
    return scale * Math.max(r - 0.9 * rh, 0.06) * Math.min(Math.max(r / 3, 1), 6);
}

/** One classical Runge–Kutta step. */
export function rk4Step(s, a, h) {
    const add = (u, k, m) => u.map((v, i) => v + m * k[i]);
    const k1 = rayDerivative(s, a);
    const k2 = rayDerivative(add(s, k1, h / 2), a);
    const k3 = rayDerivative(add(s, k2, h / 2), a);
    const k4 = rayDerivative(add(s, k3, h), a);
    return s.map((v, i) => v + (h / 6) * (k1[i] + 2 * k2[i] + 2 * k3[i] + k4[i]));
}

/**
 * Follow a ray until it falls in or gets past `escape`. Returns its fate, the
 * final state, the step count, and every crossing of the equatorial plane
 * (where the shader looks for the disk).
 */
export function traceRay(pos, dir, a, { escape = 1.01 * Math.hypot(...pos), scale = 0.04, maxSteps = 20000 } = {}) {
    const rh = horizonRadius(a);
    let s = launchRay(pos, dir, a);
    const crossings = [];
    for (let n = 0; n < maxSteps; n++) {
        const { r } = ksGeometry(s[0], s[1], s[2], a);
        if (r < 0.98 * rh) return { fate: 'captured', state: s, steps: n, crossings };
        if (r > escape && s[0] * s[3] + s[1] * s[4] + s[2] * s[5] > 0) {
            return { fate: 'escaped', state: s, steps: n, crossings };
        }
        const next = rk4Step(s, a, Math.min(stepSize(r, rh, scale), 0.1 * r + 1));
        if (Math.sign(next[2]) !== Math.sign(s[2]) && next[2] !== 0) {
            const t = s[2] / (s[2] - next[2]);
            const cx = s[0] + t * (next[0] - s[0]);
            const cy = s[1] + t * (next[1] - s[1]);
            crossings.push({ x: cx, y: cy, r: ksGeometry(cx, cy, 0, a).r });
        }
        s = next;
    }
    return { fate: 'unfinished', state: s, steps: maxSteps, crossings };
}
