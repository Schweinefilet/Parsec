// The gravitational field the field-line overlay traces, and the streamline
// integrator that walks it.
//
//   g(P) = sum over bodies of  -G * m_i * (P - P_i) / |P - P_i|^3
//
// written as the vector difference over the cubed distance directly — the
// magnitude-and-direction split does the same work and then some. `m_i` is the
// visual field mass from gravityModel, not kilograms.
//
// Gravity only attracts, so every streamline runs *down* the field and ends
// on a mass — there is no term that pushes a line outward. Lines are seeded
// on a sphere around each body (sized to that body's share of space) and
// traced inward with RK4 until they cross a stop sphere; the rare one seeded
// in a genuine Sun–planet saddle stalls where the field cancels.
//
// The step is adaptive: |g| climbs as 1/r^2 toward a body, so a fixed step
// that is fine in open space punches straight through a planet. It is a
// fraction of the distance to the nearest body surface instead — short near a
// mass, long in the gaps — which is cheaper than an RK4 error estimate and
// enough for a picture.
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
 * Gravity only attracts — g(P) points toward the masses — so a line steps
 * *along* g and converges on whichever body ends up dominating it. `sign` is
 * left as a hook (+1 along g, -1 against) but the only correct value for a
 * gravity field is +1.
 *
 * Stops on: crossing into a body's stop sphere (`minRadius`), the field
 * cancelling at a saddle (`deadspot`), leaving `bounds`, or `maxSteps`.
 * Returns `{ points, stop, body }` — `points` is a flat `[x,y,z, …]` list or
 * null if the line went nowhere, `stop` is why it ended, and `body` is the
 * index of the body it fell into (or, for the other stops, the nearest body
 * to where it ended — the one whose tint the line reads as).
 */
export function traceStreamline(seed, bodies, opts) {
    const { G, sign = 1, step, maxSteps, bounds } = opts;
    const boundsSq = bounds * bounds;
    // The longest step is a fraction of the scene, not a fixed number of
    // units: at true distances the useful space is 5000 units, and a 12-unit
    // cap there means every open-space line runs out its step budget.
    const hMax = step.max ?? bounds * step.maxFrac;
    const out = [seed.x, seed.y, seed.z];
    _P.copy(seed);
    let stop = 'maxSteps';
    let body = 0;

    for (let s = 0; s < maxSteps; s++) {
        // Distance to the nearest stop sphere sets the step length — and names
        // the body this line belongs to.
        let nearest = Infinity;
        for (let i = 0; i < bodies.length; i++) {
            const gap = _probe.subVectors(_P, bodies[i].pos).length() - bodies[i].minRadius;
            if (gap < nearest) { nearest = gap; body = i; }
        }
        if (nearest <= 0) { stop = 'minRadius'; break; }         // reached a body
        const h = sign * Math.min(hMax, Math.max(step.min, step.k * nearest));

        // RK4 on dP/ds = unitField(P)
        if (unitFieldAt(_P, bodies, G, _k1) < 1e-12) { stop = 'deadspot'; break; }
        unitFieldAt(_probe.copy(_P).addScaledVector(_k1, h * 0.5), bodies, G, _k2);
        unitFieldAt(_probe.copy(_P).addScaledVector(_k2, h * 0.5), bodies, G, _k3);
        unitFieldAt(_probe.copy(_P).addScaledVector(_k3, h), bodies, G, _k4);
        _P.addScaledVector(_k1, h / 6).addScaledVector(_k2, h / 3)
            .addScaledVector(_k3, h / 3).addScaledVector(_k4, h / 6);

        if (!Number.isFinite(_P.x)) { stop = 'nonfinite'; break; }
        out.push(_P.x, _P.y, _P.z);
        if (_P.lengthSq() > boundsSq) { stop = 'bounds'; break; } // left the scene
    }
    return { points: out.length >= 6 ? out : null, stop, body };
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
 * Returns `{ lines, lineBodies, segmentCount, stepCount, terminations }` — a
 * point list per streamline, a matching list of which body index each line
 * belongs to (for the per-planet tint), totals for the perf log, and a tally
 * of how the lines ended (`terminations.minRadius` should be the large
 * majority for a gravity field; a small `bounds` count is saddle-region lines
 * and is expected).
 */
/**
 * Radius of the sphere a body's streamlines are seeded on.
 *
 * Lines are traced *inward* from here, so this also sets how long they are.
 * A body's own share of space scales with how far out the layout has flung
 * it, so the seed sphere is a fraction of its distance from the Sun — which
 * keeps the lines a visible length at true distances, where a fixed radius
 * would collapse to a spark. The Sun is at the centre and owns everything, so
 * it gets a large sphere outright.
 */
function seedRadiusFor(body, cfg) {
    const distToSun = body.pos.length();
    if (distToSun < 1) return cfg.bounds * cfg.seedSunFrac;
    return Math.min(
        cfg.bounds * cfg.seedMaxFrac,
        Math.max(body.minRadius * cfg.seedMinK, distToSun * cfg.seedFrac));
}

export function traceField(bodies, cfg) {
    const lines = [];
    const lineBodies = [];
    let segmentCount = 0;
    let stepCount = 0;
    const terminations = { minRadius: 0, bounds: 0, deadspot: 0, maxSteps: 0, nonfinite: 0, tooShort: 0 };

    for (let b = 0; b < bodies.length; b++) {
        const body = bodies[b];
        const seeds = seedSphere(body.pos, seedRadiusFor(body, cfg), body.lineCount);
        for (const seed of seeds) {
            const { points, stop, body: endBody } = traceStreamline(seed, bodies, {
                G: cfg.G,
                sign: cfg.sign,
                step: cfg.step,
                maxSteps: cfg.maxSteps,
                bounds: cfg.bounds,
            });
            terminations[points ? stop : 'tooShort']++;
            if (points) {
                lines.push(points);
                lineBodies.push(endBody);
                segmentCount += points.length / 3 - 1;
                stepCount += points.length / 3;
            }
        }
    }
    return { lines, lineBodies, segmentCount, stepCount, terminations };
}

/** Defaults for traceField's `cfg`, mirrored from WEIGHT_CONFIG where they overlap. */
export const GRAVITY_FIELD_DEFAULTS = {
    G: 1,
    sign: 1,                        // +1 = step along g, toward the masses (the only right value)
    // Seed sphere (see seedRadiusFor). A planet's is `seedFrac` of its
    // distance from the Sun — enough that a few seeds land in contested space
    // near the Sun–planet line and trace across to the Sun, the rest fall
    // into the planet. The Sun gets `seedSunFrac` of the bounds.
    seedFrac: 0.34,
    seedSunFrac: 0.5,
    seedMinK: 4,                    // floor: minRadius * this
    seedMaxFrac: 0.5,              // ceiling: bounds * this
    step: { k: 0.25, min: 0.4, maxFrac: 0.024 },   // longest step = bounds * maxFrac
    maxSteps: 500,
    bounds: 520,                    // compressed layout; scaled with the layout at the call site
};
