// The bodies the 3D scene draws, and how they are laid out.
//
// Distances and sizes are compressed for legibility — the real solar system is
// mostly empty space, and at true scale every planet would be sub-pixel. Orbit
// *directions* are real (see utils/orbits.js); only the radii are stylised.
// Moon systems are stylised further: spacing and periods are chosen so a
// system reads clearly when you focus its planet.

export const PLANETS = [
    { id: 'mercury', name: 'Mercury', r: 0.68, orbitR: 48,  color: '#b5b5b5' },
    { id: 'venus',   name: 'Venus',   r: 1.24, orbitR: 72,  color: '#e8cda0' },
    { id: 'earth',   name: 'Earth',   r: 1.31, orbitR: 96,  color: '#4fa3e0' },
    { id: 'mars',    name: 'Mars',    r: 0.83, orbitR: 128, color: '#c1440e' },
    { id: 'jupiter', name: 'Jupiter', r: 4.13, orbitR: 190, color: '#c88b3a' },
    { id: 'saturn',  name: 'Saturn',  r: 3.56, orbitR: 245, color: '#e4d191' },
    { id: 'uranus',  name: 'Uranus',  r: 2.25, orbitR: 295, color: '#7de8e8' },
    { id: 'neptune', name: 'Neptune', r: 2.18, orbitR: 340, color: '#5b7fdb' },
    { id: 'pluto',   name: 'Pluto',   r: 0.45, orbitR: 410, color: '#d9c3a8' },
];

// Orbital periods in days — used only for sampling the orbit path
export const ORBITAL_PERIODS = {
    Mercury:  87.97,
    Venus:   224.70,
    Earth:   365.25,
    Mars:    686.97,
    Jupiter: 4332.6,
    Saturn:  10759.2,
    Uranus:  30688.5,
    Neptune: 60182.0,
    Pluto:   90560.0,
};

export const PLANET_PBR = {
    Mercury: { roughness: 0.95, metalness: 0.05 },
    Venus:   { roughness: 0.45, metalness: 0.10 },
    Earth:   { roughness: 0.60, metalness: 0.05 },
    Mars:    { roughness: 0.90, metalness: 0.05 },
    Jupiter: { roughness: 0.30, metalness: 0.00 },
    Saturn:  { roughness: 0.35, metalness: 0.00 },
    Uranus:  { roughness: 0.25, metalness: 0.05 },
    Neptune: { roughness: 0.20, metalness: 0.05 },
    Pluto:   { roughness: 0.95, metalness: 0.00 },
};

// Axial tilt in degrees (angle between rotation axis and ecliptic normal).
// Saturn is intentionally omitted — its existing tilt + rings look great.
export const AXIAL_TILT_DEG = {
    Mercury: 0.034,
    Venus:   177.4,
    Earth:   23.44,
    Mars:    25.19,
    Jupiter: 3.13,
    Uranus:  97.77,
    Neptune: 28.32,
    Pluto:   122.53,
};


// Planets that ship a photographic map under /textures. Pluto is absent on
// purpose — it gets a painted surface, and listing it here would mean firing
// a request that can only 404.
export const PLANET_TEXTURES = new Set([
    'mercury', 'venus', 'earth', 'mars', 'jupiter', 'saturn', 'uranus', 'neptune',
]);

// Only Luna ships a photographic map; every other moon is painted at runtime
// by proceduralTextures.js from its real surface characteristics.
export const MOON_TEXTURES = {
    luna: 'moon.jpg',
};

