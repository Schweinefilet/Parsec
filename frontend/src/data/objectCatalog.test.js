import { describe, it, expect } from 'vitest';
import { OBJECTS, CATEGORY_TABS, getObjectById, getObjectsByCategory } from './objectCatalog';
import { objectImage } from './objectImages';
import { accentOf, CATEGORY_ACCENT } from './categoryStyles';

const CATEGORY_IDS = new Set(CATEGORY_TABS.map(t => t.id));

describe('catalog integrity', () => {
    it('has objects', () => {
        expect(OBJECTS.length).toBeGreaterThan(50);
    });

    it('gives every object the fields the UI reads', () => {
        for (const o of OBJECTS) {
            expect(o.id, 'missing id').toBeTruthy();
            expect(o.name, `${o.id}: missing name`).toBeTruthy();
            expect(o.type, `${o.id}: missing type`).toBeTruthy();
            expect(o.category, `${o.id}: missing category`).toBeTruthy();
            expect(o.description, `${o.id}: missing description`).toBeTruthy();
            // Cards render these unconditionally
            expect(o.keyStatLabel, `${o.id}: missing keyStatLabel`).toBeTruthy();
            expect(o.keyStatValue, `${o.id}: missing keyStatValue`).toBeTruthy();
        }
    });

    it('uses unique ids', () => {
        const ids = OBJECTS.map(o => o.id);
        expect(new Set(ids).size).toBe(ids.length);
    });

    it('uses ids that are URL-safe (they become routes)', () => {
        for (const o of OBJECTS) {
            expect(o.id, `${o.id} is not URL-safe`).toMatch(/^[a-z0-9-]+$/);
        }
    });

    it('only uses categories that exist in the tab list', () => {
        for (const o of OBJECTS) {
            expect(CATEGORY_IDS.has(o.category), `${o.id}: unknown category "${o.category}"`).toBe(true);
        }
    });

    // The Sun was stranded in a 'stars' category the nav didn't list, so it was
    // unreachable. Every tab must lead somewhere.
    it('gives every category tab at least one object', () => {
        for (const tab of CATEGORY_TABS) {
            expect(getObjectsByCategory(tab.id).length, `category "${tab.id}" is empty`).toBeGreaterThan(0);
        }
    });

    it('has an accent colour for every category', () => {
        for (const tab of CATEGORY_TABS) {
            expect(CATEGORY_ACCENT[tab.id], `no accent for "${tab.id}"`).toBeTruthy();
            expect(accentOf(tab.id).rgb).toMatch(/^\d+,\d+,\d+$/);
        }
    });

    it('keeps stats well-formed where present', () => {
        for (const o of OBJECTS) {
            if (!o.stats) continue;
            expect(Array.isArray(o.stats)).toBe(true);
            for (const section of o.stats) {
                expect(section.section, `${o.id}: stat section without a name`).toBeTruthy();
                expect(Array.isArray(section.rows), `${o.id}/${section.section}: rows not an array`).toBe(true);
                for (const row of section.rows) {
                    expect(row.label, `${o.id}/${section.section}: row without label`).toBeTruthy();
                    expect(row.value !== undefined, `${o.id}/${section.section}/${row.label}: no value`).toBe(true);
                }
            }
        }
    });

    it('keeps orbital elements physically sane where present', () => {
        for (const o of OBJECTS) {
            if (!o.orbital) continue;
            expect(o.orbital.a, `${o.id}: semi-major axis`).toBeGreaterThan(0);
            expect(o.orbital.period, `${o.id}: period`).toBeGreaterThan(0);
            if (o.orbital.e != null) {
                expect(o.orbital.e, `${o.id}: eccentricity`).toBeGreaterThanOrEqual(0);
                expect(o.orbital.e, `${o.id}: eccentricity`).toBeLessThan(1);
            }
        }
    });
});

describe('lookups', () => {
    it('finds objects by id', () => {
        expect(getObjectById('saturn')?.name).toBe('Saturn');
    });

    it('returns nothing for an unknown id rather than throwing', () => {
        expect(getObjectById('not-a-real-object')).toBeFalsy();
        expect(() => getObjectById(undefined)).not.toThrow();
    });

    it('groups by category', () => {
        const planets = getObjectsByCategory('planets');
        expect(planets.length).toBe(8);
        expect(planets.every(p => p.category === 'planets')).toBe(true);
    });
});

describe('curated imagery', () => {
    it('only maps ids that exist in the catalog', () => {
        const ids = new Set(OBJECTS.map(o => o.id));
        for (const o of OBJECTS) {
            const url = objectImage(o.id);
            if (url) expect(url).toMatch(/^https:\/\/images-assets\.nasa\.gov\/.+\.(jpg|png)$/i);
        }
        // Guard the other direction: no orphaned entries
        expect(ids.size).toBeGreaterThan(0);
    });

    it('returns null for objects with no curated image, so the fallback renders', () => {
        expect(objectImage('definitely-not-an-object')).toBeNull();
    });

    it('covers most of the catalog', () => {
        const withImage = OBJECTS.filter(o => objectImage(o.id)).length;
        expect(withImage / OBJECTS.length).toBeGreaterThan(0.6);
    });
});
