import { describe, it, expect } from 'vitest';
import {
    THROAT, arealRadius, traceWormholeRay, ellipticK, ellisSweep, exitDirection, traversePose,
    TRAVERSE_SECONDS,
} from './wormhole';

// Rays are launched from far out on our side (ℓ = L) at an angle chosen to
// give impact parameter h, then traced to the far field on whichever side
// they end up. The total angle swept round the throat is φ plus the
// asymptotic correction at both ends (the angle between the ray and the
// radial there), which is what the closed form counts.
const L = 400;
const launchFor = (h) => Math.PI - Math.asin(h / arealRadius(L));
const sweptBy = (res) => res.phi + (Math.PI - launchFor(res.h)) + res.psiOut;

describe('Ellis wormhole', () => {
    it('has its smallest sphere at the throat, radius b', () => {
        expect(arealRadius(0)).toBe(THROAT);
        expect(arealRadius(0, 2.5)).toBe(2.5);
        for (const l of [-3, -0.1, 0.1, 3]) expect(arealRadius(l)).toBeGreaterThan(THROAT);
    });

    it('computes K(k) like the tables do', () => {
        expect(ellipticK(0)).toBeCloseTo(Math.PI / 2, 12);
        expect(ellipticK(Math.SQRT1_2)).toBeCloseTo(1.8540746773, 9);
        expect(ellipticK(0.9)).toBeCloseTo(2.2805491384, 9);
    });

    it('sends a ray aimed straight at the throat through, undeflected', () => {
        const res = traceWormholeRay(10, Math.PI);
        expect(res.side).toBe(-1);
        expect(res.phi).toBeCloseTo(0, 10);
        expect(res.psiOut).toBeCloseTo(0, 10);
    });

    it('lets rays below h = b through and turns the rest back', () => {
        expect(traceWormholeRay(L, launchFor(0.97), { escape: L }).side).toBe(-1);
        expect(traceWormholeRay(L, launchFor(1.03), { escape: L }).side).toBe(1);
    });

    for (const h of [0.3, 0.7, 0.95]) {
        it(`sweeps 2(h/b)K(h/b) on the way through at h = ${h}`, () => {
            const res = traceWormholeRay(L, launchFor(h), { escape: L, scale: 0.01 });
            expect(res.side).toBe(-1);
            const exact = ellisSweep(h);
            expect(exact.through).toBe(true);
            expect(sweptBy(res)).toBeCloseTo(exact.sweep, 3);
        });
    }

    for (const h of [1.1, 2, 6]) {
        it(`sweeps 2K(b/h) when it turns back at h = ${h}`, () => {
            const res = traceWormholeRay(L, launchFor(h), { escape: L, scale: 0.01 });
            expect(res.side).toBe(1);
            const exact = ellisSweep(h);
            expect(exact.through).toBe(false);
            expect(sweptBy(res)).toBeCloseTo(exact.sweep, 3);
        });
    }

    it('bends far-off light by πb²/4h², the weak-field limit', () => {
        const k = 1 / 40;
        const series = (Math.PI * k * k) / 4 + (9 * Math.PI * k ** 4) / 64;
        expect(ellisSweep(40).sweep - Math.PI).toBeCloseTo(series, 9);
    });

    it('maps a straight-through ray to the same direction on the other side', () => {
        const eOut = [0, 0, 1];
        const eT = [1, 0, 0];
        const dir = exitDirection(eOut, eT, traceWormholeRay(10, Math.PI));
        expect(dir[2]).toBeCloseTo(-1, 10);
        expect(Math.hypot(...dir)).toBeCloseTo(1, 12);
    });

    it('flies through and turns round to look back', () => {
        const start = traversePose(0);
        const mid = traversePose(TRAVERSE_SECONDS * 0.36);
        const end = traversePose(TRAVERSE_SECONDS);
        expect(start).toMatchObject({ l: 14, turn: 0, done: false });
        expect(Math.abs(mid.l)).toBeLessThan(0.5);
        expect(end.l).toBeCloseTo(-14, 10);
        expect(end.turn).toBeCloseTo(Math.PI, 10);
        expect(end.done).toBe(true);
    });
});
