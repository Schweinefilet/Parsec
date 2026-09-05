import { useState, useEffect } from 'react';

// Heliocentric distance for the deep-space probes.
//
// This used to call JPL Horizons directly from the browser. Horizons serves the
// data fine but sends no Access-Control-Allow-Origin header, so every request
// was blocked by CORS and the panel only ever showed "Distance unavailable".
// A static site has nowhere to proxy it, so instead we pin real Horizons state
// vectors and extrapolate.
//
// All three craft are on hyperbolic escape trajectories far beyond the planets,
// where the Sun's pull is negligible and recession is effectively linear.
// Anchors below came from Horizons (CENTER=500@10, EPHEM_TYPE=VECTORS) at
// 2026-01-01 and 2031-01-01; across that five-year span a linear fit holds to
// better than 0.01 AU, so this stays accurate for many years.
const EPOCH = Date.UTC(2026, 0, 1);
const MS_PER_YEAR = 365.25 * 86400000;

const PROBES = {
    voyager1:       { au: 169.255, rate: 3.5595 },
    voyager2:       { au: 141.714, rate: 3.1749 },
    'new-horizons': { au: 63.576,  rate: 2.8436 },
};

export function heliocentricDistanceAU(spacecraftId, date = new Date()) {
    const p = PROBES[spacecraftId];
    if (!p) return null;
    return p.au + p.rate * ((date.getTime() - EPOCH) / MS_PER_YEAR);
}

/**
 * Current distance from the Sun in AU for a deep-space probe.
 * Recomputed every minute; null for anything not in the table.
 */
export function useHorizons(spacecraftId) {
    const [distanceAU, setDistanceAU] = useState(() => heliocentricDistanceAU(spacecraftId));

    useEffect(() => {
        setDistanceAU(heliocentricDistanceAU(spacecraftId));
        if (!PROBES[spacecraftId]) return;
        const iv = setInterval(() => setDistanceAU(heliocentricDistanceAU(spacecraftId)), 60000);
        return () => clearInterval(iv);
    }, [spacecraftId]);

    return { distanceAU, loading: false, error: null };
}
