import { useState, useEffect } from 'react';

const HORIZONS_COMMANDS = {
    'voyager1':     '-31',
    'voyager2':     '-32',
    'new-horizons': '-98',
};

const CACHE_TTL = 24 * 60 * 60 * 1000; // 24 h

function getCached(key) {
    try {
        const raw = localStorage.getItem(key);
        if (!raw) return null;
        const { ts, data } = JSON.parse(raw);
        if (Date.now() - ts > CACHE_TTL) { localStorage.removeItem(key); return null; }
        return data;
    } catch { return null; }
}

function setCache(key, data) {
    try { localStorage.setItem(key, JSON.stringify({ ts: Date.now(), data })); } catch { /* quota */ }
}

function parseDistance(text) {
    // Horizons VECTORS output: X = ... Y = ... Z = ... on separate lines in $$SOE block
    const soe = text.match(/\$\$SOE([\s\S]*?)\$\$EOE/);
    if (!soe) return null;
    const block = soe[1];
    const xm = block.match(/X\s*=\s*([\-\d.E+]+)/i);
    const ym = block.match(/Y\s*=\s*([\-\d.E+]+)/i);
    const zm = block.match(/Z\s*=\s*([\-\d.E+]+)/i);
    if (!xm || !ym || !zm) return null;
    const x = parseFloat(xm[1]), y = parseFloat(ym[1]), z = parseFloat(zm[1]);
    return Math.sqrt(x * x + y * y + z * z);
}

export function useHorizons(spacecraftId) {
    const cmd = HORIZONS_COMMANDS[spacecraftId];
    const cacheKey = `horizons_v1_${spacecraftId}`;

    const [state, setState] = useState(() => {
        if (!cmd) return { distanceAU: null, loading: false, error: null };
        const cached = getCached(cacheKey);
        return { distanceAU: cached?.distanceAU ?? null, loading: !cached, error: null };
    });

    useEffect(() => {
        if (!cmd) return;
        const cached = getCached(cacheKey);
        if (cached) { setState({ distanceAU: cached.distanceAU, loading: false, error: null }); return; }

        setState(s => ({ ...s, loading: true }));

        const today    = new Date().toISOString().slice(0, 10);
        const tomorrow = new Date(Date.now() + 86400000).toISOString().slice(0, 10);

        const params = new URLSearchParams({
            format:     'text',
            COMMAND:    cmd,
            CENTER:     '500@10',
            MAKE_EPHEM: 'YES',
            EPHEM_TYPE: 'VECTORS',
            START_TIME: today,
            STOP_TIME:  tomorrow,
            STEP_SIZE:  '1d',
            OUT_UNITS:  'AU-D',
        });

        fetch(`https://ssd.jpl.nasa.gov/api/horizons.api?${params}`)
            .then(r => { if (!r.ok) throw new Error(`HTTP ${r.status}`); return r.text(); })
            .then(text => {
                const distanceAU = parseDistance(text);
                setCache(cacheKey, { distanceAU });
                setState({ distanceAU, loading: false, error: null });
            })
            .catch(err => {
                setState({ distanceAU: null, loading: false, error: err.message });
            });
    }, [cmd, cacheKey]);

    return state;
}
