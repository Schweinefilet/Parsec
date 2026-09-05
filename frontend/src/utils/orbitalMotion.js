// Moon orbital-speed arithmetic, extracted from the render loop so it can be
// tested without a WebGL context.
//
// This is where the "moons sometimes disappear until you refresh" bug lived:
// focusing a planet with no moons made the target speed Infinity, the smoothing
// step below computed Infinity - Infinity = NaN, and because every comparison
// and arithmetic op involving NaN yields NaN again, the speed stayed poisoned
// for the rest of the session. Every moon angle then became NaN and the moons
// vanished. The guards here are load-bearing, hence the tests.

export const DEFAULT_ORBIT_SPEED = 2000;
export const HOVER_ORBIT_SPEED = 80;
export const MOON_FOCUS_ORBIT_SPEED = 500;
const SMOOTHING = 0.05;

/**
 * Target orbital speed for the moons of the currently focused body.
 *
 * @param {object}   opts
 * @param {?string}  opts.hoveredMoonId    moon under the cursor, if any
 * @param {?object}  opts.focusedMoon      focused moon definition, if a moon is focused
 * @param {?object}  opts.focusedPlanet    focused planet definition, if a planet is focused
 * @param {object[]} opts.moons            full moon table
 * @returns {number} a finite speed, always
 */
export function targetOrbitSpeed({ hoveredMoonId, focusedMoon, focusedPlanet, moons }) {
    if (hoveredMoonId) return HOVER_ORBIT_SPEED;
    if (focusedMoon) return MOON_FOCUS_ORBIT_SPEED;
    if (!focusedPlanet) return DEFAULT_ORBIT_SPEED;

    // Bodies flagged noSpeedScaling (the ISS) have ultra-short periods that
    // would otherwise collapse the speed for every other moon of that planet.
    const scaled = moons.filter(m => m.parent === focusedPlanet.name && !m.noSpeedScaling);
    if (scaled.length === 0) return DEFAULT_ORBIT_SPEED;   // moonless planet

    const shortestPeriod = Math.min(...scaled.map(m => m.period));
    if (!Number.isFinite(shortestPeriod)) return DEFAULT_ORBIT_SPEED;

    return Math.max(DEFAULT_ORBIT_SPEED, (shortestPeriod * 86400) / 30);
}

/**
 * Advance the smoothed speed one frame.
 * Snaps rather than eases when the focused planet changed and the new target is
 * slower, so switching focus doesn't bleed the previous planet's high speed.
 */
export function stepOrbitSpeed(current, target, { planetFocusChanged = false } = {}) {
    // Never let a non-finite value enter or leave this function
    if (!Number.isFinite(target)) target = DEFAULT_ORBIT_SPEED;
    if (!Number.isFinite(current)) return target;
    if (planetFocusChanged && target < current) return target;
    return current + (target - current) * SMOOTHING;
}

/** Target speed for the ISS, which reacts immediately rather than easing from ~78k. */
export function targetIssSpeed({ issMoon, focusedId, hoveredMoonId, parentFocused }) {
    if (!issMoon) return DEFAULT_ORBIT_SPEED;
    if (issMoon.id === focusedId) return 10;
    if (hoveredMoonId === issMoon.id) return HOVER_ORBIT_SPEED;
    if (parentFocused) return 667;
    return DEFAULT_ORBIT_SPEED;
}

/**
 * Position of a moon relative to its parent, in scene units.
 * Returns the parent's own position for a non-finite angle rather than
 * propagating NaN into the scene graph.
 */
export function moonOffset(moon, angle) {
    if (!Number.isFinite(angle)) return { x: 0, y: 0, z: 0 };
    const incRad = (moon.inc * Math.PI) / 180;
    return {
        x: Math.cos(angle) * moon.orbitR,
        y: Math.sin(angle) * moon.orbitR * Math.sin(incRad),
        z: Math.sin(angle) * moon.orbitR * Math.cos(incRad),
    };
}

/** Angle after one frame. Direction flips for retrograde moons. */
export function advanceMoonAngle(moon, angle, deltaDays, speed) {
    const dir = moon.retrograde ? -1 : 1;
    const next = angle + dir * ((Math.PI * 2) / moon.period) * deltaDays * speed;
    return Number.isFinite(next) ? next : moon.phase0;
}
