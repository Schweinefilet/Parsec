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
// Arabic-Indic, which is what this atlas now sets. The one exception is the
// catalog's Unicode superscript exponents (1.989 × 10³⁰ kg): those are a
// separate set of code points that a digit swap never touches, and
// ObjectStatsPanel renders them back as plain Western digits inside a <sup>
// on purpose, since Arabic-Indic has no superscript forms and scientific
// notation is conventionally Western in Arabic-language writing anyway.
// Changing this line is all it takes to revisit the decision.
//
// `script` is the writing system, which a few tests key off. Arabic script
// leaking a Latin word mid-sentence is a translation gap; Vietnamese *is*
// written in the Latin alphabet, so the same word may legitimately match its
// English source ("Io", "Titan", "Vesta"), and the checks that would flag that
// are skipped for `latn`.

export const DEFAULT_LOCALE = 'en';

export const LOCALES = [
    {
        code: 'en',
        endonym: 'English',
        english: 'English',
        dir: 'ltr',
        numerals: 'latn',
        script: 'latn',
        // Passed to Intl.*. Distinct from `code` so a future 'pt-BR' can key
        // its strings under one name and still format like Brazil.
        intl: 'en',
        // English is the fallback for every missing key, so it is the one
        // language that is always present rather than fetched.
        bundled: true,
    },
    {
        code: 'vi',
        endonym: 'Tiếng Việt',
        english: 'Vietnamese',
        dir: 'ltr',
        numerals: 'latn',
        script: 'latn',
        intl: 'vi',
        bundled: false,
    },
    {
        code: 'ar',
        endonym: 'العربية',
        english: 'Arabic',
        dir: 'rtl',
        numerals: 'arab',
        script: 'arab',
        intl: 'ar',
        bundled: false,
    },
];

export const localeByCode = (code) =>
    LOCALES.find(l => l.code === code) ?? LOCALES[0];

export const isLocale = (code) => LOCALES.some(l => l.code === code);
