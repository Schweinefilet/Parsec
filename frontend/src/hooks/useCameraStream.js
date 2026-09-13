import { useState, useEffect, useCallback, useRef } from 'react';

// The phone's own back camera, for the AR sky viewer.
//
// Nothing here is remembered between visits — unlike useObserverLocation.js's
// location, which persists because a page about "come back tomorrow night"
// cannot re-ask every time, a camera grant is cheap to re-request each
// session and a live MediaStream cannot be serialized into storage anyway.
//
// request() resolves (or rejects to null, with `error` set) rather than
// firing a callback, since ArPermissionCard has to sequence this after the
// iOS orientation-permission gesture rather than fire it standalone — see
// utils/deviceOrientation.js's own requestPermission().

function messageFor(err) {
    if (err?.name === 'NotAllowedError' || err?.name === 'SecurityError') return 'Permission denied';
    if (err?.name === 'NotFoundError' || err?.name === 'OverconstrainedError') return 'No camera found';
    if (err?.name === 'NotReadableError') return 'The camera is in use by another app';
    return 'Could not use the camera';
}

export function useCameraStream() {
    const [stream, setStream] = useState(null);
    const [error, setError] = useState(null);
    const [asking, setAsking] = useState(false);
    const streamRef = useRef(null);

    const stop = useCallback(() => {
        streamRef.current?.getTracks().forEach((t) => t.stop());
        streamRef.current = null;
        setStream(null);
    }, []);

    // A track left running after the page navigates away, or after AR mode
    // is switched off, keeps the browser's own camera-in-use indicator lit —
    // stop() is not optional cleanup here, it is the only thing that turns
    // the light off.
    useEffect(() => () => stop(), [stop]);

    const request = useCallback(async () => {
        if (typeof navigator.mediaDevices?.getUserMedia !== 'function') {
            setError('This browser cannot use the camera');
            return null;
        }
        setError(null);
        setAsking(true);
        try {
            const s = await navigator.mediaDevices.getUserMedia({
                video: { facingMode: 'environment' },
                audio: false,
            });
            streamRef.current = s;
            setStream(s);
            return s;
        } catch (err) {
            setError(messageFor(err));
            return null;
        } finally {
            setAsking(false);
        }
    }, []);

    return { stream, error, asking, request, stop };
}
