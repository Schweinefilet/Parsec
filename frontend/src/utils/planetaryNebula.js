// The Ring Nebula (M57, NGC 6720): the shell a Sun-like star threw off about
// four thousand years ago, lit up by what is left of the star: a white dwarf
// at 135,000 K, hot enough that its ultraviolet strips the electrons off the
// gas. The gas glows as the electrons come back, not in a blackbody's smooth
// spectrum but in a handful of sharp lines, each from one element in one
// state: hydrogen's red H-α, doubly ionised oxygen's teal [O III], singly
// ionised nitrogen's red [N II] and so on. Which lines shine where depends on
// how hard the ultraviolet still is there, so the colours sort themselves
// into layers by distance from the star.
//
// Units: 1000 AU ("kAU") for the nebula, nanometres for light. The /exotic
// shader (exoticShaders.js NEBULA_FRAG) mirrors nebulaDensity and the zone
// profiles line for line.

import { cieXYZ, planck } from './blackbody';

/** What has been measured. */
export const RING = {
    // Gaia parallax of the central star.
    distancePc: 790,
    // From JWST (Wesson et al. 2024) and the star's spectrum.
    starTemp: 135000,
    starLuminosity: 310,
    // O'Dell et al. (2013): homologous expansion, about 4000 years old.
    ageYears: 4000,
    // About 20,000 dense globules in the main ring, each ~0.2" across (JWST).
    globules: 20000,
    // Ten or so faint arcs in the halo, from a companion's orbit of ~280 yr.
    arcPeriodYears: 280,
    // The star sits about 2" off the centre of the shell (Wesson et al. 2024).
    starOffsetArcsec: 2,
    // A cool companion 15,000 AU out makes it a triple (Wesson et al. 2024).
    companionAu: 15000,
};

/** One arcsecond at the nebula's distance, in kAU. */
export const ARCSEC_KAU = RING.distancePc / 1000;

/**
 * The lines the scene draws, in nm (air wavelengths), and how strong each is
 * against H-β where it shines (typical of the Ring's spectrum: H-α at the
 * recombination ratio 2.86, [O III] about ten times H-β inside, [N II] about
 * as strong as H-α at the ionisation front).
 */
export const LINES = {
    he2: { nm: 468.57, strength: 0.4 },
    hb: { nm: 486.13, strength: 1 },
    o3: { nm: 500.68, strength: 10 },
    ha: { nm: 656.28, strength: 2.86 },
    n2: { nm: 658.35, strength: 3.0 },
    s2: { nm: 671.6, strength: 0.6 },
};

/**
 * Linear sRGB of one watt at a single wavelength, as the eye would see it:
 * the CIE 1931 matching functions, then XYZ → sRGB. A pure spectral colour
 * is outside the sRGB gamut, so the negative channel is clipped. Its size
 * carries the eye's sensitivity: green-teal [O III] looks several times
 * brighter than the same power of deep-red H-α.
 */
export function lineRGB(nm) {
    const [X, Y, Z] = cieXYZ(nm);
    return [
        Math.max(0, 3.2406 * X - 1.5372 * Y - 0.4986 * Z),
        Math.max(0, -0.9689 * X + 1.8758 * Y + 0.0415 * Z),
        Math.max(0, 0.0557 * X - 0.2040 * Y + 1.0570 * Z),
    ];
}

/**
 * The colour each line is drawn in for a palette: 'eye' is lineRGB times
 * the line's strength; 'hubble' is the SHO mapping of Hubble's narrowband
 * images, sulphur and nitrogen red, hydrogen green, oxygen blue.
 */
export function paletteColours(palette) {
    const out = {};
    for (const [id, l] of Object.entries(LINES)) {
        if (palette === 'hubble') {
            const c = { s2: [1, 0.1, 0], n2: [1, 0.12, 0], ha: [0.1, 1, 0.2], hb: [0, 0, 0], o3: [0, 0.35, 1], he2: [0.15, 0.3, 1] }[id];
            // Each filter stretched on its own, as narrowband images are.
            const gain = { s2: 3, n2: 0.9, ha: 1, hb: 0, o3: 0.28, he2: 2 }[id];
            out[id] = c.map((v) => v * gain * l.strength * 0.25);
        } else {
            out[id] = lineRGB(l.nm).map((v) => v * l.strength * 0.25);
        }
    }
    return out;
}

// ── the star's ultraviolet ──────────────────────────────────────────────────

const H_EV_NM = 1239.84; // hc in eV·nm
const LYMAN_NM = H_EV_NM / 13.6; // 91.2 nm: shorter than this ionises hydrogen

/**
 * The fraction of a blackbody's photons (by number, not energy) able to
 * ionise hydrogen, numerically from Planck's law.
 */
