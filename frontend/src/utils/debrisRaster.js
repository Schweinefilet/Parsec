// The tidal disruption's debris, as a picture the GPU can read: the particle
// lattice (utils/tidalDisruption.js) drawn into a texture over the hole's
// equatorial plane, which the ray tracer samples wherever a light ray
// crosses it (exoticShaders.js TDE_FRAG).
//
// The texture is log-polar: columns are ln r, rows are the angle round the
// hole. That puts its resolution where the picture needs it: a few hundredths
// of M near the hole, where the stream is thin and the lensing sharp, and
// coarser far out where the debris is spread thin anyway.
//
// Each chain of the lattice is drawn as a line of soft capsules from particle
// to particle, so the stream stays continuous however far it stretches. Per
// texel: surface density Σ, and Σ-weighted temperature and velocity (for the
// Doppler shift), RGBA.

import { STAR_RADIUS } from './tidalDisruption';

export const RASTER = { width: 256, height: 512, rMin: 2, rMax: 1500 };

/** A raster's lookup tables, made once. */
export function createRaster({ width, height, rMin, rMax } = RASTER) {
    const lnMin = Math.log(rMin);
    const lnMax = Math.log(rMax);
    const dLn = (lnMax - lnMin) / width;
    const r = new Float64Array(width);
    for (let i = 0; i < width; i++) r[i] = Math.exp(lnMin + (i + 0.5) * dLn);
    const cos = new Float64Array(height);
    const sin = new Float64Array(height);
    for (let j = 0; j < height; j++) {
        const a = ((j + 0.5) / height - 0.5) * 2 * Math.PI;
        cos[j] = Math.cos(a);
        sin[j] = Math.sin(a);
    }
    return {
        width, height, rMin, rMax, lnMin, lnMax, dLn, r, cos, sin,
        data: new Float32Array(width * height * 4),
    };
}

/** Area of texel (i, j), in M². */
export function texelArea(R, i) {
    const r0 = Math.exp(R.lnMin + i * R.dLn);
    const r1 = Math.exp(R.lnMin + (i + 1) * R.dLn);
    return (Math.PI * (r1 * r1 - r0 * r0)) / R.height;
}

/** Where angle a falls in the rows, fractionally. */
function row(R, a) {
    return ((a / (2 * Math.PI)) + 0.5) * R.height - 0.5;
}

/**
 * Add one soft capsule from (x0, y0) to (x1, y1), half-width w, carrying
 * `mass` at temperature T and velocity (vx, vy). Its profile across is a
 * Gaussian of width w; along, flat with Gaussian ends. Normalised so the
 * capsule's integral over the plane is `mass`.
 */
export function addCapsule(R, x0, y0, x1, y1, w, mass, T, vx, vy) {
    const dx = x1 - x0, dy = y1 - y0;
    const len2 = dx * dx + dy * dy;
    const len = Math.sqrt(len2);
    // Across, a Gaussian integrates to w√π; the two rounded ends make up a
    // whole Gaussian blob, πw².
    const norm = mass / (len * w * Math.sqrt(Math.PI) + Math.PI * w * w);
    // The closest the segment comes to the hole.
    let s = len2 > 0 ? -(x0 * dx + y0 * dy) / len2 : 0;
    s = Math.min(Math.max(s, 0), 1);
    const near = Math.hypot(x0 + s * dx, y0 + s * dy);
    const r0 = Math.hypot(x0, y0), r1 = Math.hypot(x1, y1);
    // Out to 2.2 widths, where the Gaussian is down to 0.8%.
    const rLo = Math.max(near - 2.2 * w, R.rMin);
    const rHi = Math.max(r0, r1) + 2.2 * w;
    if (rHi < R.rMin || rLo > R.rMax) return;
    const iLo = Math.max(0, Math.floor((Math.log(rLo) - R.lnMin) / R.dLn));
    const iHi = Math.min(R.width - 1, Math.floor((Math.log(rHi) - R.lnMin) / R.dLn));
    // Rows: the angles the segment spans, padded by its width; all of them
    // if it passes close to the hole.
    let jLo, jHi;
    if (near < 2.2 * w + 0.5) {
        jLo = 0;
        jHi = R.height - 1;
    } else {
        const a0 = Math.atan2(y0, x0);
        let a1 = Math.atan2(y1, x1);
        if (a1 - a0 > Math.PI) a1 -= 2 * Math.PI;
        if (a0 - a1 > Math.PI) a1 += 2 * Math.PI;
        const pad = Math.asin(Math.min(1, (2.2 * w) / near));
        jLo = Math.floor(row(R, Math.min(a0, a1) - pad));
        jHi = Math.ceil(row(R, Math.max(a0, a1) + pad));
        if (jHi - jLo >= R.height) { jLo = 0; jHi = R.height - 1; }
    }
    const inv = 1 / (w * w);
    const d = R.data;
    for (let jj = jLo; jj <= jHi; jj++) {
        const j = ((jj % R.height) + R.height) % R.height;
        const c = R.cos[j], sn = R.sin[j];
        for (let i = iLo; i <= iHi; i++) {
            const px = R.r[i] * c, py = R.r[i] * sn;
            let t = len2 > 0 ? ((px - x0) * dx + (py - y0) * dy) / len2 : 0;
            t = Math.min(Math.max(t, 0), 1);
            const ex = px - x0 - t * dx, ey = py - y0 - t * dy;
            const q = (ex * ex + ey * ey) * inv;
            if (q > 4.84) continue;
            const sig = norm * Math.exp(-q);
            const k = (j * R.width + i) * 4;
            d[k] += sig;
            d[k + 1] += sig * T;
            d[k + 2] += sig * vx;
            d[k + 3] += sig * vy;
        }
    }
}

