// A neutron star, for /exotic/neutron-star: a solid ball a few times its own
// Schwarzschild radius, in units of M (G = c = 1) like /gargantua.
//
// Outside a non-rotating star spacetime is exactly Schwarzschild, which is
// Kerr at a = 0, so the rays go through the same integrator: utils/kerr.js on
// the CPU, its GLSL twin on the GPU. The only difference is where a ray
// stops: on the surface at r = R rather than at a horizon.
//
// The famous consequence: light leaving the surface bends round it, so more
// than half the star is visible at once. From R = 3M down the whole surface
// is in view, the back of the star included.

import { rk4Step, launchRay, ksGeometry, stepSize } from './kerr';

/** A 1.4-solar-mass star of 12 km: R ≈ 5.8 M. */
export const DEFAULT_RADIUS = 5.8;
export const MIN_RADIUS = 3;
export const MAX_RADIUS = 10;

/** GM/c² for 1.4 suns, in km: what turns the readouts into kilometres. */
export const KM_PER_M = 1.4766 * 1.4;

/**
 * Impact parameter of light leaving the surface tangentially, b = R/√(1−2/R)
 * (above the photon sphere). Smaller b hits the star; this is its apparent
 * radius seen from far away, larger than R.
 */
export function apparentRadius(R) {
    if (R <= 3) return 3 * Math.sqrt(3);
    return R / Math.sqrt(1 - 2 / R);
}

/** Redshift of the surface's light seen far away, g = √(1 − 2/R). */
export function surfaceRedshift(R) {
    return Math.sqrt(1 - 2 / R);
}

/**
 * The largest angle round the star from which surface light still reaches a
 * distant observer: the bending ψ of a ray leaving the surface tangentially,
 *   ψ_max = ∫₀^{1/R} b du / √(1 − b²u²(1 − 2u)),  b = apparentRadius(R).
 * The integrand blows up at the surface; u = (1 − t²)/R moves the singularity
 * into the measure. Infinity at or inside R = 3 (light can orbit).
 */
export function maxBendAngle(R, n = 4000) {
    if (R <= 3) return Infinity;
    const b = apparentRadius(R);
    const f = (u) => b / Math.sqrt(Math.max(1 - b * b * u * u * (1 - 2 * u), 0));
    // ∫₀^{1/R} f du with u = (1 − t²)/R, du = −2t/R dt, t ∈ [0, 1].
    let sum = 0;
    for (let i = 0; i < n; i++) {
        const t = (i + 0.5) / n;
        sum += f((1 - t * t) / R) * (2 * t) / R;
    }
    return sum / n;
}

/** Fraction of the surface visible at once, from the exact bending. */
export function visibleFraction(R) {
    const psi = maxBendAngle(R);
    if (psi >= Math.PI) return 1;
    return (1 - Math.cos(psi)) / 2;
}

/**
 * Beloborodov's (2002) approximation, 1 − cos α = (1 − cos ψ)(1 − 2/R): with
 * α = 90°, a visible fraction of 1 / (2(1 − 2/R)). Good to a percent or so for
 * real stars; what the readout shows next to the exact figure in the tests.
 */
export function visibleFractionBeloborodov(R) {
    return Math.min(1 / (2 * (1 - 2 / R)), 1);
}

/** Follow a ray from `pos` along `dir` until it hits the surface or escapes. */
export function traceToSurface(pos, dir, R, { scale = 0.02, maxSteps = 40000 } = {}) {
    const escape = 1.01 * Math.hypot(...pos);
    let s = launchRay(pos, dir, 0);
    for (let n = 0; n < maxSteps; n++) {
        const { r } = ksGeometry(s[0], s[1], s[2], 0);
        if (r < R) return { fate: 'surface', state: s, steps: n };
        if (r > escape && s[0] * s[3] + s[1] * s[4] + s[2] * s[5] > 0) {
            return { fate: 'escaped', state: s, steps: n };
        }
        // Step as for a hole of horizon 2, but never so far it skips the
        // surface's last stretch.
        s = rk4Step(s, 0, Math.min(stepSize(r, 2, scale), 0.1 * r + 1, Math.max(r - R, 0.002) + 0.002));
    }
    return { fate: 'unfinished', state: s, steps: maxSteps };
}

/**
 * The magnetic axis at `t` seconds: tilted `incl` from the spin axis (+z)
 * and turning about it once every `period` seconds. The hotspots and the
 * beams sit on it, which is what makes a pulsar pulse.
 */
export function magneticAxis(t, incl, period) {
    const w = (2 * Math.PI * t) / period;
    return [Math.sin(incl) * Math.cos(w), Math.sin(incl) * Math.sin(w), Math.cos(incl)];
}
