import { describe, it, expect } from 'vitest';
import {
    HL_TAU, GAPS, PLANETS, gapFactor, mmBrightness, dustTemperature, keplerPeriod, planetMassRatio,
    gapWidth, wakePhase, planetPosition, gasAspect, JUPITER_IN_SUNS,
} from './protoplanetaryDisk';

describe('HL Tau', () => {
    it('follows Kepler: a year at 1 AU round the Sun, longer round a lighter star', () => {
        expect(keplerPeriod(1, 1)).toBeCloseTo(1, 12);
        expect(keplerPeriod(5.2, 1)).toBeCloseTo(11.86, 1); // Jupiter
        expect(keplerPeriod(10, HL_TAU.starMass)).toBeCloseTo(Math.sqrt(1000 / 1.7), 12);
    });

    it('cuts each gap to its own depth at its centre, and leaves the disk alone far from them', () => {
        for (const g of GAPS) {
            // Neighbours overlap a little, never by more than a few percent.
            expect(gapFactor(g.r)).toBeGreaterThan(g.depth * 0.93);
            expect(gapFactor(g.r)).toBeLessThanOrEqual(g.depth + 1e-12);
        }
        expect(gapFactor(150)).toBeCloseTo(1, 6);
        expect(gapFactor(3)).toBeCloseTo(1, 5);
    });

    it('is darker in every gap than in the bright rings either side of it', () => {
        for (const g of GAPS) {
            const at = mmBrightness(g.r);
            const scan = (from, to) => {
                let best = 0;
                for (let r = from; r <= to; r += 0.1) best = Math.max(best, mmBrightness(r));
                return best;
            };
            expect(at).toBeLessThan(scan(g.r + g.width * 0.6, g.r + g.width * 1.5));
            if (g.r > 20) expect(at).toBeLessThan(scan(g.r - g.width * 1.5, g.r - g.width * 0.6));
        }
    });

    it('is brightest in the middle and gone past its edge', () => {
        expect(mmBrightness(2)).toBeGreaterThan(mmBrightness(20));
        expect(mmBrightness(140)).toBeLessThan(0.01 * mmBrightness(20));
        expect(dustTemperature(50)).toBeCloseTo(30, 12);
        expect(dustTemperature(200)).toBeCloseTo(15, 12);
    });

    it('turns a gap’s width into a planet and back (Kanagawa et al. 2016)', () => {
        for (const r of [10, 30, 80]) {
            const q = 3e-4;
            expect(planetMassRatio(gapWidth(q, r), r)).toBeCloseTo(q, 12);
        }
        // Wider gaps, heavier planets: four times the mass for twice the width.
        expect(planetMassRatio(8, 40) / planetMassRatio(4, 40)).toBeCloseTo(4, 12);
    });

    it('puts planets of a sensible size in the deepest gaps: sub-Jupiters, as the papers find', () => {
        expect(PLANETS.map((p) => p.gap)).toEqual(['D1', 'D2', 'D6']);
        for (const p of PLANETS) {
            expect(p.jupiters).toBeGreaterThan(0.02);
            expect(p.jupiters).toBeLessThan(1.5);
            expect(p.jupiters).toBeCloseTo((p.q * HL_TAU.starMass) / JUPITER_IN_SUNS, 12);
        }
    });

    it('raises a trailing spiral wake that starts at the planet', () => {
        const rp = 32;
        expect(wakePhase(rp, rp)).toBeCloseTo(0, 12);
        // Leaves the planet radially: no first-order change in angle.
        const e = 1e-3;
        expect(Math.abs(wakePhase(rp + e, rp) / e)).toBeLessThan(1e-2);
        // Trailing for a disk turning towards +φ: behind outside, ahead inside.
        expect(wakePhase(48, rp)).toBeLessThan(0);
        expect(wakePhase(20, rp)).toBeGreaterThan(0);
        // Winds tighter the further out it gets.
        expect(Math.abs(wakePhase(64, rp))).toBeGreaterThan(Math.abs(wakePhase(48, rp)));
    });

    it('orbits its planets counter-clockwise at their Kepler rate', () => {
        const p = PLANETS[0];
        const P = keplerPeriod(p.r);
        const a = planetPosition(p, 0);
        const b = planetPosition(p, P / 4);
        expect(Math.hypot(...a)).toBeCloseTo(p.r, 10);
        expect(a[0] * b[1] - a[1] * b[0]).toBeGreaterThan(0);
        planetPosition(p, P).forEach((v, i) => expect(v).toBeCloseTo(a[i], 8));
        expect(gasAspect(10)).toBeCloseTo(0.05, 12);
    });
});
