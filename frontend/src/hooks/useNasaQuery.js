import { useState, useEffect, useRef } from 'react';

const NASA_BASE = 'https://api.nasa.gov';

const NASA_API_KEY = import.meta.env.VITE_NASA_API_KEY || (() => {
    console.warn('[useNasaQuery] VITE_NASA_API_KEY not set — using DEMO_KEY');
    return 'DEMO_KEY';
})();

export function useNasaQuery(path, params = {}, { skip = false } = {}) {
    const [data, setData]       = useState(null);
    const [loading, setLoading] = useState(!skip);
    const [error, setError]     = useState(null);
    const abortRef = useRef(null);

    useEffect(() => {
        if (skip) return;

        abortRef.current?.abort('superseded');
        const controller = new AbortController();
        abortRef.current = controller;

        setLoading(true);
        setError(null);

        const query = new URLSearchParams({ api_key: NASA_API_KEY, ...params }).toString();
        const url   = `${NASA_BASE}${path}?${query}`;

        fetch(url, { signal: controller.signal })
            .then(r => {
                if (!r.ok) throw new Error(`HTTP ${r.status}`);
                return r.json();
            })
            .then(json => {
                if (!controller.signal.aborted) setData(json);
            })
            .catch(err => {
                if (err.name !== 'AbortError') setError(err.message);
            })
            .finally(() => {
                if (!controller.signal.aborted) setLoading(false);
            });

        return () => controller.abort('component unmounted');
    }, [path, JSON.stringify(params), skip]); // eslint-disable-line react-hooks/exhaustive-deps

    return { data, loading, error };
}

// Fetch APOD (Astronomy Picture of the Day)
export function useApod() {
    return useNasaQuery('/planetary/apod');
}

// Fetch NEO count for a date range (YYYY-MM-DD strings)
export function useNeoFeed(startDate, endDate) {
    return useNasaQuery('/neo/rest/v1/feed', { start_date: startDate, end_date: endDate });
}
