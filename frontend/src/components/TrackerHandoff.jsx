import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
    HANDOFF, SETTLING, IDLE,
    getTrackerPhase, getTrackerSnapshot, getTrackerSatId, isTrackerGlobeReady,
    setTrackerPhase, subscribeTracker,
} from '../utils/trackerEntry';
import { useReducedMotion } from '../hooks/useMediaQuery';

// The cut between the solar system and the tracker. SolarSystem3D.jsx pulls
// the camera back until Earth is framed exactly the way SatelliteGlobe frames
// it, captures that frame, and sets the phase to 'handoff'. This is the piece
// that survives the route change — mounted in App.jsx as a sibling of
// <Routes>, not inside any one Route's element, so neither it nor its timers
// are torn down by the navigate() it is itself about to make. Same placement,
// and the same reason, as SkyEntryCurtain.jsx.
//
// Where it differs from that curtain is the whole point of it. A curtain
// fades through black because the two sides have nothing in common. Here they
// do: the captured still and the globe's first frame are the same picture of
// the same planet at the same size, lit the same way (utils/trackerEntry.js
// sets out how that is arranged). So this holds the still up, waits for the
// globe underneath it to actually have something drawn, and dissolves. There
// is no black beat at all — at no point is anything on screen other than
// Earth.
//
// The still is an <img> of a dataURL rather than a second live canvas. Keeping
// SolarSystem3D mounted across the swap would mean a routing change and two
// WebGL contexts alive at once, for a beat that lasts a third of a second and
// is a dissolve between two motionless images either way.
const CROSS_MS = 420;
// If the globe never reports in — a texture that 404s, a WebGL context that
// fails to come up — dissolve anyway rather than leaving a still frame of the
// solar system standing over the tracker forever.
const READY_TIMEOUT_MS = 1200;

const TrackerHandoff = () => {
    const navigate = useNavigate();
    const reduceMotion = useReducedMotion();
    const [still, setStill] = useState(null);
    const [fading, setFading] = useState(false);
    const timersRef = useRef([]);
    const navigateRef = useRef(navigate);
    navigateRef.current = navigate;

    useEffect(() => {
        const clearTimers = () => {
            timersRef.current.forEach(clearTimeout);
            timersRef.current = [];
        };
        const after = (ms, fn) => { timersRef.current.push(setTimeout(fn, ms)); };

        // Guards the one-shot navigate: this runs again on every phase
        // change, and 'handoff' is still the phase for the length of the
        // dissolve, so without a latch the navigate would fire repeatedly.
        //
        // It has to be cleared when the sequence ends, which is the whole
        // reason 'idle' is handled here rather than in an effect of its own.
        // It wasn't, and the latch survived the trip: the first visit to the
        // tracker worked and every one after it stalled on the hand-off
        // frame — camera pinned, chrome hidden, no navigate — until the page
        // was reloaded and the component remounted with a fresh closure.
        let started = false;

        const run = () => {
            const phase = getTrackerPhase();

            if (phase === IDLE) {
                // Sequence finished, or was abandoned. Re-arm for the next
                // one and drop any still left standing.
                started = false;
                clearTimers();
                setStill(null);
                setFading(false);
                return;
            }

            if (phase !== HANDOFF || started) return;
            started = true;
            clearTimers();
            const crossMs = reduceMotion ? 0 : CROSS_MS;

            // The captured frame goes up first and the navigate happens
            // underneath it, so the route swap — which tears down one 3D
            // scene and builds another — is never on screen.
            const shot = getTrackerSnapshot();
            setStill(shot);
            setFading(false);

            const sat = getTrackerSatId();
            navigateRef.current(sat ? `/satellites?sat=${sat}` : '/satellites');

            const dissolve = () => {
                setFading(true);
                after(crossMs, () => {
                    // Hand over to the page, which eases the globe out of
                    // full-bleed and into its card from here.
                    setTrackerPhase(SETTLING);
                    setStill(null);
                    setFading(false);
                });
            };

            if (!shot) {
                // No usable capture (the camera was grabbed mid-flight, or
                // the canvas would not read back). Nothing to dissolve from,
                // so let the globe simply appear.
                setTrackerPhase(SETTLING);
                return;
            }

            // Wait for the globe to have drawn something, then dissolve.
            let settled = false;
            const go = () => {
                if (settled) return;
                settled = true;
                unsubReady();
                dissolve();
            };
            const unsubReady = subscribeTracker(() => {
                if (isTrackerGlobeReady()) go();
            });
            if (isTrackerGlobeReady()) go();
            after(READY_TIMEOUT_MS, go);
        };

        const unsub = subscribeTracker(run);
        run(); // in case the phase was already 'handoff' when this mounted
        return () => { unsub(); clearTimers(); };
    }, [reduceMotion]);

    if (!still) return null;

    return (
        <img
            src={still}
            alt=""
            aria-hidden="true"
            style={{
                position: 'fixed', inset: 0, zIndex: 300,
                width: '100%', height: '100%',
                // The capture is of the scene canvas, which is the full
                // viewport whenever the scene is focused on something — and
                // it always is here, since the sequence runs from /object/earth.
                objectFit: 'cover',
                opacity: fading ? 0 : 1,
                transition: `opacity ${reduceMotion ? 0 : CROSS_MS}ms linear`,
                pointerEvents: 'none',
            }}
        />
    );
};

export default TrackerHandoff;
