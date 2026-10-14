import { describe, it, expect } from 'vitest';
import {
    WR104, MASSES, outflowAuPerDay, outflowKmPerS, armSpacing, dustOnset, shockHalfAngle, dustTemperature,
    kBandPlanck, coneAxis, dustDensity, spiralCrossings, orbitSeparation, coneTrail, starPositions,
} from './pinwheel';

const opts = { theta: shockHalfAngle(0.02), width: 0.08 };

describe('WR 104', () => {
    it('expands at about 1250 km/s, the speed of a WC9 star’s wind', () => {
        expect(outflowAuPerDay()).toBeCloseTo(0.28e-3 * 2580, 12);
        expect(outflowKmPerS(WR104.masPerDay, WR104.distancePc)).toBeGreaterThan(1200);
        expect(outflowKmPerS(WR104.masPerDay, WR104.distancePc)).toBeLessThan(1300);
    });

    it('spaces its turns by the wind speed times the period: about 174 AU, 68 mas', () => {
        expect(armSpacing()).toBeCloseTo(outflowAuPerDay() * 241.5, 12);
        expect(armSpacing()).toBeCloseTo(174.5, 0);
        expect((armSpacing() / WR104.distancePc) * 1e3).toBeCloseTo(0.28 * 241.5, 6);
        expect(dustOnset()).toBeCloseTo(34.3, 1);
    });

    it('opens the wind-collision cone wider for a stronger O-star wind (Eichler & Usov 1993)', () => {
        expect(shockHalfAngle(1)).toBeCloseTo(2.1 * 0.75, 12);
        // Small η: the cone narrows as η^⅓.
        expect(shockHalfAngle(1e-6) / Math.cbrt(1e-6)).toBeCloseTo(2.1, 1);
        let prev = 0;
        for (const eta of [0.001, 0.01, 0.03, 0.1, 0.3]) {
            expect(shockHalfAngle(eta)).toBeGreaterThan(prev);
            prev = shockHalfAngle(eta);
        }
    });

    it('cools its dust outward, and dims it in the infrared faster still', () => {
        expect(dustTemperature(dustOnset())).toBeCloseTo(1500, 9);
        expect(dustTemperature(dustOnset() * 2 ** 2.5)).toBeCloseTo(750, 6);
        expect(kBandPlanck(1500) / kBandPlanck(750)).toBeGreaterThan(50);
    });

    it('has no dust inside the cavity', () => {
        expect(dustDensity([10, 0, 0], 0, opts)).toBe(0);
    });

    it('puts the dust on the spiral where the crossings say', () => {
        const t = 37;
        const phi = 0.8;
        const rs = spiralCrossings(phi, t, opts.theta, 700).filter((r) => r > dustOnset());
        expect(rs.length).toBeGreaterThan(5);
        for (const r of rs) {
            const on = dustDensity([r * Math.cos(phi), r * Math.sin(phi), 0], t, opts) * r * r;
            expect(on).toBeGreaterThan(0.99);
        }
        // Half way between two turns of the same edge there is nothing.
        const r = rs[2] + armSpacing() / 2;
        const off = dustDensity([r * Math.cos(phi), r * Math.sin(phi), 0], t, opts) * r * r;
        expect(off).toBeLessThan(0.01);
    });

    it('repeats every orbit, and turns as a whole once per orbit', () => {
        const x = [120, -60, 15];
        expect(dustDensity(x, 10 + WR104.periodDays, opts)).toBeCloseTo(dustDensity(x, 10, opts), 12);
        const a = 0.9;
        const rx = [x[0] * Math.cos(a) - x[1] * Math.sin(a), x[0] * Math.sin(a) + x[1] * Math.cos(a), x[2]];
        const dt = (a / (2 * Math.PI)) * WR104.periodDays;
        expect(dustDensity(rx, 10 + dt, opts)).toBeCloseTo(dustDensity(x, 10, opts), 12);
    });

    it('turns its cone counter-clockwise in the orbital plane', () => {
        const a = coneAxis(0);
        const b = coneAxis(WR104.periodDays / 4);
        expect(a[0] * b[1] - a[1] * b[0]).toBeCloseTo(1, 12);
        expect(a[2]).toBe(0);
    });

    it('keeps its stars a couple of AU apart, the companion further along the cone', () => {
        // 30 suns in 241.5 days: Kepler gives about 2.4 AU.
        expect(orbitSeparation()).toBeCloseTo(Math.cbrt(30 * (241.5 / 365.25) ** 2), 12);
        expect(orbitSeparation()).toBeGreaterThan(2);
        expect(orbitSeparation()).toBeLessThan(3);
        const [wr, ob] = starPositions(50);
        expect(Math.hypot(ob[0] - wr[0], ob[1] - wr[1])).toBeCloseTo(orbitSeparation(), 10);
        // The centre of mass stays put.
        expect(wr[0] * MASSES.wr + ob[0] * MASSES.ob).toBeCloseTo(0, 10);
        const ax = coneAxis(50);
        expect((ob[0] - wr[0]) * ax[0] + (ob[1] - wr[1]) * ax[1]).toBeGreaterThan(0);
        // A few degrees of trail: the orbit is slow next to the wind.
        expect((coneTrail() * 180) / Math.PI).toBeGreaterThan(3);
        expect((coneTrail() * 180) / Math.PI).toBeLessThan(8);
    });
});
