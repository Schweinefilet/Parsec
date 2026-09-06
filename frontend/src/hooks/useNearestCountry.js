import { useState, useEffect, useMemo } from 'react';
import { loadLandPoints, nearestCountry } from '../utils/nearestCountry';

/**
 * Nearest country to a ground point, recomputed as the point moves.
 *
 * Returns null until the land table has loaded — it is a separate chunk fetched
 * the first time this hook runs, so nothing outside the ISS tracker pays for
 * it. Null is also what you get if that fetch fails, which leaves the readout
 * showing a dash rather than taking the page down with it.
 */
export function useNearestCountry(lat, lon) {
    const [ready, setReady] = useState(false);

    useEffect(() => {
        let live = true;
        loadLandPoints()
            .then(() => { if (live) setReady(true); })
            .catch((err) => console.warn('[NearestCountry] land table failed:', err?.message));
        return () => { live = false; };
    }, []);

    return useMemo(
        () => (ready && lat != null && lon != null ? nearestCountry(lat, lon) : null),
        [ready, lat, lon],
    );
}
