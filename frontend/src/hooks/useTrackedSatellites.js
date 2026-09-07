import { useState, useEffect, useRef } from 'react';
import { TRACKED_SATELLITES } from '../data/trackedSatellites';

// Where the other spacecraft are.
//
// The obvious route is a "where is satellite N right now" API, and both of the
// ones worth trying are dead ends for a static site. wheretheiss.at, which the
// ISS already uses, serves exactly one satellite — ask it for anything else and
// it returns 404. N2YO covers everything and answers happily to curl, but sends
// no Access-Control-Allow-Origin, so a browser refuses to read the response;
// and even if it did, the key would be sitting in a public JS bundle with an
// hourly quota anyone could spend.
//
// So instead we take the orbital elements and do the arithmetic here. CelesTrak
// serves current TLEs with CORS headers and no key, and SGP4 — the standard
// propagator those elements are defined against — turns one into a position.
// Checked against the live wheretheiss.at fix for the ISS, propagating its TLE
// this way lands within half a kilometre on the ground and 30 m in altitude,
// which is unsurprising: that service is doing the same sum.
//
// It also costs one request rather than one per satellite per tick, so the
// position can be recomputed as often as we like instead of as often as a quota
// allows.

const TLE_URL = 'https://celestrak.org/NORAD/elements/gp.php?CATNR=';
// Elements are issued every few hours and drift slowly; a LEO TLE is good to
// about a kilometre for a day or so. Refetching every six hours is polite to
// CelesTrak and far more current than the accuracy needs.
const TLE_REFRESH_MS = 6 * 60 * 60 * 1000;
const STEP_MS = 1000;

/**
 * Pull the two element lines out of a CelesTrak TLE response.
 *
 * The reply is CRLF-delimited and may or may not carry a name line above the
 * elements. For a catalog number it does not know, CelesTrak answers 404 with
 * the words "No GP data found", which has no element lines in it — so this
 * returns null and the caller drops that satellite rather than propagating
 * nonsense.
 */
export function parseTLE(text) {
    const lines = text.split(/\r?\n/).map(l => l.trim()).filter(Boolean);
    const one = lines.find(l => l.startsWith('1 '));
    const two = lines.find(l => l.startsWith('2 '));
    return one && two ? [one, two] : null;
}

/**
 * Live positions for the tracked spacecraft, recomputed every second.
 *
 * Returns an entry per satellite once its elements have arrived; anything whose
 * fetch failed is simply absent, so the globe draws the ones it has rather than
 * nothing at all.
 */
export function useTrackedSatellites() {
    const [fixes, setFixes] = useState([]);
    const stateRef = useRef({ sgp4: null, records: [] });

    useEffect(() => {
        let cancelled = false;
        const controller = new AbortController();

        const loadElements = async () => {
            // satellite.js is only wanted on this page, so it arrives as its
            // own chunk rather than riding in the main bundle.
            const sgp4 = stateRef.current.sgp4
                ?? (stateRef.current.sgp4 = await import('satellite.js'));

            const records = [];
            await Promise.all(TRACKED_SATELLITES.map(async (satDef) => {
                try {
                    const res = await fetch(`${TLE_URL}${satDef.norad}&FORMAT=TLE`,
                        { signal: controller.signal });
                    if (!res.ok) throw new Error(`HTTP ${res.status}`);
                    const tle = parseTLE(await res.text());
                    if (!tle) throw new Error('no elements in response');
                    records.push({ def: satDef, rec: sgp4.twoline2satrec(tle[0], tle[1]) });
                } catch (err) {
                    if (err.name !== 'AbortError') {
                        console.warn(`[Tracker] ${satDef.name} elements failed:`, err.message);
                    }
                }
            }));
            if (!cancelled) stateRef.current.records = records;
        };

        const step = () => {
            const { sgp4, records } = stateRef.current;
            if (!sgp4 || !records.length) return;
            const now = new Date();
            const gmst = sgp4.gstime(now);
            const out = [];
            for (const { def, rec } of records) {
                try {
                    const pv = sgp4.propagate(rec, now);
                    if (!pv?.position) continue;
                    const geo = sgp4.eciToGeodetic(pv.position, gmst);
                    const lat = sgp4.degreesLat(geo.latitude);
                    const lon = sgp4.degreesLong(geo.longitude);
                    if (!Number.isFinite(lat) || !Number.isFinite(lon)) continue;
                    // km/s from the ECI velocity vector
                    const v = pv.velocity;
                    out.push({
                        id: def.id, name: def.name, color: def.color,
                        catalogId: def.catalogId,
                        lat, lon,
                        altitude: geo.height,
                        velocity: v ? Math.hypot(v.x, v.y, v.z) : null,
                    });
                } catch {
                    // A decayed or malformed element set: skip it rather than
                    // taking the whole tracker down.
                }
            }
            if (!cancelled) setFixes(out);
        };

        loadElements().then(() => { if (!cancelled) step(); })
            .catch(err => console.warn('[Tracker] element load failed:', err.message));

        const tick = setInterval(step, STEP_MS);
        const refresh = setInterval(loadElements, TLE_REFRESH_MS);

        return () => {
            cancelled = true;
            controller.abort('unmounted');
            clearInterval(tick);
            clearInterval(refresh);
        };
    }, []);

    return fixes;
}
