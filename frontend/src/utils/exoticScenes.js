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

/**
 * What the page's picker offers, in order. Gargantua is its own page
 * (GargantuaPage), shown under the same picker; the rest are entries below.
 */
export const EXOTIC_ORDER = ['gargantua', 'wormhole', 'binary', 'tde', 'wr104'];
export const DEFAULT_EXOTIC = 'gargantua';
/**
 * Built, tested, but pulled from the picker while they get a visual rework:
 * their URLs fall back to the default. Put an id back in EXOTIC_ORDER to
 * bring it back.
 */
export const STASHED_EXOTIC = ['neutron-star', 'roche', 'ring', 'hl-tau'];

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
    'hl-tau': {
        // In AU. No integrator: light goes straight, and the gas is marched
        // in `maxSteps` samples.
        base: { stepScale: 1, maxSteps: 220 },
        minDist: 40, maxDist: 700,
        exposure: 1.1,
        sky: { milkyWay: 0.06 },
        shots: {
            // As ALMA saw it: 46.7° from face-on.
            alma: { dist: 250, el: (90 - 46.72) * DEG, fov: 44 * DEG, set: { view: 'mm' } },
            above: { dist: 260, el: 85 * DEG, fov: 44 * DEG },
            edge: { dist: 380, el: 2 * DEG, fov: 40 * DEG, set: { view: 'visible' } },
            close: { dist: 75, el: 24 * DEG, fov: 58 * DEG },
        },
        shotOrder: ['alma', 'above', 'edge', 'close'],
        start: { dist: 420, az: -0.9, el: 60 * DEG, fov: 40 * DEG },
    },
    wr104: {
        // In AU. Marched, sphere-traced through the space between the turns.
        base: { stepScale: 0.02, maxSteps: 420 },
        minDist: 120, maxDist: 4000,
        exposure: 1.0,
        sky: { milkyWay: 0.04 },
        shots: {
            // Nearly face-on, as Keck sees it.
            earth: { dist: 1500, el: 84 * DEG, fov: 46 * DEG },
            tilted: { dist: 1500, el: 32 * DEG, fov: 46 * DEG },
            edge: { dist: 1600, el: 2 * DEG, fov: 44 * DEG },
            close: { dist: 260, el: 55 * DEG, fov: 55 * DEG },
        },
        shotOrder: ['earth', 'tilted', 'edge', 'close'],
        start: { dist: 2600, az: 0.5, el: 70 * DEG, fov: 40 * DEG },
    },
    ring: {
        // In thousands of AU. Marched; `stepScale` scales its steps.
        base: { stepScale: 1, maxSteps: 520 },
        minDist: 25, maxDist: 600,
        exposure: 1.0,
        sky: { milkyWay: 0.08 },
        shots: {
            // From Earth we look down the long axis, within a few degrees.
            earth: { dist: 175, el: 86 * DEG, fov: 44 * DEG },
            side: { dist: 190, el: 3 * DEG, fov: 48 * DEG },
            tilted: { dist: 180, el: 38 * DEG, fov: 46 * DEG },
            inside: { dist: 34, el: 70 * DEG, fov: 75 * DEG },
        },
        shotOrder: ['earth', 'tilted', 'side', 'inside'],
        start: { dist: 320, az: -0.6, el: 80 * DEG, fov: 40 * DEG },
    },
    tde: {
        // In M: Kerr at a = 0, as the neutron star.
        base: { stepScale: 0.04, maxSteps: 800 },
        minDist: 14, maxDist: 1500,
        exposure: 0.85,
        shots: {
            // Framed by the scene as it goes (exoticSceneSetup.js tdeFrame).
            follow: { dist: 300, el: 55 * DEG, fov: 50 * DEG, follow: true },
            above: { dist: 170, el: 72 * DEG, fov: 50 * DEG },
            tilted: { dist: 120, el: 20 * DEG, fov: 52 * DEG },
            close: { dist: 44, el: 9 * DEG, fov: 62 * DEG },
        },
        shotOrder: ['follow', 'above', 'tilted', 'close'],
        start: { dist: 420, az: 0.4, el: 60 * DEG, fov: 46 * DEG },
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

/** The object for a URL segment, falling back to the default (stashed ones too). */
export function resolveExotic(id) {
    return EXOTIC_ORDER.includes(id) ? id : DEFAULT_EXOTIC;
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