// 23 natural satellites + ISS — id matches objectCatalog (null = no detail page)
// noSpeedScaling: true → excluded from the minP orbit-speed calculation so fast
// short-period bodies don't slow down all other moons; capped at speed 2000.
export const MOON_DATA = [
    // Earth
    { id: 'luna',      name: 'Moon',      parent: 'Earth',   orbitR: 14,  radius: 0.41, color: '#c8c8c8', period: 27.321,  phase0: 2.35, inc: 5.1,   retrograde: false },
    { id: 'iss',       name: 'ISS',       parent: 'Earth',   orbitR: 2.8, radius: 0.036, hitRadius: 0.18, color: '#c0c8d0', period: 0.0642,  phase0: 1.0,  inc: 51.6,  retrograde: false, noSpeedScaling: true },
    // Mars
    { id: 'phobos',    name: 'Phobos',    parent: 'Mars',    orbitR: 5,   radius: 0.15, color: '#9b8e83', period: 0.319,   phase0: 1.20, inc: 1.1,   retrograde: false },
    { id: 'deimos',    name: 'Deimos',    parent: 'Mars',    orbitR: 8,   radius: 0.14, color: '#b7ada6', period: 1.262,   phase0: 3.70, inc: 1.8,   retrograde: false },
    // Jupiter
    { id: 'amalthea',  name: 'Amalthea',  parent: 'Jupiter', orbitR: 13,  radius: 0.19, color: '#c0826a', period: 0.498,   phase0: 0.80, inc: 0.4,   retrograde: false },
    { id: 'io',        name: 'Io',        parent: 'Jupiter', orbitR: 17,  radius: 0.38, color: '#d8b28b', period: 1.769,   phase0: 1.50, inc: 0.05,  retrograde: false },
    { id: 'europa',    name: 'Europa',    parent: 'Jupiter', orbitR: 21,  radius: 0.34, color: '#d8e0ea', period: 3.551,   phase0: 3.10, inc: 0.47,  retrograde: false },
    { id: 'ganymede',  name: 'Ganymede',  parent: 'Jupiter', orbitR: 27,  radius: 0.45, color: '#b8c3cc', period: 7.155,   phase0: 0.60, inc: 0.2,   retrograde: false },
    { id: 'callisto',  name: 'Callisto',  parent: 'Jupiter', orbitR: 34,  radius: 0.41, color: '#9a8f86', period: 16.689,  phase0: 5.20, inc: 0.19,  retrograde: false },
    // Saturn
    { id: 'mimas',     name: 'Mimas',     parent: 'Saturn',  orbitR: 13,  radius: 0.17, color: '#d0cdc8', period: 0.942,   phase0: 2.10, inc: 1.5,   retrograde: false },
    { id: 'enceladus', name: 'Enceladus', parent: 'Saturn',  orbitR: 16,  radius: 0.23, color: '#dfe9f2', period: 1.370,   phase0: 4.80, inc: 0.0,   retrograde: false },
    { id: 'tethys',    name: 'Tethys',    parent: 'Saturn',  orbitR: 19,  radius: 0.26, color: '#c8c4be', period: 1.888,   phase0: 1.00, inc: 1.1,   retrograde: false },
    { id: 'dione',     name: 'Dione',     parent: 'Saturn',  orbitR: 22,  radius: 0.26, color: '#c2bdb8', period: 2.737,   phase0: 3.50, inc: 0.0,   retrograde: false },
    { id: 'rhea',      name: 'Rhea',      parent: 'Saturn',  orbitR: 26,  radius: 0.32, color: '#bfbbb5', period: 4.518,   phase0: 5.60, inc: 0.3,   retrograde: false },
    { id: 'titan',     name: 'Titan',     parent: 'Saturn',  orbitR: 33,  radius: 0.45, color: '#d7c18b', period: 15.945,  phase0: 1.80, inc: 0.3,   retrograde: false },
    { id: 'iapetus',   name: 'Iapetus',   parent: 'Saturn',  orbitR: 45,  radius: 0.26, color: '#a09488', period: 79.330,  phase0: 4.20, inc: 15.5,  retrograde: false },
    // Uranus
    { id: 'miranda',   name: 'Miranda',   parent: 'Uranus',  orbitR: 10,  radius: 0.14, color: '#c5c5ca', period: 1.413,   phase0: 0.40, inc: 4.2,   retrograde: false },
    { id: 'ariel',     name: 'Ariel',     parent: 'Uranus',  orbitR: 13,  radius: 0.23, color: '#cccdd4', period: 2.520,   phase0: 2.80, inc: 0.0,   retrograde: false },
    { id: 'umbriel',   name: 'Umbriel',   parent: 'Uranus',  orbitR: 16,  radius: 0.23, color: '#8a8d94', period: 4.144,   phase0: 5.00, inc: 0.1,   retrograde: false },
    { id: 'titania',   name: 'Titania',   parent: 'Uranus',  orbitR: 20,  radius: 0.3,  color: '#c0bfc5', period: 8.706,   phase0: 1.60, inc: 0.1,   retrograde: false },
    { id: 'oberon',    name: 'Oberon',    parent: 'Uranus',  orbitR: 24,  radius: 0.3,  color: '#aaa8ae', period: 13.463,  phase0: 3.90, inc: 0.1,   retrograde: false },
    // Neptune
    { id: 'proteus',   name: 'Proteus',   parent: 'Neptune', orbitR: 9,   radius: 0.19, color: '#8a8f96', period: 1.122,   phase0: 2.50, inc: 0.0,   retrograde: false },
    { id: 'triton',    name: 'Triton',    parent: 'Neptune', orbitR: 13,  radius: 0.34, color: '#bcc7d4', period: 5.877,   phase0: 0.90, inc: 157.0, retrograde: true  },
    { id: 'nereid',    name: 'Nereid',    parent: 'Neptune', orbitR: 22,  radius: 0.15, color: '#9fa6b0', period: 360.14,  phase0: 5.10, inc: 7.2,   retrograde: false },
];

// Use astronomy-engine's HelioVector for true planet positions (includes perturbations).
// Normalize to a unit direction then scale by the visual orbitR so out-of-ecliptic
// displacement stays geometrically consistent with the compressed radii.
// Axis mapping: astronomical (x,y,z) → scene (x, z_astro→y, y_astro→z)

