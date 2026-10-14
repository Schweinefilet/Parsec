// The /exotic page's objects: what each one is called in the URL, where its
// camera starts, the framed shots it offers, how far the camera may go, and
// what its integrator costs. Plain data and arithmetic, kept out of the
// renderer so it can be tested without a GPU, the way gargantuaCamera.js is.
//
// The camera orbits on a sphere exactly as on /gargantua (`dist`, `az`, `el`;
// gargantuaCamera.js cameraFrame turns it into a basis). The wormhole is the
// one exception: its `dist` is the signed ℓ, negative on the far side, and
// `turn` swings the camera round to look back at the throat.

import { QUALITY } from './gargantuaCamera';

const DEG = Math.PI / 180;

export const EXOTIC_ORDER = ['wormhole', 'neutron-star', 'binary', 'roche'];
export const DEFAULT_EXOTIC = 'wormhole';

export const EXOTIC = {
    wormhole: {
        // Units of the throat radius.
        base: { stepScale: 0.03, maxSteps: 700 },
        minDist: 1.6, maxDist: 40,
        exposure: 1.4,
        shots: {
            approach: { dist: 7, el: 6 * DEG, fov: 60 * DEG },
            through: { dist: 14, el: 4 * DEG, fov: 70 * DEG, scripted: true },
            far: { dist: -7, el: 6 * DEG, fov: 60 * DEG, turn: Math.PI },
        },
        shotOrder: ['approach', 'through', 'far'],
        start: { dist: 16, az: 0.2, el: 14 * DEG, fov: 55 * DEG },
    },
    'neutron-star': {
        base: { stepScale: 0.035, maxSteps: 900 },
        minDist: 12, maxDist: 160,
        exposure: 0.9,
        shots: {
            // J0030 as NICER sees it: 54° from the north pole. Both hot
            // regions are in the south, in view only by bending.
            earth: { dist: 34, el: (90 - 54) * DEG, fov: 36 * DEG },
            south: { dist: 34, el: -62 * DEG, fov: 36 * DEG },
            close: { dist: 17, el: -24 * DEG, fov: 60 * DEG },
        },
        shotOrder: ['earth', 'south', 'close'],
        start: { dist: 70, az: 0.4, el: 10 * DEG, fov: 40 * DEG },
    },
    binary: {
        base: { stepScale: 0.05, maxSteps: 900 },
        minDist: 14, maxDist: 160,
        exposure: 1.2,
        // The galaxy's bright core straight behind the pair, its band along
        // the orbit's plane: a busy background is what shows the shadows.
        sky: { euler: [0, 0, Math.PI], milkyWay: 0.15 },
        shots: {
            edge: { dist: 34, el: 5 * DEG, fov: 50 * DEG },
            above: { dist: 52, el: 58 * DEG, fov: 44 * DEG },
            close: { dist: 24, el: 12 * DEG, fov: 60 * DEG },
        },
        shotOrder: ['edge', 'above', 'close'],
        start: { dist: 90, az: -0.4, el: 22 * DEG, fov: 44 * DEG },
    },
    roche: {
        // In units of the separation; there is no integrator, only marching.
        base: { stepScale: 1, maxSteps: 1 },
        minDist: 0.9, maxDist: 8,
        exposure: 1.0,
        shots: {
            wide: { dist: 2.6, el: 24 * DEG, fov: 46 * DEG },
            eclipse: { dist: 2.8, el: 2 * DEG, fov: 44 * DEG },
            disk: { dist: 1.15, el: 30 * DEG, fov: 55 * DEG, target: 'accretor' },
        },
        shotOrder: ['wide', 'eclipse', 'disk'],
        start: { dist: 4.5, az: -1.2, el: 36 * DEG, fov: 46 * DEG },
    },
};

/** How the sky is turned (XYZ Euler) and how bright its Milky Way is, unless an object says otherwise. */
export const DEFAULT_SKY = { euler: [1.05, 0.35, 0.6], milkyWay: 0.03 };

/** The object for a URL segment, falling back to the default. */
export function resolveExotic(id) {
    return EXOTIC[id] ? id : DEFAULT_EXOTIC;
}

/**
 * The integrator's settings at a quality level: the object's own base,
 * scaled the same way /gargantua's levels scale from its "high".
 */
export function exoticQuality(id, quality) {
    const q = QUALITY[quality] ?? QUALITY.high;
    const { base } = EXOTIC[id];
    return {
        stepScale: base.stepScale * (q.stepScale / QUALITY.high.stepScale),
        maxSteps: Math.min(Math.round(base.maxSteps * (q.maxSteps / QUALITY.high.maxSteps)), 3000),
        scale: q.scale,
    };
}

/** Clamp a user-driven camera to the object's range, keeping the wormhole's sign. */
export function clampExoticCamera(id, cam) {
    const { minDist, maxDist } = EXOTIC[id];
    const sign = cam.dist < 0 ? -1 : 1;
    return {
        ...cam,
        dist: sign * Math.min(Math.max(Math.abs(cam.dist), minDist), maxDist),
        el: Math.min(Math.max(cam.el, -85 * DEG), 85 * DEG),
    };
}

/** Rotate a camera basis about its own up axis by `turn` radians. */
export function turnFrame(frame, turn) {
    if (!turn) return frame;
    const c = Math.cos(turn), s = Math.sin(turn);
    return {
        ...frame,
        fwd: frame.fwd.map((v, i) => c * v + s * frame.right[i]),
        right: frame.right.map((v, i) => c * v - s * frame.fwd[i]),
    };
}
