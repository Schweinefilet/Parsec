// The bodies the gravity overlays act on, and how real mass becomes a drawable
// weight.
//
// Two facts make "just plot the real numbers" a non-starter. Planetary mass
// spans eight orders of magnitude — Pluto to the Sun is about 1.5e8 : 1 — so a
// well depth or a field-line count proportional to mass gives every planet
// nothing and the Sun everything. And the scene's radii are already
// compressed: Neptune's orbit is drawn at 3.5x Earth's where the real ratio is
// 30x (see solarSystemBodies.js), so a body's screen position is not its real
// distance either.
//
// So mass is mapped through a clamped log to a small visual range. Distance is
// deliberately NOT an input here — see the note on DISTANCE in WEIGHT_CONFIG.
// Every constant is in that object for visual iteration; nothing downstream
// hardcodes a number.

import { PLANETS } from '../data/solarSystemBodies';

// Mean masses, kg (IAU 2015 / JPL). The keys are the roster: Sun + the eight
// planets + Pluto.
const MASS_KG = {
    sun:     1.98892e30,
    mercury: 3.3011e23,
    venus:   4.8675e24,
    earth:   5.97237e24,
    mars:    6.4171e23,
    jupiter: 1.89819e27,
    saturn:  5.6834e26,
    uranus:  8.6810e25,
    neptune: 1.02413e26,
    pluto:   1.303e22,
};

// Drawn sphere radius in scene units, read from the scene's own tables so the
// field-line stop sphere tracks whatever size a body is actually rendered at.
// The Sun's 12 matches sunGeo in SolarSystem3D.
const DRAWN_R = { sun: 12, ...Object.fromEntries(PLANETS.map(p => [p.id, p.r])) };

export const WEIGHT_CONFIG = {
    // log10(mass) is clamped to this window, then normalised to 0..1.
    logMassMin: 22.0,   // ~Pluto — the floor
    logMassMax: 30.3,   // ~Sun   — the ceiling

    // ── Warped-grid mode ──────────────────────────────────────────────────
    // A body contributes a Gaussian dimple to the height field. Wall slope is
    // depth/sigma, so the Sun's pit is made both deeper and steeper by pairing
    // a large `depth.max` with a modest `radius.max` — and a high `gamma` on
    // each keeps that from dragging the planets down with it: at mass
    // parameter 1 (the Sun) gamma does nothing, but by Jupiter's 0.64 it has
    // pulled the curve well back down, so the planets stay the shallow, tight
    // pinch-points they were and only the Sun gets the drama.
    gridDepth:  { min: 3,  max: 48, gamma: 2.0 },   // Gaussian amplitude, scene units
    gridRadius: { min: 14, max: 48, gamma: 1.3 },   // Gaussian sigma,     scene units
    // The distance term. A first cut left distance out entirely — the scene's
    // radial compression already maps it into position — but rendering both
    // layout extremes showed that at true distances a fixed-size well is a
    // sub-percent feature on a 8,000-unit sheet and Neptune, Uranus and Pluto
    // read as flat. So each well's radius and depth are scaled by (that body's
    // radial expansion in the current layout) ^ these exponents: expansion is
    // 1 in the compressed view, so this is inert there and only the checked
    // compressed tuning above applies; it climbs toward ~13x for Pluto at true
    // scale, which is what brings the outer wells back. Gated to the layout
    // rather than folded into the mass mapping, so the compression is never
    // counted twice.
    gridExpandRadius: 0.7,
    gridExpandDepth:  0.28,
    // The Sun is fixed at the origin, so the expansion above never touches it
    // — which left it a small, fixed pit that the layout's zoom-out shrank
    // into insignificance next to the flung-out planet wells. It holds 99.9%
    // of the system's mass and should read that way at any scale, so its
    // well grows with the layout by this factor (both dimensions equally, so
    // the wall slope the compressed tuning set is preserved — just larger).
    sunWellTrueScale: 3.4,

    // ── Field-line mode ───────────────────────────────────────────────────
    // g(P) = sum over bodies of  -G * m_i * (P - P_i) / |P - P_i|^3
    // G is a single scalar and drops out of the streamline *direction*
    // entirely — it only scales |g|, which the tracer does not read (steps
    // come from distance to the nearest body, see gravityField.js). Kept
    // here so the formula in code matches the spec.
    fieldG: 1,
    fieldMass:  { min: 1, max: 60, gamma: 1.6 },    // m_i above; compresses ~8 decades to ~1.8
    fieldLines: { min: 5, max: 24, gamma: 1.0 },    // seed streamlines per body (rounded)
    // Stop sphere for a converging line: clamp(drawnRadius * k, floor, ceil).
    minRadius:  { k: 1.8, floor: 2.5, ceil: 44 },
    // Same layout-gated distance term as the grid: the stop sphere and the
    // field mass are scaled by the body's radial expansion so an outer planet
    // still gathers a bundle of lines once the layout has flung it out to
    // true distance. Inert in the compressed view.
    fieldExpandRadius: 0.7,
    fieldExpandMass:   0.5,
};

const clamp01 = (x) => (x < 0 ? 0 : x > 1 ? 1 : x);
const lerp = (a, b, t) => a + (b - a) * t;

/** Real mass (kg) to a 0..1 weight parameter, clamped log. */
export function massParam(massKg, cfg = WEIGHT_CONFIG) {
    const l = Math.log10(massKg);
    return clamp01((l - cfg.logMassMin) / (cfg.logMassMax - cfg.logMassMin));
}

/**
 * The visual weights for one body.
 *
 * `drawnR` is its rendered radius in scene units; only `minRadius` uses it.
 */
export function visualWeights(massKg, drawnR, cfg = WEIGHT_CONFIG) {
    const p = massParam(massKg, cfg);
    const band = ({ min, max, gamma }) => lerp(min, max, Math.pow(p, gamma));
    return {
        gridDepth:  band(cfg.gridDepth),
        gridRadius: band(cfg.gridRadius),
        fieldMass:  band(cfg.fieldMass),
        lineCount:  Math.max(cfg.fieldLines.min, Math.round(band(cfg.fieldLines))),
        minRadius:  Math.min(cfg.minRadius.ceil,
            Math.max(cfg.minRadius.floor, (drawnR ?? 1) * cfg.minRadius.k)),
    };
}

// The roster: Sun + eight planets + Pluto. The grid shader's array uniforms
// are sized to MAX_GRAVITY_BODIES, which leaves headroom; the Moon is
// deliberately left out (it would sit inside Earth's well and roughly double
// the inner-system clutter for little payoff).
export const GRAVITY_BODIES = ['sun', ...PLANETS.map(p => p.id)].map(id => ({
    id,
    massKg: MASS_KG[id],
    drawnR: DRAWN_R[id],
    weights: visualWeights(MASS_KG[id], DRAWN_R[id]),
}));

export const MAX_GRAVITY_BODIES = 16;
