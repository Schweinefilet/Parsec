// Which country the ground point below the station is nearest to.
//
// The obvious way to answer this is to ask a reverse-geocoder, and it is the
// wrong way: the ISS is over water about seven tenths of the time, and a
// geocoder has nothing to say about a point at sea — wheretheiss.at's own
// coordinate endpoint returns "??" for every one of them. "Nearest" is a
// different question from "over", and only the first is answerable most of the
// time, so we carry a little land geometry and answer it ourselves.
//
// `data/landPoints.json` is a cloud of points sampled from Natural Earth's
// coastlines and country interiors — see `scripts/build-land-points.mjs` for
// how it is built and what it costs. It is loaded on demand rather than
// imported, so it lands as its own chunk (~21 KB gzipped) that only the ISS
// tracker ever fetches.

const EARTH_R_KM = 6371;
const DEG2RAD = Math.PI / 180;

/** @type {{ names: string[], owner: Uint16Array, x: Float32Array, y: Float32Array, z: Float32Array, count: number } | null} */
let cloud = null;
let loading = null;

// Points arrive sorted and delta-coded, in tenths of a degree. Undo that once,
// straight into unit vectors: comparing dot products orders points exactly as
// great-circle distance does, so the search itself needs no trigonometry.
function build(table) {
    let count = 0;
    for (const [, deltas] of table) count += deltas.length >> 1;

    const names = new Array(table.length);
    const owner = new Uint16Array(count);
    const x = new Float32Array(count);
    const y = new Float32Array(count);
    const z = new Float32Array(count);

    let n = 0;
    table.forEach(([name, deltas], country) => {
        names[country] = name;
        let lat10 = 0, lon10 = 0;
        for (let i = 0; i < deltas.length; i += 2) {
            lat10 += deltas[i];
            lon10 += deltas[i + 1];
            const lat = (lat10 / 10) * DEG2RAD;
            const lon = (lon10 / 10) * DEG2RAD;
            const c = Math.cos(lat);
            x[n] = c * Math.cos(lon);
            y[n] = c * Math.sin(lon);
            z[n] = Math.sin(lat);
            owner[n] = country;
            n++;
        }
    });

    return { names, owner, x, y, z, count: n };
}

/**
 * Fetch and decode the land table. Safe to call as often as you like — the
 * chunk is requested once and the decode happens once.
 */
export function loadLandPoints() {
    if (cloud) return Promise.resolve(cloud);
    loading ??= import('../data/landPoints.json')
        .then((m) => (cloud = build(m.default)));
    return loading;
}

/**
 * Nearest country to a ground point, or null before the table has loaded.
 *
 * The distance is to the nearest *sampled* land point, so treat it as accurate
 * to a few tens of km rather than exactly. Near a land border it can name the
 * neighbour; over open water, which is the case this exists for, it is right
 * about 99% of the time.
 *
 * @returns {{ name: string, km: number } | null}
 */
export function nearestCountry(lat, lon) {
    if (!cloud || !Number.isFinite(lat) || !Number.isFinite(lon)) return null;

    const latR = lat * DEG2RAD;
    const lonR = lon * DEG2RAD;
    const c = Math.cos(latR);
    const qx = c * Math.cos(lonR);
    const qy = c * Math.sin(lonR);
    const qz = Math.sin(latR);

    const { x, y, z, owner, names, count } = cloud;
    let best = -2;
    let at = 0;
    for (let i = 0; i < count; i++) {
        const dot = qx * x[i] + qy * y[i] + qz * z[i];
        if (dot > best) { best = dot; at = i; }
    }

    return {
        name: names[owner[at]],
        km: EARTH_R_KM * Math.acos(Math.min(1, Math.max(-1, best))),
    };
}

/** Test seam: forget the loaded table. */
export function __reset() {
    cloud = null;
    loading = null;
}
