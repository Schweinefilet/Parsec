// A traversable wormhole, for the /exotic/wormhole page: the Ellis (1973)
// metric, the simplest one there is and the zero-mass, sharp-edged limit of
// the wormhole James, von Tunzelmann, Franklin & Thorne built for
// Interstellar (2015, "Visualizing Interstellar's Wormhole").
//
//   ds² = −dt² + dℓ² + (ℓ² + b²)(dθ² + sin²θ dφ²)
//
// ℓ runs from −∞ (the other universe) to +∞ (ours) through a throat at ℓ = 0,
// where the spheres around it are smallest: radius b. Lengths are in units of
// b, so the throat radius is 1.
//
// With no mass there is no time dilation and no redshift: the whole picture is
// lensing. Every ray stays in one plane through the throat, so the shader
// integrates it in 2D — (ℓ, φ) and the radial momentum — with the angular
// momentum h conserved, and only turns it back into a 3D direction at the end.
// Hamilton's equations for H = ½(p_ℓ² + h²/r²) with r² = ℓ² + b²:
//   dℓ/dλ = p_ℓ,   dφ/dλ = h/r²,   dp_ℓ/dλ = h²ℓ/r⁴.
// `wormholeDerivative` below is the shader's `wormDeriv`, line for line.

/** Throat radius in the page's units. Everything else scales with it. */
export const THROAT = 1;

/** Areal radius of the sphere at ℓ: the size a ring there looks from far off. */
export function arealRadius(l, b = THROAT) {
    return Math.sqrt(l * l + b * b);
}

/** d/dλ of [ℓ, φ, p_ℓ] for a ray of angular momentum h (unit energy). */
export function wormholeDerivative(s, h, b = THROAT) {
    const [l, , pl] = s;
    const r2 = l * l + b * b;
    return [pl, h / r2, (h * h * l) / (r2 * r2)];
}

/** The integration step: fine at the throat, coarse far out. */
export function wormholeStep(l, b, scale) {
    return scale * Math.min(Math.max(Math.sqrt(l * l + b * b), b), 40 * b);
}

function rk4(s, h, b, dl) {
    const add = (u, k, m) => u.map((v, i) => v + m * k[i]);
    const k1 = wormholeDerivative(s, h, b);
    const k2 = wormholeDerivative(add(s, k1, dl / 2), h, b);
    const k3 = wormholeDerivative(add(s, k2, dl / 2), h, b);
    const k4 = wormholeDerivative(add(s, k3, dl), h, b);
    return s.map((v, i) => v + (dl / 6) * (k1[i] + 2 * k2[i] + 2 * k3[i] + k4[i]));
}

/**
 * Follow a ray that leaves ℓ = `l0` at angle `psi` to the radial direction
 * pointing away from the throat on the +ℓ side's orientation (ψ = π is
 * straight at it when ℓ0 > 0). Returns which universe it ends up in (`side`,
 * +1 ours, −1 the other), how far round it went (`phi`), and the angle `psiOut`
 * its final direction makes with the outward radial on that side.
 */
export function traceWormholeRay(l0, psi, { b = THROAT, escape, scale = 0.03, maxSteps = 20000 } = {}) {
    const esc = escape ?? Math.max(Math.abs(l0) * 1.5, 60 * b);
    const h = arealRadius(l0, b) * Math.sin(psi);
    let s = [l0, 0, Math.cos(psi)];
    for (let n = 0; n < maxSteps; n++) {
        const side = s[0] >= 0 ? 1 : -1;
        if (Math.abs(s[0]) > esc && side * s[2] > 0) {
            const r = arealRadius(s[0], b);
            return { side, phi: s[1], psiOut: Math.atan2(h / r, side * s[2]), steps: n, h };
        }
        s = rk4(s, h, b, wormholeStep(s[0], b, scale));
    }
    return { side: 0, phi: s[1], psiOut: NaN, steps: maxSteps, h };
}

/** Complete elliptic integral of the first kind K(k), by the AGM. */
export function ellipticK(k) {
    let a = 1;
    let g = Math.sqrt(1 - k * k);
    for (let i = 0; i < 30 && Math.abs(a - g) > 1e-15; i++) {
        [a, g] = [(a + g) / 2, Math.sqrt(a * g)];
    }
    return Math.PI / (2 * a);
}

/**
 * Closed-form sweep of a ray from infinity to infinity, in radians round the
 * throat. Above h = b it turns back into our universe, having swept 2K(b/h)
 * (so it is deflected by 2K − π, which goes to πb²/4h² far out). Below it,
 * the ray goes through and sweeps 2(h/b)K(h/b) on its way to the other side.
 */
export function ellisSweep(h, b = THROAT) {
    const ah = Math.abs(h);
    if (ah > b) return { through: false, sweep: 2 * ellipticK(b / ah) };
    return { through: true, sweep: 2 * (ah / b) * ellipticK(ah / b) };
}

/**
 * A traced ray's final direction as a 3D unit vector, given the camera's
 * outward radial `eOut` and the ray's in-plane tangent `eT` (both unit,
 * perpendicular). On the far side the outward radial is −e_r(φ): the other
 * universe is the mirror copy of ours. Mirrors the shader's exit step.
 */
export function exitDirection(eOut, eT, { side, phi, psiOut }) {
    const c = Math.cos(phi), s = Math.sin(phi);
    const er = eOut.map((v, i) => c * v + s * eT[i]);
    const ep = eOut.map((v, i) => -s * v + c * eT[i]);
    return er.map((v, i) => Math.cos(psiOut) * side * v + Math.sin(psiOut) * ep[i]);
}

/**
 * Where the camera is `t` seconds into the "Go through" shot: in from ℓ = 14,
 * through the throat, out to ℓ = −14, then a slow turn to look back at the
 * sphere, now with our own sky inside it. `turn` is the yaw in radians.
 */
export const TRAVERSE_SECONDS = 26;
export function traversePose(t) {
    const u = Math.min(Math.max(t / TRAVERSE_SECONDS, 0), 1);
    const m = Math.min(u / 0.72, 1);
    const ease = m * m * (3 - 2 * m);
    const k = Math.min(Math.max((u - 0.72) / 0.28, 0), 1);
    return {
        l: 14 - 28 * ease,
        turn: Math.PI * k * k * (3 - 2 * k),
        done: u >= 1,
    };
}
