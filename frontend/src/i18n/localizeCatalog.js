// Translating the catalog, which is a different problem from translating the
// interface.
//
// The interface is 200 strings written to be translated. The catalog is 70
// objects carrying a name, a type, a paragraph, and something like 800 stat
// values — and the values are the awkward part, because they are not sentences.
// "2,439.7 km", "−180 to 430 °C", "~25 days (equator)", "Herschel, 1781". Very
// nearly all of that is a number, a unit and a qualifier, drawn from a
// vocabulary of a few dozen words that recur across every object.
//
// So values are rewritten rather than listed. A locale supplies the vocabulary
// — units, qualifiers, the handful of proper nouns worth transliterating — and
// an `exact` table for the ones that are genuinely prose. Listing all 741
// values instead would be 741 lines that go stale the moment somebody corrects
// a radius, and the correction would silently keep the old figure in every
// language but English.
//
// Counted nouns go through Intl.PluralRules (see translate.js): "87.97 days"
// and "5 days" are different words in Arabic, and appending an s is an
// English-shaped assumption baked into the string.

import { selectPlural } from './translate';
import { OBJECTS, CATEGORY_TABS } from '../data/objectCatalog';

const compiled = new Map();
const objectCache = new Map();   // `${code}:${id}` → localized object

// Catalog translations, by locale code, registered when their chunk lands —
// see ../load.js. English is the source and needs none, so it is never here;
// every function below treats a missing catalog as "leave it alone", which is
// also exactly the right behaviour while a translation is still downloading.
const CATALOGS = {};

export function registerCatalog(code, data) {
    CATALOGS[code] = data;
    // The phrase rules are compiled from the table, so a table arriving after
    // something has already asked for its rules has to clear that answer.
    compiled.delete(code);
    objectCache.clear();
}

// English display name → catalog id. The 3D scene labels bodies by name (its
// tables predate the catalog and a consistency test keeps the two in step), so
// this is how a label finds its translation.
// The value carries which field matched, because the scene calls the station
// "ISS" and the catalog calls it "International Space Station" — a label that
// asked for the short one should not come back with the long one.
const NAME_TO_ID = new Map();
for (const o of OBJECTS) {
    NAME_TO_ID.set(o.name, { id: o.id, short: false });
    if (o.shortName) NAME_TO_ID.set(o.shortName, { id: o.id, short: true });
}

// The spelled-out units that follow a number in the catalog and therefore have
// to agree with it. Abbreviations (km, kg, m/s²) do not inflect in any language
// this site is likely to reach, so they go through the phrase table instead.
const COUNTED = /(\d[\d,]*(?:\.\d+)?)(\s*)(light[- ]years?|days?|years?|hours?|minutes?|months?|weeks?)\b/gi;

// "April 13, 2029" → "13 April 2029". English is the outlier here: most of the
// world writes the day first, and a phrase table cannot fix word order because
// it only ever sees one word. Applied before the phrase sweep, so the month is
// still in English and recognisable when this runs.
const MONTHS = 'Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sept|Sep|Oct|Nov|Dec';
const DMY = new RegExp(
    String.raw`\b(${MONTHS})([a-z]*)\.?\s+(\d{1,2}),\s*(\d{4})\b`, 'g');

/**
 * Compile a locale's phrase table into replacement rules.
 *
 * Longest first, and this matters: "S-Type" has to be matched before "Type",
 * or an asteroid's classification comes out as "S-" followed by the Arabic for
 * a kind of thing. Word boundaries alone do not save you here, because the
 * hyphen is one.
 */
function compilePhrases(phrases) {
    return Object.entries(phrases)
        .sort((a, b) => b[0].length - a[0].length)
        .map(([from, to]) => {
            const esc = from.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
            // \b is defined on word characters, so it does nothing useful next
            // to "°C" or "m/s²". Anchor on a letter or digit when there is one
            // at that end, and on nothing when there is not.
            const left = /^[\w]/.test(from) ? String.raw`\b` : '';
            const right = /[\w]$/.test(from) ? String.raw`\b` : '';
            return [new RegExp(left + esc + right, 'g'), to];
        });
}

