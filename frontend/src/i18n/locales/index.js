// The languages the atlas speaks, and how each one wants to be laid out.
//
// This file holds only what has to be known before a language is chosen: its
// name, its direction, its digits. The words themselves are a separate chunk —
// Arabic alone is 28 KB gzipped, and an English reader should not download it
// to be told it exists. See ../load.js.
//
// `endonym` is the name of the language in that language: a reader who cannot
// read the current interface can still find their own row. Nobody looking for
// Arabic scans a list for the word "Arabic".
//
// `numerals` is a real editorial choice rather than an oversight. Arabic has
// two digit sets in live use — Arabic-Indic (٠١٢٣) across the Mashriq and the
// Gulf, Western (0123) across the Maghreb — and CLDR's default for `ar` is
// Arabic-Indic. This atlas sets Western anyway, for two reasons that are
// specific to what is on the screen: the catalog's values carry Unicode
// superscripts (1.989 × 10³⁰ kg) that have no Arabic-Indic equivalent, so a
// switch would render half of every mass in one digit set and half in the
// other; and Arabic-language scientific and astronomical writing overwhelmingly
// sets figures in Western digits. Changing this line is all it takes to revisit
// the decision.

export const DEFAULT_LOCALE = 'en';

export const LOCALES = [
    {
        code: 'en',
        endonym: 'English',
        english: 'English',
        dir: 'ltr',
        numerals: 'latn',
        // Passed to Intl.*. Distinct from `code` so a future 'pt-BR' can key
        // its strings under one name and still format like Brazil.
        intl: 'en',
        // English is the fallback for every missing key, so it is the one
        // language that is always present rather than fetched.
        bundled: true,
    },
    {
        code: 'ar',
        endonym: 'العربية',
        english: 'Arabic',
        dir: 'rtl',
        numerals: 'latn',
        intl: 'ar',
        bundled: false,
    },
];

export const localeByCode = (code) =>
    LOCALES.find(l => l.code === code) ?? LOCALES[0];

export const isLocale = (code) => LOCALES.some(l => l.code === code);