export function ionisingFraction(T) {
    let all = 0;
    let ion = 0;
    // Integrate in ln λ from 1 nm to 100 µm; photon number ∝ B_λ·λ.
    const steps = 4000;
    const a = Math.log(1), b = Math.log(1e5);
    for (let i = 0; i < steps; i++) {
        const l = Math.exp(a + ((i + 0.5) * (b - a)) / steps);
        const n = planck(l, T) * l * l;
        all += n;
        if (l < LYMAN_NM) ion += n;
    }
    return ion / all;
}

const L_SUN = 3.828e26; // W
const K_B = 1.380649e-23;

/**
 * Ionising photons per second from a star of luminosity L (suns) at T: its
 * photon rate (L over the mean photon energy, 2.701kT for a blackbody)
 * times the ionising fraction.
 */
export function ionisingPhotonRate(T, L) {
    const meanE = 2.701 * K_B * T;
    return ((L * L_SUN) / meanE) * ionisingFraction(T);
}

/** Case-B recombination coefficient of hydrogen at 10,000 K, cm³/s. */
export const ALPHA_B = 2.6e-13;

/**
 * Strömgren radius in cm: how far Q ionising photons a second can keep gas
 * of density n (cm⁻³) ionised, where recombinations use them all up.
 */
export function stromgrenRadius(Q, n, alpha = ALPHA_B) {
    return Math.cbrt((3 * Q) / (4 * Math.PI * n * n * alpha));
}

/** Years for gas at v km/s to reach r kAU. */
export function expansionAge(rKau, vKmS) {
    const km = rKau * 1000 * 1.495978707e8;
    return km / vKmS / 3.15576e7;
}

// ── the shape ───────────────────────────────────────────────────────────────

/**
 * The main shell: a triaxial ellipsoid (O'Dell et al. 2013) with its long
 * axis close to our line of sight, which is why from Earth it looks like a
 * ring: we look down a barrel. Semi-axes in kAU.
 */
export const SHELL = { a: 33, b: 26, c: 58, thickness: 0.13 };
/** The faint halo round it, as a multiple of the shell's size. */
export const HALO = { inner: 1.15, outer: 2.3, density: 0.2 };

/** Ellipsoidal radius: 1 on the shell's mid-surface. */
export function shellRadius(x, y, z) {
    return Math.hypot(x / SHELL.a, y / SHELL.b, z / SHELL.c);
}

/**
 * Electron density at a point, relative to the ring's peak: the shell,
 * densest round its waist and thinner over the poles, a tenuous fill inside,
 * and the halo outside with its faint, evenly spaced arcs.
 */
export function nebulaDensity(x, y, z, arcSpacing = 1.9) {
    const s = shellRadius(x, y, z);
    const pole = z / (SHELL.c * Math.max(s, 1e-6));
    const waist = 0.25 + 0.75 * Math.exp(-(pole * pole) / 0.5);
    const d = (s - 1) / SHELL.thickness;
    const shell = Math.exp(-d * d) * waist;
    const inside = 0.08 * (1 - smooth(0.85, 1.0, s));
    let halo = HALO.density * smooth(HALO.inner - 0.1, HALO.inner + 0.1, s) * (1 - smooth(HALO.outer - 0.3, HALO.outer, s));
    const r = Math.hypot(x, y, z);
    halo *= 0.6 + 0.4 * Math.cos((2 * Math.PI * r) / arcSpacing);
    return shell + inside + halo;
}

/**
 * How much of each line's emission comes from ellipsoidal radius s: the
 * ionisation layers, hardest nearest the star. He II only deep inside,
 * [O III] through the cavity to the ring's inner face, hydrogen everywhere
 * the gas is ionised, [N II] and [S II] piled up at the ionisation front.
 */
export function zoneWeights(s) {
    const front = Math.exp(-(((s - 1.02) / 0.08) ** 2));
    // Past the shell, the halo: older, thinner gas, still lit, glowing
    // mostly in hydrogen and nitrogen.
    const halo = smooth(HALO.inner - 0.12, HALO.inner, s);
    const h = Math.max(1 - smooth(1.04, 1.14, s), halo);
    return {
        he2: 1 - smooth(0.55, 0.8, s),
        o3: 1 - smooth(0.88, 1.02, s) + 0.25 * halo,
        hb: h,
        ha: h,
        n2: 0.15 * h + front + 0.5 * halo,
        s2: 0.15 * h + front + 0.5 * halo,
    };
}

function smooth(e0, e1, x) {
    const t = Math.min(Math.max((x - e0) / (e1 - e0), 0), 1);
    return t * t * (3 - 2 * t);
}
