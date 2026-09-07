import { useState, useEffect, useRef, useMemo } from 'react';
import * as Astronomy from 'astronomy-engine';
import { SATELLITES } from '../data/trackedSatellites';
import { loadElements } from './../utils/celestrakElements';

// Where every tracked spacecraft is, on one clock and in one shape.
//
// There is no "where is satellite N right now" service this can call. The one
// the ISS used serves only the ISS; N2YO covers everything but sends no CORS
// header, so a browser will not read its reply, and its key would ship in a
// public bundle anyway. So the site takes the orbital elements and does the
// arithmetic: CelesTrak publishes current TLEs with CORS and no key, and SGP4
// turns a set into a position. Propagating the ISS's own elements this way
// lands within half a kilometre of that old live feed.
//
// Doing the sum locally is what makes the rest of the page possible. A position
// costs nothing, so every satellite updates every second instead of every five;
// and a whole orbit can be drawn the moment you select something, rather than
// accumulating while you sit and watch.

// A low-orbit element set is good to about a kilometre for a day, and CelesTrak
// reissues every few hours. Six is well inside that; the loader also caches to
// localStorage, so a reload does not go near the network.
const TLE_REFRESH_MS = 6 * 60 * 60 * 1000;
const STEP_MS = 1000;
const TRACK_POINTS = 90;
const R_EARTH_KM = 6378.137;

/**
 * Is the spacecraft in sunlight?
 *
 * A cylindrical shadow: it is lit unless it is on the far side of Earth from
 * the Sun *and* within an Earth radius of the Earth–Sun axis. That ignores the
 * penumbra, which is a few seconds of an orbit either side of the terminator
 * crossing and not worth the algebra here.
 *
 * @param {{x:number,y:number,z:number}} posEci  km, Earth-centred inertial
 */
export function isSunlit(posEci, date) {
    const sun = Astronomy.GeoVector('Sun', date, false);   // geocentric equatorial
    const m = Math.hypot(sun.x, sun.y, sun.z);
    if (!m) return true;
    const sx = sun.x / m, sy = sun.y / m, sz = sun.z / m;
    const along = posEci.x * sx + posEci.y * sy + posEci.z * sz;
    if (along > 0) return true;                            // sunward hemisphere
    const px = posEci.x - along * sx;
    const py = posEci.y - along * sy;
    const pz = posEci.z - along * sz;
    return Math.hypot(px, py, pz) > R_EARTH_KM;
}

/** How far to the horizon from this altitude — the circle it can see. */
export function footprintRadiusKm(altitudeKm) {
    if (!(altitudeKm > 0)) return 0;
    return R_EARTH_KM * Math.acos(R_EARTH_KM / (R_EARTH_KM + altitudeKm));
}

/** Epoch of an element set, as a Date. */
function epochOf(satrec) {
    return new Date((satrec.jdsatepoch - 2440587.5) * 86400000);
}

/** Minutes per revolution, from the mean motion in the elements. */
function periodMinutes(satrec) {
    return satrec.no > 0 ? (2 * Math.PI) / satrec.no : null;
}

/**
 * Live state for every tracked spacecraft, plus the ground path of one of them.
 *
 * Anything whose elements failed to load is simply absent from `satellites`,
 * so the page draws what it has rather than nothing at all.
 */
export function useSatelliteTracking(selectedId) {
    const [fixes, setFixes] = useState([]);
    const [status, setStatus] = useState('loading');
    const [track, setTrack] = useState([]);
    const engine = useRef({ sgp4: null, records: [] });

    // ── Elements, then a position every second ────────────────────────────
    useEffect(() => {
        let cancelled = false;
        const controller = new AbortController();

        const refreshElements = async () => {
            const sgp4 = engine.current.sgp4
                ?? (engine.current.sgp4 = await import('satellite.js'));

            const { sets, error } = await loadElements(SATELLITES, { signal: controller.signal });
            if (cancelled) return;
            if (error) console.warn('[Tracker] element fetch:', error);

            const records = [];
            for (const def of SATELLITES) {
                const set = sets.get(def.norad);
                if (!set) continue;
                try {
                    const rec = sgp4.twoline2satrec(set.line1, set.line2);
                    records.push({ def, rec, epoch: epochOf(rec), period: periodMinutes(rec) });
                } catch (err) {
                    console.warn(`[Tracker] ${def.shortName} elements unusable:`, err.message);
                }
            }
            engine.current.records = records;
            setStatus(records.length === SATELLITES.length ? 'ready'
                : records.length ? 'partial' : 'error');
        };

        const step = () => {
            const { sgp4, records } = engine.current;
            if (!sgp4 || !records.length) return;
            const now = new Date();
            const gmst = sgp4.gstime(now);
            const out = [];
            for (const { def, rec, epoch, period } of records) {
                try {
                    const pv = sgp4.propagate(rec, now);
                    if (!pv?.position) continue;
                    const geo = sgp4.eciToGeodetic(pv.position, gmst);
                    const lat = sgp4.degreesLat(geo.latitude);
                    const lon = sgp4.degreesLong(geo.longitude);
                    if (!Number.isFinite(lat) || !Number.isFinite(lon)) continue;
                    const v = pv.velocity;
                    out.push({
                        ...def,
                        lat, lon,
                        altitude: geo.height,
                        velocity: v ? Math.hypot(v.x, v.y, v.z) : null,
                        sunlit: isSunlit(pv.position, now),
                        footprintKm: footprintRadiusKm(geo.height),
                        periodMinutes: period,
                        elementsEpoch: epoch,
                    });
                } catch {
                    // A decayed or malformed set: drop that one, keep the rest
                }
            }
            if (!cancelled) setFixes(out);
        };

        refreshElements().then(() => { if (!cancelled) step(); })
            .catch((err) => {
                if (err.name === 'AbortError') return;
                console.warn('[Tracker] element load failed:', err.message);
                if (!cancelled) setStatus('error');
            });

        const tick = setInterval(step, STEP_MS);
        const refresh = setInterval(refreshElements, TLE_REFRESH_MS);
        return () => {
            cancelled = true;
            controller.abort('unmounted');
            clearInterval(tick);
            clearInterval(refresh);
        };
    }, []);

    // ── One orbit of ground path for whichever is selected ────────────────
    // Recomputed on selection and then occasionally, so the tail stays put
    // rather than crawling forward a point at a time.
    useEffect(() => {
        let cancelled = false;

        const build = () => {
            const { sgp4, records } = engine.current;
            const entry = records.find(r => r.def.id === selectedId);
            if (!sgp4 || !entry) { if (!cancelled) setTrack([]); return; }
            const span = (entry.period ?? 93) * 60000;
            const now = Date.now();
            const pts = [];
            for (let i = 0; i <= TRACK_POINTS; i++) {
                const when = new Date(now - span + (span * i) / TRACK_POINTS);
                try {
                    const pv = sgp4.propagate(entry.rec, when);
                    if (!pv?.position) continue;
                    const geo = sgp4.eciToGeodetic(pv.position, sgp4.gstime(when));
                    pts.push({
                        lat: sgp4.degreesLat(geo.latitude),
                        lon: sgp4.degreesLong(geo.longitude),
                        alt: geo.height,
                    });
                } catch { /* skip a bad step rather than lose the path */ }
            }
            if (!cancelled) setTrack(pts);
        };

        build();
        const iv = setInterval(build, 15000);
        return () => { cancelled = true; clearInterval(iv); };
    }, [selectedId, status]);

    const selected = useMemo(
        () => fixes.find(f => f.id === selectedId) ?? null,
        [fixes, selectedId],
    );

    return { satellites: fixes, selected, track, status };
}
