import { describe, it, expect, beforeAll } from 'vitest';
import landPoints from '../data/landPoints.json';
import { countryName, catalogFor } from './localizeCatalog';
import { loadLocale } from './load';
import { LOCALES, DEFAULT_LOCALE } from './locales';

// The tracker's "nearest country" tile is the one place a name arrives from a
// data file rather than from a string table, so it is the one place a language
// can be complete everywhere else and still print Latin script mid-sentence.

const tableNames = landPoints.map(([name]) => name);

beforeAll(async () => {
    await Promise.all(LOCALES.map(l => loadLocale(l.code)));
});

describe('the land table', () => {
    it('names every country exactly once', () => {
        expect(new Set(tableNames).size).toBe(tableNames.length);
    });

    it('is big enough to be the real list', () => {
        expect(tableNames.length).toBeGreaterThan(200);
    });
});

describe('country names', () => {
    for (const { code, script } of LOCALES.filter(l => l.code !== DEFAULT_LOCALE)) {
        it(`${code} translates every country in the table`, () => {
            const table = catalogFor(code)?.countries ?? {};
            const missing = tableNames.filter(n => !table[n]);
            expect(missing, `untranslated in ${code}`).toEqual([]);
        });

        it(`${code} has no country the table does not`, () => {
            // A stale entry is one that was renamed upstream and silently
            // stopped being used — worth failing on, because the name it was
            // covering is now falling through to English.
            const table = catalogFor(code)?.countries ?? {};
            const extra = Object.keys(table).filter(n => !tableNames.includes(n));
            expect(extra).toEqual([]);
        });

        // Only meaningful for a locale in a non-Latin script. Vietnamese is
        // written in the Latin alphabet, so a Latin letter in a Vietnamese
        // country name ("Bồ Đào Nha", "Brazil") is not a translation gap.
        if (script !== 'latn') {
            it(`${code} leaves no Latin script in a translated name`, () => {
                const table = catalogFor(code)?.countries ?? {};
                const latin = Object.entries(table)
                    .filter(([, v]) => /[A-Za-z]/.test(v))
                    .map(([k, v]) => `${k} → ${v}`);
                expect(latin).toEqual([]);
            });
        }
    }

    it('passes a name through untouched in the source language', () => {
        expect(countryName('United States', 'en')).toBe('United States');
    });

    it('passes an unknown name through rather than blanking it', () => {
        expect(countryName('Atlantis', 'ar')).toBe('Atlantis');
    });

    it('translates the abbreviations the map form uses', () => {
        // Natural Earth's labels are shortened for a map ("Dem. Rep. Congo"),
        // which is an English cartographic convention rather than a name.
        expect(countryName('Dem. Rep. Congo', 'ar')).toBe('جمهورية الكونغو الديمقراطية');
        expect(countryName('Bosnia and Herz.', 'ar')).toBe('البوسنة والهرسك');
        expect(countryName('United States', 'ar')).toBe('الولايات المتحدة');
    });
});
