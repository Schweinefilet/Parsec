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

/**
 * PSR J0030+0451, the one neutron star whose surface has been mapped: NICER's
 * pulse profiles, fitted by Riley et al. (2019, ApJL 887 L21) with their
 * preferred ST+PST model (Table 2 medians). Angles in radians, in the star's
 * own frame with the spin axis on +z; longitudes from the spots' phases.
 *
 * Two hot regions, both in the southern hemisphere: a small round spot and a
 * thin crescent, the edge of a large circle with a slightly offset, slightly
 * smaller circle taken out of it. Both at 10^6.11 K. Earth sees the star from
 * 54° off the spin axis on the *northern* side, so every photon NICER counted
 * from them was bent round the star to reach us.
 */
export const J0030 = {
    massSun: 1.34,
    radiusKm: 12.71,
    spinHz: 205.53,
    inclination: 0.94,
    spotTemp: 10 ** 6.11,
    // Not seen by NICER, which only sees the hot regions. An old millisecond
    // pulsar's whole surface is ~10^5 K: J0437−4715's ultraviolet glow gives
    // (1–3.5) × 10^5 K (Durant et al. 2012).
    surfaceTemp: 1.5e5,
    st: { colat: 2.23, radius: 0.09, lon: 2 * Math.PI * 0.46 },
    pst: {
        colat: 2.91, radius: 0.47,
        // The ceding (masking) circle: radius ψ + ψ⁺, its centre moved a
        // fraction ϰ of the radius in the direction φ (from local north).
        innerRadius: 0.47 - 0.01, offset: 0.10 * 0.47, offsetAz: 0.71,
        // Its phase is quoted from Earth's antipode, half a turn round.
        lon: 2 * Math.PI * (-0.59 + 0.5),
    },
};

/** J0030's compactness: R = 6.4 M (GM/Rc² = 0.156 in the paper). */
export const DEFAULT_RADIUS = 6.4;
export const MIN_RADIUS = 3;
export const MAX_RADIUS = 10;

/** GM/c² for J0030's 1.34 suns, in km: what turns the readouts into kilometres. */
export const KM_PER_M = 1.4766 * J0030.massSun;

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

/** Unit vector at colatitude θ (from +z) and longitude φ. */
export function unitVector(colat, lon) {
    const st = Math.sin(colat);
    return [st * Math.cos(lon), st * Math.sin(lon), Math.cos(colat)];
}

const dot = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
const angle = (a, b) => Math.acos(Math.min(Math.max(dot(a, b), -1), 1));

/**
 * The centres of J0030's hot regions as unit vectors in the star's frame:
 * `st` the round spot, `pst` the crescent's outer circle and `pstInner` the
 * circle cut out of it. The shader gets these three.
 */
export function hotRegions(map = J0030) {
    const st = unitVector(map.st.colat, map.st.lon);
    const c = unitVector(map.pst.colat, map.pst.lon);
    // Local east and north at the crescent's centre, then a step of `offset`
    // along the great circle heading `offsetAz` from north.
    const east = [-Math.sin(map.pst.lon), Math.cos(map.pst.lon), 0];
    const north = [
        c[1] * east[2] - c[2] * east[1],
        c[2] * east[0] - c[0] * east[2],
        c[0] * east[1] - c[1] * east[0],
    ];
    const az = map.pst.offsetAz, off = map.pst.offset;
    const dir = north.map((v, i) => Math.cos(az) * v + Math.sin(az) * east[i]);
    const inner = c.map((v, i) => Math.cos(off) * v + Math.sin(off) * dir[i]);
    return { st, pst: c, pstInner: inner };
}

/**
 * Temperature at the unit surface direction `n` (star's frame), with sharp
 * edges: the map the shader draws, which softens them by a pixel or so.
 */
export function surfaceTemperature(n, map = J0030) {
    const { st, pst, pstInner } = hotRegions(map);
    const inSpot = angle(n, st) < map.st.radius;
    const inCrescent = angle(n, pst) < map.pst.radius && angle(n, pstInner) > map.pst.innerRadius;
    return inSpot || inCrescent ? map.spotTemp : map.surfaceTemp;
}

/**
 * Visible-light surface brightness relative to a star at `T0`, seen with
 * redshift g. Even 10^5 K puts the whole visible band on the Rayleigh–Jeans
 * tail, I_ν ∝ ν²T, where the colour no longer changes with temperature (a
 * pale blue-white) and only the brightness does, in proportion. Redshifted,
 * I_ν = g³ I'(ν/g) ∝ g T: a factor g, not g⁴.
 */
export function opticalBrightness(T, g = 1, T0 = J0030.spotTemp) {
    return (g * T) / T0;
}
