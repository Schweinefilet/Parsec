import { describe, it, expect } from 'vitest';
import { createRaster, addCapsule, texelArea, rasterizeDebris, debrisTemperature } from './debrisRaster';
import { createEvent, stepEvent, RELEASE_HEAT, TDE } from './tidalDisruption';

// What the raster holds in all, Σ times each texel's area.
const total = (R, ch = 0) => {
    let m = 0;
    for (let j = 0; j < R.height; j++) {
        for (let i = 0; i < R.width; i++) m += R.data[(j * R.width + i) * 4 + ch] * texelArea(R, i);
    }
    return m;
};

describe('the debris raster', () => {
    it('tiles the plane: its texels add up to the annulus they cover', () => {
        const R = createRaster();
        let a = 0;
        for (let i = 0; i < R.width; i++) a += texelArea(R, i) * R.height;
        expect(a).toBeCloseTo(Math.PI * (R.rMax ** 2 - R.rMin ** 2), -2);
    });

    it('keeps a capsule’s mass, short or long, near or far', () => {
        for (const [x0, y0, x1, y1, w] of [[20, 0, 21, 0, 0.3], [40, 10, 60, -5, 0.8], [-300, 200, -320, 230, 6]]) {
            const R = createRaster();
            addCapsule(R, x0, y0, x1, y1, w, 0.25, 9000, 0.1, -0.2);
            expect(total(R)).toBeCloseTo(0.25, 1);
            // The weighted channels carry the same mass times their value.
            expect(total(R, 1) / total(R)).toBeCloseTo(9000, 2);
            expect(total(R, 3) / total(R)).toBeCloseTo(-0.2, 5);
        }
    });

    it('puts a capsule where it is: densest on it, nothing well away from it', () => {
        const R = createRaster();
        addCapsule(R, 0, 30, 0, 32, 0.5, 1, 6000, 0, 0);
        const at = (x, y) => {
            const r = Math.hypot(x, y);
            const i = Math.floor((Math.log(r) - R.lnMin) / R.dLn);
            const j = Math.floor(((Math.atan2(y, x) / (2 * Math.PI)) + 0.5) * R.height);
            return R.data[(j * R.width + i) * 4];
        };
        expect(at(0, 31)).toBeGreaterThan(0);
        expect(at(0, -31)).toBe(0);
        expect(at(5, 31)).toBe(0);
    });

    it('draws nothing before the star lets go, and the whole star just after', () => {
        const ev = createEvent(1.5);
        const R = createRaster();
        rasterizeDebris(R, ev);
        expect(total(R)).toBe(0);
        while (ev.released == null) stepEvent(ev, 2);
        stepEvent(ev, 20);
        rasterizeDebris(R, ev);
        // The chains' interior segments carry nearly all of it.
        expect(total(R)).toBeGreaterThan(0.85);
        expect(total(R)).toBeLessThan(1.05);
    });

    it('heats shocked gas from the stream’s orange to blue-white', () => {
        expect(debrisTemperature(0)).toBe(6000);
        expect(debrisTemperature(0.05)).toBeGreaterThan(20000);
        // It leaves the star at the star's own temperature.
        expect(debrisTemperature(RELEASE_HEAT) / TDE.starTemp).toBeCloseTo(1, 1);
    });
});
