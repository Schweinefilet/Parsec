import { describe, it, expect, beforeEach } from 'vitest';
import stars from '../data/stars.json';
import constellations from '../data/constellationLines.json';
import { loadSkyCatalog, __resetSkyCatalog } from './skyCatalog';

// scripts/build-sky-catalog.mjs does a live network fetch and isn't run in
// CI — these pin the *committed* output instead, so a bad regeneration (a
// schema drift in either upstream source, a broken join) fails a test
// rather than shipping quietly.

describe('stars.json', () => {
    it('has a plausible number of naked-to-dark-sky stars', () => {
        expect(stars.length).toBeGreaterThan(5000);
        expect(stars.length).toBeLessThan(15000);
    });

    it('is sorted brightest first', () => {
        for (let i = 1; i < stars.length; i++) {
            expect(stars[i][2]).toBeGreaterThanOrEqual(stars[i - 1][2]);
        }
    });

    it('every row has valid coordinates and magnitude', () => {
        for (const [ra, dec, mag] of stars) {
            expect(ra).toBeGreaterThanOrEqual(0);
            expect(ra).toBeLessThan(360);
            expect(dec).toBeGreaterThanOrEqual(-90);
            expect(dec).toBeLessThanOrEqual(90);
            expect(Number.isFinite(mag)).toBe(true);
        }
    });

    it('has no duplicate Hipparcos ids', () => {
        const hips = stars.map(s => s[3]).filter(h => h != null);
        expect(new Set(hips).size).toBe(hips.length);
    });

    it('finds Sirius, Polaris and Betelgeuse by name', () => {
        const byName = Object.fromEntries(stars.filter(s => s[5]).map(s => [s[5], s]));
        expect(byName.Sirius[2]).toBeLessThan(-1);       // brightest star in the sky
        expect(byName.Polaris[1]).toBeGreaterThan(88);   // within ~2° of the pole
        expect(byName.Betelgeuse[4]).toBe('Ori');
    });
});

describe('constellationLines.json', () => {
    it('has exactly the 88 IAU constellations, no duplicates', () => {
        expect(constellations.length).toBe(88);
        expect(new Set(constellations.map(c => c[0])).size).toBe(88);
    });

    it('every strip has at least two points and valid coordinates', () => {
        for (const [, , , main, thin] of constellations) {
            for (const strip of [...main, ...thin]) {
                expect(strip.length).toBeGreaterThanOrEqual(2);
                for (const [ra, dec] of strip) {
                    expect(ra).toBeGreaterThanOrEqual(0);
                    expect(ra).toBeLessThan(360);
                    expect(dec).toBeGreaterThanOrEqual(-90);
                    expect(dec).toBeLessThanOrEqual(90);
                }
            }
        }
    });

    it('recognizes Orion, with a real figure', () => {
        const ori = constellations.find(c => c[0] === 'Ori');
        expect(ori[2]).toBe('Orion');
        expect(ori[3].length).toBeGreaterThan(0);
    });
});

describe('loadSkyCatalog()', () => {
    beforeEach(() => { __resetSkyCatalog(); });

    it('resolves the same data as the static imports', async () => {
        const catalog = await loadSkyCatalog();
        expect(catalog.stars.length).toBe(stars.length);
        expect(catalog.constellations.length).toBe(constellations.length);
    });

    it('is idempotent — concurrent callers share one fetch', async () => {
        const [a, b] = await Promise.all([loadSkyCatalog(), loadSkyCatalog()]);
        expect(a).toBe(b);
    });
});
