import { useState, useEffect } from 'react';

// Module-level cache so the same query is never fetched twice per session.
const cache = new Map();

const IMAGE_EXTS = /\.(jpe?g|png|webp|gif)(\?.*)?$/i;

export function useNasaImage(query, override) {
    const key = override ?? (query ? query.replace(/\(.*?\)/g, '').trim() : null);

    const [imageUrl, setImageUrl] = useState(() => cache.get(key) ?? null);

    useEffect(() => {
        if (!key) return;
        if (cache.has(key)) {
            setImageUrl(cache.get(key));
            return;
        }

        const controller = new AbortController();
        const url = `https://images-api.nasa.gov/search?q=${encodeURIComponent(key)}&media_type=image`;

        fetch(url, { signal: controller.signal })
            .then(r => {
                if (!r.ok) throw new Error(`HTTP ${r.status}`);
                return r.json();
            })
            .then(data => {
                const items = data?.collection?.items;
                if (!items?.length) { cache.set(key, null); return; }
                const links = items[0]?.links;
                if (!links?.length) { cache.set(key, null); return; }
                const raw  = links[0].href ?? null;
                // NASA Images API returns ~thumb.jpg thumbnails — upgrade to ~medium (~1024 px)
                const href = raw ? raw.replace(/~thumb\.jpg$/i, '~medium.jpg') : null;
                // Reject non-image hrefs (e.g. video manifests, MP4s)
                const validHref = href && IMAGE_EXTS.test(href) ? href : null;
                cache.set(key, validHref);
                setImageUrl(validHref);
            })
            .catch(err => {
                if (err.name === 'AbortError') return;
                cache.set(key, null);
            });

        return () => controller.abort('component unmounted');
    }, [key]);

    return imageUrl;
}
