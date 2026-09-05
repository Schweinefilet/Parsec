import { useState, useEffect, useRef } from 'react';
import { moonPhaseDays, moonPhaseName } from '../utils/astroFormatters';

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
    iss_lat:   '51.6°N',
    iss_lon:   '0.0°E',
    neo_week:  '~25',
};

const INITIAL_CELLS = [
    { key: 'iss_lat',    label: 'ISS LAT',    value: FALLBACKS.iss_lat  },
    { key: 'iss_lon',    label: 'ISS LON',    value: FALLBACKS.iss_lon  },
    { key: 'iss_alt',    label: 'ISS ALT',    value: '~408',   unit: 'km'    },
    { key: 'iss_speed',  label: 'ISS SPEED',  value: '7.66',   unit: 'km/s'  },
    { key: 'neo_week',   label: 'NEO/WEEK',   value: FALLBACKS.neo_week, unit: 'objects' },
    { key: 'moon_phase', label: 'MOON',       value: moonPhaseName(moonPhaseDays())       },
    { key: 'sol_wind',   label: 'SOL WIND',   value: '~450',   unit: 'km/s'  },
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

    const updateCell = (key, value, unit) =>
        setCells(prev =>
            prev.map(c => c.key === key ? { ...c, value, ...(unit !== undefined ? { unit } : {}) } : c)
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
                updateCell('iss_lat', `${Math.abs(lat).toFixed(1)}°${lat >= 0 ? 'N' : 'S'}`);
                updateCell('iss_lon', `${Math.abs(lon).toFixed(1)}°${lon >= 0 ? 'E' : 'W'}`);
            }
            if (Number.isFinite(Number(d.altitude))) {
                updateCell('iss_alt', Number(d.altitude).toFixed(0), 'km');
            }
            if (Number.isFinite(Number(d.velocity))) {
                // API reports km/h; the strip shows km/s
                updateCell('iss_speed', (Number(d.velocity) / 3600).toFixed(2), 'km/s');
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
                if (Number.isFinite(count)) updateCell('neo_week', String(count), 'objects');
            } catch (err) {
                if (err.name === 'AbortError') return;
                console.warn('[SpaceStrip] NEO fetch failed after retries:', err.message);
                if (mountedRef.current) updateCell('neo_week', 'Unavailable', '');
            }
        });
    };

    const updateMoon = () => updateCell('moon_phase', moonPhaseName(moonPhaseDays()));

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
