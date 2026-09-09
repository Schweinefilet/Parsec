import { describe, it, expect } from 'vitest';
import {
    WEIGHT_CONFIG, GRAVITY_BODIES, MAX_GRAVITY_BODIES,
    massParam, visualWeights,
} from './gravityModel';
import { PLANETS } from '../data/solarSystemBodies';

// The overlays are only honest if the mapping is monotonic and clamped: a
// heavier body must never get a shallower well, and nothing off the ends of
// the mass window may run away.

describe('mass parameter', () => {
    it('is 0 at the floor and 1 at the ceiling, clamped both ways', () => {
        expect(massParam(10 ** WEIGHT_CONFIG.logMassMin)).toBeCloseTo(0, 6);
        expect(massParam(10 ** WEIGHT_CONFIG.logMassMax)).toBeCloseTo(1, 6);
        expect(massParam(1e10)).toBe(0);      // far below Pluto
        expect(massParam(1e40)).toBe(1);      // far above the Sun
    });

    it('is monotonic in mass', () => {
        const ordered = [...GRAVITY_BODIES].sort((a, b) => a.massKg - b.massKg);
        for (let i = 1; i < ordered.length; i++) {
            expect(massParam(ordered[i].massKg))
                .toBeGreaterThanOrEqual(massParam(ordered[i - 1].massKg));
        }
    });
});

describe('visual weights', () => {
    it('every weight rises with mass', () => {
        const ordered = [...GRAVITY_BODIES].sort((a, b) => a.massKg - b.massKg);
        for (let i = 1; i < ordered.length; i++) {
            const lo = visualWeights(ordered[i - 1].massKg, ordered[i - 1].drawnR);
            const hi = visualWeights(ordered[i].massKg, ordered[i].drawnR);
            expect(hi.gridDepth).toBeGreaterThanOrEqual(lo.gridDepth);
            expect(hi.gridRadius).toBeGreaterThanOrEqual(lo.gridRadius);
            expect(hi.fieldMass).toBeGreaterThanOrEqual(lo.fieldMass);
            expect(hi.lineCount).toBeGreaterThanOrEqual(lo.lineCount);
        }
    });

    it('stays inside the configured bands', () => {
        for (const b of GRAVITY_BODIES) {
            const w = visualWeights(b.massKg, b.drawnR);
            expect(w.gridDepth).toBeGreaterThanOrEqual(WEIGHT_CONFIG.gridDepth.min - 1e-9);
            expect(w.gridDepth).toBeLessThanOrEqual(WEIGHT_CONFIG.gridDepth.max + 1e-9);
            expect(w.fieldMass).toBeLessThanOrEqual(WEIGHT_CONFIG.fieldMass.max + 1e-9);
            expect(w.lineCount).toBeGreaterThanOrEqual(WEIGHT_CONFIG.fieldLines.min);
            expect(w.lineCount).toBeLessThanOrEqual(WEIGHT_CONFIG.fieldLines.max);
            expect(w.minRadius).toBeGreaterThanOrEqual(WEIGHT_CONFIG.minRadius.floor - 1e-9);
            expect(w.minRadius).toBeLessThanOrEqual(WEIGHT_CONFIG.minRadius.ceil + 1e-9);
        }
    });

    it('gives the Sun the deepest well and the most lines', () => {
        const sun = GRAVITY_BODIES.find(b => b.id === 'sun').weights;
        for (const b of GRAVITY_BODIES) {
            if (b.id === 'sun') continue;
            expect(sun.gridDepth).toBeGreaterThan(b.weights.gridDepth);
            expect(sun.lineCount).toBeGreaterThanOrEqual(b.weights.lineCount);
        }
    });

    it('keeps Jupiter heavier than Earth in the grid, as the gamma intends', () => {
        const j = GRAVITY_BODIES.find(b => b.id === 'jupiter').weights;
        const e = GRAVITY_BODIES.find(b => b.id === 'earth').weights;
        expect(j.gridDepth).toBeGreaterThan(e.gridDepth * 1.5);
    });

    it('carries the layout-gated expansion exponents for the renderers', () => {
        // The distance term lives with the renderers (per-frame, needs scaleT),
        // but its exponents belong in the one config object.
        for (const k of ['gridExpandRadius', 'gridExpandDepth', 'fieldExpandRadius', 'fieldExpandMass']) {
            expect(WEIGHT_CONFIG[k]).toBeGreaterThan(0);
            expect(WEIGHT_CONFIG[k]).toBeLessThanOrEqual(1);
        }
    });
});

describe('roster', () => {
    it('is the Sun, the planets and Pluto — and fits the shader cap', () => {
        expect(GRAVITY_BODIES.map(b => b.id))
            .toEqual(['sun', ...PLANETS.map(p => p.id)]);
        expect(GRAVITY_BODIES.length).toBeLessThanOrEqual(MAX_GRAVITY_BODIES);
        expect(GRAVITY_BODIES.some(b => b.id === 'pluto')).toBe(true);
    });

    it('has a real mass and a drawn radius for every body', () => {
        for (const b of GRAVITY_BODIES) {
            expect(b.massKg).toBeGreaterThan(0);
            expect(b.drawnR).toBeGreaterThan(0);
        }
    });
});
