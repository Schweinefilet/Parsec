import { useState, useEffect } from 'react';
import { holdTips, releaseTips, subscribeTips } from '../utils/coachTips';

/** True while anything is holding the first-visit tips back. */
export function useTipsHeld() {
    const [held, setHeld] = useState(false);
    useEffect(() => subscribeTips(setHeld), []);
    return held;
}

/**
 * Hold the tips back under `name` for as long as `active` is true, and let go
 * when it stops or the component unmounts.
 */
export function useHoldTips(name, active) {
    useEffect(() => {
        if (!active) return undefined;
        holdTips(name);
        return () => releaseTips(name);
    }, [name, active]);
}
