// HL Tau: a star under a million years old, with a disk of gas and dust round
// it in which planets are forming. ALMA's 2014 long-baseline image of it
// (ALMA Partnership 2015, ApJL 808, L3) was the first to show what a disk
// like this looks like up close: not a smooth smear but bright rings and dark
// gaps, the gaps most likely swept out by planets too small to see.
//
// Everything here is in astronomical units, years and suns. The /exotic
// shader (exoticShaders.js PROTODISK_FRAG) mirrors gapFactor, dustOpticalDepth
// and wakePhase line for line.

/** What the star and the disk are, as measured. */
export const HL_TAU = {
    // Pinte et al. (2016), from the gas's Keplerian rotation.
    starMass: 1.7,
    // A young, cool star still drawing in gas: K-type, about 4000 K.
    starTemp: 4000,
    // The distance ALMA Partnership (2015) adopted, in the Taurus clouds.
    distancePc: 140,
    // From ellipses fitted to the rings (ALMA Partnership 2015).
    inclinationDeg: 46.72,
    positionAngleDeg: 138.02,
    // Where the millimetre dust ends.
    outerRadius: 105,
};

/**
 * The seven dark rings, D1–D7: radius from ALMA Partnership (2015) via
 * Pinte et al. (2016), Table 1. Their widths (FWHM) and depths (how much of
 * the dust's light is left at the bottom) are read off the published radial
 * profile: D1, D2 and D6 are deep, D5 is the faintest, only about 15% down.
 */
export const GAPS = [
    { id: 'D1', r: 13.2, width: 4.6, depth: 0.35 },
    { id: 'D2', r: 32.3, width: 7.5, depth: 0.12 },
    { id: 'D3', r: 42.0, width: 3.0, depth: 0.6 },
    { id: 'D4', r: 50.0, width: 3.5, depth: 0.55 },
    { id: 'D5', r: 64.2, width: 4.0, depth: 0.85 },
    { id: 'D6', r: 73.7, width: 6.0, depth: 0.3 },
    { id: 'D7', r: 91.0, width: 7.0, depth: 0.45 },
];

const FWHM = 2 * Math.sqrt(2 * Math.log(2));

/**
 * How much of the dust is left at radius r once the gaps are cut: 1 between
 * them, the gap's depth at its centre. Each gap is a Gaussian notch.
 */
export function gapFactor(r, gaps = GAPS) {
    let f = 1;
    for (const g of gaps) {
        const s = g.width / FWHM;
        const d = (r - g.r) / s;
        f *= 1 - (1 - g.depth) * Math.exp(-0.5 * d * d);
    }
    return f;
}

/**
 * Vertical optical depth of the millimetre dust: thick in the middle, ~1
 * through the bright rings, cut off sharply at the disk's edge.
 */
export function dustOpticalDepth(r) {
    const rr = Math.max(r, 0.5);
    return 2.5 * Math.pow(rr / 20, -1) * Math.exp(-Math.pow(rr / HL_TAU.outerRadius, 6)) * gapFactor(rr);
}

/** Midplane dust temperature, a passive disk lit by its star: ~T ∝ r^−1/2. */
export function dustTemperature(r) {
    return 30 * Math.pow(Math.max(r, 0.5) / 50, -0.5);
}

/**
 * Millimetre brightness at radius r, relative to 20 AU. At these wavelengths
 * a blackbody's brightness is proportional to its temperature
 * (Rayleigh–Jeans), and a slab of optical depth τ seen face-on shines
 * B(T)(1 − e^−τ).
 */
export function mmBrightness(r) {
    return (dustTemperature(r) / dustTemperature(20)) * (1 - Math.exp(-dustOpticalDepth(r)));
}

/** Gas scale height over radius: a flared disk, thicker relative to r further out. */
export function gasAspect(r) {
    return 0.05 * Math.pow(Math.max(r, 0.5) / 10, 0.25);
}

/** Orbital period in years at r AU round a star of mStar suns (Kepler's third law). */
export function keplerPeriod(r, mStar = HL_TAU.starMass) {
    return Math.sqrt((r * r * r) / mStar);
}

/** Jupiter's mass in suns. */
export const JUPITER_IN_SUNS = 9.546e-4;

/**
 * The planet that would carve a gap `width` wide at radius r: Kanagawa et
 * al. (2016)'s fit to simulated gaps, Δ/r = 0.41 q^½ (h/r)^−¾ α^−¼, solved
 * for the planet-to-star mass ratio q. α is the disk's turbulent viscosity;
 * 10⁻³ is the usual guess.
 */
export function planetMassRatio(width, r, aspect = gasAspect(r), alpha = 1e-3) {
    const k = width / r / 0.41;
    return k * k * Math.pow(aspect, 1.5) * Math.sqrt(alpha);
}

/** The gap width Kanagawa et al. (2016) give for a planet of mass ratio q. */
export function gapWidth(q, r, aspect = gasAspect(r), alpha = 1e-3) {
    return 0.41 * r * Math.sqrt(q) * Math.pow(aspect, -0.75) * Math.pow(alpha, -0.25);
}

/**
 * The spiral wake a planet at rp raises in the gas: the azimuth of its crest
 * at radius r, relative to the planet's, for a disk turning towards +φ.
 * Rafikov (2002) in the form Muto et al. (2012) fit to scattered-light
 * spirals, with Ω ∝ r^−3/2 and a sound speed ∝ r^−1/4; hp is the planet's
 * h/r. Trailing: it falls behind outside the planet and runs ahead inside.
 */
export function wakePhase(r, rp, hp = gasAspect(rp)) {
    const a = 1.5;
    const b = 0.25;
    const x = r / rp;
    const c1 = 1 / (1 + b);
    const c2 = 1 / (1 - a + b);
    const f = Math.pow(x, 1 + b) * (c1 - c2 * Math.pow(x, -a)) - (c1 - c2);
    return -Math.sign(r - rp) * f / hp;
}

/**
 * The planets the scene shows: one in each of the three deepest gaps, the
 * mass Kanagawa's fit gives for the gap's width, and an arbitrary starting
 * angle so they aren't lined up.
 */
export const PLANETS = ['D1', 'D2', 'D6'].map((id, i) => {
    const g = GAPS.find((x) => x.id === id);
    const q = planetMassRatio(g.width, g.r);
    return {
        gap: id, r: g.r, q,
        jupiters: (q * HL_TAU.starMass) / JUPITER_IN_SUNS,
        phase0: [0.6, 2.9, 4.6][i],
    };
});

/** Where a planet is, `years` into the scene: a circular, counter-clockwise orbit. */
export function planetPosition(p, years, mStar = HL_TAU.starMass) {
    const ang = p.phase0 + (2 * Math.PI * years) / keplerPeriod(p.r, mStar);
    return [p.r * Math.cos(ang), p.r * Math.sin(ang), 0];
}
