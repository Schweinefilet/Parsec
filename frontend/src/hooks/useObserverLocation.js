import { useState, useEffect, useCallback } from 'react';

// Where the person standing outside is.
//
// Remembered between visits, because a page whose whole point is "come back
// tomorrow night" cannot ask for permission every time. It is kept in this
// browser and goes nowhere else — nothing here is sent anywhere, the sky is
// computed on the device.
//
// Stored rounded to two decimals, about a kilometre. Altitude and azimuth do
// not change measurably over that distance, so the precision would buy nothing
// and it is not ours to keep.

const KEY = 'parsec.observer';
const PRECISION = 2;

function read() {
    try {
        const raw = localStorage.getItem(KEY);
        if (!raw) return null;
        const v = JSON.parse(raw);
        return Number.isFinite(v?.lat) && Number.isFinite(v?.lon) ? { lat: v.lat, lon: v.lon } : null;
    } catch {
        return null;   // private window, cleared storage, or a browser refusing
    }
}

function write(value) {
    try {
        if (value) localStorage.setItem(KEY, JSON.stringify(value));
        else localStorage.removeItem(KEY);
    } catch { /* not being able to remember is not a reason to fail */ }
}

const round = (n) => Number(n.toFixed(PRECISION));

export function useObserverLocation() {
    const [location, setLocation] = useState(read);
    const [error, setError] = useState(null);
    const [asking, setAsking] = useState(false);

    useEffect(() => { write(location); }, [location]);

    const request = useCallback(() => {
        if (!navigator.geolocation) { setError('This browser cannot share a location'); return; }
        setError(null);
        setAsking(true);
        navigator.geolocation.getCurrentPosition(
            (p) => {
                setLocation({ lat: round(p.coords.latitude), lon: round(p.coords.longitude) });
                setAsking(false);
            },
            (err) => {
                setError(err.code === 1 ? 'Permission denied' : 'Could not get your location');
                setAsking(false);
            },
            { timeout: 10000, maximumAge: 300000 },
        );
    }, []);

    const forget = useCallback(() => { setLocation(null); setError(null); }, []);

    return { location, error, asking, request, forget };
}
