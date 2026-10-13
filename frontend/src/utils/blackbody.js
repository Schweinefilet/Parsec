// The colour of a blackbody at temperature T, as linear sRGB.
//
// Gargantua's disk is coloured by temperature, not by an artist's ramp: DNGR
// gave it a 4500 K blackbody spectrum (James et al. 2015, §4.1), and with
// Doppler shift switched on the colour is the blackbody at the *shifted*
// temperature — a blackbody seen at a frequency shift g is exactly a blackbody
// at gT. So the shader needs one lookup, temperature → colour, and this builds
// it: Planck's law integrated against the CIE 1931 colour-matching functions,
// then XYZ → linear sRGB.
//
// The matching functions are the multi-lobe Gaussian fit of Wyman, Sloan &
// Shirley (2013), accurate to well under a percent of the tabulated curves —
// plenty for a lookup whose output then goes through bloom and a film curve.

// Second radiation constant, hc/k, in nm·K.
const C2 = 1.4388e7;

const lobe = (l, mu, s1, s2) => {
    const t = (l - mu) / (l < mu ? s1 : s2);
    return Math.exp(-0.5 * t * t);
};

/** CIE 1931 2° colour-matching functions at wavelength `l` in nm. */
export function cieXYZ(l) {
    return [
        1.056 * lobe(l, 599.8, 37.9, 31.0) + 0.362 * lobe(l, 442.0, 16.0, 26.7) - 0.065 * lobe(l, 501.1, 20.4, 26.2),
        0.821 * lobe(l, 568.8, 46.9, 40.5) + 0.286 * lobe(l, 530.9, 16.3, 31.1),
        1.217 * lobe(l, 437.0, 11.8, 36.0) + 0.681 * lobe(l, 459.0, 26.0, 13.8),
    ];
}

/** Planck spectral radiance at `l` nm, up to a constant factor. */
export function planck(l, T) {
    return 1 / (Math.pow(l, 5) * (Math.exp(C2 / (l * T)) - 1));
}

/**
 * Linear-sRGB colour of a blackbody at T kelvin, normalised to luminance
 * Y = 1 — hue only. Brightness is the caller's (σT⁴, beaming, exposure).
 * Out-of-gamut channels (a deep red source has negative blue) clip to 0.
 */
export function blackbodyRGB(T) {
    let X = 0, Y = 0, Z = 0;
    for (let l = 380; l <= 780; l += 2) {
        const p = planck(l, T);
        const [x, y, z] = cieXYZ(l);
        X += p * x; Y += p * y; Z += p * z;
    }
    X /= Y; Z /= Y; Y = 1;
    return [
        Math.max(0, 3.2406 * X - 1.5372 * Y - 0.4986 * Z),
        Math.max(0, -0.9689 * X + 1.8758 * Y + 0.0415 * Z),
        Math.max(0, 0.0557 * X - 0.2040 * Y + 1.0570 * Z),
    ];
}

/** Temperature range of the lookup. Log-spaced: colour changes per ratio, not per kelvin. */
export const BLACKBODY_MIN_K = 600;
export const BLACKBODY_MAX_K = 100000;

/** Where in [0, 1] of the lookup a temperature falls. The shader repeats this. */
export function blackbodyCoord(T) {
    const lo = Math.log(BLACKBODY_MIN_K);
    const hi = Math.log(BLACKBODY_MAX_K);
    return Math.min(1, Math.max(0, (Math.log(T) - lo) / (hi - lo)));
}

/** `size` RGBA float texels spanning the range above, for a 1-row DataTexture. */
export function blackbodyTable(size = 256) {
    const out = new Float32Array(size * 4);
    const lo = Math.log(BLACKBODY_MIN_K);
    const hi = Math.log(BLACKBODY_MAX_K);
    for (let i = 0; i < size; i++) {
        const T = Math.exp(lo + ((hi - lo) * i) / (size - 1));
        const [r, g, b] = blackbodyRGB(T);
        out.set([r, g, b, 1], i * 4);
    }
    return out;
}
