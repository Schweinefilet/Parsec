// Loading the night-sky data — the star field and the constellation lines
// built by scripts/build-sky-catalog.mjs.
//
// Same shape as utils/nearestCountry.js's loadLandPoints(): a module-level
// cache, `??=` to dedupe concurrent callers, and a dynamic import() so
// neither table (166 KB / 8 KB gzipped) ever reaches anyone who doesn't
// navigate to /sky. Both come from the same build so they're fetched
// together — a page that shows stars with no constellation lines yet
// (or vice versa) isn't a state worth having.

let cache = null;
let loading = null;

/**
 * One star: `[ra, dec, mag, hip, con, proper, bayer, flam, ci]`.
 * `ra`/`dec` are J2000 decimal degrees (already converted from the source
 * catalog's decimal-hour RA — see the build script). `hip`/`proper`/`bayer`/
 * `flam`/`ci` are nullable. Sorted brightest (lowest `mag`) first.
 * @typedef {[number, number, number, number|null, string|null, string|null, string|null, number|null, number|null]} StarRow
 */

/**
 * One constellation: `[iau, nameEn, nameNative, mainStrips, thinStrips]`.
 * A "strip" is a connected polyline: `[[ra, dec], [ra, dec], ...]`, already
 * resolved to coordinates (no HIP lookup needed at runtime). `thinStrips` are
 * Stellarium's fainter secondary connections — draw them dimmer, not hidden.
 * @typedef {[string, string, string|null, number[][][], number[][][]]} ConstellationRow
 */

/**
 * Fetches (once) and returns `{ stars: StarRow[], constellations:
 * ConstellationRow[] }`. Safe to call from anywhere; a second call while the
 * first is still in flight gets the same promise rather than fetching twice.
 */
export function loadSkyCatalog() {
    if (cache) return Promise.resolve(cache);
    loading ??= Promise.all([
        import('../data/stars.json'),
        import('../data/constellationLines.json'),
    ]).then(([starsMod, linesMod]) => {
        cache = { stars: starsMod.default, constellations: linesMod.default };
        return cache;
    });
    return loading;
}

/** Test/dev seam. */
export function __resetSkyCatalog() {
    cache = null;
    loading = null;
}
