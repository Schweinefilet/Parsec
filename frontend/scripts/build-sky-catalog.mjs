// Regenerates src/data/stars.json and src/data/constellationLines.json — the
// two tables behind the night-sky scene (/sky). Run with:
//
//   node scripts/build-sky-catalog.mjs
//
// Two sources, two licenses, both Creative Commons Attribution-ShareAlike —
// credit both wherever the scene shows a "data" line, and if either shipped
// table is ever redistributed on its own it needs to carry the same license.
//
//   Stars: the HYG database (Hipparcos + Yale Bright Star + Gliese), current
//   release, from https://codeberg.org/astronexus/hyg. CC BY-SA 4.0 — checked
//   directly against that repo's own LICENSE file, not a secondhand summary.
//   ~119,600 stars; filtered here to mag ≤ 6.5 — the same "dark-sky" ceiling
//   `visibilityFor()` (utils/skyPositions.js) already uses for the most
//   generous naked-eye claim this site makes elsewhere, rather than a new
//   number invented just for this scene. That's ~8,900 stars. (A first pass
//   at 6.0 — the number often quoted as "naked eye" — came out to only ~5,100:
//   that 6.0-vs-6.5 half-magnitude is worth roughly 3,800 stars, most of a
//   whole extra Bright-Star-Catalog's worth, so it isn't a rounding matter.)
//
//   Constellation lines: Stellarium's western sky culture, from
//   https://github.com/Stellarium/stellarium-skycultures (western/index.json).
//   Its own description.md says plainly: "Text and data: CC BY-SA;
//   Illustrations: Free Art License" — a GitHub Discussion elsewhere has the
//   original author casually granting one specific requester permission to
//   relicense the lines under MIT, but that is a one-off grant in a thread,
//   not a change to the repo's own stated license, so this treats the line
//   data as CC BY-SA like everything else in that file. Only the line
//   coordinates are used here — never the illustration artwork.
//
// The two datasets join on Hipparcos (HIP) catalog numbers, which both
// happen to use as their primary identifier. A constellation-defining star
// can sit just above the mag 6.0 display cutoff (Stellarium draws a few
// figures with fainter stars than "naked eye" strictly means), so every line
// endpoint is resolved against the *full, unfiltered* HYG table before
// filtering — the shipped line file carries baked-in [ra, dec] pairs, not
// HIP references, so nothing at runtime needs the full 9,000+ table just to
// draw a stick figure.
//
// HYG's `ra` column is decimal hours (0-24), not degrees — confirmed against
// this exact file by cross-checking its own `rarad` column (ra * π/12 matches
// rarad; ra * π/180 does not) and by spot-checking Sirius (HIP 32349) against
// its well-known RA of 6h45m09s / Dec -16°42'58": this file has
// ra=6.752481, dec=-16.716116, an exact match. Converted to decimal degrees
// (× 15) here so the shipped table and the renderer never have to remember
// which unit which field is in.

import { writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { gunzipSync } from 'node:zlib';

const HYG_URL = 'https://codeberg.org/astronexus/hyg/media/branch/main/data/hyg/CURRENT/hyg_v44.csv.gz';
const LINES_URL = 'https://raw.githubusercontent.com/Stellarium/stellarium-skycultures/master/western/index.json';
const MAG_LIMIT = 6.5;

const here = dirname(fileURLToPath(import.meta.url));
const STARS_OUT = resolve(here, '../src/data/stars.json');
const LINES_OUT = resolve(here, '../src/data/constellationLines.json');

/**
 * Minimal quoted-field-aware CSV split. HYG's own fields never carry escaped
 * quotes, so this doesn't need to handle `""` — just commas inside a quoted
 * field (spectral types like `"K3V:"`, empty fields as `""`).
 */
function splitCsvLine(line) {
    const out = [];
    let field = '';
    let quoted = false;
    for (let i = 0; i < line.length; i++) {
        const c = line[i];
        if (c === '"') { quoted = !quoted; continue; }
        if (c === ',' && !quoted) { out.push(field); field = ''; continue; }
        field += c;
    }
    out.push(field);
    return out;
}

console.log(`Fetching ${HYG_URL} …`);
const hygRes = await fetch(HYG_URL);
if (!hygRes.ok) throw new Error(`${HYG_URL} → HTTP ${hygRes.status}`);
const hygCsv = gunzipSync(Buffer.from(await hygRes.arrayBuffer())).toString('utf8');

const hygLines = hygCsv.split('\n').filter(Boolean);
const header = splitCsvLine(hygLines[0]);
const col = Object.fromEntries(header.map((name, i) => [name, i]));
const need = ['id', 'hip', 'proper', 'ra', 'dec', 'mag', 'ci', 'bayer', 'flam', 'con'];
for (const name of need) if (!(name in col)) throw new Error(`HYG CSV is missing a "${name}" column`);

/** Every star, keyed by HIP — used only to resolve constellation-line endpoints. */
const byHip = new Map();
/** The mag ≤ MAG_LIMIT display table. */
const bright = [];

for (const line of hygLines.slice(1)) {
    const f = splitCsvLine(line);
    const id = Number(f[col.id]);
    if (id === 0) continue;   // row 0 is the Sun — not a night-sky star
    const hip = f[col.hip] ? Number(f[col.hip]) : null;
    const raDeg = Number(f[col.ra]) * 15;
    const dec = Number(f[col.dec]);
    const mag = Number(f[col.mag]);
    if (!Number.isFinite(raDeg) || !Number.isFinite(dec) || !Number.isFinite(mag)) continue;

    if (hip != null) byHip.set(hip, { ra: raDeg, dec });

    if (mag <= MAG_LIMIT) {
        bright.push({
            ra: raDeg,
            dec,
            mag,
            hip,
            con: f[col.con] || null,
            proper: f[col.proper] || null,
            bayer: f[col.bayer] || null,
            flam: f[col.flam] ? Number(f[col.flam]) : null,
            ci: f[col.ci] ? Number(f[col.ci]) : null,
        });
    }
}

// Brightest first: the running scene slices this array by tier
// (utils/quality.js), and a magnitude-sorted array makes that a plain
// `.slice(0, n)` with no runtime sort.
bright.sort((a, b) => a.mag - b.mag);

const round = (n, dp) => (n == null ? null : Math.round(n * 10 ** dp) / 10 ** dp);
const starsTable = bright.map(s => [
    round(s.ra, 4), round(s.dec, 4), round(s.mag, 2), s.hip, s.con,
    s.proper, s.bayer, s.flam, round(s.ci, 2),
]);

writeFileSync(STARS_OUT, JSON.stringify(starsTable));
console.log(`${starsTable.length} stars (mag ≤ ${MAG_LIMIT}) → ${STARS_OUT} `
    + `(${(JSON.stringify(starsTable).length / 1024).toFixed(1)} KB)`);

// ── Constellation lines ─────────────────────────────────────────────────────

console.log(`Fetching ${LINES_URL} …`);
const linesRes = await fetch(LINES_URL);
if (!linesRes.ok) throw new Error(`${LINES_URL} → HTTP ${linesRes.status}`);
const western = await linesRes.json();

// A strip can open with the literal string "thin" instead of a HIP id — a
// Stellarium style marker for a fainter secondary connection (e.g. the rest
// of Ursa Major's figure beyond the Plough), not a broken reference. Split
// each constellation's strips into `main` and `thin` groups up front so the
// renderer can draw the second set dimmer without inspecting anything at
// runtime; strip the marker itself before resolving the rest as HIP ids.
let unresolved = 0;
const resolveStrip = (hips) => hips
    .map((hip) => {
        const star = byHip.get(hip);
        if (!star) { unresolved++; return null; }
        return [round(star.ra, 4), round(star.dec, 4)];
    })
    .filter(Boolean);

const linesTable = western.constellations.map((c) => {
    const main = [];
    const thin = [];
    for (const strip of c.lines) {
        if (strip[0] === 'thin') thin.push(resolveStrip(strip.slice(1)));
        else main.push(resolveStrip(strip));
    }
    return [c.iau, c.common_name?.english ?? c.id, c.common_name?.native ?? null, main, thin];
});

if (unresolved) console.warn(`${unresolved} constellation-line star(s) had no HIP match — dropped from their strip`);
if (linesTable.length !== 88) console.warn(`Expected 88 IAU constellations, got ${linesTable.length}`);

writeFileSync(LINES_OUT, JSON.stringify(linesTable));
const segCount = linesTable.reduce((s, [, , , main, thin]) =>
    s + [...main, ...thin].reduce((s2, st) => s2 + Math.max(0, st.length - 1), 0), 0);
console.log(`${linesTable.length} constellations, ${segCount} line segments → ${LINES_OUT} `
    + `(${(JSON.stringify(linesTable).length / 1024).toFixed(1)} KB)`);
