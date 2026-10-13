import { describe, it, expect } from 'vitest';
import {
    positions, rochePotential, rocheGradient, l1Point, eggletonRadius, lobeRadius, lobeVolumeRadius,
    streamPath, jacobi, lubowShuMin, diskOuterRadius,
} from './roche';

describe('Roche geometry', () => {
    it('puts L1 halfway between equal stars', () => {
        expect(l1Point(1)).toBeCloseTo(0, 10);
        const g = rocheGradient(l1Point(1), 0, 0, 1);
        expect(Math.hypot(...g)).toBeLessThan(1e-9);
    });

    it('moves L1 towards the lighter star', () => {
        const q = 0.3; // donor lighter
        const { xd, xa } = positions(q);
        const lx = l1Point(q);
        expect(xd - lx).toBeLessThan(lx - xa);
        expect(Math.hypot(...rocheGradient(lx, 0, 0, q))).toBeLessThan(1e-9);
    });

    it('makes L1 a saddle: lowest along y and z, highest along x', () => {
        const q = 0.5, lx = l1Point(q), p = rochePotential(lx, 0, 0, q), e = 1e-3;
        expect(rochePotential(lx + e, 0, 0, q)).toBeLessThan(p);
        expect(rochePotential(lx - e, 0, 0, q)).toBeLessThan(p);
        expect(rochePotential(lx, e, 0, q)).toBeGreaterThan(p);
        expect(rochePotential(lx, 0, e, q)).toBeGreaterThan(p);
    });

    it('reaches L1 from the donor along the line between the stars', () => {
        const q = 0.4;
        expect(lobeRadius([-1, 0, 0], q)).toBeCloseTo(positions(q).xd - l1Point(q), 6);
    });

    for (const q of [0.1, 0.4, 1]) {
        it(`fills a lobe of Eggleton’s volume radius (q = ${q})`, () => {
            const r = lobeVolumeRadius(q);
            expect(Math.abs(r / eggletonRadius(q) - 1)).toBeLessThan(0.01);
        });
    }

    it('is a teardrop: longest towards L1, shortest out of the plane', () => {
        const q = 0.4;
        const toL1 = lobeRadius([-1, 0, 0], q);
        const back = lobeRadius([1, 0, 0], q);
        const up = lobeRadius([0, 0, 1], q);
        expect(toL1).toBeGreaterThan(back);
        expect(back).toBeGreaterThan(up);
    });
});

describe('the stream through L1', () => {
    it('conserves the Jacobi constant', () => {
        const q = 0.4;
        const lx = l1Point(q);
        const c0 = jacobi([lx - 1e-3, 0, 0], [-0.01, 0, 0], q);
        const { end, endVelocity } = streamPath(q);
        expect(jacobi(end, endVelocity, q)).toBeCloseTo(c0, 6);
    });

    it('is swung off the line between the stars by the Coriolis force', () => {
        const { points } = streamPath(0.4);
        // The frame turns counter-clockwise, so −2Ω × v pushes gas heading
        // along −x towards +y: the stream curves round the accretor that way.
        expect(points[Math.floor(points.length / 2)][1]).toBeGreaterThan(0);
    });

    for (const q of [0.1, 0.3, 0.6]) {
        it(`comes as close to the accretor as Lubow & Shu say (q = ${q})`, () => {
            const { rMin } = streamPath(q);
            expect(Math.abs(rMin / lubowShuMin(q) - 1)).toBeLessThan(0.06);
        });
    }

    it('feeds a disk that fits inside the accretor’s lobe', () => {
        const q = 0.4;
        const { xa } = positions(q);
        const rd = diskOuterRadius(q);
        expect(rd).toBeLessThan(l1Point(q) - xa);
        expect(rd).toBeGreaterThan(lubowShuMin(q));
    });
});