/** A particle's temperature: the stream's own, raised by the heat of shocks. */
export function debrisTemperature(heat) {
    return 6000 * Math.pow(1 + 2000 * heat, 0.3);
}

/**
 * Draw the whole event's debris. `ev` is a utils/tidalDisruption.js event
 * after its release; nothing is drawn before it.
 */
export function rasterizeDebris(R, ev) {
    R.data.fill(0);
    if (ev.released == null) return R;
    const { nAlong, nAcross, state: s, alive, weight, heat, E } = ev;
    // Chains are about the star's diameter / nAcross apart; each is drawn
    // a little wider than that so they merge into one ribbon.
    const w0 = (2.2 * STAR_RADIUS) / nAcross;
    const vel = (k, r) => {
        // d(x, y)/dt = u (1 − 2/r) / E.
        const f = (1 - 2 / r) / E[k];
        return [s[4 * k + 2] * f, s[4 * k + 3] * f];
    };
    // Gas that has gone round: no longer a stream, its chain neighbours
    // anywhere on the ring. Each is drawn as a short arc of its own circle,
    // a few capsules long, and the arcs overlap into a ring.
    const round = (k) => ev.returning[k] && ev.passes[k] >= 3;
    const ARC = 0.66; // radians
    const PIECES = 3;
    for (let k = 0; k < ev.n; k++) {
        if (alive[k] !== 1 || !round(k)) continue;
        const x = s[4 * k], y = s[4 * k + 1];
        const r = Math.hypot(x, y);
        const a0 = Math.atan2(y, x);
        // Which way round it goes.
        const turn = Math.sign(x * s[4 * k + 3] - y * s[4 * k + 2]) || 1;
        const [vx, vy] = vel(k, r);
        // The velocity turns with the arc; Doppler needs it per piece.
        const v = Math.hypot(vx, vy);
        const T = debrisTemperature(heat[k]);
        for (let p = 0; p < PIECES; p++) {
            const b0 = a0 + turn * ARC * (p / PIECES - 0.5);
            const b1 = a0 + turn * ARC * ((p + 1) / PIECES - 0.5);
            const bm = 0.5 * (b0 + b1);
            addCapsule(R, r * Math.cos(b0), r * Math.sin(b0), r * Math.cos(b1), r * Math.sin(b1),
                w0 + 0.06 * r, weight[k] / PIECES, T, -turn * v * Math.sin(bm), turn * v * Math.cos(bm));
        }
    }
    for (let c = 0; c < nAcross; c++) {
        for (let i = 0; i < nAlong - 1; i++) {
            const a = c * nAlong + i, b = a + 1;
            if (alive[a] !== 1 || alive[b] !== 1 || round(a) || round(b)) continue;
            const x0 = s[4 * a], y0 = s[4 * a + 1], x1 = s[4 * b], y1 = s[4 * b + 1];
            const r0 = Math.hypot(x0, y0), r1 = Math.hypot(x1, y1);
            const len = Math.hypot(x1 - x0, y1 - y0);
            // Neighbours that have gone separate ways (one shocked round,
            // one still on its way out) are no longer one stream.
            if (len > Math.max(10, 0.6 * Math.min(r0, r1))) continue;
            const rm = 0.5 * (r0 + r1);
            // Never thinner than about a texel.
            const w = Math.max(w0, 0.6 * rm * R.dLn);
            const mass = 0.5 * (weight[a] + weight[b]);
            const T = debrisTemperature(0.5 * (heat[a] + heat[b]));
            const [va, wa] = vel(a, r0);
            const [vb, wb] = vel(b, r1);
            addCapsule(R, x0, y0, x1, y1, w, mass, T, 0.5 * (va + vb), 0.5 * (wa + wb));
        }
    }
    return R;
}
