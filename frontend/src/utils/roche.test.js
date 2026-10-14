import { describe, it, expect } from 'vitest';
import {
    positions, rochePotential, rocheGradient, l1Point, eggletonRadius, lobeRadius, lobeVolumeRadius,
    streamPath, jacobi, lubowShuMin, diskOuterRadius, diskScaleHeight, accretorAzimuth, inDiskShadow,
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

describe('the disk and its shadow', () => {
    it('flares: thicker in proportion further out', () => {
        const rd = 0.3, hr = 0.1;
        expect(diskScaleHeight(rd, rd, hr)).toBeGreaterThan(0.99 * hr * rd);
        const inner = diskScaleHeight(0.1 * rd, rd, hr) / (0.1 * rd);
        const outer = diskScaleHeight(0.5 * rd, rd, hr) / (0.5 * rd);
        expect(outer).toBeGreaterThan(inner);
        expect(inner / outer).toBeCloseTo(Math.pow(0.2, 1 / 8), 6);
    });

    it('swells at the rim just downstream of the impact, not upstream', () => {
        const rd = 0.3, hr = 0.1;
        const plain = diskScaleHeight(rd, rd, hr, Math.PI);
        expect(diskScaleHeight(rd, rd, hr, 0.2)).toBeGreaterThan(1.4 * plain);
        expect(diskScaleHeight(rd, rd, hr, 5.0)).toBeLessThan(1.01 * plain);
        // No cliff at the impact: just upstream it is already well swollen.
        expect(diskScaleHeight(rd, rd, hr, 2 * Math.PI - 0.1)).toBeGreaterThan(1.4 * plain);
        // Nothing in the inner disk.
        expect(diskScaleHeight(0.3 * rd, rd, hr, 0)).toBeCloseTo(diskScaleHeight(0.3 * rd, rd, hr, Math.PI), 12);
    });

    it('meets the stream at the rim downstream of the line between the stars', () => {
        // The stream comes in on the +y side and the gas circles prograde,
        // so the impact sits at a positive azimuth round the accretor.
        const q = 0.4;
        const rd = diskOuterRadius(q);
        const { points } = streamPath(q, { rStop: rd });
        const end = points[points.length - 1];
        const phi = accretorAzimuth(end[0], end[1], q);
        expect(phi).toBeGreaterThan(0);
        expect(phi).toBeLessThan(Math.PI);
    });

    it('shades L1 and the donor’s equator, but not its poles', () => {
        const q = 0.4, hr = 0.12;
        const lx = l1Point(q);
        const { xd } = positions(q);
        expect(inDiskShadow(lx, 0, 0, q, hr)).toBe(true);
        expect(inDiskShadow(xd - 0.1, 0, 0.02, q, hr)).toBe(true);
        expect(inDiskShadow(xd - 0.1, 0, 0.25, q, hr)).toBe(false);
    });
});
