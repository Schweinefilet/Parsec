import { useState, useEffect, useRef } from 'react';
import { moonPhaseDays, moonPhaseKey } from '../utils/astroFormatters';

const NASA_API_KEY = import.meta.env.VITE_NASA_API_KEY || (() => {
    console.warn('[useSpaceStrip] VITE_NASA_API_KEY not set — using DEMO_KEY');
    return 'DEMO_KEY';
})();

// Module-level queue: limits concurrent NeoWs requests to one at a time.
// Each enqueue call waits for the previous task to settle before starting.
let neoQueueTail = Promise.resolve();
function enqueueNeo(fn) {
    const task = neoQueueTail.then(fn, fn);
    neoQueueTail = task.catch(() => {});
    return task;
}

const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));

// Static fallbacks shown when APIs are unreachable or rate-limited
const FALLBACKS = {
    iss_lat:   { value: '51.6°', suffixKey: 'sky.north' },
    iss_lon:   { value: '0.0°',  suffixKey: 'sky.east' },
    neo_week:  '~25',
};

// Labels and units are keys; the value is a measurement, and a measurement is
// the same in every language. `valueKey` is for the two cells whose value is a
// word rather than a number — the moon phase, and "Unavailable".
// `suffixKey` is the hemisphere letter, which is a word in every language and
// happens to be one character in this one: N and W are not universal, and an
// Arabic reader gets ش and غ.
const INITIAL_CELLS = [
    { key: 'iss_lat',    label: 'ticker.issLat',     ...FALLBACKS.iss_lat },
    { key: 'iss_lon',    label: 'ticker.issLon',     ...FALLBACKS.iss_lon },
    { key: 'iss_alt',    label: 'ticker.issAlt',     value: '~408', unit: 'ticker.km' },
    { key: 'iss_speed',  label: 'ticker.issSpeed',   value: '7.66', unit: 'ticker.kmPerSec' },
    { key: 'neo_week',   label: 'ticker.neoWeek',    value: FALLBACKS.neo_week, unit: 'ticker.objects' },
    { key: 'moon_phase', label: 'ticker.moon',       valueKey: moonPhaseKey(moonPhaseDays()) },
    { key: 'sol_wind',   label: 'ticker.solarWind',  value: '~450', unit: 'ticker.kmPerSec' },
];

function todayISO()     { return new Date().toISOString().slice(0, 10); }
function weekAheadISO() {
    const d = new Date(); d.setDate(d.getDate() + 7); return d.toISOString().slice(0, 10);
}

async function fetchJSON(url, signal, timeoutMs = 6000) {
    // Combine the caller's signal with a local timeout. Passing `signal` straight
    // through (as this used to) meant the timeout controller was never the one
    // fetch listened to, so slow requests hung until the network gave up.
    const controller = new AbortController();
    const onAbort = () => controller.abort(signal?.reason ?? 'aborted');
    if (signal) {
        if (signal.aborted) controller.abort(signal.reason);
        else signal.addEventListener('abort', onAbort, { once: true });
    }
    const id = setTimeout(() => controller.abort('timeout'), timeoutMs);
    try {
        const r = await fetch(url, { signal: controller.signal });
        if (!r.ok) throw new Error(`HTTP ${r.status}`);
        const json = await r.json();
        if (json?.error?.code === 'OVER_RATE_LIMIT') throw new Error('OVER_RATE_LIMIT');
        return json;
    } finally {
        clearTimeout(id);
        signal?.removeEventListener('abort', onAbort);
    }
}

async function fetchNeoWithBackoff(url, signal) {
    let delay = 1000;
    for (let attempt = 0; attempt < 3; attempt++) {
        try {
            const r = await fetch(url, { signal });
            if (r.status === 429) {
                if (attempt < 2) { await sleep(delay); delay *= 2; continue; }
                throw new Error('Rate limited after 3 retries');
            }
            if (!r.ok) throw new Error(`HTTP ${r.status}`);
            const json = await r.json();
            if (json?.error?.code === 'OVER_RATE_LIMIT') {
                if (attempt < 2) { await sleep(delay); delay *= 2; continue; }
                throw new Error('Rate limited after 3 retries');
            }
            return json;
        } catch (err) {
            if (err.name === 'AbortError') throw err;
            if (attempt === 2) throw err;
            await sleep(delay);
            delay *= 2;
        }
    }
}

