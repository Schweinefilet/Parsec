// Whether this device can plausibly run the AR sky viewer.
//
// Feature-detection only — presence of the APIs, never a permission request.
// Showing or hiding the AR toggle must never itself cost the user a camera or
// motion-sensor prompt; that only happens once they've tapped the toggle and
// seen the explainer card (see ArPermissionCard.jsx).

/**
 * True on a touchscreen device that exposes both `DeviceOrientationEvent` and
 * `getUserMedia`. Deliberately built on the same `(pointer: coarse)` signal
 * utils/quality.js's own detectTier()/skyAllowed() use for "is this actually
 * a touchscreen" — not hooks/useMediaQuery.js's useIsMobile(), which is a bare
 * CSS width breakpoint and false-positives on a narrow desktop window that
 * has neither a camera worth pointing at the sky nor a compass to read.
 */
export function isArViewerSupported() {
    if (typeof window === 'undefined') return false;
    const coarse = window.matchMedia?.('(pointer: coarse)').matches ?? false;
    if (!coarse) return false;
    if (!('DeviceOrientationEvent' in window)) return false;
    if (typeof navigator === 'undefined' || typeof navigator.mediaDevices?.getUserMedia !== 'function') return false;
    return true;
}
