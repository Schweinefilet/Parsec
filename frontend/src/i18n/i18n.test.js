import { describe, it, expect, beforeAll } from 'vitest';
import { LOCALES, DEFAULT_LOCALE, localeByCode } from './locales';
import {
    makeTranslator, flatKeys, selectPlural, detectLocale, stringsFor, localeLoaded,
} from './translate';
import { loadLocale } from './load';
import {
    translateValue, localizeObject, localizeCategory, bodyName, bodyNameExists,
    catalogFor, translatedCatalogs, OBJECTS, CATEGORY_TABS,
} from './localizeCatalog';
import { PLANETS, MOON_DATA, SMALL_BODIES, PROBES } from '../data/solarSystemBodies';

// A translation is only useful if it is complete, and "complete" is not a
// thing you can eyeball across 200 keys and 70 objects. These tests are what
// stands between a missing key and an English sentence appearing in the middle
// of an Arabic page.

// Every locale but English is a chunk, so the suite fetches the lot before it
// starts asserting on them. This is also the test that the loader works: a
// language that fails to arrive fails every coverage check below.
beforeAll(async () => {
    await Promise.all(LOCALES.map(l => loadLocale(l.code)));
});

const enStrings = () => stringsFor('en');

describe('locale table', () => {
    it('has English as the default and the source of every key', () => {
        expect(DEFAULT_LOCALE).toBe('en');
        expect(localeByCode(DEFAULT_LOCALE).dir).toBe('ltr');
        // English is the fallback behind every missing key, so it cannot be a
        // chunk that might not arrive.
        expect(localeByCode(DEFAULT_LOCALE).bundled).toBe(true);
    });

    it('loads every other language on demand', () => {
        for (const l of LOCALES.filter(x => x.code !== DEFAULT_LOCALE)) {
            expect(l.bundled, `${l.code} should be split out`).toBe(false);
            // beforeAll fetched them; if a loader were missing this is where
            // it would show, rather than as a page silently stuck in English.
            expect(localeLoaded(l.code), `${l.code} did not load`).toBe(true);
        }
    });

    it('gives every locale a direction, an endonym and a distinct code', () => {
        const codes = new Set();
        for (const l of LOCALES) {
            expect(['ltr', 'rtl'], `${l.code} direction`).toContain(l.dir);
            expect(l.endonym, `${l.code} endonym`).toBeTruthy();
            expect(codes.has(l.code), `${l.code} is listed twice`).toBe(false);
            codes.add(l.code);
        }
    });

    it('names each language in its own script, not only in English', () => {
        // The point of an endonym is that someone who cannot read the current
        // interface can still find their row.
        const ar = localeByCode('ar');
        expect(ar.endonym).toBe('العربية');
        expect(ar.endonym).not.toBe(ar.english);
    });
});

describe('string coverage', () => {
    const keys = () => flatKeys(enStrings());

    it('has a good number of keys to translate', () => {
        expect(keys().length).toBeGreaterThan(150);
    });

    for (const locale of LOCALES.filter(l => l.code !== DEFAULT_LOCALE)) {
        it(`${locale.code} translates every key`, () => {
            const t = makeTranslator(locale.code);
            const missing = keys().filter(k => !t.has(k));
            expect(missing, `untranslated in ${locale.code}`).toEqual([]);
        });

        it(`${locale.code} has no key English does not`, () => {
            // A stray key is a typo that will never be read, and it hides the
            // real key it was meant to be.
            const extra = flatKeys(stringsFor(locale.code)).filter(k => !keys().includes(k));
            expect(extra, `not present in English`).toEqual([]);
        });

        it(`${locale.code} keeps every placeholder its English string uses`, () => {
            const t = makeTranslator(locale.code);
            const bad = [];
            for (const key of keys()) {
                const src = key.split('.').reduce((n, p) => n?.[p], enStrings());
                const dst = key.split('.').reduce((n, p) => n?.[p], stringsFor(locale.code));
                if (typeof src !== 'string' || typeof dst !== 'string') continue;
                const want = [...src.matchAll(/\{(\w+)\}/g)].map(m => m[1]).sort();
                const got = [...dst.matchAll(/\{(\w+)\}/g)].map(m => m[1]).sort();
                if (want.join(',') !== got.join(',')) bad.push(`${key}: ${want} vs ${got}`);
            }
            expect(bad).toEqual([]);
            expect(t.code).toBe(locale.code);
        });
    }
});

