import { useState, useEffect, useRef } from 'react';

// Generic hook for NASA Open API endpoints.
// api.nasa.gov supports CORS — no proxy needed.
const NASA_BASE = 'https://api.nasa.gov';
const DEMO_KEY  = 'DEMO_KEY'; // 30 req/hr unauthenticated limit

export function useNasaQuery(path, params = {}, { skip = false } = {}) {
    const [data, setData]     = useState(null);
    const [loading, setLoading] = useState(!skip);
    const [error, setError]   = useState(null);
    const abortRef = useRef(null);

    useEffect(() => {
        if (skip) return;

        abortRef.current?.abort();
        const controller = new AbortController();
        abortRef.current = controller;

        setLoading(true);
        setError(null);

        const query = new URLSearchParams({ api_key: DEMO_KEY, ...params }).toString();
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

        return () => controller.abort();
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
