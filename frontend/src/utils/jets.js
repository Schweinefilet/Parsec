// Relativistic jets, for Gargantua's quasar shot: two beams of plasma shot out
// along the spin axis at nearly the speed of light, glowing by synchrotron
// radiation (electrons spiralling in a magnetic field). Interstellar left them
// out; a hole being fed as hard as a quasar's would have them.
//
// The physics a picture of them needs is special relativity's Doppler
// factor: plasma coming towards you at nearly c looks far brighter than the
// same plasma going away, so one jet outshines the other by orders of
// magnitude, and its blobs seem to move faster than light. The shader
// (gargantuaShaders.js jetGlow) mirrors jetRadius, jetLorentz and the boost.
//
// Units: M (gravitational radii) for lengths, c = 1.

import { cieXYZ } from './blackbody';

/** Synchrotron spectral index: flux ∝ ν^−α. About 0.7 for optically thin jets. */
export const JET_ALPHA = 0.7;
/** The jets' top Lorentz factor; M87's and most quasars' are a few to ten. */
export const JET_GAMMA = 6;
/** How far out the jet has got up to speed, in M. */
export const JET_ACCEL = 60;
/** How far the drawn jets reach, in M. */
export const JET_LENGTH = 420;

/**
 * The colour of synchrotron light, F_ν ∝ ν^−α (so F_λ ∝ λ^(α−2)), through
 * the CIE curves into linear sRGB, normalised to luminance 1: a blue-white.
 * A power law has no scale, so Doppler shifting it changes only how bright
 * it is, never its colour: the boost is all a jet's beaming does to it.
 */
export function synchrotronRGB(alpha = JET_ALPHA) {
    let X = 0, Y = 0, Z = 0;
    for (let l = 380; l <= 780; l += 2) {
        const f = Math.pow(l, alpha - 2);
        const [x, y, z] = cieXYZ(l);
        X += f * x; Y += f * y; Z += f * z;
    }
    X /= Y; Z /= Y;
    return [
        Math.max(0, 3.2406 * X - 1.5372 - 0.4986 * Z),
        Math.max(0, -0.9689 * X + 1.8758 + 0.0415 * Z),
        Math.max(0, 0.0557 * X - 0.2040 + 1.0570 * Z),
    ];
}

/** Lorentz factor of speed β. */
export function lorentz(beta) {
    return 1 / Math.sqrt(1 - beta * beta);
}

/** Speed of Lorentz factor Γ. */
export function speedOf(gamma) {
    return Math.sqrt(1 - 1 / (gamma * gamma));
}

/**
 * The Doppler factor δ = 1 / (Γ(1 − β cos θ)) of plasma moving at β, seen
 * at θ from its direction of motion: the factor its frequencies (and its
 * clocks) are sped up by.
 */
export function dopplerFactor(beta, cosTheta) {
    return 1 / (lorentz(beta) * (1 - beta * cosTheta));
}

/**
 * How much brighter a steady jet looks for its Doppler factor: δ^(2+α).
 * (A single blob gets δ^(3+α); a continuous jet one power less, because
 * the number of blobs in view is compressed by δ too.)
 */
export function jetBoost(delta, alpha = JET_ALPHA) {
    return Math.pow(delta, 2 + alpha);
}

/**
 * Brightness of the approaching jet over the receding one, at θ from the
 * approaching one's axis: ((1 + β cos θ)/(1 − β cos θ))^(2+α).
 */
export function jetCounterjetRatio(beta, theta, alpha = JET_ALPHA) {
    const c = Math.cos(theta);
    return Math.pow((1 + beta * c) / (1 - beta * c), 2 + alpha);
}

/**
 * How fast a blob in the approaching jet appears to cross the sky, in units
 * of c: β sin θ / (1 − β cos θ). Above 1 is "superluminal" motion, an effect
 * of the blob nearly catching up with its own light.
 */
export function apparentSpeed(beta, theta) {
    return (beta * Math.sin(theta)) / (1 - beta * Math.cos(theta));
}

/**
 * The jet's radius at height z above the hole: parabolic, as M87's is from
 * 10² to 10⁵ Schwarzschild radii (Asada & Nakamura 2012: z ∝ r^1.73), on a
 * base about the size of the ergosphere.
 */
export function jetRadius(z) {
    return 1.4 + 0.9 * Math.pow(Math.abs(z), 1 / 1.73);
}

/** The jet's Lorentz factor at height z: accelerating from slow at its base. */
export function jetLorentz(z, gammaMax = JET_GAMMA) {
    return 1 + (gammaMax - 1) * (1 - Math.exp(-Math.abs(z) / JET_ACCEL));
}
