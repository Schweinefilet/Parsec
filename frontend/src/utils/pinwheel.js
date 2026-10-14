// WR 104: a Wolf–Rayet star and an O/B star orbiting each other every 241.5
// days, throwing out a spiral of hot dust that keeps its shape as it
// expands: the "pinwheel" Tuthill et al. imaged with Keck (1999, 2008).
//
// The two stars' winds collide. The weaker one (the O/B star's) pushes a
// hollow cone into the stronger, wrapped round the O/B star and pointing
// away from the Wolf–Rayet star, and dust condenses in the compressed gas on
// the cone's surface once it is far enough out to be cool. The cone turns
// with the orbit; the dust on it flies straight out at the wind's speed. So
// every parcel of dust at distance r left the stars r/v ago, when the cone
// pointed wherever the orbit had it then: an Archimedean spiral, one turn per
// orbit, its turns v·P apart.
//
// Units are AU and days. The /exotic shader (exoticShaders.js PINWHEEL_FRAG)
// mirrors shockHalfAngle's output (as a uniform), coneAxis and dustDensity.

/** Measured: Tuthill et al. (2008) unless noted. */
export const WR104 = {
    periodDays: 241.5,
    // How fast the spiral expands on the sky.
    masPerDay: 0.28,
    distancePc: 2580,
    // The dust-free hole in the middle before the plume starts.
    cavityMas: 13.3,
    // Dust condenses at about this temperature.
    formationTemp: 1500,
    // The orbit's tilt from Hill et al. (2024): spectra put it at about
    // 30–45°, though the spiral looks nearly face-on from Earth.
    orbitTiltDeg: 45,
};

const KM_PER_AU = 1.495978707e8;
const SECONDS_PER_DAY = 86400;

/** AU per day the dust flies out at: an angular rate times a distance. */
export function outflowAuPerDay(masPerDay = WR104.masPerDay, pc = WR104.distancePc) {
    // 1 mas at 1 pc is 1e-3 AU.
    return masPerDay * 1e-3 * pc;
}

/** The same, in km/s. */
export function outflowKmPerS(masPerDay, pc) {
    return (outflowAuPerDay(masPerDay, pc) * KM_PER_AU) / SECONDS_PER_DAY;
}

/** Distance between successive turns of the spiral: the wind's speed times the period. */
export function armSpacing(v = outflowAuPerDay(), P = WR104.periodDays) {
    return v * P;
}

/** Where the dust begins, in AU. */
export function dustOnset() {
    return WR104.cavityMas * 1e-3 * WR104.distancePc;
}

/**
 * Half the opening angle of the cone where the winds meet, in radians, for a
 * wind momentum ratio η = (Ṁv)_O / (Ṁv)_WR < 1: Eichler & Usov (1993)'s fit,
 * θ ≈ 2.1 (1 − η^⅖/4) η^⅓.
 */
export function shockHalfAngle(eta) {
    return 2.1 * (1 - Math.pow(eta, 0.4) / 4) * Math.cbrt(eta);
}

/**
 * Dust temperature at r: an optically thin grain in equilibrium with
 * starlight, T ∝ r^(−2/(4+β)) with emissivity index β = 1, from the
 * formation temperature at the onset radius.
 */
export function dustTemperature(r, r0 = dustOnset()) {
    return WR104.formationTemp * Math.pow(Math.max(r, 1e-3) / r0, -0.4);
}

/** Relative 2.2 µm brightness of a grain at T (Planck's law, Wien factor hc/λk = 6540 K). */
export function kBandPlanck(T) {
    return 1 / Math.expm1(6540 / T);
}

/** The orbital phase angle at time t days: counter-clockwise seen from +z. */
export function orbitAngle(t, P = WR104.periodDays) {
    return (2 * Math.PI * t) / P;
}

/** The cone's axis at time t: in the orbital plane, from the WR star past the O/B star. */
export function coneAxis(t, P = WR104.periodDays) {
    const a = orbitAngle(t, P);
    return [Math.cos(a), Math.sin(a), 0];
}

/**
 * Dust density at point x (AU) at time t (days), up to a constant: the gas
 * left the stars r/v ago on the cone's surface, a shell `width` radians thick
 * round half-angle `theta`, and has thinned as 1/r² since. Zero inside the
 * dust-free cavity.
 */
export function dustDensity(x, t, { theta, width, v = outflowAuPerDay(), P = WR104.periodDays, r0 = dustOnset() }) {
    const r = Math.hypot(x[0], x[1], x[2]);
    if (r < r0) return 0;
    const ax = coneAxis(t - r / v, P);
    const c = (x[0] * ax[0] + x[1] * ax[1] + x[2] * ax[2]) / r;
    const psi = Math.acos(Math.min(1, Math.max(-1, c)));
    const d = (psi - theta) / width;
    return Math.exp(-d * d) / (r * r);
}

/**
 * The radii, out to rMax, at which the spiral's centre line crosses the
 * direction at angle `phi` in the orbital plane at time t: where the cone's
 * axis, back when that dust left, pointed at phi ± theta.
 */
export function spiralCrossings(phi, t, theta, rMax, { v = outflowAuPerDay(), P = WR104.periodDays } = {}) {
    const out = [];
    for (const side of [-1, 1]) {
        // The axis pointed at phi + side·theta at times t0 + kP.
        const target = phi + side * theta;
        let lag = t - (target * P) / (2 * Math.PI);
        lag = ((lag % P) + P) % P;
        for (let r = lag * v; r <= rMax; r += P * v) out.push(r);
    }
    return out.sort((a, b) => a - b);
}

/**
 * The two stars' masses in suns. Not measured: a WC9 star of about ten
 * suns and an early B companion of about twenty are typical, and only their
 * sum (through the separation) and ratio (through who sits where) matter.
 */
export const MASSES = { wr: 10, ob: 20 };

/** The stars' separation in AU, from Kepler's third law. */
export function orbitSeparation(P = WR104.periodDays, mTotal = MASSES.wr + MASSES.ob) {
    const years = P / 365.25;
    return Math.cbrt(mTotal * years * years);
}

/**
 * How far the cone trails the line between the stars, in radians: the
 * stars move on while the wind crosses the gap, so the cone is swept back
 * by about atan(v_orbit / v_wind).
 */
export function coneTrail(v = outflowAuPerDay(), P = WR104.periodDays) {
    const vOrbit = (2 * Math.PI * orbitSeparation(P)) / P;
    return Math.atan(vOrbit / v);
}

/** Where the two stars are at time t: the Wolf–Rayet star, then its companion. */
export function starPositions(t, P = WR104.periodDays) {
    const a = orbitSeparation(P);
    const [x, y] = coneAxis(t, P);
    const total = MASSES.wr + MASSES.ob;
    const fWr = -MASSES.ob / total;
    const fOb = MASSES.wr / total;
    return [[a * fWr * x, a * fWr * y, 0], [a * fOb * x, a * fOb * y, 0]];
}
