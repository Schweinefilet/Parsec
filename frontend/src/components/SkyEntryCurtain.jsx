import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
    CURTAIN, getSkyEntryPhase, subscribeSkyEntry, resetSkyEntry,
} from '../utils/skyEntry';
import { setLookDirection, DEFAULT_AZIMUTH } from '../utils/skyRotation';
import { useReducedMotion } from '../hooks/useMediaQuery';

// Where /sky opens its look direction when arrived at through this
// transition, rather than its own usual near-horizon default — selling the
// second half of "turn to face the sky" across the cut the curtain hides.
const ARRIVAL_ALTITUDE = 55;

// The cut between the two scenes: SolarSystem3D.jsx eases the camera toward
// the observer's spot on Earth while turning it to face outward, then hands
// off here by setting utils/skyEntry.js's phase to 'curtain'. This is the
// one piece of that sequence that survives the route change from the
// catch-all route to /sky — mounted in App.jsx as a sibling of <Routes>, not
// inside any one Route's element, so it (and the timers below) are never
// torn down by the navigate() call it is itself about to make.
//
// Plain opacity, not a wipe or an iris — the point is to be invisible, not
// to be noticed. A few stars fade in while it is held opaque so a beat of
// solid black doesn't read as "loading" the way LoadingScreen's identical
// black already means elsewhere in this app.
const FADE_MS = 460;
const HOLD_MS = 420; // opaque time before navigating back out — covers /sky's lazy chunk + first paint

// Fixed, not random — a re-render mid-fade must not reshuffle the sky.
const STARS = [
    [8, 18], [17, 62], [23, 34], [31, 81], [38, 12], [44, 55],
    [52, 28], [59, 71], [66, 9], [72, 46], [79, 88], [85, 24],
    [91, 60], [14, 91], [63, 38], [95, 15],
];

const SkyEntryCurtain = () => {
    const navigate = useNavigate();
    const [opaque, setOpaque] = useState(false);
    const [showStars, setShowStars] = useState(false);
    const reduceMotion = useReducedMotion();
    const timersRef = useRef([]);
    const navigateRef = useRef(navigate);
    navigateRef.current = navigate;

    useEffect(() => {
        const clearTimers = () => {
            timersRef.current.forEach(clearTimeout);
            timersRef.current = [];
        };
        const after = (ms, fn) => { timersRef.current.push(setTimeout(fn, ms)); };

        const run = () => {
            if (getSkyEntryPhase() !== CURTAIN) return;
            clearTimers();
            const fadeMs = reduceMotion ? 0 : FADE_MS;
            setOpaque(true);
            after(fadeMs, () => {
                setShowStars(true);
                setLookDirection(DEFAULT_AZIMUTH, ARRIVAL_ALTITUDE);
                navigateRef.current('/sky');
                after(HOLD_MS, () => {
                    setOpaque(false);
                    setShowStars(false);
                    after(fadeMs, resetSkyEntry);
                });
            });
        };

        const unsub = subscribeSkyEntry(run);
        run(); // in case phase was already 'curtain' the instant this mounted
        return () => { unsub(); clearTimers(); };
    }, [reduceMotion]);

    return (
        <div
            aria-hidden="true"
            style={{
                position: 'fixed', inset: 0, zIndex: 300,
                background: '#000',
                opacity: opaque ? 1 : 0,
                transition: `opacity ${reduceMotion ? 0 : FADE_MS}ms ease`,
                pointerEvents: opaque ? 'auto' : 'none',
            }}
        >
            <div
                style={{
                    position: 'absolute', inset: 0,
                    opacity: showStars ? 1 : 0,
                    transition: `opacity ${reduceMotion ? 0 : HOLD_MS}ms ease`,
                }}
            >
                {STARS.map(([top, left], i) => (
                    <span
                        key={i}
                        style={{
                            position: 'absolute', top: `${top}%`, left: `${left}%`,
                            width: 2, height: 2, borderRadius: '50%',
                            background: '#fff',
                            boxShadow: '0 0 3px 1px rgba(255,255,255,0.5)',
                        }}
                    />
                ))}
            </div>
        </div>
    );
};

export default SkyEntryCurtain;
