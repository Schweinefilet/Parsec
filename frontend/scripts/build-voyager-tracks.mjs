// Regenerates src/data/voyagerTracks.json — the flight paths drawn for Voyager
// 1 and 2.  Run with:  node scripts/build-voyager-tracks.mjs
//
// These are the trajectories the spacecraft actually flew, sampled from JPL
// Horizons, not a curve fitted to their endpoints. Every bend in them is a real
// gravity assist: Jupiter and Saturn for both, then Uranus and Neptune for
// Voyager 2 alone. Voyager 1 is often said to have done the full Grand Tour and
// did not — it was aimed at a close pass of Titan at Saturn, which was worth
// more than Uranus and threw it up out of the ecliptic, which is why its track
// leaves the plane of the planets and never comes back to it.
//
// REF_PLANE='FRAME' matters. Horizons defaults to ecliptic coordinates, but the
// scene is built on astronomy-engine's HelioVector, which returns J2000
// *equatorial*. Mixing the two tilts one against the other by the 23.4° between
// the planes — which is exactly what had happened to the pinned probe vectors
// this replaces.
//
// Sampling is dense through the encounters and sparse on the long run out, then
// thinned by Douglas–Peucker against how the path will actually be drawn: the
// scene compresses radius hard, so a tolerance in AU would keep far too much
// detail out at 150 AU and far too little at Jupiter.

import { writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const API = 'https://ssd.jpl.nasa.gov/api/horizons.api';

const PROBES = [
    {
        id: 'voyager1', command: '-31',
        // Horizons' solution starts an hour after the 1977-09-05 12:56 UTC lift-off
        passes: [
            { start: '1977-09-06', stop: '1982-01-01', step: '2d' },   // Jupiter, Saturn
            { start: '1982-01-01', stop: '2035-01-01', step: '100d' }, // interstellar run
        ],
    },
    {
        id: 'voyager2', command: '-32',
        passes: [
            { start: '1977-08-21', stop: '1990-06-01', step: '2d' },   // the full Grand Tour
            { start: '1990-06-01', stop: '2035-01-01', step: '100d' },
        ],
    },
];

// How the scene lays radius out, from PLANETS in src/data/solarSystemBodies.js:
// semi-major axis in AU against the ring it is drawn on. Only used here to
// decimate in something close to drawn units — the renderer owns the real map.
const ANCHOR_AU    = [0.387, 0.723, 1.0, 1.524, 5.203, 9.537, 19.19, 30.07, 39.48];
const ANCHOR_SCENE = [48,    72,    96,  128,   190,   245,   295,   340,   410];
const TOLERANCE = 0.5;      // scene units of allowed deviation from the true path

function sceneRadius(au) {
    if (au <= ANCHOR_AU[0]) return (au / ANCHOR_AU[0]) * ANCHOR_SCENE[0];
    for (let i = 1; i < ANCHOR_AU.length; i++) {
        if (au <= ANCHOR_AU[i]) {
            const f = Math.log(au / ANCHOR_AU[i - 1]) / Math.log(ANCHOR_AU[i] / ANCHOR_AU[i - 1]);
            return ANCHOR_SCENE[i - 1] + f * (ANCHOR_SCENE[i] - ANCHOR_SCENE[i - 1]);
        }
    }
    const n = ANCHOR_AU.length - 1;
    const slope = (ANCHOR_SCENE[n] - ANCHOR_SCENE[n - 1]) / Math.log(ANCHOR_AU[n] / ANCHOR_AU[n - 1]);
    return ANCHOR_SCENE[n] + slope * Math.log(au / ANCHOR_AU[n]);
}

const drawn = (p) => {
    const r = Math.hypot(p.x, p.y, p.z);
    const s = sceneRadius(r) / r;
    return [p.x * s, p.y * s, p.z * s];
};

const MONTHS = { Jan:0,Feb:1,Mar:2,Apr:3,May:4,Jun:5,Jul:6,Aug:7,Sep:8,Oct:9,Nov:10,Dec:11 };
// Values look like "-2.5888E-01", so the sign has to be allowed inside the
// exponent as well as in front of the mantissa.
const ROW = /A\.D\. (\d{4})-([A-Za-z]{3})-(\d{2}) (\d{2}):(\d{2}):[\d.]+ TDB\s*\n\s*X\s*=\s*([-+0-9.Ee]+)\s+Y\s*=\s*([-+0-9.Ee]+)\s+Z\s*=\s*([-+0-9.Ee]+)/g;

async function fetchPass(command, { start, stop, step }) {
    const qs = new URLSearchParams({
        format: 'text', COMMAND: `'${command}'`, OBJ_DATA: "'NO'", MAKE_EPHEM: "'YES'",
        EPHEM_TYPE: "'VECTORS'", CENTER: "'500@10'", START_TIME: `'${start}'`,
        STOP_TIME: `'${stop}'`, STEP_SIZE: `'${step}'`, VEC_TABLE: "'1'",
        REF_PLANE: "'FRAME'", OUT_UNITS: "'AU-D'",
    });
    const res = await fetch(`${API}?${qs}`);
    if (!res.ok) throw new Error(`Horizons → HTTP ${res.status}`);
    const txt = await res.text();
    const body = txt.slice(txt.indexOf('$$SOE'), txt.indexOf('$$EOE'));
    if (body.length < 10) throw new Error(`no ephemeris for ${command} ${start}..${stop}`);
    const out = [];
    let m;
    ROW.lastIndex = 0;
    while ((m = ROW.exec(body))) {
        out.push({
            t: Date.UTC(+m[1], MONTHS[m[2]], +m[3], +m[4], +m[5]),
            x: +m[6], y: +m[7], z: +m[8],
        });
    }
    return out;
}

// Douglas–Peucker, measuring deviation in drawn scene units.
function simplify(points, tol) {
    const keep = new Uint8Array(points.length);
    keep[0] = keep[points.length - 1] = 1;
    const xyz = points.map(drawn);
    const stack = [[0, points.length - 1]];
    while (stack.length) {
        const [lo, hi] = stack.pop();
        if (hi - lo < 2) continue;
        const [ax, ay, az] = xyz[lo], [bx, by, bz] = xyz[hi];
        const dx = bx - ax, dy = by - ay, dz = bz - az;
        const len2 = dx * dx + dy * dy + dz * dz;
        let worst = -1, at = -1;
        for (let i = lo + 1; i < hi; i++) {
            const [px, py, pz] = xyz[i];
            const ux = px - ax, uy = py - ay, uz = pz - az;
            const t = len2 > 0 ? Math.max(0, Math.min(1, (ux * dx + uy * dy + uz * dz) / len2)) : 0;
            const d = Math.hypot(ux - dx * t, uy - dy * t, uz - dz * t);
            if (d > worst) { worst = d; at = i; }
        }
        if (worst > tol) { keep[at] = 1; stack.push([lo, at], [at, hi]); }
    }
    return points.filter((_, i) => keep[i]);
}

const here = dirname(fileURLToPath(import.meta.url));
const out = {};

for (const probe of PROBES) {
    const merged = [];
    for (const pass of probe.passes) {
        const rows = await fetchPass(probe.command, pass);
        for (const r of rows) if (!merged.length || r.t > merged[merged.length - 1].t) merged.push(r);
        process.stdout.write(`${probe.id} ${pass.start}..${pass.stop} @${pass.step}: ${rows.length}\n`);
    }
    const thinned = simplify(merged, TOLERANCE);
    out[probe.id] = {
        launch: merged[0].t,
        // [days since launch, x, y, z] in AU, J2000 equatorial (ICRF), Sun-centred.
        // Four decimals is 15,000 km — a rounding error against a scene where
        // Earth's whole orbit is 96 units across.
        points: thinned.map(p => [
            Math.round((p.t - merged[0].t) / 86400000),
            +p.x.toFixed(4), +p.y.toFixed(4), +p.z.toFixed(4),
        ]),
    };
    console.log(`  → ${merged.length} samples thinned to ${thinned.length}`);
}

const dest = resolve(here, '../src/data/voyagerTracks.json');
const json = JSON.stringify(out);
writeFileSync(dest, json);
console.log(`${(json.length / 1024).toFixed(1)} KB → ${dest}`);
