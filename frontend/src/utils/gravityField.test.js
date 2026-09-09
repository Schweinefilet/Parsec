import { describe, it, expect } from 'vitest';
import * as THREE from 'three';
import {
    fieldAt, traceStreamline, seedSphere, traceField, GRAVITY_FIELD_DEFAULTS,
} from './gravityField';

const body = (x, y, z, fieldMass, minRadius = 3) => ({
    pos: new THREE.Vector3(x, y, z), fieldMass, minRadius,
});

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

    it('a line traced inward lands on the mass', () => {
        const bodies = [body(0, 0, 0, 20, 4)];
        const pts = traceStreamline(new THREE.Vector3(60, 0, 0), bodies, {
            G: 1, sign: 1, step, maxSteps: 500, bounds: 500,
        });
        expect(pts).not.toBeNull();
        const end = new THREE.Vector3(pts.at(-3), pts.at(-2), pts.at(-1));
        expect(end.length()).toBeLessThan(5);   // at the stop sphere
    });

    it('a line traced outward leaves through the bounds', () => {
        const bodies = [body(0, 0, 0, 20, 4)];
        const pts = traceStreamline(new THREE.Vector3(10, 0, 0), bodies, {
            G: 1, sign: -1, step, maxSteps: 2000, bounds: 200,
        });
        expect(pts).not.toBeNull();
        const end = new THREE.Vector3(pts.at(-3), pts.at(-2), pts.at(-1));
        expect(end.length()).toBeGreaterThan(190);
    });

    it('never overshoots through a body — steps shrink as it closes in', () => {
        const bodies = [body(0, 0, 0, 50, 3)];
        const pts = traceStreamline(new THREE.Vector3(120, 0, 0), bodies, {
            G: 1, sign: 1, step, maxSteps: 4000, bounds: 400,
        });
        // every sample stays outside the stop sphere, right down to the last
        for (let i = 0; i < pts.length; i += 3) {
            const r = Math.hypot(pts[i], pts[i + 1], pts[i + 2]);
            expect(r).toBeGreaterThan(2);
        }
    });

    it('terminates rather than looping forever near a saddle', () => {
        const bodies = [body(-30, 0, 0, 10, 3), body(30, 0, 0, 10, 3)];
        const pts = traceStreamline(new THREE.Vector3(6, 3, 0), bodies, {
            G: 1, sign: -1, step, maxSteps: 300, bounds: 250,
        });
        expect(pts).not.toBeNull();
        expect(pts.length / 3).toBeLessThanOrEqual(301);
        const end = new THREE.Vector3(pts.at(-3), pts.at(-2), pts.at(-1));
        // it left the region one way or another — bounds, or stalled in place
        expect(Number.isFinite(end.length())).toBe(true);
    });
});

describe('seeding', () => {
    it('spreads the requested number of points over the sphere', () => {
        const c = new THREE.Vector3(5, 0, -5);
        const seeds = seedSphere(c, 4, 20);
        expect(seeds).toHaveLength(20);
        for (const s of seeds) {
            expect(s.distanceTo(c)).toBeCloseTo(4, 5);
        }
        // roughly centred
        const mean = seeds.reduce((a, s) => a.add(s), new THREE.Vector3()).multiplyScalar(1 / 20);
        expect(mean.distanceTo(c)).toBeLessThan(1.2);
    });
});

describe('traceField', () => {
    it('produces a line per seed, and reports totals', () => {
        const bodies = [
            { pos: new THREE.Vector3(0, 0, 0), fieldMass: 60, minRadius: 20, lineCount: 12 },
            { pos: new THREE.Vector3(96, 0, 0), fieldMass: 12, minRadius: 3, lineCount: 8 },
        ];
        const { lines, segmentCount, stepCount } = traceField(bodies, {
            ...GRAVITY_FIELD_DEFAULTS, bounds: 520,
        });
        expect(lines.length).toBeGreaterThan(10);
        expect(lines.length).toBeLessThanOrEqual(20);
        expect(segmentCount).toBeGreaterThan(0);
        expect(stepCount).toBeGreaterThan(lines.length);
        for (const l of lines) expect(l.length % 3).toBe(0);
    });
});
