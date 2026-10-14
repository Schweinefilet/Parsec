import { describe, it, expect } from 'vitest';
import {
    apparentRadius, surfaceRedshift, maxBendAngle, visibleFraction, visibleFractionBeloborodov,
    traceToSurface, DEFAULT_RADIUS, KM_PER_M,
    J0030, hotRegions, surfaceTemperature, unitVector, opticalBrightness,
} from './neutronStar';

// A ray fired from far down −x with impact parameter b, travelling +x.
const D = 2000;
const fire = (b, R) => traceToSurface([-D, b, 0], [1, 0, 0], R, { scale: 0.01 });

describe('neutron star', () => {
    it('looks bigger than it is: apparent radius R/√(1−2/R)', () => {
        expect(apparentRadius(6)).toBeCloseTo(6 / Math.sqrt(2 / 3), 12);
        expect(apparentRadius(DEFAULT_RADIUS)).toBeGreaterThan(DEFAULT_RADIUS);
        expect(surfaceRedshift(6)).toBeCloseTo(Math.sqrt(2 / 3), 12);
    });

    for (const R of [4, 5.8, 8]) {
        it(`is hit just inside its apparent radius and missed just outside (R = ${R})`, () => {
            const b = apparentRadius(R);
            expect(fire(b * 0.995, R).fate).toBe('surface');
            expect(fire(b * 1.005, R).fate).toBe('escaped');
        });
    }

    it('bends grazing light by more than 90°, so more than half the star shows', () => {
        for (const R of [4, 5.8, 8]) {
            expect(maxBendAngle(R)).toBeGreaterThan(Math.PI / 2);
            expect(visibleFraction(R)).toBeGreaterThan(0.5);
        }
        expect(visibleFraction(3.05)).toBe(1);
    });

    it('matches Beloborodov’s approximation to a couple of percent', () => {
        for (const R of [5, 5.8, 8, 10]) {
            expect(Math.abs(visibleFraction(R) - visibleFractionBeloborodov(R))).toBeLessThan(0.02);
        }
    });

    it('agrees with the traced ray on how far round a grazing ray reaches', () => {
        // The ray that just grazes the surface, followed backwards from the
        // observer: where it touches is ψ_max round from the sub-observer point.
        const R = 5.8;
        const res = fire(apparentRadius(R) * 0.9999, R);
        expect(res.fate).toBe('surface');
        const [x, y] = res.state;
        // Sub-observer point is −x; angle from it to the hit.
        const psi = Math.atan2(y, -x);
        expect(psi).toBeCloseTo(maxBendAngle(R), 1);
    });

    describe('PSR J0030+0451’s hot regions (Riley et al. 2019)', () => {
        // The sphere sampled evenly in cos θ and φ: each sample the same area.
        const samples = [];
        for (let i = 0; i < 300; i++) {
            for (let j = 0; j < 600; j++) {
                const mu = -1 + (2 * (i + 0.5)) / 300;
                const ph = (2 * Math.PI * (j + 0.5)) / 600;
                const s2 = Math.sqrt(1 - mu * mu);
                samples.push([s2 * Math.cos(ph), s2 * Math.sin(ph), mu]);
            }
        }
        const hot = samples.filter((v) => surfaceTemperature(v) > 1e6);

        it('has the paper’s size and compactness', () => {
            expect(DEFAULT_RADIUS * KM_PER_M).toBeCloseTo(J0030.radiusKm, 0);
            expect(1 / DEFAULT_RADIUS).toBeCloseTo(0.156, 2);
        });

        it('puts both regions in the southern hemisphere, away from Earth', () => {
            expect(hot.length).toBeGreaterThan(0);
            expect(hot.every((v) => v[2] < 0)).toBe(true);
            // Earth is 54° from the north pole: it never sees them straight on.
            const earth = unitVector(J0030.inclination, 0);
            expect(Math.max(...hot.map((v) => v[0] * earth[0] + v[1] * earth[1] + v[2] * earth[2]))).toBeLessThan(0);
        });

        it('makes the second region a thin crescent, not a disk', () => {
            const { pst, pstInner } = hotRegions();
            const nearPst = hot.filter((v) => v[0] * pst[0] + v[1] * pst[1] + v[2] * pst[2] > Math.cos(0.6));
            // A full cap of 0.47 rad covers (1 − cos 0.47)/2 of the sphere;
            // the crescent is a small part of that.
            const cap = (1 - Math.cos(J0030.pst.radius)) / 2;
            const frac = nearPst.length / samples.length;
            expect(frac).toBeGreaterThan(0.05 * cap);
            expect(frac).toBeLessThan(0.35 * cap);
            // The cut-out circle sits just off the outer one's centre.
            const off = Math.acos(pst[0] * pstInner[0] + pst[1] * pstInner[1] + pst[2] * pstInner[2]);
            expect(off).toBeCloseTo(J0030.pst.offset, 6);
        });

        it('makes the round spot a few degrees across', () => {
            const { st } = hotRegions();
            const spot = hot.filter((v) => v[0] * st[0] + v[1] * st[1] + v[2] * st[2] > Math.cos(0.2));
            const expected = (1 - Math.cos(J0030.st.radius)) / 2;
            expect(spot.length / samples.length).toBeCloseTo(expected, 3);
        });

        it('shines in visible light in proportion to g·T, the Rayleigh–Jeans tail', () => {
            expect(opticalBrightness(J0030.spotTemp)).toBeCloseTo(1, 12);
            expect(opticalBrightness(J0030.surfaceTemp)).toBeCloseTo(J0030.surfaceTemp / J0030.spotTemp, 12);
            expect(opticalBrightness(1e6, 0.8, 1e6)).toBeCloseTo(0.8, 12);
        });
    });
});
