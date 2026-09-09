import { describe, it, expect } from 'vitest';
import * as THREE from 'three';
import {
    fieldAt, traceStreamline, seedSphere, traceField, GRAVITY_FIELD_DEFAULTS,
} from './gravityField';

const body = (x, y, z, fieldMass, minRadius = 3) => ({
    pos: new THREE.Vector3(x, y, z), fieldMass, minRadius,
});
const last = (pts) => new THREE.Vector3(pts.at(-3), pts.at(-2), pts.at(-1));

describe('the field', () => {
    it('points toward a single mass, and falls off with distance', () => {
        const bodies = [body(0, 0, 0, 10)];
        const near = fieldAt(new THREE.Vector3(10, 0, 0), bodies, 1);
        const far = fieldAt(new THREE.Vector3(40, 0, 0), bodies, 1);
        // toward the origin → negative x, zero elsewhere
        expect(near.x).toBeLessThan(0);
        expect(Math.abs(near.y)).toBeLessThan(1e-9);
        expect(near.length()).toBeGreaterThan(far.length());
        // inverse square: 4x the distance → 1/16 the pull
        expect(far.length() / near.length()).toBeCloseTo(1 / 16, 3);
    });

    it('superposes — the saddle between two equal masses has no field', () => {
        const bodies = [body(-20, 0, 0, 10), body(20, 0, 0, 10)];
        const g = fieldAt(new THREE.Vector3(0, 0, 0), bodies, 1);
        expect(g.length()).toBeLessThan(1e-9);
    });

    it('ignores a sample sitting exactly on a body', () => {
        const bodies = [body(0, 0, 0, 10), body(20, 0, 0, 10)];
        const g = fieldAt(new THREE.Vector3(0, 0, 0), bodies, 1);
        expect(Number.isFinite(g.length())).toBe(true);   // pulled only by the far body
        expect(g.x).toBeGreaterThan(0);
    });
});

describe('streamline tracing', () => {
    const step = { k: 0.25, min: 0.4, max: 12 };

    it('runs down-field and converges on the mass — gravity only attracts', () => {
        const bodies = [body(0, 0, 0, 20, 4)];
        const { points, stop } = traceStreamline(new THREE.Vector3(60, 0, 0), bodies, {
            G: 1, step, maxSteps: 500, bounds: 500,   // sign defaults to +1
        });
        expect(points).not.toBeNull();
        expect(stop).toBe('minRadius');
        expect(last(points).length()).toBeLessThan(5);       // at the stop sphere
    });

    it('every sample moves closer to the mass, never past it', () => {
        const bodies = [body(0, 0, 0, 50, 3)];
        const { points } = traceStreamline(new THREE.Vector3(120, 0, 0), bodies, {
            G: 1, step, maxSteps: 4000, bounds: 400,
        });
        let prev = Infinity;
        for (let i = 0; i < points.length; i += 3) {
            const r = Math.hypot(points[i], points[i + 1], points[i + 2]);
            expect(r).toBeGreaterThan(2);                     // never through the body
            expect(r).toBeLessThanOrEqual(prev + 1e-6);       // monotonically inward
            prev = r;
        }
    });

    it('steps along the field, not against it — the anti-inversion guard', () => {
        const bodies = [body(0, 0, 0, 60, 20), body(96, 0, 0, 12, 3)];
        const { points, stop } = traceStreamline(new THREE.Vector3(-40, 30, 60), bodies, {
            G: 1, step, maxSteps: 800, bounds: 520,
        });
        expect(stop).toBe('minRadius');
        // At every vertex, the direction to the next vertex agrees with g(P):
        // the line moves down-field. A sign flip in the tracer makes this
        // negative everywhere.
        for (let i = 0; i + 5 < points.length; i += 3) {
            const p = new THREE.Vector3(points[i], points[i + 1], points[i + 2]);
            const nextDir = new THREE.Vector3(points[i + 3], points[i + 4], points[i + 5]).sub(p).normalize();
            const g = fieldAt(p, bodies, 1).normalize();
            expect(g.dot(nextDir)).toBeGreaterThan(0.5);
        }
    });

    it('a line right on a saddle terminates instead of looping', () => {
        const bodies = [body(-30, 0, 0, 10, 3), body(30, 0, 0, 10, 3)];
        const { points, stop } = traceStreamline(new THREE.Vector3(0, 0.05, 0), bodies, {
            G: 1, step, maxSteps: 300, bounds: 250,
        });
        expect(['deadspot', 'maxSteps', 'minRadius']).toContain(stop);
        if (points) expect(points.length / 3).toBeLessThanOrEqual(301);
    });

    it('sign: -1 is the against-the-field hook — it runs away to the bounds', () => {
        const bodies = [body(0, 0, 0, 20, 4)];
        const { stop } = traceStreamline(new THREE.Vector3(10, 0, 0), bodies, {
            G: 1, sign: -1, step, maxSteps: 2000, bounds: 200,
        });
        expect(stop).toBe('bounds');
    });
});

describe('seeding', () => {
    it('spreads the requested number of points over the sphere', () => {
        const c = new THREE.Vector3(5, 0, -5);
        const seeds = seedSphere(c, 4, 20);
        expect(seeds).toHaveLength(20);
        for (const s of seeds) expect(s.distanceTo(c)).toBeCloseTo(4, 5);
        const mean = seeds.reduce((a, s) => a.add(s), new THREE.Vector3()).multiplyScalar(1 / 20);
        expect(mean.distanceTo(c)).toBeLessThan(1.2);
    });
});

describe('traceField', () => {
    // A Sun-like body and two planets, roughly the inner-system layout.
    const bodies = () => [
        { pos: new THREE.Vector3(0, 0, 0),    fieldMass: 60, minRadius: 20, lineCount: 16 },
        { pos: new THREE.Vector3(96, 0, 0),   fieldMass: 12, minRadius: 3,  lineCount: 11 },
        { pos: new THREE.Vector3(-190, 0, 0), fieldMass: 20, minRadius: 4,  lineCount: 12 },
    ];

    it('produces a line per seed and reports totals', () => {
        const { lines, segmentCount, stepCount } = traceField(bodies(), {
            ...GRAVITY_FIELD_DEFAULTS, bounds: 520,
        });
        expect(lines.length).toBeGreaterThan(20);
        expect(segmentCount).toBeGreaterThan(0);
        expect(stepCount).toBeGreaterThan(lines.length);
        for (const l of lines) expect(l.length % 3).toBe(0);
    });

    it('the large majority of lines converge on a body (attractive field)', () => {
        const { terminations } = traceField(bodies(), { ...GRAVITY_FIELD_DEFAULTS, bounds: 520 });
        const total = Object.values(terminations).reduce((a, b) => a + b, 0);
        // minRadius = fell into a body. bounds should be a small minority
        // (saddle-region lines only); nothing repulsive exists to push lines out.
        expect(terminations.minRadius / total).toBeGreaterThan(0.8);
        expect(terminations.bounds / total).toBeLessThan(0.15);
    });
});
