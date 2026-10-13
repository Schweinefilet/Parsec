import { describe, it, expect } from 'vitest';
import {
    apparentRadius, surfaceRedshift, maxBendAngle, visibleFraction, visibleFractionBeloborodov,
    traceToSurface, magneticAxis, DEFAULT_RADIUS,
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

    it('turns its magnetic axis round the spin axis once a period', () => {
        const incl = 0.4;
        const a = magneticAxis(0, incl, 2);
        const b = magneticAxis(1, incl, 2);
        expect(Math.hypot(...a)).toBeCloseTo(1, 12);
        expect(a[2]).toBeCloseTo(Math.cos(incl), 12);
        expect(b[0]).toBeCloseTo(-a[0], 12);
        expect(magneticAxis(2, incl, 2)[0]).toBeCloseTo(a[0], 12);
    });
});
