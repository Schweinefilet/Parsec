import { describe, it, expect, beforeAll } from 'vitest';
import constellationLines from '../data/constellationLines.json';
import { constellationName, catalogFor } from './localizeCatalog';
import { loadLocale } from './load';
import { LOCALES, DEFAULT_LOCALE } from './locales';

// The night sky's constellation labels are the other place (besides the
// tracker's "nearest country") a name arrives from a data file rather than
// a string table — so, like countries.test.js, this is what stands between
// a missing translation and Latin script mid-sentence on a page otherwise
// fully in Arabic or Vietnamese.

const codes = constellationLines.map(([iau]) => iau);
const nativeNameOf = Object.fromEntries(constellationLines.map(([iau, , native]) => [iau, native]));

beforeAll(async () => {
    await Promise.all(LOCALES.map(l => loadLocale(l.code)));
});

describe('the constellation table', () => {
    it('names all 88 IAU constellations, each once', () => {
        expect(codes.length).toBe(88);
        expect(new Set(codes).size).toBe(88);
    });
});

describe('constellation names', () => {
    for (const { code, script } of LOCALES.filter(l => l.code !== DEFAULT_LOCALE)) {
        it(`${code} translates every constellation`, () => {
            const table = catalogFor(code)?.constellations ?? {};
            const missing = codes.filter(c => !table[c]);
            expect(missing, `untranslated in ${code}`).toEqual([]);
        });

        it(`${code} has no constellation the data does not`, () => {
            // A stray key is a typo, or a code the data no longer uses —
            // either way it is translating nothing and hiding the mistake.
            const table = catalogFor(code)?.constellations ?? {};
            const extra = Object.keys(table).filter(c => !codes.includes(c));
            expect(extra).toEqual([]);
        });

        it(`${code} gives every constellation a distinct name`, () => {
            // Centaurus and Sagittarius, or Hydra and Hydrus, colliding onto
            // the same translated word would be a real, silent mistake — two
            // different figures in the sky reading as one.
            const table = catalogFor(code)?.constellations ?? {};
            const values = codes.map(c => table[c]).filter(Boolean);
            expect(new Set(values).size).toBe(values.length);
        });

        // Only meaningful for a non-Latin script. Vietnamese is written in
        // the Latin alphabet, so a Latin letter in a Vietnamese name is not
        // a translation gap.
        if (script !== 'latn') {
            it(`${code} leaves no Latin script in a translated name`, () => {
                const table = catalogFor(code)?.constellations ?? {};
                const latin = Object.entries(table)
                    .filter(([, v]) => /[A-Za-z]/.test(v))
                    .map(([k, v]) => `${k} → ${v}`);
                expect(latin).toEqual([]);
            });
        }
    }

    it('falls back to the Latin name in the source language', () => {
        expect(constellationName('Ori', 'Orion', 'en')).toBe('Orion');
    });

    it('passes an unknown code through to its fallback rather than blanking it', () => {
        expect(constellationName('Zzz', 'Nonesuch', 'ar')).toBe('Nonesuch');
    });

    it('translates a real constellation', () => {
        expect(constellationName('Ori', nativeNameOf.Ori, 'ar')).toBe('الجبّار');
        expect(constellationName('Ori', nativeNameOf.Ori, 'vi')).toBe('Lạp Hộ');
    });

    it('agrees with the catalog phrases already shipped for the same constellations', () => {
        // catalog/{ar,vi}.js's `phrases` dict already translates six of these
        // names as "which constellation is this object in" labels on
        // unrelated deep-sky catalog entries. The same constellation should
        // read the same way here.
        const shipped = {
            ar: { And: 'المرأة المسلسلة', Aqr: 'الدلو', CVn: 'الكلاب الصائدة', Ori: 'الجبّار', Tau: 'الثور', Ser: 'الحية' },
            vi: { And: 'Tiên Nữ', Aqr: 'Bảo Bình', CVn: 'Lạp Khuyển', Ori: 'Lạp Hộ', Tau: 'Kim Ngưu', Ser: 'Cự Xà' },
        };
        for (const [code, table] of Object.entries(shipped)) {
            for (const [iau, name] of Object.entries(table)) {
                expect(constellationName(iau, nativeNameOf[iau], code), `${code}/${iau}`).toBe(name);
            }
        }
    });
});
