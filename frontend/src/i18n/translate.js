// The translator itself — no React, so it can be tested and used from the
// modules that compute text outside a component (the sky calendar, the
// satellite tracker's formatters).
//
// No i18n library. What is needed here is key lookup, one interpolation form
// and CLDR plural categories; Intl.PluralRules is in every browser this site
// already requires, and the rest is the forty lines below. react-i18next is
// forty kilobytes to reach the same place, on a page that spends its budget on
// textures.

import { LOCALES, DEFAULT_LOCALE, localeByCode } from './locales';
import { en } from './locales/en';

// Loaded strings, by locale code. Everything but English arrives when its
// chunk does — see ./load.js. A translator built before its language has
// landed is not an error; it answers in English until it has.
//
// English is registered here rather than by the loader because it is the
// fallback behind every key, and the modules that translate outside React
// (the sky calendar) reach for a translator without going near the loader.
const registry = new Map();

export function registerLocale(code, strings) {
    registry.set(code, strings);
}

/** Whether this locale's words are here yet. */
export const localeLoaded = (code) => registry.has(code);

export const stringsFor = (code) => registry.get(code) ?? null;

registry.set(DEFAULT_LOCALE, en);

const english = () => registry.get(DEFAULT_LOCALE) ?? {};

/** Walk a dotted key into a nested object. Returns undefined, never throws. */
function lookup(tree, key) {
    let node = tree;
    for (const part of key.split('.')) {
        if (node == null || typeof node !== 'object') return undefined;
        node = node[part];
    }
    return node;
}

/**
 * Fill {name} placeholders.
 *
 * Values are substituted verbatim: this returns a string, and callers that
 * need markup inside a sentence pass the pieces as separate keys rather than
 * getting HTML back. Nothing here is ever fed to dangerouslySetInnerHTML, and
 * that is deliberate.
 */
function interpolate(text, vars) {
    if (!vars) return text;
    return text.replace(/\{(\w+)\}/g, (whole, name) =>
        Object.prototype.hasOwnProperty.call(vars, name) ? String(vars[name]) : whole);
}

const pluralRulesCache = new Map();
function pluralCategory(intl, n) {
    let rules = pluralRulesCache.get(intl);
    if (!rules) {
        rules = new Intl.PluralRules(intl);
        pluralRulesCache.set(intl, rules);
    }
    return rules.select(n);
}

/**
 * Pick the right form of a counted noun.
 *
 * Arabic has six categories and uses five of them in ordinary prose — one day,
 * two days, "3–10 days" in the plural genitive, "11–99 days" in the singular
 * accusative, and a sixth form for everything else including every decimal.
 * "87.97 days" therefore needs a different word from "5 days", which no amount
 * of appending an s will produce. Intl.PluralRules already knows all of this,
 * so a form table keyed by its categories is the whole implementation.
 *
 * A table may give only some categories; the fall-through order ends at
 * `other`, which every table must have.
 */
export function selectPlural(forms, n, intl) {
    if (typeof forms === 'string') return forms;
    const cat = pluralCategory(intl, Math.abs(n));
    return forms[cat]
        ?? (cat === 'zero' || cat === 'few' ? forms.many : undefined)
        ?? forms.other;
}

/**
 * Build a translator for one locale.
 *
 * Missing keys fall back to English rather than to the key, so a half-finished
 * translation reads as a mixed-language page instead of a page of dotted
 * identifiers. `t.missing` reports what fell through, which is what the parity
 * test asserts on.
 */
export function makeTranslator(code) {
    const locale = localeByCode(code);
    const strings = registry.get(locale.code) ?? {};
    const EN = english();

    const t = (key, vars) => {
        let value = lookup(strings, key);
        if (value === undefined) value = lookup(EN, key);
        if (value === undefined) return key;
        // A list is a leaf in its own right — the sixteen compass points are
        // one entry, not sixteen keys — and comes back as the array.
        if (Array.isArray(value)) return value;
        if (typeof value === 'object') {
            // A plural table: the caller passes the number as `count`.
            if (vars && typeof vars.count === 'number') {
                value = selectPlural(value, vars.count, locale.intl);
            } else {
                return key;
            }
        }
        return interpolate(String(value), vars);
    };

    t.locale = locale;
    t.code = locale.code;
    t.dir = locale.dir;
    t.intl = locale.intl;
    /** True when this locale actually has the key, ignoring the English fallback. */
    t.has = (key) => lookup(strings, key) !== undefined;
    return t;
}

/** Every dotted key in a strings tree, for the parity test. */
export function flatKeys(tree, prefix = '') {
    const out = [];
    for (const [k, v] of Object.entries(tree)) {
        const key = prefix ? `${prefix}.${k}` : k;
        // A plural table is a leaf: its keys are CLDR categories, and which of
        // those a language uses is a fact about the language, not a gap. So is
        // a list, whose indices are positions rather than names.
        const isPluralTable = v && typeof v === 'object' && !Array.isArray(v)
            && Object.keys(v).every(c =>
                ['zero', 'one', 'two', 'few', 'many', 'other'].includes(c));
        const isLeaf = !v || typeof v !== 'object' || Array.isArray(v) || isPluralTable;
        if (isLeaf) out.push(key);
        else out.push(...flatKeys(v, key));
    }
    return out;
}

/**
 * The locale to open in.
 *
 * A stored choice wins over the browser's, because it was made on this site
 * about this site. Otherwise the browser's ordered preference list is scanned
 * for anything whose base language is one we have — `ar-EG`, `ar-SA` and `ar`
 * all mean Arabic here, and matching on the base tag is what stops a reader
 * whose phone says `ar-MA` from getting English.
 */
export const STORAGE_KEY = 'p4rsec.locale';

export function detectLocale(stored, preferred = []) {
    if (stored && LOCALES.some(l => l.code === stored)) return stored;
    for (const tag of preferred) {
        const base = String(tag).toLowerCase().split('-')[0];
        const hit = LOCALES.find(l => l.code === base);
        if (hit) return hit.code;
    }
    return DEFAULT_LOCALE;
}

export function readStoredLocale() {
    try {
        return window.localStorage.getItem(STORAGE_KEY);
    } catch {
        // Safari in private browsing, and any browser set to block site data.
        return null;
    }
}

export function writeStoredLocale(code) {
    try {
        window.localStorage.setItem(STORAGE_KEY, code);
    } catch { /* a preference we cannot persist is still a preference */ }
}
