// Fetching a language.
//
// Each locale is one dynamic import, so Vite emits it as its own chunk and a
// reader who never switches never downloads it. Arabic is 28 KB gzipped of
// strings and catalog; that is thirteen per cent of the main bundle for a
// language most visitors will not read, and it would be thirteen per cent
// again for every language added after it.
//
// English is the exception and is bundled — it is the fallback behind every
// missing key — and it registers itself in ./translate.js, where anything that
// needs a translator can reach it without going through this file.

import { registerCatalog } from './localizeCatalog';
import { registerLocale } from './translate';
import { isLocale } from './locales';

// One import() per locale, written out rather than built from a template
// string: a bundler can only split what it can see statically, and
// `import('./locales/' + code)` would either fail or drag every locale into
// one chunk.
const LOADERS = {
    ar: () => Promise.all([
        import('./locales/ar'),
        import('./catalog/ar'),
    ]).then(([strings, catalog]) => {
        registerLocale('ar', strings.ar);
        registerCatalog('ar', catalog.ar);
    }),
};

const inFlight = new Map();

/**
 * Make a locale usable, and resolve when it is.
 *
 * Idempotent and safe to call from anywhere: a second call for a language
 * already loading returns the same promise rather than fetching it twice. A
 * failed fetch resolves rather than rejects — a language that will not
 * download is a page in English, not a broken page — and it is not cached, so
 * a later attempt can succeed once the network comes back.
 */
export function loadLocale(code) {
    if (!isLocale(code) || code === 'en' || !LOADERS[code]) return Promise.resolve();
    if (!inFlight.has(code)) {
        inFlight.set(code, LOADERS[code]().catch((err) => {
            console.warn(`[P4RSEC] could not load the ${code} translation:`, err);
            inFlight.delete(code);
        }));
    }
    return inFlight.get(code);
}
