// The /gargantua page's camera, shots and quality levels — everything about
// the scene that is plain arithmetic, kept out of the component so it can be
// tested without a GPU.
//
// The camera orbits the hole on a sphere: `dist` in gravitational radii, `az`
// around the spin axis, `el` above the disk plane. Coordinates are the
// shader's Kerr–Schild ones, spin along +z.

import { FILM_SPIN, MAX_SPIN } from './kerr';

const DEG = Math.PI / 180;

/**
 * How hard the GPU works. `stepScale` sets the integration step (smaller is
 * finer), `maxSteps` how far a ray may go before it is given up on, `scale`
 * the trace resolution against the screen's own pixels. Ultra and above are
 * meant to hurt: this page is the one place on the site that is built to.
 */
export const QUALITY = {
    balanced: { stepScale: 0.06, maxSteps: 360, scale: 0.75 },
    high: { stepScale: 0.035, maxSteps: 720, scale: 1 },
    ultra: { stepScale: 0.022, maxSteps: 1300, scale: 1.25 },
    absurd: { stepScale: 0.013, maxSteps: 2800, scale: 2 },
};
export const QUALITY_ORDER = ['balanced', 'high', 'ultra', 'absurd'];
export const DEFAULT_QUALITY = 'high';

/** The next level down, for when the GPU gives up; null at the bottom. */
export function lowerQuality(q) {
    const i = QUALITY_ORDER.indexOf(q);
    return i > 0 ? QUALITY_ORDER[i - 1] : null;
}

/**
 * Framed views. Each sets where the camera eases to and how the hole looks
 * when it gets there; `dive` is a sequence of its own (divePose below).
 */
export const SHOTS = {
    // As the film shows it: spin 0.6, no Doppler, a 4500 K disk, the camera
    // just above its plane.
    film: { spin: FILM_SPIN, doppler: 0, temp: 4500, dist: 30, el: 4 * DEG, fov: 50 * DEG },
    // What the film left out: near-maximal spin, and the disk's own motion
    // brightening the side coming towards you and dimming the other.
    physical: { spin: MAX_SPIN, doppler: 1, temp: 6200, dist: 28, el: 7 * DEG, fov: 50 * DEG },
    // From high above: the disk as a disk, and its far side still bent up
    // into a ring around the shadow.
    above: { spin: FILM_SPIN, doppler: 0, temp: 4500, dist: 34, el: 62 * DEG, fov: 52 * DEG },
    // Cooper's fall: in towards the horizon until the view goes dark.
    dive: { spin: FILM_SPIN, doppler: 0, temp: 4500, dist: 30, el: 8 * DEG, fov: 60 * DEG },
};
export const SHOT_ORDER = ['film', 'physical', 'above', 'dive'];

export const MIN_DIST = 3;
export const MAX_DIST = 120;
export const MAX_EL = 85 * DEG;

/** Length of the dive, in seconds, and when its fade to black starts. */
export const DIVE_SECONDS = 32;
const DIVE_FADE_FROM = 0.9;

/**
 * Where the camera is `t` seconds into the dive. It falls slowly at first and
 * faster as it nears the hole — a smooth ease, not the real free-fall, which
 * would spend nearly all of its time far away — sinks towards the disk plane
 * and turns with it. The view fades out just short of the horizon: the
 * Kerr–Schild picture breaks down inside the ergosphere, where no camera can
 * hold still, so it stops before it.
 */
export function divePose(t, rh) {
    const u = Math.min(Math.max(t / DIVE_SECONDS, 0), 1);
    const ease = u * u * (3 - 2 * u);
    const end = Math.max(rh * 1.25, 2.4);
    return {
        dist: 30 + (end - 30) * Math.pow(ease, 0.8),
        el: (8 - 5 * ease) * DEG,
        az: 0.9 * ease,
        fov: (60 + 25 * ease) * DEG,
        fade: u < DIVE_FADE_FROM ? 1 : Math.max(0, 1 - (u - DIVE_FADE_FROM) / (1 - DIVE_FADE_FROM)),
        done: u >= 1,
    };
}

/** Frame-rate-independent ease of `cur` towards `target`; `rate` per second. */
export function damp(cur, target, rate, dt) {
    return target + (cur - target) * Math.exp(-rate * dt);
}

/** The shortest-way equivalent of `target` relative to the angle `cur`. */
export function nearestAngle(cur, target) {
    const tau = 2 * Math.PI;
    return cur + ((((target - cur) % tau) + tau + Math.PI) % tau) - Math.PI;
}

/**
 * Camera position and an orthonormal right/up/forward basis looking at the
 * hole, with spin up and `roll` turning the frame about the line of sight.
 */
export function cameraFrame({ dist, az, el, roll = 0 }) {
    const ce = Math.cos(el);
    const pos = [dist * ce * Math.cos(az), dist * ce * Math.sin(az), dist * Math.sin(el)];
    const fwd = pos.map(v => -v / dist);
    // right = fwd × z, normalised; up = right × fwd.
    let right = [fwd[1], -fwd[0], 0];
    const rl = Math.hypot(right[0], right[1]) || 1;
    right = right.map(v => v / rl);
    const up = [
        right[1] * fwd[2] - right[2] * fwd[1],
        right[2] * fwd[0] - right[0] * fwd[2],
        right[0] * fwd[1] - right[1] * fwd[0],
    ];
    const c = Math.cos(roll), s = Math.sin(roll);
    return {
        pos,
        fwd,
        right: right.map((v, i) => c * v + s * up[i]),
        up: up.map((v, i) => c * v - s * right[i]),
    };
}

/** Clamp a user-driven camera to where the renderer stays honest. */
export function clampCamera(cam) {
    return {
        ...cam,
        dist: Math.min(Math.max(cam.dist, MIN_DIST), MAX_DIST),
        el: Math.min(Math.max(cam.el, -MAX_EL), MAX_EL),
    };
}

// ── readouts ────────────────────────────────────────────────────────────────

/**
 * GM/c² for Gargantua, in km. The film's hole is about 100 million suns
 * (Thorne, The Science of Interstellar, ch. 6), which makes one gravitational
 * radius almost exactly one astronomical unit.
 */
export const GARGANTUA_SOLAR_MASSES = 1e8;
export const GRAV_RADIUS_KM = 1.4766 * GARGANTUA_SOLAR_MASSES;
export const AU_KM = 1.495978707e8;

/**
 * How long one hour at the camera lasts far away, as a rounded value and a
 * unit for the translator: { value, unit: 'minutes' | 'hours' | 'days' | 'years' }.
 */
export function hourElsewhere(dilation) {
    if (!(dilation > 0)) return null;
    const hours = 1 / dilation;
    if (hours < 2) return { value: Math.round(hours * 60), unit: 'minutes' };
    if (hours < 48) return { value: Math.round(hours * 10) / 10, unit: 'hours' };
    if (hours < 24 * 730) return { value: Math.round(hours / 24), unit: 'days' };
    return { value: Math.round(hours / 8766), unit: 'years' };
}
