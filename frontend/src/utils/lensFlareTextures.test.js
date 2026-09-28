import { describe, it, expect } from 'vitest';
import { sunFlareScale, setSunFlareScale, setSunFlareGains } from './lensFlareTextures.js';
import * as THREE from 'three';

// The scene's own numbers, so these read as the views they describe rather
// than as bare ratios: a 12-unit Sun, the opening camera 578 units out, and
// the quarter-unit Sun true sizes shrinks it to.
const SUN = 12;
const HOME = 578;
const TRUE_SIZE_SUN = 0.225;

describe('sunFlareScale', () => {
    it('is 1x at the view the flare was authored against', () => {
        expect(sunFlareScale(SUN, HOME)).toBeCloseTo(1, 3);
    });

    it('shrinks as the camera pulls back — the whole point of it', () => {
        const home = sunFlareScale(SUN, HOME);
        const further = sunFlareScale(SUN, HOME * 2);
        const furthest = sunFlareScale(SUN, HOME * 4);
        expect(further).toBeLessThan(home);
        expect(furthest).toBeLessThan(further);
    });

    it('grows as the camera closes in', () => {
        expect(sunFlareScale(SUN, HOME / 2)).toBeGreaterThan(sunFlareScale(SUN, HOME));
    });

    it('tracks apparent size rather than distance alone', () => {
        // Half the Sun at half the distance looks identical, so it must be.
        expect(sunFlareScale(SUN / 2, HOME / 2)).toBeCloseTo(sunFlareScale(SUN, HOME), 3);
    });

    it('still shows something at true sizes, where the Sun is a quarter of a unit', () => {
        // Un-clamped this lands near 0.11, which is small enough to read as
        // nothing at all — and the flare is the only mark of where the Sun is
        // in that view, so the floor is load-bearing, not cosmetic.
        const scale = sunFlareScale(TRUE_SIZE_SUN, 96);
        expect(scale).toBeGreaterThan(0.25);
        expect(scale).toBeLessThan(0.5);
    });

    it('does not swallow the frame right up against the Sun', () => {
        expect(sunFlareScale(SUN, SUN * 2.5)).toBeLessThanOrEqual(2.6);
    });

    it('falls back to the floor for a degenerate camera rather than NaN', () => {
        for (const args of [[0, HOME], [SUN, 0], [NaN, HOME], [SUN, NaN], [-1, HOME]]) {
            expect(Number.isFinite(sunFlareScale(...args))).toBe(true);
        }
    });
});

describe('setSunFlareScale', () => {
    const fakeFlare = () => ({
        userData: {
            flareParts: [
                { element: { size: 220 }, baseSize: 220 },
                { element: { size: 760 }, baseSize: 760 },
            ],
        },
    });

    it('scales every element from its authored size', () => {
        const flare = fakeFlare();
        setSunFlareScale(flare, 0.5);
        expect(flare.userData.flareParts.map(p => p.element.size)).toEqual([110, 380]);
    });

    it('does not compound frame on frame', () => {
        const flare = fakeFlare();
        setSunFlareScale(flare, 0.5);
        setSunFlareScale(flare, 0.5);
        setSunFlareScale(flare, 2);
        expect(flare.userData.flareParts.map(p => p.element.size)).toEqual([440, 1520]);
    });

    it('is a no-op on a flare that was never built (the low quality tier has none)', () => {
        expect(() => setSunFlareScale(null, 1)).not.toThrow();
        expect(() => setSunFlareScale({}, 1)).not.toThrow();
    });
});

describe('setSunFlareGains', () => {
    const part = (role) => ({ element: { color: new THREE.Color(1, 1, 1) }, role });

    it('drives the halo and rays on their own and leaves the ghosts as authored', () => {
        const halo = part('halo'), ray = part('rays'), ghost = part('ghost');
        setSunFlareGains({ userData: { flareParts: [halo, ray, ghost] } }, { halo: 0.5, rays: 1.5 });
        expect(halo.element.color.r).toBeCloseTo(0.5);
        expect(ray.element.color.r).toBeCloseTo(1.5);
        expect(ghost.element.color.r).toBe(1);
    });

    it('defaults to everything as authored', () => {
        const halo = part('halo');
        halo.element.color.setScalar(0.2);
        setSunFlareGains({ userData: { flareParts: [halo] } });
        expect(halo.element.color.r).toBe(1);
    });

    it('ignores a missing flare', () => {
        expect(() => setSunFlareGains(null)).not.toThrow();
    });
});
