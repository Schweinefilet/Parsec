// The gravitational field the field-line overlay traces, and the streamline
// integrator that walks it.
//
//   g(P) = sum over bodies of  -G * m_i * (P - P_i) / |P - P_i|^3
//
// written as the vector difference over the cubed distance directly — the
// magnitude-and-direction split does the same work and then some. `m_i` is the
// visual field mass from gravityModel, not kilograms.
//
// Streamlines are traced with RK4 and an adaptive step. |g| climbs as 1/r^2
// toward a body, so a fixed step that is fine in open space punches straight
// through a planet. The step is a fraction of the distance to the nearest body
// surface instead — short near a mass, long in the gaps — which is cheaper
// than an RK4 error estimate and enough for a picture.
//
// Everything here is pure and runs on the CPU. It is sequential and must not
// be called per frame; the caller retraces only when a body has moved far
// enough to matter (see the gate in SolarSystem3D).

import * as THREE from 'three';

const _d = new THREE.Vector3();

/**
 * Field vector at P. `bodies` is `[{ pos: Vector3, fieldMass: number }, …]`.
 * Writes into `out` and returns it.
 */
export function fieldAt(P, bodies, G, out = new THREE.Vector3()) {
    out.set(0, 0, 0);
    for (let i = 0; i < bodies.length; i++) {
        _d.subVectors(P, bodies[i].pos);
        const r2 = _d.lengthSq();
        if (r2 < 1e-6) continue;
        // -G m / |d|^3, applied to the vector d
        out.addScaledVector(_d, (-G * bodies[i].fieldMass) / (r2 * Math.sqrt(r2)));
    }
    return out;
}

// Scratch for one trace. The tracer is sequential, so a single set is safe.
const _k1 = new THREE.Vector3();
const _k2 = new THREE.Vector3();
const _k3 = new THREE.Vector3();
const _k4 = new THREE.Vector3();
const _probe = new THREE.Vector3();
const _P = new THREE.Vector3();

/** Unit field direction at P, written into `out`. Returns |g| before it was normalised. */
function unitFieldAt(P, bodies, G, out) {
    fieldAt(P, bodies, G, out);
    const len = out.length();
    if (len > 1e-12) out.multiplyScalar(1 / len);
    return len;
}

/**
 * Trace one streamline from `seed`, stepping along the field direction.
 *
 * g points toward masses, so `sign` chooses which way the line runs:
 *   -1  outward — away from the masses (the default). Lines leave each body,
 *       most bend toward the Sun, a few escape, and the ones near a Sun–planet
 *       saddle stall where the field cancels. This is the familiar picture.
 *   +1  inward — toward the masses, converging on one of them.
 *
 * Stops on: crossing into any body's stop sphere, leaving `bounds` (radius
 * from the origin), or `maxSteps` (a line trapped near a saddle). Returns a
 * flat `[x,y,z, x,y,z, …]` list, or null if it went nowhere.
 */
export function traceStreamline(seed, bodies, opts) {
    const { G, sign = -1, step, maxSteps, bounds } = opts;
    const boundsSq = bounds * bounds;
    // The longest step is a fraction of the scene, not a fixed number of
    // units: at true distances the useful space is 5000 units, and a 12-unit
    // cap there means every open-space line runs out its step budget.
    const hMax = step.max ?? bounds * step.maxFrac;
    const out = [seed.x, seed.y, seed.z];
    _P.copy(seed);

    for (let s = 0; s < maxSteps; s++) {
        // Distance to the nearest stop sphere sets the step length.
        let nearest = Infinity;
        for (let i = 0; i < bodies.length; i++) {
            const gap = _probe.subVectors(_P, bodies[i].pos).length() - bodies[i].minRadius;
            if (gap < nearest) nearest = gap;
        }
        if (nearest <= 0) break;                                 // reached a body
        const h = sign * Math.min(hMax, Math.max(step.min, step.k * nearest));

        // RK4 on dP/ds = unitField(P)
        if (unitFieldAt(_P, bodies, G, _k1) < 1e-12) break;      // dead spot
        unitFieldAt(_probe.copy(_P).addScaledVector(_k1, h * 0.5), bodies, G, _k2);
        unitFieldAt(_probe.copy(_P).addScaledVector(_k2, h * 0.5), bodies, G, _k3);
        unitFieldAt(_probe.copy(_P).addScaledVector(_k3, h), bodies, G, _k4);
        _P.addScaledVector(_k1, h / 6).addScaledVector(_k2, h / 3)
            .addScaledVector(_k3, h / 3).addScaledVector(_k4, h / 6);

        if (!Number.isFinite(_P.x)) break;
        out.push(_P.x, _P.y, _P.z);
        if (_P.lengthSq() > boundsSq) break;                     // left the scene
    }
    return out.length >= 6 ? out : null;
}

/**
 * Seed points evenly over a sphere (Fibonacci lattice).
 * Appends `THREE.Vector3`s to `into` and returns it.
 */
export function seedSphere(center, radius, count, into = []) {
    const golden = Math.PI * (3 - Math.sqrt(5));
    for (let i = 0; i < count; i++) {
        const y = count > 1 ? 1 - (i / (count - 1)) * 2 : 0;
        const ring = Math.sqrt(Math.max(0, 1 - y * y));
        const th = golden * i;
        into.push(new THREE.Vector3(
            center.x + radius * Math.cos(th) * ring,
            center.y + radius * y,
            center.z + radius * Math.sin(th) * ring,
        ));
    }
    return into;
}

/**
 * Trace the whole field: seed every body and walk each streamline.
 *
 * `bodies` is `[{ pos, fieldMass, minRadius, lineCount }, …]` — the shared
 * per-frame array from gravityModel, positioned from the live scene.
 * `cfg` carries the tuning constants (see GRAVITY_FIELD_DEFAULTS).
 *
 * Returns `{ lines: number[][], segmentCount, stepCount }` — a point list per
 * streamline, plus totals for the perf log.
 */
export function traceField(bodies, cfg) {
    const lines = [];
    let segmentCount = 0;
    let stepCount = 0;

    for (let b = 0; b < bodies.length; b++) {
        const body = bodies[b];
        const seedR = body.minRadius * cfg.seedRadiusK;
        const seeds = seedSphere(body.pos, seedR, body.lineCount);
        for (const seed of seeds) {
            const pts = traceStreamline(seed, bodies, {
                G: cfg.G,
                sign: cfg.sign,
                step: cfg.step,
                maxSteps: cfg.maxSteps,
                bounds: cfg.bounds,
            });
            if (pts) {
                lines.push(pts);
                segmentCount += pts.length / 3 - 1;
                stepCount += pts.length / 3;
            }
        }
    }
    return { lines, segmentCount, stepCount };
}

/** Defaults for traceField's `cfg`, mirrored from WEIGHT_CONFIG where they overlap. */
export const GRAVITY_FIELD_DEFAULTS = {
    G: 1,
    sign: -1,                       // -1 = trace outward, away from the seed body
    seedRadiusK: 1.5,              // seed sphere radius = minRadius * this
    step: { k: 0.25, min: 0.4, maxFrac: 0.024 },   // longest step = bounds * maxFrac
    maxSteps: 500,
    bounds: 520,                    // compressed layout; scaled with the layout at the call site
};
