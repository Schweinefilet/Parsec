import { useState, useEffect } from 'react';

// Module-level cache so the same query is never fetched twice per session.
const cache = new Map();

export function useNasaImage(query, override) {
    const key = override ?? (query ? query.replace(/\(.*?\)/g, '').trim() : null);

    const [imageUrl, setImageUrl] = useState(() => cache.get(key) ?? null);

    useEffect(() => {
        if (!key) return;
        if (cache.has(key)) {
            setImageUrl(cache.get(key));
            return;
        }

        const url = `https://images-api.nasa.gov/search?q=${encodeURIComponent(key)}&media_type=image`;
        let cancelled = false;

        fetch(url)
            .then(r => {
                if (!r.ok) throw new Error(`HTTP ${r.status}`);
                return r.json();
            })
            .then(data => {
                const raw  = data?.collection?.items?.[0]?.links?.[0]?.href ?? null;
                // NASA Images API returns ~thumb.jpg thumbnails (~160 px) — upgrade to ~medium (~1024 px)
                const href = raw ? raw.replace(/~thumb\.jpg$/i, '~medium.jpg') : null;
                cache.set(key, href);
                if (!cancelled) setImageUrl(href);
            })
            .catch(() => {
                cache.set(key, null);
            });

        return () => { cancelled = true; };
    }, [key]);

    return imageUrl;
}
