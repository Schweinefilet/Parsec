import { describe, it, expect, afterEach } from 'vitest';
import {
    AU_UNITS, KM_PER_UNIT, isTrueScale, isTrueSize, scaleProgress, sizeProgress,
    setTrueScale, toggleTrueScale, radialFactor, sizeFactor, subscribeScale,
    isScaleSettling, __setScaleImmediate, getScaleStage, setScaleStage,
    cycleScaleStage, SCALE_COMPRESSED, SCALE_DISTANCES, SCALE_SIZES,
} from './scaleMode';
import { PLANETS } from '../data/solarSystemBodies';

afterEach(() => __setScaleImmediate(false));

describe('scaleMode', () => {
    it('starts at true distances and sizes', () => {
        // The module's own cold-load state — every fresh page load opens
        // here, at the owner's request (see scaleMode.js's own doc comment).
        // Every other test in this file runs after afterEach's
        // __setScaleImmediate(false), so this is the one place that default
        // is actually observable.
        expect(getScaleStage()).toBe(SCALE_SIZES);
        expect(isTrueScale()).toBe(true);
        expect(isTrueSize()).toBe(true);
        expect(scaleProgress()).toBe(1);
        expect(sizeProgress()).toBe(1);
    });

    it('eases across rather than cutting', () => {
        const t0 = 1_000_000;
        setTrueScale(true, t0);
        expect(scaleProgress(t0)).toBeCloseTo(0, 5);
        const mid = scaleProgress(t0 + 1100);
        expect(mid).toBeGreaterThan(0.2);
        expect(mid).toBeLessThan(0.8);
        expect(scaleProgress(t0 + 5000)).toBe(1);
        expect(isScaleSettling(t0 + 5000)).toBe(false);
    });

    it('reverses from wherever it had got to, without snapping', () => {
        const t0 = 2_000_000;
        setTrueScale(true, t0);
        const caught = scaleProgress(t0 + 800);
        setTrueScale(false, t0 + 800);
        // Turning back starts from where it was, not from 1
        expect(scaleProgress(t0 + 800)).toBeCloseTo(caught, 5);
        expect(scaleProgress(t0 + 800 + 5000)).toBe(0);
    });

    it('tells subscribers, so the button can follow', () => {
        let calls = 0;
        const off = subscribeScale(() => calls++);
        toggleTrueScale();
        expect(calls).toBe(1);
        off();
        toggleTrueScale();
        expect(calls).toBe(1);
    });
});

describe('the three stages', () => {
    it('cycles compressed → distances → distances and sizes → compressed', () => {
        expect(getScaleStage()).toBe(SCALE_COMPRESSED);
        cycleScaleStage();
        expect(getScaleStage()).toBe(SCALE_DISTANCES);
        cycleScaleStage();
        expect(getScaleStage()).toBe(SCALE_SIZES);
        cycleScaleStage();
        expect(getScaleStage()).toBe(SCALE_COMPRESSED);
    });

    it('only moves sizes on the second step, leaving distances where they are', () => {
        const t0 = 3_000_000;
        setScaleStage(SCALE_DISTANCES, t0);
        expect(scaleProgress(t0 + 5000)).toBe(1);
        expect(sizeProgress(t0 + 5000)).toBe(0);

        setScaleStage(SCALE_SIZES, t0 + 5000);
        // Distances are already true and stay there for the whole size move
        expect(scaleProgress(t0 + 6000)).toBe(1);
        expect(sizeProgress(t0 + 5000)).toBeCloseTo(0, 5);
        expect(sizeProgress(t0 + 10000)).toBe(1);
    });

    it('brings both home together when cycling straight back to compressed', () => {
        const t0 = 4_000_000;
        __setScaleImmediate(SCALE_SIZES);
        expect(scaleProgress()).toBe(1);
        expect(sizeProgress()).toBe(1);
        setScaleStage(SCALE_COMPRESSED, t0);
        expect(scaleProgress(t0 + 5000)).toBe(0);
        expect(sizeProgress(t0 + 5000)).toBe(0);
    });

    it('reports each half of the layout separately', () => {
        __setScaleImmediate(SCALE_DISTANCES);
        expect(isTrueScale()).toBe(true);
        expect(isTrueSize()).toBe(false);
        __setScaleImmediate(SCALE_SIZES);
        expect(isTrueScale()).toBe(true);
        expect(isTrueSize()).toBe(true);
    });

    it('ignores a stage it is already on, and clamps nonsense', () => {
        let calls = 0;
        const off = subscribeScale(() => calls++);
        setScaleStage(SCALE_COMPRESSED);
        expect(calls).toBe(0);
        setScaleStage(99);
        expect(getScaleStage()).toBe(SCALE_SIZES);
        setScaleStage(-4);
        expect(getScaleStage()).toBe(SCALE_COMPRESSED);
        off();
    });
});

