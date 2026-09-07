import { useState, useEffect } from 'react';

/**
 * Subscribe to a CSS media query.
 * Initialised synchronously so the first paint already matches the viewport —
 * a layout that flips after mount is worse than one that starts correct.
 */
export function useMediaQuery(query) {
    const [matches, setMatches] = useState(
        () => typeof window !== 'undefined' && window.matchMedia(query).matches
    );

    useEffect(() => {
        const mql = window.matchMedia(query);
        const onChange = (e) => setMatches(e.matches);
        setMatches(mql.matches);
        mql.addEventListener('change', onChange);
        return () => mql.removeEventListener('change', onChange);
    }, [query]);

    return matches;
}

export const useIsMobile = () => useMediaQuery('(max-width: 767px)');
// Wide enough for the expanded time control to sit at bottom-left without
// reaching the centred controls. Below this it opens on request instead.
export const useHasRoomForTimeline = () => useMediaQuery('(min-width: 1280px)');
export const useReducedMotion = () => useMediaQuery('(prefers-reduced-motion: reduce)');
