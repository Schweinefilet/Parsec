import { describe, it, expect } from 'vitest';
import {
    EXOTIC, EXOTIC_ORDER, STASHED_EXOTIC, resolveExotic, exoticQuality, clampExoticCamera, turnFrame,
} from './exoticScenes';
import { cameraFrame, QUALITY_ORDER } from './gargantuaCamera';
import { EXOTIC_FRAGS, MAX_STEPS } from './exoticShaders';

describe('exotic scenes', () => {
    it('has a shader and shots for every object, stashed ones included', () => {
        for (const id of Object.keys(EXOTIC)) {
            expect(EXOTIC_FRAGS[id]).toContain('void main()');
            const def = EXOTIC[id];
            expect(def.shotOrder.length).toBeGreaterThan(0);
            for (const s of def.shotOrder) expect(def.shots[s]).toBeDefined();
        }
    });

    it('resolves unknown ids to the default', () => {
        expect(resolveExotic('binary')).toBe('binary');
        expect(resolveExotic('nope')).toBe('gargantua');
        expect(resolveExotic(undefined)).toBe('gargantua');
    });

    it('offers Gargantua first, and hides the stashed objects', () => {
        expect(EXOTIC_ORDER[0]).toBe('gargantua');
        for (const id of STASHED_EXOTIC) {
            expect(EXOTIC[id]).toBeDefined();
            expect(EXOTIC_ORDER).not.toContain(id);
            expect(resolveExotic(id)).toBe('gargantua');
        }
        for (const id of EXOTIC_ORDER.slice(1)) expect(EXOTIC[id]).toBeDefined();
    });

    it('gets more expensive at every quality level, within the shader’s loop bound', () => {
        for (const id of Object.keys(EXOTIC)) {
            const levels = QUALITY_ORDER.map((q) => exoticQuality(id, q));
            for (let i = 1; i < levels.length; i++) {
                expect(levels[i].stepScale).toBeLessThanOrEqual(levels[i - 1].stepScale);
                expect(levels[i].maxSteps).toBeGreaterThanOrEqual(levels[i - 1].maxSteps);
                expect(levels[i].scale).toBeGreaterThan(levels[i - 1].scale);
            }
            expect(levels.at(-1).maxSteps).toBeLessThanOrEqual(MAX_STEPS);
        }
        expect(exoticQuality('wormhole', 'high').stepScale).toBe(EXOTIC.wormhole.base.stepScale);
    });

    it('clamps the camera but keeps the wormhole’s side', () => {
        expect(clampExoticCamera('wormhole', { dist: -100, el: 0 }).dist).toBe(-EXOTIC.wormhole.maxDist);
        expect(clampExoticCamera('wormhole', { dist: 0.1, el: 0 }).dist).toBe(EXOTIC.wormhole.minDist);
        expect(clampExoticCamera('binary', { dist: 1, el: 3 }).el).toBeLessThan(Math.PI / 2);
    });

    it('turns a camera round to look the other way', () => {
        const f = cameraFrame({ dist: 10, az: 0.3, el: 0.2 });
        const g = turnFrame(f, Math.PI);
        f.fwd.forEach((v, i) => expect(g.fwd[i]).toBeCloseTo(-v, 12));
        f.right.forEach((v, i) => expect(g.right[i]).toBeCloseTo(-v, 12));
        expect(g.up).toEqual(f.up);
        expect(turnFrame(f, 0)).toBe(f);
    });
});
