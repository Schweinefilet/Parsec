// Builds public/models/asteroids/lod/*.stl — the belt's copies of the asteroid
// models, cut down to something proportionate to how they are actually drawn.
// Run with:  node scripts/decimate-asteroids.mjs
//
// The belt scatters 2,400 instances of five models. At full resolution those
// models are 4,000–8,000 triangles each, so the scene was drawing 16.7 million
// triangles every frame for rocks that cover one or two pixels — measured at
// 97.5% of the whole scene's triangle count, and enough to hold a desktop at
// exactly half its refresh rate.
//
// The full-resolution files stay where they are, because three of them are also
// the named bodies you can fly to and look at closely. Only the belt reads from
// lod/.
//
// Vertex clustering rather than edge collapse: it is a few lines, it cannot
// fail on the degenerate topology STL exports are full of (STL has no shared
// vertices at all — every triangle carries its own three), and at two pixels
// the difference between a good decimation and a crude one does not survive
// rasterisation. What matters is that the silhouette stays roughly right, which
// snapping to a grid does.

import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const SRC = resolve(here, '../public/models/asteroids');
const DEST = resolve(SRC, 'lod');

const KEYS = ['geographos', 'mithra', 'vesta', 'bennu', 'golevka'];
// Enough to keep a lumpy silhouette, far more than two pixels can show.
const TARGET_TRIANGLES = 400;

function readBinarySTL(path) {
    const buf = readFileSync(path);
    const count = buf.readUInt32LE(80);
    const tris = new Float32Array(count * 9);
    for (let i = 0; i < count; i++) {
        const at = 84 + i * 50 + 12;          // skip the per-facet normal
        for (let j = 0; j < 9; j++) tris[i * 9 + j] = buf.readFloatLE(at + j * 4);
    }
    return tris;
}

function writeBinarySTL(path, tris) {
    const count = tris.length / 9;
    const buf = Buffer.alloc(84 + count * 50);
    buf.write('decimated for the belt — see scripts/decimate-asteroids.mjs', 0, 'ascii');
    buf.writeUInt32LE(count, 80);
    const ax = new Array(3), bx = new Array(3), cx = new Array(3);
    for (let i = 0; i < count; i++) {
        const at = 84 + i * 50;
        for (let j = 0; j < 3; j++) {
            ax[j] = tris[i * 9 + j];
            bx[j] = tris[i * 9 + 3 + j];
            cx[j] = tris[i * 9 + 6 + j];
        }
        // Facet normal. three.js recomputes vertex normals on load anyway, but
        // a zeroed normal is not a valid STL and other tools will choke on it.
        const u = [bx[0] - ax[0], bx[1] - ax[1], bx[2] - ax[2]];
        const v = [cx[0] - ax[0], cx[1] - ax[1], cx[2] - ax[2]];
        const n = [u[1] * v[2] - u[2] * v[1], u[2] * v[0] - u[0] * v[2], u[0] * v[1] - u[1] * v[0]];
        const len = Math.hypot(n[0], n[1], n[2]) || 1;
        for (let j = 0; j < 3; j++) buf.writeFloatLE(n[j] / len, at + j * 4);
        for (let j = 0; j < 9; j++) buf.writeFloatLE(tris[i * 9 + j], at + 12 + j * 4);
    }
    writeFileSync(path, buf);
    return count;
}

/** Snap every vertex to a grid cell centroid, then drop the collapsed faces. */
function cluster(tris, grid) {
    let minX = Infinity, minY = Infinity, minZ = Infinity;
    let maxX = -Infinity, maxY = -Infinity, maxZ = -Infinity;
    for (let i = 0; i < tris.length; i += 3) {
        minX = Math.min(minX, tris[i]); maxX = Math.max(maxX, tris[i]);
        minY = Math.min(minY, tris[i + 1]); maxY = Math.max(maxY, tris[i + 1]);
        minZ = Math.min(minZ, tris[i + 2]); maxZ = Math.max(maxZ, tris[i + 2]);
    }
    const sx = (maxX - minX) / grid || 1;
    const sy = (maxY - minY) / grid || 1;
    const sz = (maxZ - minZ) / grid || 1;
    const cellOf = (x, y, z) => {
        const i = Math.min(grid - 1, Math.floor((x - minX) / sx));
        const j = Math.min(grid - 1, Math.floor((y - minY) / sy));
        const k = Math.min(grid - 1, Math.floor((z - minZ) / sz));
        return (i * grid + j) * grid + k;
    };

    // A cell's representative point is the average of everything that landed in
    // it, which keeps the surface where it was instead of on the lattice.
    const sums = new Map();
    for (let i = 0; i < tris.length; i += 3) {
        const c = cellOf(tris[i], tris[i + 1], tris[i + 2]);
        const s = sums.get(c) ?? [0, 0, 0, 0];
        s[0] += tris[i]; s[1] += tris[i + 1]; s[2] += tris[i + 2]; s[3]++;
        sums.set(c, s);
    }
    const rep = new Map();
    for (const [c, s] of sums) rep.set(c, [s[0] / s[3], s[1] / s[3], s[2] / s[3]]);

    const out = [];
    const seen = new Set();
    for (let t = 0; t < tris.length; t += 9) {
        const c0 = cellOf(tris[t], tris[t + 1], tris[t + 2]);
        const c1 = cellOf(tris[t + 3], tris[t + 4], tris[t + 5]);
        const c2 = cellOf(tris[t + 6], tris[t + 7], tris[t + 8]);
        // Two corners in one cell means the triangle collapsed to a line.
        if (c0 === c1 || c1 === c2 || c0 === c2) continue;
        // And the same three cells twice is the same face twice.
        const key = [c0, c1, c2].sort((a, b) => a - b).join(',');
        if (seen.has(key)) continue;
        seen.add(key);
        out.push(...rep.get(c0), ...rep.get(c1), ...rep.get(c2));
    }
    return new Float32Array(out);
}

mkdirSync(DEST, { recursive: true });
let before = 0, after = 0;

for (const key of KEYS) {
    const tris = readBinarySTL(resolve(SRC, `${key}.stl`));
    const from = tris.length / 9;

    // Search the grid resolution rather than guessing it: the relationship
    // between grid size and triangle count depends on how the model's surface
    // folds, and it is different for every rock.
    let best = null;
    for (let grid = 3; grid <= 40; grid++) {
        const out = cluster(tris, grid);
        const n = out.length / 9;
        if (!best || Math.abs(n - TARGET_TRIANGLES) < Math.abs(best.n - TARGET_TRIANGLES)) {
            best = { out, n, grid };
        }
        if (n > TARGET_TRIANGLES * 1.6) break;
    }

    const n = writeBinarySTL(resolve(DEST, `${key}.stl`), best.out);
    before += from;
    after += n;
    console.log(`${key.padEnd(12)} ${String(from).padStart(5)} → ${String(n).padStart(4)} triangles  (grid ${best.grid})`);
}

console.log(`\ntotal ${before} → ${after} triangles per model set`);
