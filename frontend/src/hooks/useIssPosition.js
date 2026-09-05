import { useState, useEffect, useRef } from 'react';

const ENDPOINT = 'https://api.wheretheiss.at/v1/satellites/25544';
const POLL_MS = 5000;

/**
 * Live ISS state vector, polled from wheretheiss.at.
 * Keeps a short trail of recent fixes so the caller can draw a ground track,
 * and reports staleness rather than silently showing a frozen position.
 */
export function useIssPosition({ trailLength = 240 } = {}) {
    const [state, setState] = useState({
        lat: null, lon: null, altitude: null, velocity: null,
        visibility: null, timestamp: null,
        loading: true, error: null, stale: false,
    });
    const [trail, setTrail] = useState([]);
    const failures = useRef(0);

    useEffect(() => {
        let cancelled = false;
        const controller = new AbortController();

        const tick = async () => {
            try {
                const r = await fetch(ENDPOINT, { signal: controller.signal });
                if (!r.ok) throw new Error(`HTTP ${r.status}`);
                const d = await r.json();
                if (cancelled) return;
                failures.current = 0;
                const lat = Number(d.latitude);
                const lon = Number(d.longitude);
                if (!Number.isFinite(lat) || !Number.isFinite(lon)) throw new Error('bad payload');

                setState({
                    lat, lon,
                    altitude: Number(d.altitude),
                    velocity: Number(d.velocity),
                    visibility: d.visibility ?? null,
                    timestamp: Number(d.timestamp) * 1000,
                    loading: false, error: null, stale: false,
                });
                setTrail(prev => {
                    const last = prev[prev.length - 1];
                    // Skip duplicate fixes; the API updates about once a second
                    if (last && last.lat === lat && last.lon === lon) return prev;
                    const next = [...prev, { lat, lon }];
                    return next.length > trailLength ? next.slice(next.length - trailLength) : next;
                });
            } catch (err) {
                if (cancelled || err.name === 'AbortError') return;
                failures.current += 1;
                setState(s => ({
                    ...s,
                    loading: false,
                    // One blip shouldn't wipe a good position off the screen
                    error: failures.current >= 3 ? err.message : s.error,
                    stale: failures.current >= 2,
                }));
            }
        };

        tick();
        const iv = setInterval(tick, POLL_MS);
        return () => {
            cancelled = true;
            controller.abort('unmounted');
            clearInterval(iv);
        };
    }, [trailLength]);

    return { ...state, trail };
}