describe('the translator', () => {
    it('interpolates named placeholders', () => {
        const t = makeTranslator('en');
        expect(t('tracker.about', { name: 'Hubble' })).toBe('About Hubble');
    });

    it('falls back to English rather than printing the key', () => {
        const t = makeTranslator('ar');
        // Every key is translated, so force the gap: a key nobody has.
        expect(t('nav.copyLink')).not.toBe('nav.copyLink');
        expect(t('no.such.key')).toBe('no.such.key');
    });

    it('leaves an unknown placeholder alone instead of writing undefined', () => {
        const t = makeTranslator('en');
        expect(t('tracker.about', {})).toBe('About {name}');
    });
});

describe('plural selection', () => {
    // The reason this module exists. English needs two forms and Arabic five,
    // and "87.97 days" is a different word from "5 days" in Arabic.
    // Read inside each test, not beside them: a describe body runs at
    // collection time, before beforeAll has fetched anything.
    const forms = () => catalogFor('ar').counted.day;

    it('picks the dual for two', () => {
        expect(selectPlural(forms(), 2, 'ar')).toBe('يومان');
    });

    it('picks the plural for three to ten', () => {
        expect(selectPlural(forms(), 5, 'ar')).toBe('أيام');
        expect(selectPlural(forms(), 10, 'ar')).toBe('أيام');
    });

    it('picks the singular accusative for eleven and up', () => {
        expect(selectPlural(forms(), 25, 'ar')).toBe('يومًا');
    });

    it('handles a decimal, which is where a naive rule breaks', () => {
        expect(selectPlural(forms(), 87.97, 'ar')).toBe('يوم');
    });

    it('collapses to one string when a locale needs no forms', () => {
        expect(selectPlural('days', 5, 'en')).toBe('days');
    });

    it('drives the interface strings too', () => {
        const t = makeTranslator('ar');
        expect(t('time.days', { count: 2 })).toBe('يومين');
        expect(t('time.days', { count: 5 })).toBe('5 أيام');
        expect(t('time.days', { count: 30 })).toBe('30 يومًا');
    });
});

describe('locale detection', () => {
    it('prefers a stored choice', () => {
        expect(detectLocale('ar', ['en-GB'])).toBe('ar');
    });

    it('matches the browser on the base tag, not the full one', () => {
        // ar-MA, ar-EG and ar all mean Arabic here.
        expect(detectLocale(null, ['ar-MA'])).toBe('ar');
        expect(detectLocale(null, ['fr-FR', 'ar-EG'])).toBe('ar');
    });

    it('falls back to English for a language we do not have', () => {
        expect(detectLocale(null, ['ja-JP'])).toBe('en');
        expect(detectLocale(null, [])).toBe('en');
        expect(detectLocale('zz', [])).toBe('en');
    });
});

describe('catalog coverage', () => {
    // Driven by the locale list, not by what happens to be registered: a
    // catalog that failed to load would otherwise make this whole block
    // silently produce zero tests, which is the worst possible way for a
    // coverage suite to pass.
    for (const { code, script } of LOCALES.filter(l => l.code !== DEFAULT_LOCALE)) {
        const cat = () => catalogFor(code);

        it(`${code} names every object`, () => {
            const missing = OBJECTS.filter(o => !cat().objects?.[o.id]?.name).map(o => o.id);
            expect(missing).toEqual([]);
        });

        it(`${code} describes every object`, () => {
            const missing = OBJECTS.filter(o => !cat().objects?.[o.id]?.description).map(o => o.id);
            expect(missing).toEqual([]);
        });

        it(`${code} translates every object type`, () => {
            const types = [...new Set(OBJECTS.map(o => o.type))];
            expect(types.filter(t => !cat().types?.[t])).toEqual([]);
        });

        it(`${code} has a catalog at all`, () => {
            expect(cat(), `${code} catalog did not load`).toBeTruthy();
            expect(translatedCatalogs()).toContain(code);
        });

        it(`${code} translates every stat label`, () => {
            const labels = new Set();
            for (const o of OBJECTS) {
                labels.add(o.keyStatLabel);
                labels.add(o.secondaryStatLabel);
                for (const s of o.stats ?? []) for (const r of s.rows) labels.add(r.label);
            }
            expect([...labels].filter(l => l && !cat().statLabels?.[l])).toEqual([]);
        });

        it(`${code} translates every stats section`, () => {
            const sections = new Set();
            for (const o of OBJECTS) for (const s of o.stats ?? []) sections.add(s.section);
            expect([...sections].filter(s => !cat().sections?.[s])).toEqual([]);
        });

        it(`${code} translates every category tab`, () => {
            expect(CATEGORY_TABS.filter(t => !cat().categories?.[t.id])).toEqual([]);
        });

        it(`${code} has a name for every body the 3D scene labels`, () => {
            // The scene labels by English display name, and two of its tables
            // disagree with the catalog on purpose ("Moon" vs "Luna"). A body
            // whose name falls through here shows up in Latin script mid-scene
            // — which is a bug in Arabic and simply correct in Vietnamese,
            // where "Io" and "Titan" are the names. For a Latin-script locale
            // the check is only that an entry exists at all.
            const scene = [...PLANETS, ...MOON_DATA, ...SMALL_BODIES, ...PROBES];
            const untranslated = scene
                .map(b => b.name)
                .filter(n => script === 'latn'
                    ? !bodyNameExists(n, code)
                    : bodyName(n, code) === n);
            expect(untranslated).toEqual([]);
        });
    }
});