describe('sizeFactor', () => {
    it('leaves every body at its drawn size at rest', () => {
        for (const p of PLANETS) expect(sizeFactor(p.r, 6371, 0)).toBe(1);
    });

    it('lands a body on its real radius in scene units', () => {
        // Earth: 6,371 km at 1.56 million km to the unit
        const earth = PLANETS.find(p => p.id === 'earth');
        const drawn = earth.r * sizeFactor(earth.r, 6371, 1);
        expect(drawn).toBeCloseTo(6371 / KM_PER_UNIT, 9);
        // …which is the four-thousandths-of-a-unit the mode is named for
        expect(drawn).toBeGreaterThan(0.004);
        expect(drawn).toBeLessThan(0.005);
    });

    it('keeps the bodies honest against each other', () => {
        const earth   = PLANETS.find(p => p.id === 'earth');
        const jupiter = PLANETS.find(p => p.id === 'jupiter');
        const at = (p, km) => p.r * sizeFactor(p.r, km, 1);
        // Jupiter is 10.97 Earth radii, whatever the two were drawn at
        expect(at(jupiter, 69911) / at(earth, 6371)).toBeCloseTo(69911 / 6371, 6);
    });

    it('leaves anything it has no real radius for alone', () => {
        expect(sizeFactor(2, null, 1)).toBe(1);
        expect(sizeFactor(2, 0, 1)).toBe(1);
        expect(sizeFactor(0, 6371, 1)).toBe(1);
    });
});

describe('radialFactor', () => {
    it('leaves everything alone while compressed', () => {
        for (const p of PLANETS) expect(radialFactor(p.orbitR, p.au, 0)).toBe(1);
    });

    it('puts every planet at its real distance once true', () => {
        for (const p of PLANETS) {
            const moved = p.orbitR * radialFactor(p.orbitR, p.au, 1);
            expect(moved, p.id).toBeCloseTo(p.au * AU_UNITS, 6);
        }
    });

    it('spreads the outer system and leaves the inner one about where it was', () => {
        const earth = PLANETS.find(p => p.id === 'earth');
        const neptune = PLANETS.find(p => p.id === 'neptune');
        // Earth's ring is the anchor, so it barely moves
        expect(radialFactor(earth.orbitR, earth.au, 1)).toBeCloseTo(1, 2);
        // Neptune is 30 AU out but drawn at 3.5 Earth rings, so it has furthest to go
        expect(radialFactor(neptune.orbitR, neptune.au, 1)).toBeGreaterThan(8);
    });

    it('restores the ratio the compressed view flattens', () => {
        const earth = PLANETS.find(p => p.id === 'earth');
        const neptune = PLANETS.find(p => p.id === 'neptune');
        const at = (t) => (neptune.orbitR * radialFactor(neptune.orbitR, neptune.au, t))
            / (earth.orbitR * radialFactor(earth.orbitR, earth.au, t));
        expect(at(0)).toBeCloseTo(340 / 96, 2);          // the drawn lie: 3.5x
        expect(at(1)).toBeCloseTo(30.069, 2);            // the truth: 30x
    });

    it('declines to divide by nothing', () => {
        expect(radialFactor(0, 5, 1)).toBe(1);
        expect(radialFactor(100, 0, 1)).toBe(1);
    });
});
