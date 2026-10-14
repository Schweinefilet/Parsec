import { describe, it, expect } from 'vitest';
import {
    lorentz, speedOf, dopplerFactor, jetBoost, jetCounterjetRatio, apparentSpeed, jetRadius, jetLorentz,
    JET_GAMMA, JET_ALPHA, synchrotronRGB,
} from './jets';
import { blackbodyRGB } from './blackbody';

describe('relativistic jets', () => {
    it('round-trips speed and Lorentz factor', () => {
        expect(lorentz(0)).toBe(1);
        expect(lorentz(0.6)).toBeCloseTo(1.25, 12);
        expect(speedOf(lorentz(0.98))).toBeCloseTo(0.98, 12);
    });

    it('has the textbook Doppler factors: 1/Γ side on, √((1+β)/(1−β)) head on', () => {
        const b = 0.8;
        expect(dopplerFactor(b, 0)).toBeCloseTo(1 / lorentz(b), 12);
        expect(dopplerFactor(b, 1)).toBeCloseTo(Math.sqrt((1 + b) / (1 - b)), 12);
        expect(dopplerFactor(b, -1)).toBeCloseTo(Math.sqrt((1 - b) / (1 + b)), 12);
        expect(dopplerFactor(0, 0.3)).toBe(1);
    });

    it('makes the near jet outshine the far one by the ratio of their boosts', () => {
        const b = speedOf(JET_GAMMA);
        for (const th of [0.2, 0.7, 1.2]) {
            const near = jetBoost(dopplerFactor(b, Math.cos(th)));
            const far = jetBoost(dopplerFactor(b, -Math.cos(th)));
            expect(near / far).toBeCloseTo(jetCounterjetRatio(b, th), 6);
        }
        // Side on, the two are equal; at 20° a Γ = 6 jet is thousands of times brighter.
        expect(jetCounterjetRatio(b, Math.PI / 2)).toBeCloseTo(1, 12);
        expect(jetCounterjetRatio(b, (20 * Math.PI) / 180)).toBeGreaterThan(1000);
        expect(jetBoost(2, JET_ALPHA)).toBeCloseTo(2 ** 2.7, 12);
    });

    it('moves faster than light across the sky, up to βΓ at cos θ = β', () => {
        const b = 0.99;
        const best = Math.acos(b);
        expect(apparentSpeed(b, best)).toBeCloseTo(b * lorentz(b), 10);
        expect(apparentSpeed(b, best)).toBeGreaterThan(apparentSpeed(b, best * 1.5));
        expect(apparentSpeed(b, best)).toBeGreaterThan(apparentSpeed(b, best * 0.5));
        expect(apparentSpeed(b, Math.PI / 2)).toBeCloseTo(b, 12);
        // M87's HST-1 knot at ~6c needs β above 0.98.
        expect(apparentSpeed(0.98, Math.acos(0.98))).toBeLessThan(6);
        expect(apparentSpeed(0.99, Math.acos(0.99))).toBeGreaterThan(6);
    });

    it('widens parabolically, z ∝ r^1.73, and speeds up with height', () => {
        const r1 = jetRadius(100) - 1.4;
        const r2 = jetRadius(1000) - 1.4;
        expect(Math.log(1000 / 100) / Math.log(r2 / r1)).toBeCloseTo(1.73, 10);
        expect(jetRadius(-50)).toBe(jetRadius(50));
        expect(jetLorentz(0)).toBe(1);
        expect(jetLorentz(1e5)).toBeCloseTo(JET_GAMMA, 6);
        expect(jetLorentz(30)).toBeLessThan(jetLorentz(90));
    });

    it('glows blue-white, bluer than the Sun', () => {
        const [r, , b] = synchrotronRGB();
        expect(b).toBeGreaterThan(r);
        const sun = blackbodyRGB(5772);
        expect(b / r).toBeGreaterThan(sun[2] / sun[0]);
        // Steeper spectra are redder.
        const steep = synchrotronRGB(1.5);
        expect(steep[2] / steep[0]).toBeLessThan(b / r);
    });
});