function rulesFor(code) {
    if (!compiled.has(code)) {
        const cat = CATALOGS[code];
        compiled.set(code, cat ? compilePhrases(cat.phrases ?? {}) : []);
    }
    return compiled.get(code);
}

/**
 * One stat value, translated.
 *
 * Order is deliberate: an exact override wins outright, then counted nouns are
 * resolved against the number in front of them, then the phrase table sweeps
 * the rest. Arabic output contains no ASCII letters, so a replacement can
 * never be matched again by a later rule.
 */
export function translateValue(raw, code) {
    const cat = CATALOGS[code];
    if (!cat || typeof raw !== 'string') return raw;
    if (cat.exact && Object.prototype.hasOwnProperty.call(cat.exact, raw)) {
        return cat.exact[raw];
    }

    let out = raw;
    if (cat.dayFirstDates) out = out.replace(DMY, (whole, mon, rest, day, year) =>
        `${day} ${mon}${rest} ${year}`);

    const counted = cat.counted ?? {};
    out = out.replace(COUNTED, (whole, num, gap, word) => {
        const key = word.toLowerCase().replace(/\s/g, '-').replace(/s$/, '');
        const forms = counted[key] ?? counted[word.toLowerCase()];
        if (!forms) return whole;
        const n = parseFloat(String(num).replace(/,/g, ''));
        const unit = selectPlural(forms, Number.isFinite(n) ? n : 1, cat.intl ?? code);
        return `${num}${gap || ' '}${unit}`;
    });

    for (const [re, to] of rulesFor(code)) out = out.replace(re, to);
    return cat.rtl ? isolateSigned(out) : out;
}

// A signed number, wrapped so the sign stays in front of it.
//
// "−180 to 430 °C" renders as "108− …" in a right-to-left paragraph, and it is
// not a bug in the font or the translation. The Unicode bidi algorithm gives
// the minus sign a neutral class, so in right-to-left text it resolves to the
// right of the digits it belongs to — which turns a temperature below freezing
// into something that looks like a footnote marker. Unsigned numbers are
// unaffected, which is why this touches only the signed ones rather than
// wrapping every figure on the page.
//
// U+2066 LEFT-TO-RIGHT ISOLATE and U+2069 POP DIRECTIONAL ISOLATE are the
// characters the standard provides for exactly this. They are invisible, they
// survive being copied, and they need no markup — which matters, because these
// strings are also read by the compare page, the card, and the 3D overlay,
// none of which control how the other two wrap them.
const SIGNED_NUMBER = /[−+-]\d[\d,.]*/g;
export const isolateSigned = (text) =>
    text.replace(SIGNED_NUMBER, (m) => `\u2066${m}\u2069`);

/**
 * One catalog object with every human-readable field in the target language.
 *
 * The id, the category, the orbital elements and every number are untouched:
 * translating a catalog should not be able to move a planet. Cached because
 * the grid renders seventy of these and the stats are a nested rebuild.
 */
export function localizeObject(object, code) {
    const cat = CATALOGS[code];
    if (!cat || !object) return object;
    // Idempotent. Components take an object from the catalog and hand it down,
    // and any of them may localize; translating an already-translated object
    // would look for Arabic in a table keyed by English and quietly lose the
    // fields that have no fallback.
    if (object.localizedTo === code) return object;

    const cacheKey = `${code}:${object.id}`;
    const hit = objectCache.get(cacheKey);
    if (hit && hit.source === object) return hit.value;

    const entry = cat.objects?.[object.id] ?? {};
    const value = {
        ...object,
        localizedTo: code,
        name: entry.name ?? object.name,
        shortName: entry.shortName ?? (object.shortName ? object.shortName : undefined),
        type: cat.types?.[object.type] ?? object.type,
        description: entry.description ?? object.description,
        keyStatLabel: cat.statLabels?.[object.keyStatLabel] ?? object.keyStatLabel,
        keyStatValue: translateValue(object.keyStatValue, code),
        secondaryStatLabel: cat.statLabels?.[object.secondaryStatLabel] ?? object.secondaryStatLabel,
        secondaryStatValue: translateValue(object.secondaryStatValue, code),
        operator: object.operator ? translateValue(object.operator, code) : object.operator,
        altitude: object.altitude ? translateValue(object.altitude, code) : object.altitude,
        stats: (object.stats ?? []).map(section => ({
            ...section,
            // `section` stays the English key: it is what the tab state, the
            // compare page's row matching and every test identify a section by.
            // `sectionLabel` is what gets drawn.
            sectionLabel: cat.sections?.[section.section] ?? section.section,
            rows: section.rows.map(row => ({
                ...row,
                labelText: cat.statLabels?.[row.label] ?? row.label,
                valueText: translateValue(row.value, code),
            })),
        })),
    };
    if (value.shortName === undefined) delete value.shortName;

    objectCache.set(cacheKey, { source: object, value });
    return value;
}