export const SMALL_BODIES = [
    // i=0 so bodies sit visually in their belt plane (beltQuat handles ecliptic tilt)
    { id: 'ceres',    name: 'Ceres',           r: 0.10, color: '#8a8a7a', scale: 53.8,
      el: { a: 2.767, e: 0.076, i: 10.59, node:  80.3, peri:  73.60, period: 1682.0, M0: 1.68 } },
    { id: 'vesta',    name: 'Vesta',            r: 0.09, color: '#7a7060', scale: 60.2,
      el: { a: 2.361, e: 0.089, i:  7.14, node: 103.9, peri: 151.2,  period: 1325.0, M0: 0.36 } },
    { id: 'pallas',   name: 'Pallas',           r: 0.08, color: '#6a6a60', scale: 53.8,
      el: { a: 2.772, e: 0.231, i: 34.84, node: 173.1, peri: 310.1, period: 1686.0, M0: 1.37 } },
    { id: 'haumea',   name: 'Haumea',           r: 0.12, color: '#ccc8c0', scale: 10.14,
      el: { a: 43.13, e: 0.191, i: 0, node: 0, peri: 239.0,  period: 103468, M0: 1.8 } },
    { id: 'makemake', name: 'Makemake',         r: 0.12, color: '#c8c4b8', scale:  9.98,
      el: { a: 45.79, e: 0.159, i: 0, node: 0, peri: 294.8,  period: 113183, M0: 2.9 } },
    { id: 'eris',     name: 'Eris',             r: 0.15, color: '#d0cece', scale:  9.16,
      el: { a: 67.8,  e: 0.436, i: 0, node: 0, peri: 151.4,  period: 203469, M0: 3.2 } },
    // Halley keeps its real retrograde inclination — it's the defining feature of this comet
    { id: 'halley',   name: "Halley's Comet",   r: 0.11, color: '#57524a', scale: 16.15, isComet: true,
      el: { a: 17.834, e: 0.967, i: 162.3, node: 58.42, peri: 111.3,  period:  27494, M0: 1.159 } },
];

// Persists across React Router remounts so the exit animation survives navigation

/**
 * Whether this body's surface in the 3D view is painted rather than
 * photographed.
 *
 * Most moons and dwarf planets have no global photographic map, so their
 * surfaces are generated from what the body is known to look like. That is a
 * reasonable thing to show, but not something to pass off as imagery — the UI
 * says so on the object's page.
 *
 * Vesta and Halley are excluded: their shape comes from real 3D shape models
 * rather than a painted map.
 */
export function isSurfacePainted(id) {
    if (['vesta', 'halley', 'sun', 'iss'].includes(id)) return false;
    if (PLANETS.some(p => p.id === id)) return !PLANET_TEXTURES.has(id);
    if (MOON_DATA.some(m => m.id === id)) return !MOON_TEXTURES[id];
    return SMALL_BODIES.some(b => b.id === id);
}

// ── Interstellar probes ────────────────────────────────────────────────────
// Real Horizons state vectors (CENTER=500@10, VECTORS, AU, J2000 equatorial)
// at two epochs five years apart. Both craft are on hyperbolic escape
// trajectories far beyond the planets, where the Sun's pull is negligible and
// motion is a straight line to well under a hundredth of an AU — so a position
// at any date is a linear read between these two samples.
//
// `scale` is scene units per AU, shared by both so their relative distances
// stay honest. It is far smaller than the planets' scale: Voyager 1 is 171 AU
// out, and at the inner system's scale it would sit thousands of units off
// screen. Same compression the rest of the view uses, just more of it.
export const PROBE_EPOCH_A = Date.UTC(2026, 0, 1);
export const PROBE_EPOCH_B = Date.UTC(2031, 0, 1);
export const PROBE_SCALE = 4.0;

export const PROBES = [
    {
        id: 'voyager1', name: 'Voyager 1', color: '#ffd9a0', r: 6, focusDist: 46,
        a: [-31.83641396068854, -134.6784849020786,  97.44480620314309],
        b: [-34.00817390450292, -149.0263894391153, 107.8072242760942],
    },
    {
        id: 'voyager2', name: 'Voyager 2', color: '#a8d4ff', r: 6, focusDist: 46,
        a: [ 39.22753200608659, -103.9915497105585, -87.91865807489688],
        b: [ 43.66497936520670, -113.8326465813978, -99.84384764825664],
    },
];

// Every id the 3D scene actually draws. Objects outside this set — exoplanets,
// deep-sky targets, near-Earth asteroids, most spacecraft — have no position to
// fly to, so their pages show imagery instead of an empty starfield.
const SCENE_BODY_IDS = new Set([
    'sun',
    ...PLANETS.map(p => p.id),
    ...MOON_DATA.map(m => m.id),
    ...SMALL_BODIES.map(b => b.id),
    ...PROBES.map(p => p.id),
]);

export const hasSceneBody = (id) => SCENE_BODY_IDS.has(id);
