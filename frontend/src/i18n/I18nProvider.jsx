import { useMemo, useState, useEffect, useCallback } from 'react';
import { LOCALES, localeByCode, isLocale } from './locales';
import {
    makeTranslator, detectLocale, readStoredLocale, writeStoredLocale,
    localeLoaded, STORAGE_KEY,
} from './translate';
import { I18nContext, intlTag } from './context';
import { loadLocale } from './load';
import {
    localizeObject, localizeCategory, categoryBadge, bodyName,
    assetLabel, statLabel, sectionLabel, translateValue, countryName,
} from './localizeCatalog';

// Language, direction and the formatters that depend on both.
//
// One context for the lot, because they always change together: a locale that
// switched the words without switching `dir` would set Arabic left-to-right,
// and one that switched `dir` without switching the date formatter would put a
// Gregorian English month inside an Arabic sentence.

/** `?lang=ar` — so a link can carry the language, which a stored key cannot. */
function localeFromSearch(search) {
    try {
        const q = new URLSearchParams(search).get('lang');
        return q && isLocale(q) ? q : null;
    } catch {
        return null;
    }
}

function initialLocale() {
    if (typeof window === 'undefined') return 'en';
    return localeFromSearch(window.location.search)
        ?? detectLocale(readStoredLocale(), navigator.languages ?? [navigator.language]);
}

export function I18nProvider({ children, locale: forced }) {
    const wanted = forced ?? initialLocale();
    // Nothing is drawn until the chosen language is in hand. The alternative
    // is a page that renders in English and then repaints in Arabic a moment
    // later, right side to left side — which is worse than the blank frame it
    // replaces, and the blank frame is one an Arabic reader sees at most once
    // per visit. English is bundled, so this resolves synchronously for the
    // common case and there is no wait at all.
    const [ready, setReady] = useState(() => localeLoaded(wanted));
    const [code, setCode] = useState(wanted);
    const active = forced ?? code;
    const locale = localeByCode(active);

    useEffect(() => {
        if (localeLoaded(active)) { setReady(true); return undefined; }
        let live = true;
        setReady(false);
        loadLocale(active).then(() => { if (live) setReady(true); });
        return () => { live = false; };
    }, [active]);

    const setLocale = useCallback((next) => {
        if (!isLocale(next)) return;
        writeStoredLocale(next);
        // Fetched before the switch, so the interface changes language once
        // rather than twice.
        loadLocale(next).then(() => setCode(next));
    }, []);

    // The two attributes that make the rest of the page behave: `dir` drives
    // every logical CSS property in the stylesheet and the bidi algorithm in
    // every run of mixed text, and `lang` drives hyphenation, quotation marks
    // and what a screen reader sounds like.
    useEffect(() => {
        const root = document.documentElement;
        root.setAttribute('lang', locale.code);
        root.setAttribute('dir', locale.dir);

        // index.html carries the English description for crawlers, which see the
        // document before any of this runs. Once a reader has chosen a language,
        // anything that reads the description should follow them. The tab title
        // is route-specific and belongs to AppShell (utils/documentHead), which
        // re-composes it in the new language when `t` changes here.
        const t = makeTranslator(localeLoaded(locale.code) ? locale.code : 'en');
        const meta = document.querySelector('meta[name="description"]');
        if (meta) meta.setAttribute('content', t('app.description'));
    }, [locale, ready]);

    // Another tab changing the language should not leave this one behind.
    useEffect(() => {
        const onStorage = (e) => {
            if (e.key === STORAGE_KEY && e.newValue && isLocale(e.newValue)) setCode(e.newValue);
        };
        window.addEventListener('storage', onStorage);
        return () => window.removeEventListener('storage', onStorage);
    }, []);

    const value = useMemo(() => {
        const t = makeTranslator(ready ? locale.code : 'en');
        const nf = new Intl.NumberFormat(intlTag(locale));
        return {
            t,
            locale: locale.code,
            dir: locale.dir,
            rtl: locale.dir === 'rtl',
            intl: intlTag(locale),
            locales: LOCALES,
            setLocale,

            // ── The catalog ──
            object: (o) => localizeObject(o, t.code),
            category: (tab) => localizeCategory(tab, t.code),
            categoryBadge: (id) => categoryBadge(id, t.code),
            bodyName: (name) => bodyName(name, t.code),
            countryName: (name) => countryName(name, t.code),
            assetLabel: (name) => assetLabel(name, t.code),
            statLabel: (label) => statLabel(label, t.code),
            sectionLabel: (section) => sectionLabel(section, t.code),
            statValue: (v) => translateValue(v, t.code),

            // ── Numbers, dates, times ──
            num: (n, opts) => (opts
                ? new Intl.NumberFormat(intlTag(locale), opts).format(n)
                : nf.format(n)),
            date: (d, opts = { day: 'numeric', month: 'short', year: 'numeric' }) =>
                new Intl.DateTimeFormat(intlTag(locale), opts).format(d),
            time: (d, opts = { hour: '2-digit', minute: '2-digit' }) =>
                new Intl.DateTimeFormat(intlTag(locale), opts).format(d),
        };
    }, [locale, setLocale, ready]);

    return (
        <I18nContext.Provider value={value}>
            {ready ? children : null}
        </I18nContext.Provider>
    );
}