/** The category tabs, translated. Same shape, so CATEGORY_TABS stays the source. */
export function localizeCategory(tab, code) {
    const cat = CATALOGS[code];
    const entry = cat?.categories?.[tab.id];
    if (!entry) return tab;
    return { ...tab, label: entry.label ?? tab.label, description: entry.description ?? tab.description };
}

/** A category id as a short badge — what the cards and search results print. */
export function categoryBadge(id, code) {
    const cat = CATALOGS[code];
    return cat?.categories?.[id]?.badge
        ?? cat?.categories?.[id]?.label
        ?? id.replace(/-/g, ' ');
}

/**
 * A body's display name, given the English one.
 *
 * The 3D scene's labels come through here. It knows names, not ids — see
 * data/solarSystemBodies.js, whose tables the scene is built from.
 */
export function bodyName(englishName, code) {
    const cat = CATALOGS[code];
    if (!cat) return englishName;
    if (cat.bodies?.[englishName]) return cat.bodies[englishName];
    const hit = NAME_TO_ID.get(englishName);
    if (!hit) return englishName;
    const entry = cat.objects?.[hit.id];
    if (!entry) return englishName;
    return (hit.short && entry.shortName) || entry.name || englishName;
}

/**
 * Whether the catalog actually carries a name for a scene body.
 *
 * `bodyName` returning the English string is the only signal a script like
 * Arabic needs — a Latin word mid-scene is the bug. Vietnamese is written in
 * the Latin alphabet, so "Io" and "Titan" are the real Vietnamese names and
 * come back unchanged; there the question is only whether an entry exists at
 * all, which is what this answers. See i18n.test.js.
 */
export function bodyNameExists(englishName, code) {
    const cat = CATALOGS[code];
    if (!cat) return false;
    if (cat.bodies?.[englishName]) return true;
    const hit = NAME_TO_ID.get(englishName);
    if (!hit) return false;
    const entry = cat.objects?.[hit.id];
    if (!entry) return false;
    return Boolean((hit.short && entry.shortName) || entry.name);
}

/** A loading-screen asset name ("Saturn's rings"), translated where we have one. */
export function assetLabel(englishName, code) {
    const cat = CATALOGS[code];
    return cat?.assets?.[englishName] ?? englishName;
}

/**
 * A country's name, given the label the land table uses.
 *
 * That label is Natural Earth's short map form — "Dem. Rep. Congo" — which is
 * an English cartographic convention rather than a name. Other languages get
 * the ordinary name instead of an abbreviation of it.
 */
export function countryName(name, code) {
    return CATALOGS[code]?.countries?.[name] ?? name;
}

/**
 * A constellation's name, given its IAU three-letter code (the stable id
 * both the star catalog and Astronomy.Constellation() use) and the Latin
 * name to fall back to. Keyed by code rather than by name, unlike
 * countryName() above — a name is not a stable key across languages the way
 * "Ori" is, and English needs no table of its own: Latin *is* its name.
 */
export function constellationName(iau, fallback, code) {
    return CATALOGS[code]?.constellations?.[iau] ?? fallback;
}

/** Stat labels and section names on their own, for the compare page. */
export function statLabel(label, code) {
    return CATALOGS[code]?.statLabels?.[label] ?? label;
}
export function sectionLabel(section, code) {
    return CATALOGS[code]?.sections?.[section] ?? section;
}

/** Test seam: which locales claim a catalog translation. */
export const translatedCatalogs = () => Object.keys(CATALOGS);
export const catalogFor = (code) => CATALOGS[code] ?? null;
export { OBJECTS, CATEGORY_TABS };