export function useSpaceStrip() {
    const [cells, setCells] = useState(INITIAL_CELLS);
    const mountedRef = useRef(true);
    const neoAbortRef = useRef(null);

    const updateCell = (key, value, unit, suffixKey) =>
        setCells(prev =>
            prev.map(c => c.key === key
                // A cell that has just been given a measurement is no longer a
                // cell whose value is a word, so the key goes with it. The
                // hemisphere letter is replaced outright rather than kept: a
                // latitude that has crossed the equator must not keep saying N.
                ? {
                    ...c, value, valueKey: undefined, suffixKey,
                    ...(unit !== undefined ? { unit } : {}),
                }
                : c)
        );

    const fetchIss = async (signal) => {
        // wheretheiss.at serves CORS headers and returns altitude/velocity too,
        // so the strip's ISS cells all come from one request.
        try {
            const d = await fetchJSON('https://api.wheretheiss.at/v1/satellites/25544', signal);
            if (!mountedRef.current) return;
            const lat = Number(d.latitude);
            const lon = Number(d.longitude);
            if (Number.isFinite(lat) && Number.isFinite(lon)) {
                updateCell('iss_lat', `${Math.abs(lat).toFixed(1)}°`, undefined,
                    lat >= 0 ? 'sky.north' : 'sky.south');
                updateCell('iss_lon', `${Math.abs(lon).toFixed(1)}°`, undefined,
                    lon >= 0 ? 'sky.east' : 'sky.west');
            }
            if (Number.isFinite(Number(d.altitude))) {
                updateCell('iss_alt', Number(d.altitude).toFixed(0), 'ticker.km');
            }
            if (Number.isFinite(Number(d.velocity))) {
                // API reports km/h; the strip shows km/s
                updateCell('iss_speed', (Number(d.velocity) / 3600).toFixed(2), 'ticker.kmPerSec');
            }
        } catch (err) {
            if (err.name === 'AbortError') return;
            console.warn('[SpaceStrip] ISS fetch failed:', err.message);
        }
    };

    const fetchNeos = async () => {
        neoAbortRef.current?.abort('superseded');
        const controller = new AbortController();
        neoAbortRef.current = controller;

        enqueueNeo(async () => {
            try {
                const start = todayISO();
                const end   = weekAheadISO();
                const url   = `https://api.nasa.gov/neo/rest/v1/feed?start_date=${start}&end_date=${end}&api_key=${NASA_API_KEY}`;
                const d = await fetchNeoWithBackoff(url, controller.signal);
                if (!mountedRef.current) return;
                const count = d?.element_count;
                if (Number.isFinite(count)) updateCell('neo_week', String(count), 'ticker.objects');
            } catch (err) {
                if (err.name === 'AbortError') return;
                console.warn('[SpaceStrip] NEO fetch failed after retries:', err.message);
                if (mountedRef.current) {
                    setCells(prev => prev.map(c => c.key === 'neo_week'
                        ? { ...c, value: undefined, valueKey: 'ticker.unavailable', unit: undefined }
                        : c));
                }
            }
        });
    };

    const updateMoon = () => setCells(prev => prev.map(c => c.key === 'moon_phase'
        ? { ...c, valueKey: moonPhaseKey(moonPhaseDays()) } : c));

    useEffect(() => {
        mountedRef.current = true;
        const issController = new AbortController();

        fetchIss(issController.signal);
        fetchNeos();
        updateMoon();

        const issInterval  = setInterval(() => fetchIss(issController.signal), 10_000);
        const neoInterval  = setInterval(fetchNeos,   600_000);
        const moonInterval = setInterval(updateMoon,  600_000);

        return () => {
            mountedRef.current = false;
            issController.abort('component unmounted');
            neoAbortRef.current?.abort('component unmounted');
            clearInterval(issInterval);
            clearInterval(neoInterval);
            clearInterval(moonInterval);
        };
    }, []); // eslint-disable-line react-hooks/exhaustive-deps

    return cells;
}
