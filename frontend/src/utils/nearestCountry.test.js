import { describe, it, expect, beforeAll, afterEach } from 'vitest';
import { loadLandPoints, nearestCountry, __reset } from './nearestCountry';

describe('nearestCountry', () => {
    it('answers null until the land table is there', () => {
        __reset();
        expect(nearestCountry(35.68, 139.69)).toBeNull();
    });

    describe('once loaded', () => {
        beforeAll(() => loadLandPoints());
        afterEach(() => {});

        it('names the country a point over land is over', () => {
            expect(nearestCountry(35.68, 139.69).name).toBe('Japan');          // Tokyo
            expect(nearestCountry(-25, 133).name).toBe('Australia');           // Uluru-ish
            expect(nearestCountry(48, 67).name).toBe('Kazakhstan');            // deep interior
        });

        it('reports land as overhead rather than hundreds of km off', () => {
            // The interior fill is what makes this true — boundary samples alone
            // would put the middle of Kazakhstan a long way from Kazakhstan.
            expect(nearestCountry(48, 67).km).toBeLessThan(75);
            expect(nearestCountry(-25, 133).km).toBeLessThan(75);
        });

        it('still answers at sea, which is where the station usually is', () => {
            // The point in the brief: south-west Pacific, nothing underneath
            const pacific = nearestCountry(-21.73, 171.04);
            expect(pacific.name).toBe('Vanuatu');
            expect(pacific.km).toBeGreaterThan(100);
            expect(pacific.km).toBeLessThan(400);

            // Mid-Atlantic — the Azores are Portuguese, and they are the nearest land
            expect(nearestCountry(30, -40).name).toBe('Portugal');
        });

        it('keeps small island nations, which are often the only answer', () => {
            // Sampling that drops sub-degree islands answers with a mainland
            // thousands of km away instead
            expect(nearestCountry(-8, 179).name).toBe('Tuvalu');
            expect(nearestCountry(3.2, 73).name).toBe('Maldives');
        });

        it('measures the antimeridian the short way round', () => {
            // Straddling ±180 is where a naive lon difference goes wrong: these
            // two points are ~180 km apart, not most of the way around the world
            const west = nearestCountry(-16.8, 179.9);
            const east = nearestCountry(-16.8, -179.9);
            expect(west.name).toBe('Fiji');
            expect(east.name).toBe('Fiji');
            expect(Math.abs(west.km - east.km)).toBeLessThan(200);
        });

        it('refuses coordinates that are not numbers', () => {
            expect(nearestCountry(NaN, 10)).toBeNull();
            expect(nearestCountry(10, undefined)).toBeNull();
        });
    });
});