describe('stat values', () => {
    it('agrees with the number in front of it', () => {
        expect(translateValue('87.97 days', 'ar')).toBe('87.97 يوم');
        expect(translateValue('5 days', 'ar')).toBe('5 أيام');
        expect(translateValue('27.32 days (synchronous)', 'ar')).toContain('متزامن');
    });

    it('reorders a date to day-first', () => {
        expect(translateValue('April 13, 2029', 'ar')).toBe('13 أبريل 2029');
        expect(translateValue('October 4, 1957', 'ar')).toBe('4 أكتوبر 1957');
    });

    it('matches the longest phrase first', () => {
        // "S-Type" before "Type", or an asteroid's class comes out mangled.
        expect(translateValue('S-Type (stony)', 'ar')).toBe('من النوع S (صخري)');
        expect(translateValue('Radial Velocity', 'ar')).toBe('السرعة الشعاعية');
    });

    it('keeps designations, numbers and superscripts intact', () => {
        expect(translateValue('1.989 × 10³⁰ kg', 'ar')).toBe('1.989 × 10³⁰ كغ');
        expect(translateValue('M31 / NGC 224', 'ar')).toBe('M31 / NGC 224');
        expect(translateValue('G2V', 'ar')).toBe('G2V');
    });

    it('leaves values alone in the source language', () => {
        expect(translateValue('87.97 days', 'en')).toBe('87.97 days');
    });

    it('leaves no untranslated English prose anywhere in the catalog', () => {
        // Catalogue designations are meant to survive in Latin: an Arabic
        // reader looking up TRAPPIST-1 or NGC 5195 will type it exactly as it
        // is written, and rendering an identifier in Arabic script destroys
        // the only thing it is for. Everything that is not one of those is
        // prose, and prose that survives this sweep is a gap in the
        // vocabulary — which is what this test is for. It is the check that
        // catches the value nobody thought about.
        const DESIGNATIONS = /\b(MEarth|TRAPPIST|Lagrange|SAbc)\b/g;
        const seen = new Set();
        const leftovers = [];
        for (const o of OBJECTS) {
            for (const s of o.stats ?? []) for (const r of s.rows) {
                if (seen.has(r.value)) continue;
                seen.add(r.value);
                const out = translateValue(r.value, 'ar');
                const prose = out
                    .replace(DESIGNATIONS, '')
                    // Anything with a digit stuck to letters is a catalogue
                    // number or a spectral class: NGC 224, PSR B0531+21, G2V.
                    .replace(/\b[A-Za-z]+[-–\s]?\d[\w+.-]*/g, '')
                    .replace(/\bS\/\d+/g, '')
                    // Bare acronyms: NASA, DART, RTG, PHA.
                    .replace(/\b[A-Z]{1,6}\b/g, '');
                if (/[A-Za-z]{3,}/.test(prose)) leftovers.push(`${r.value}  →  ${out}`);
            }
        }
        expect(leftovers).toEqual([]);
    });
});

