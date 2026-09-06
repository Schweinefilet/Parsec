import { useState, useEffect } from 'react';

/**
 * Whether an element has come close enough to the viewport to be worth loading
 * something for.
 *
 * `loading="lazy"` is not this. Browsers pick their own margin for it and pick
 * it generously — on a phone, cards a full screen below the fold were fetching
 * and decoding megapixel photographs while the 3D scene was still starting.
 * This gives us the margin instead.
 *
 * Latches on: once something has been near, keep it loaded rather than tearing
 * it down and paying for the image again on the way back up.
 */
export function useNearViewport(ref, rootMargin = '300px') {
    const [near, setNear] = useState(false);

    useEffect(() => {
        const el = ref.current;
        if (!el || near) return;
        if (typeof IntersectionObserver !== 'function') { setNear(true); return; }

        const io = new IntersectionObserver(([entry]) => {
            if (entry.isIntersecting) { setNear(true); io.disconnect(); }
        }, { rootMargin });
        io.observe(el);
        return () => io.disconnect();
    }, [ref, rootMargin, near]);

    return near;
}
