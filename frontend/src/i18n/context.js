import { createContext, useContext } from 'react';
import { LOCALES, DEFAULT_LOCALE, localeByCode, isLocale } from './locales';
import { makeTranslator } from './translate';

// The context, the hooks and the shape they carry. Kept apart from the
// provider component so each file exports one kind of thing — see index.jsx.

export const I18nContext = createContext(null);

/**
 * The BCP-47 tag handed to Intl, carrying the numbering system.
 *
 * `ar` on its own formats with Arabic-Indic digits, which is right for prose
 * and wrong for this atlas — see the note in locales/index.js. The `-u-nu-`
 * extension is the standard way to say so, and it keeps the choice in the
 * locale table rather than scattered through the formatters.
 */
export function intlTag(locale) {
    return locale.numerals && locale.numerals !== 'latn'
        ? `${locale.intl}-u-nu-${locale.numerals}`
        : `${locale.intl}-u-nu-latn`;
}

export function useI18n() {
    const ctx = useContext(I18nContext);
    // Rendering a component outside the provider is a wiring mistake, not a
    // user-facing one — fall back to English so a test that mounts one piece
    // in isolation still renders something readable.
    return ctx ?? fallback();
}

/** The common case: just the words. */
export function useT() {
    return useI18n().t;
}

let fallbackValue = null;
function fallback() {
    if (!fallbackValue) {
        const locale = localeByCode(DEFAULT_LOCALE);
        const tag = intlTag(locale);
        fallbackValue = {
            t: makeTranslator(DEFAULT_LOCALE),
            locale: locale.code,
            dir: locale.dir,
            rtl: false,
            intl: tag,
            locales: LOCALES,
            setLocale: () => {},
            object: (o) => o,
            category: (tab) => tab,
            categoryBadge: (id) => id.replace(/-/g, ' '),
            bodyName: (n) => n,
            assetLabel: (n) => n,
            statLabel: (l) => l,
            sectionLabel: (s) => s,
            statValue: (v) => v,
            num: (n, opts) => new Intl.NumberFormat(tag, opts).format(n),
            date: (d, opts = { day: 'numeric', month: 'short', year: 'numeric' }) =>
                new Intl.DateTimeFormat(tag, opts).format(d),
            time: (d, opts = { hour: '2-digit', minute: '2-digit' }) =>
                new Intl.DateTimeFormat(tag, opts).format(d),
        };
    }
    return fallbackValue;
}

export { LOCALES, DEFAULT_LOCALE, isLocale };
