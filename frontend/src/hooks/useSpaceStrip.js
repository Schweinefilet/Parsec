import { useState, useEffect } from 'react';
import { moonPhaseDays, moonPhaseName } from '../utils/astroFormatters';

// Static fallbacks shown when APIs are unreachable or rate-limited
const FALLBACKS = {
    iss_lat:   '51.6°N',
    iss_lon:   '0.0°E',
    neo_week:  '~25',
    apod:      'Astronomy Pic of the Day',
};

const INITIAL_CELLS = [
    { key: 'iss_lat',    label: 'ISS LAT',    value: FALLBACKS.iss_lat  },
    { key: 'iss_lon',    label: 'ISS LON',    value: FALLBACKS.iss_lon  },
    { key: 'iss_alt',    label: 'ISS ALT',    value: '~408',   unit: 'km'    },
    { key: 'iss_speed',  label: 'ISS SPEED',  value: '7.66',   unit: 'km/s'  },
    { key: 'neo_week',   label: 'NEO/WEEK',   value: FALLBACKS.neo_week, unit: 'objects' },
    { key: 'moon_phase', label: 'MOON',       value: moonPhaseName(moonPhaseDays())       },
    { key: 'apod',       label: 'APOD',       value: FALLBACKS.apod    },
    { key: 'sol_wind',   label: 'SOL WIND',   value: '~450',   unit: 'km/s'  },
];

function todayISO()     { return new Date().toISOString().slice(0, 10); }
function weekAheadISO() {
    const d = new Date(); d.setDate(d.getDate() + 7); return d.toISOString().slice(0, 10);
}

async function fetchJSON(url, timeoutMs = 6000) {
    const controller = new AbortController();
    const id = setTimeout(() => controller.abort(), timeoutMs);
    try {
        const r = await fetch(url, { signal: controller.signal });
        clearTimeout(id);
        if (!r.ok) throw new Error(`HTTP ${r.status}`);
        const json = await r.json();
        // Detect NASA DEMO_KEY rate-limit response
        if (json?.error?.code === 'OVER_RATE_LIMIT') throw new Error('OVER_RATE_LIMIT');
        return json;
    } catch (err) {
        clearTimeout(id);
        throw err;
    }
}

export function useSpaceStrip() {
    const [cells, setCells] = useState(INITIAL_CELLS);

    const updateCell = (key, value, unit) =>
        setCells(prev =>
            prev.map(c => c.key === key ? { ...c, value, ...(unit !== undefined ? { unit } : {}) } : c)
        );

    const fetchIss = async () => {
        // Try wheretheiss.at first (more reliable), then Open Notify
        const endpoints = [
            'https://api.wheretheiss.at/v1/satellites/25544',
            'https://api.open-notify.org/iss-now.json',
        ];
        for (const url of endpoints) {
            try {
                const d = await fetchJSON(url);
                // wheretheiss.at uses {latitude, longitude}, Open Notify uses {iss_position:{latitude,longitude}}
                const lat = Number(d.latitude ?? d.iss_position?.latitude);
                const lon = Number(d.longitude ?? d.iss_position?.longitude);
                if (Number.isFinite(lat) && Number.isFinite(lon)) {
                    console.log(`[SpaceStrip] ISS from ${url}: lat=${lat}, lon=${lon}`);
                    updateCell('iss_lat', `${Math.abs(lat).toFixed(1)}°${lat >= 0 ? 'N' : 'S'}`);
                    updateCell('iss_lon', `${Math.abs(lon).toFixed(1)}°${lon >= 0 ? 'E' : 'W'}`);
                    return;
                }
            } catch (err) {
                console.warn(`[SpaceStrip] ISS fetch failed (${url}):`, err.message);
            }
        }
        console.warn('[SpaceStrip] All ISS endpoints failed — using fallback');
        // Fallbacks already set in INITIAL_CELLS
    };

    const fetchNeos = async () => {
        const start = todayISO();
        const end   = weekAheadISO();
        try {
            const d = await fetchJSON(
                `https://api.nasa.gov/neo/rest/v1/feed?start_date=${start}&end_date=${end}&api_key=DEMO_KEY`
            );
            console.log('[SpaceStrip] NEO raw element_count:', d.element_count);
            const count = d.element_count;
            if (Number.isFinite(count)) updateCell('neo_week', String(count), 'objects');
        } catch (err) {
            console.warn('[SpaceStrip] NEO fetch failed:', err.message, '— using fallback');
        }
    };

    const fetchApod = async () => {
        const today = todayISO();
        const cacheKey = `parsec-apod-${today}`;
        const cached = localStorage.getItem(cacheKey);
        if (cached) {
            updateCell('apod', cached);
            return;
        }
        try {
            const d = await fetchJSON('https://api.nasa.gov/planetary/apod?api_key=DEMO_KEY');
            console.log('[SpaceStrip] APOD raw title:', d.title);
            const title = typeof d.title === 'string' ? d.title : null;
            if (title) {
                const display = title.length > 32 ? title.slice(0, 30) + '…' : title;
                updateCell('apod', display);
                try { localStorage.setItem(cacheKey, display); } catch {}
            }
        } catch (err) {
            console.warn('[SpaceStrip] APOD fetch failed:', err.message, '— using fallback');
        }
    };

    const updateMoon = () => updateCell('moon_phase', moonPhaseName(moonPhaseDays()));

    useEffect(() => {
        fetchIss();
        fetchNeos();
        fetchApod();
        updateMoon();

        const issInterval  = setInterval(fetchIss,   10_000);
        const neoInterval  = setInterval(fetchNeos,  600_000);
        const moonInterval = setInterval(updateMoon, 600_000);

        return () => {
            clearInterval(issInterval);
            clearInterval(neoInterval);
            clearInterval(moonInterval);
        };
    }, []); // eslint-disable-line react-hooks/exhaustive-deps

    return cells;
}
