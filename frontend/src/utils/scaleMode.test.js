import { describe, it, expect, afterEach } from 'vitest';
import {
    AU_UNITS, isTrueScale, scaleProgress, setTrueScale, toggleTrueScale,
    radialFactor, subscribeScale, isScaleSettling, __setScaleImmediate,
} from './scaleMode';
import { PLANETS } from '../data/solarSystemBodies';

afterEach(() => __setScaleImmediate(false));

describe('scaleMode', () => {
    it('starts compressed', () => {
        expect(isTrueScale()).toBe(false);
        expect(scaleProgress()).toBe(0);
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