describe('localizeObject', () => {
    const earth = OBJECTS.find(o => o.id === 'earth');

    it('translates the words and leaves the data alone', () => {
        const ar = localizeObject(earth, 'ar');
        expect(ar.name).toBe('الأرض');
        expect(ar.id).toBe('earth');
        expect(ar.category).toBe('planets');
        expect(ar.orbital).toEqual(earth.orbital);
    });

    it('keeps the English section key and adds a label beside it', () => {
        // The tabs, the compare page's row matching and the tests all identify
        // a section by its English name; only the drawn label changes.
        const ar = localizeObject(earth, 'ar');
        const physical = ar.stats.find(s => s.section === 'Physical');
        expect(physical).toBeTruthy();
        expect(physical.sectionLabel).toBe('الخصائص الفيزيائية');
        expect(physical.rows[0].label).toBe(earth.stats[0].rows[0].label);
        expect(physical.rows[0].labelText).not.toBe(physical.rows[0].label);
    });

    it('is a no-op for the source language', () => {
        expect(localizeObject(earth, 'en')).toBe(earth);
    });

    it('returns the same object for the same input, so the grid does not rebuild', () => {
        expect(localizeObject(earth, 'ar')).toBe(localizeObject(earth, 'ar'));
    });
});

describe('categories and body names', () => {
    it('translates a category tab in place', () => {
        const tab = CATEGORY_TABS.find(t => t.id === 'planets');
        const ar = localizeCategory(tab, 'ar');
        expect(ar.id).toBe('planets');
        expect(ar.label).toBe('الكواكب');
    });

    it('maps the scene names the catalog spells differently', () => {
        expect(bodyName('Moon', 'ar')).toBe('القمر');
        expect(bodyName('ISS', 'ar')).toBe('المحطة الدولية');
    });

    it('passes an unknown name through untouched', () => {
        expect(bodyName('Betelgeuse', 'ar')).toBe('Betelgeuse');
    });
});

describe('lists', () => {
    it('returns a list whole rather than as a key', () => {
        // The sixteen compass points are one entry. Treating the array as a
        // branch would make "sky.compass.0" a key nobody writes, and treating
        // it as a plural table would return the key string — which the sky
        // page would then index into, one character at a time.
        const en = makeTranslator('en');
        const ar = makeTranslator('ar');
        expect(Array.isArray(en('sky.compass'))).toBe(true);
        expect(en('sky.compass')).toHaveLength(16);
        expect(ar('sky.compass')).toHaveLength(16);
        expect(ar('sky.compass')[0]).toBe('شمال');
        expect(ar('sky.compass')[4]).toBe('شرق');
    });

    it('gives every locale the same number of points', () => {
        const lengths = LOCALES.map(l => makeTranslator(l.code)('sky.compass').length);
        expect(new Set(lengths).size).toBe(1);
    });
});

describe('signed numbers in a right-to-left page', () => {
    // The bidi algorithm calls a minus sign neutral, so in Arabic text it
    // resolves to the right of the digits and "−180" is drawn as "180−".
    // Nothing about the translation is wrong when this happens, which is what
    // makes it easy to ship.
    const LRI = '⁦', PDI = '⁩';

    it('wraps a leading sign with the digits it belongs to', () => {
        expect(translateValue('−180 to 430 °C', 'ar'))
            .toBe(`${LRI}−180${PDI} إلى 430 °م`);
    });

    it('wraps both ends of a negative range', () => {
        const out = translateValue('−143 to −173 °C', 'ar');
        expect(out).toBe(`${LRI}−143${PDI} إلى ${LRI}−173${PDI} °م`);
    });

    it('leaves unsigned numbers alone, which already read correctly', () => {
        expect(translateValue('465 °C (avg)', 'ar')).toBe('465 °م (متوسط)');
        expect(translateValue('1.989 × 10³⁰ kg', 'ar')).not.toContain(LRI);
    });

    it('does nothing in a left-to-right language', () => {
        expect(translateValue('−180 to 430 °C', 'en')).toBe('−180 to 430 °C');
    });

    it('uses the Arabic degree symbol', () => {
        expect(translateValue('465 °C (avg)', 'ar')).toContain('°م');
        expect(translateValue('465 °C (avg)', 'ar')).not.toContain('°C');
    });
});
