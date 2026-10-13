import { describe, it, expect } from 'vitest';
import {
    binaryAcceleration, traceBinaryRay, petersSeparation, petersMergeTime, orbitalOmega,
    holePositions, gwFrequency,
} from './binaryHole';

const D = 1500;
const single = (m = 1) => [{ c: [0, 0, 0], m }];
const fire = (b, holes, opts) => traceBinaryRay([-D, b, 0], [1, 0, 0], holes, { scale: 0.01, ...opts });

describe('binary black hole: one hole on its own is Schwarzschild', () => {
    it('captures inside b = 3√3 m and lets the rest go', () => {
        for (const m of [1, 0.5]) {
            const bc = 3 * Math.sqrt(3) * m;
            expect(fire(bc * 0.99, single(m)).fate).toBe('captured');
            expect(fire(bc * 1.01, single(m)).fate).toBe('escaped');
        }
    });

    it('holds light on the photon sphere at r = 3m', () => {
        // A circular orbit: tangential, at 3m. Half a turn later it is still there.
        const holes = single(1);
        let x = [3, 0, 0];
        let v = [0, 1, 0];
        const h = 0.002;
        for (let i = 0; i < Math.round((Math.PI * 3) / h); i++) {
            const a = binaryAcceleration(x, v, holes);
            // Semi-implicit Euler is enough to show the balance holds.
            v = v.map((q, k) => q + h * a[k]);
            x = x.map((q, k) => q + h * v[k]);
        }
        expect(Math.hypot(...x)).toBeCloseTo(3, 1);
    });

    it('bends distant light by 4m/b', () => {
        const b = 400;
        const res = fire(b, single(1), { escape: D });
        const bend = Math.atan2(-res.v[1], res.v[0]);
        // 4m/b, plus the next term of the exact Schwarzschild series.
        expect(bend).toBeCloseTo(4 / b + (15 * Math.PI) / (4 * b * b), 4);
    });
});

describe('binary black hole: the pair', () => {
    it('sits about its centre of mass', () => {
        const [h1, h2] = holePositions(10, 0.3, 0.6, 0.4);
        expect(h1.c[0] * 0.6 + h2.c[0] * 0.4).toBeCloseTo(0, 12);
        expect(Math.hypot(h1.c[0] - h2.c[0], h1.c[1] - h2.c[1])).toBeCloseTo(10, 12);
    });

    it('leaves a ray through the midpoint, square to the pair, undeflected', () => {
        const holes = holePositions(10, 0, 0.5, 0.5); // on the x axis
        const res = traceBinaryRay([0, -D, 0], [0, 1, 0], holes, { scale: 0.01 });
        expect(res.fate).toBe('escaped');
        expect(res.v[0]).toBeCloseTo(0, 12);
        expect(res.v[2]).toBeCloseTo(0, 12);
    });

    it('casts two shadows: a ray at either hole is captured', () => {
        const holes = holePositions(10, 0, 0.5, 0.5);
        for (const x0 of [5, -5]) {
            expect(traceBinaryRay([x0, 0, D], [0, 0, -1], holes).fate).toBe('captured');
        }
        expect(traceBinaryRay([0, 0, D], [0, 0, -1], holes).fate).toBe('escaped');
    });

    it('shrinks its orbit the way Peters says', () => {
        const a0 = 10, m1 = 0.5, m2 = 0.5;
        const T = petersMergeTime(a0, m1, m2);
        expect(T).toBeCloseTo((5 * 1e4) / (256 * 0.25), 9);
        // Integrate da/dt directly and compare with the closed form halfway.
        let a = a0;
        const dt = T / 200000;
        for (let t = 0; t < T / 2; t += dt) a -= dt * (64 / 5) * m1 * m2 / (a * a * a);
        expect(a).toBeCloseTo(petersSeparation(T / 2, a0, m1, m2), 3);
        expect(petersSeparation(T, a0, m1, m2)).toBe(0);
    });

    it('chirps: the wave frequency rises as the orbit shrinks', () => {
        expect(orbitalOmega(4)).toBeGreaterThan(orbitalOmega(10));
        // GW150914 was about 65 suns and swept up through ~35 Hz near a ≈ 10 M.
        const f = gwFrequency(10, 65);
        expect(f).toBeGreaterThan(20);
        expect(f).toBeLessThan(40);
    });
});
