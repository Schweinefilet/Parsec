import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';

// vi.hoisted(), not a plain top-level const — vi.mock()'s factory runs
// before ordinary module-scope initialization, so a plainly-declared
// magvarMock would still be in its temporal dead zone the first time the
// factory closes over it.
const { magvarMock } = vi.hoisted(() => ({ magvarMock: vi.fn(() => 0) }));
vi.mock('magvar', () => ({ magvar: (...args) => magvarMock(...args) }));

import {
    getOrientationHeading, getOrientationAltitude, isOrientationAbsolute,
    nudgeCalibrationOffset, resetCalibrationOffset, setDeclinationLocation,
    needsOrientationPermission, requestDeviceOrientationPermission,
    subscribeDeviceOrientation, __injectOrientationEvent, __injectMotionEvent,
    __resetDeviceOrientation,
} from './deviceOrientation.js';

describe('deviceOrientation', () => {
    beforeEach(() => {
        __resetDeviceOrientation();
        magvarMock.mockReset();
        magvarMock.mockReturnValue(0);
    });
    afterEach(() => { __resetDeviceOrientation(); });

    describe('altitude from beta/gamma — hand-worked special cases', () => {
        // These three pin the formula against physical geometry worked out
        // by hand (see deviceOrientation.js's own header), independent of
        // its algebra: no amount of internal self-consistency substitutes
        // for a real device, but these are cases where the *correct* answer
        // can be reasoned out directly rather than just re-deriving the
        // same formula the implementation uses.
        it('beta=90, gamma=0 (the AR "magic window" position) reads altitude 0', () => {
            __injectOrientationEvent({ alpha: 0, beta: 90, gamma: 0 });
            expect(getOrientationAltitude()).toBeCloseTo(0, 5);
        });

        it('beta=0, gamma=0 (flat on a table, screen up) reads altitude -90', () => {
            // The back camera, on the underside, faces straight down through
            // the table.
            __injectOrientationEvent({ alpha: 0, beta: 0, gamma: 0 });
            expect(getOrientationAltitude()).toBeCloseTo(-90, 5);
        });

        it('beta=180, gamma=0 (flat, screen down) reads altitude +90 (zenith)', () => {
            __injectOrientationEvent({ alpha: 0, beta: 180, gamma: 0 });
            expect(getOrientationAltitude()).toBeCloseTo(90, 5);
        });

        it('does not depend on alpha at all', () => {
            __injectOrientationEvent({ alpha: 37, beta: 90, gamma: 0 });
            const withAlpha37 = getOrientationAltitude();
            __resetDeviceOrientation();
            __injectOrientationEvent({ alpha: 260, beta: 90, gamma: 0 });
            expect(getOrientationAltitude()).toBeCloseTo(withAlpha37, 5);
        });
    });

    describe('altitude from gravity (devicemotion), preferred over beta/gamma when available', () => {
        // The same three hand-worked cases altitudeFromBetaGamma() is
        // pinned against above (see deviceOrientation.js's own header for
        // why this second source exists at all: the beta/gamma Euler
        // decomposition is unstable exactly near beta=90, this app's own
        // default AR holding orientation). Each case here also feeds a
        // deliberately wrong beta/gamma alongside the gravity reading, to
        // prove gravity is what actually won, not a coincidence of the
        // fallback agreeing with it.
        it('flat, screen up (g ~ (0,0,+9.8)) reads altitude -90', () => {
            __injectMotionEvent({ accelerationIncludingGravity: { x: 0, y: 0, z: 9.8 } });
            __injectOrientationEvent({ alpha: 0, beta: 45, gamma: 30 }, { absolute: true });
            expect(getOrientationAltitude()).toBeCloseTo(-90, 4);
        });

        it('flat, screen down (g ~ (0,0,-9.8)) reads altitude +90 (zenith)', () => {
            __injectMotionEvent({ accelerationIncludingGravity: { x: 0, y: 0, z: -9.8 } });
            __injectOrientationEvent({ alpha: 0, beta: 45, gamma: 30 }, { absolute: true });
            expect(getOrientationAltitude()).toBeCloseTo(90, 4);
        });

        it('upright "magic window" (g ~ (0,+9.8,0)) reads altitude 0', () => {
            __injectMotionEvent({ accelerationIncludingGravity: { x: 0, y: 9.8, z: 0 } });
            __injectOrientationEvent({ alpha: 0, beta: 45, gamma: 30 }, { absolute: true });
            expect(getOrientationAltitude()).toBeCloseTo(0, 4);
        });

        it('does not depend on alpha or beta/gamma at all, same as the Euler formula', () => {
            __injectMotionEvent({ accelerationIncludingGravity: { x: 0, y: 9.8, z: 0 } });
            __injectOrientationEvent({ alpha: 12, beta: 3, gamma: -60 }, { absolute: true });
            const withOneOrientation = getOrientationAltitude();
            __resetDeviceOrientation();
            __injectMotionEvent({ accelerationIncludingGravity: { x: 0, y: 9.8, z: 0 } });
            __injectOrientationEvent({ alpha: 300, beta: 179, gamma: 88 }, { absolute: true });
            expect(getOrientationAltitude()).toBeCloseTo(withOneOrientation, 4);
        });

        it('falls back to beta/gamma when no motion event has arrived yet', () => {
            __injectOrientationEvent({ alpha: 0, beta: 90, gamma: 0 }, { absolute: true });
            expect(getOrientationAltitude()).toBeCloseTo(0, 4);
        });

        it('falls back when the gravity reading is degenerate (all zero)', () => {
            __injectMotionEvent({ accelerationIncludingGravity: { x: 0, y: 0, z: 0 } });
            __injectOrientationEvent({ alpha: 0, beta: 90, gamma: 0 }, { absolute: true });
            expect(getOrientationAltitude()).toBeCloseTo(0, 4); // the Euler answer for this beta/gamma, not NaN
        });

        it('ignores a motion event with no accelerationIncludingGravity at all', () => {
            __injectMotionEvent({ accelerationIncludingGravity: null });
            __injectOrientationEvent({ alpha: 0, beta: 90, gamma: 0 }, { absolute: true });
            expect(getOrientationAltitude()).toBeCloseTo(0, 4);
        });

        it('keeps the last good gravity reading rather than clearing it on a bad one', () => {
            __injectMotionEvent({ accelerationIncludingGravity: { x: 0, y: 9.8, z: 0 } });
            __injectMotionEvent({ accelerationIncludingGravity: null });
            __injectOrientationEvent({ alpha: 0, beta: 45, gamma: 30 }, { absolute: true });
            expect(getOrientationAltitude()).toBeCloseTo(0, 4); // still the upright reading, not the (wrong) Euler fallback
        });
    });

    describe('heading from Euler angles (no webkitCompassHeading present)', () => {
        it('alpha=0, beta=90, gamma=0 reads heading 0 (north)', () => {
            __injectOrientationEvent({ alpha: 0, beta: 90, gamma: 0 }, { absolute: true });
            expect(getOrientationHeading()).toBeCloseTo(0, 4);
        });

        it('alpha=90, beta=90, gamma=0 reads heading 90 (east)', () => {
            __injectOrientationEvent({ alpha: 90, beta: 90, gamma: 0 }, { absolute: true });
            expect(getOrientationHeading()).toBeCloseTo(90, 4);
        });

        it('alpha=180, beta=90, gamma=0 reads heading 180 (south)', () => {
            __injectOrientationEvent({ alpha: 180, beta: 90, gamma: 0 }, { absolute: true });
            expect(getOrientationHeading()).toBeCloseTo(180, 4);
        });

        it('alpha=270, beta=90, gamma=0 reads heading 270 (west)', () => {
            __injectOrientationEvent({ alpha: 270, beta: 90, gamma: 0 }, { absolute: true });
            expect(getOrientationHeading()).toBeCloseTo(270, 4);
        });

        it('marks the reading as earth-referenced when flagged absolute', () => {
            __injectOrientationEvent({ alpha: 0, beta: 90, gamma: 0 }, { absolute: true });
            expect(isOrientationAbsolute()).toBe(true);
        });

        // Found via a CDP script driving headless Chrome's own
        // DeviceOrientation.setDeviceOrientationOverride: the first
        // deviceorientationabsolute dispatch after setting an override
        // arrives with alpha/beta/gamma all null, before real values start
        // showing up on later events. A version of onAbsoluteEvent that
        // trusted any absolute-flagged event's mere arrival latched onto
        // that null sample and, via receivedAbsolute, permanently ignored
        // the plain deviceorientation events that were about to carry real
        // data — this pins the fix.
        it('ignores a null-valued absolute event rather than latching onto it', () => {
            __injectOrientationEvent({ alpha: null, beta: null, gamma: null }, { absolute: true });
            expect(isOrientationAbsolute()).toBe(false);
            __injectOrientationEvent({ alpha: 30, beta: 90, gamma: 0 }, { absolute: false });
            expect(getOrientationHeading()).toBeCloseTo(30, 4);
        });

        // The same headless-Chrome emulation was also seen dispatching
        // empty *plain* deviceorientation events, independent of any
        // override — not just the absolute variant above. Before this was
        // handled uniformly in handleOrientation, a null event defaulted
        // beta/gamma to 0 ("phone lying flat, facing north"), which is a
        // real, wrong altitude reading (-90°, clamped to the floor by
        // setLookDirection), not a harmless no-op — and it corrupted the
        // smoothed state for every real sample that followed.
        it('ignores a null-valued plain event too, without corrupting a real sample that follows', () => {
            __injectOrientationEvent({ alpha: 0, beta: 90, gamma: 0 }, { absolute: false });
            __injectOrientationEvent({ alpha: null, beta: null, gamma: null }, { absolute: false });
            expect(getOrientationHeading()).toBeCloseTo(0, 4);
            expect(getOrientationAltitude()).toBeCloseTo(0, 4);
        });

        it('marks a plain relative reading as not earth-referenced', () => {
            __injectOrientationEvent({ alpha: 0, beta: 90, gamma: 0 }, { absolute: false });
            expect(isOrientationAbsolute()).toBe(false);
        });
    });

    describe('webkitCompassHeading — used directly, no Euler re-derivation', () => {
        it('passes the value straight through as heading', () => {
            __injectOrientationEvent({ alpha: 123, beta: 45, gamma: -10, webkitCompassHeading: 217 });
            expect(getOrientationHeading()).toBeCloseTo(217, 5);
        });

        it('still computes altitude from beta/gamma independently', () => {
            __injectOrientationEvent({ alpha: 0, beta: 90, gamma: 0, webkitCompassHeading: 217 });
            expect(getOrientationAltitude()).toBeCloseTo(0, 5);
        });

        it('counts as earth-referenced even with no absolute flag (iOS never sets it)', () => {
            __injectOrientationEvent({ alpha: 0, beta: 90, gamma: 0, webkitCompassHeading: 55 }, { absolute: false });
            expect(isOrientationAbsolute()).toBe(true);
        });
    });

    describe('smoothing', () => {
        it('the first sample snaps directly, with no blur to seed from', () => {
            __injectOrientationEvent({ alpha: 45, beta: 90, gamma: 0 }, { absolute: true });
            expect(getOrientationHeading()).toBeCloseTo(45, 4);
        });

        it('eases toward a new heading via the short way around the 0/360 seam', () => {
            __injectOrientationEvent({ alpha: 350, beta: 90, gamma: 0, timeStamp: 0 }, { absolute: true });
            __injectOrientationEvent({ alpha: 10, beta: 90, gamma: 0, timeStamp: 100 }, { absolute: true });
            const h = getOrientationHeading();
            // A naive lerp from 350 toward 10 without wraparound would move
            // *away* from 10 first (350 -> lower numbers, through 180) —
            // the correct short path instead moves up through 360/0.
            const wrappedDistanceFrom350 = Math.min(Math.abs(h - 350), 360 - Math.abs(h - 350));
            expect(wrappedDistanceFrom350).toBeGreaterThan(0);
            expect(wrappedDistanceFrom350).toBeLessThan(15);
        });

        // These three pin the actual point of switching from a flat per-event
        // weight to a time-based one — see TAU_MS's own header in
        // deviceOrientation.js. A flat weight applied to every event
        // regardless of how much real time it covered is what read as
        // "jumpy" during a burst (each one still nudges the full amount, so
        // several events arriving almost at once move the average far more
        // than the little real time between them warrants) and "laggy"
        // after a gap (a stretch with no events left the average stuck, and
        // it took several more flat-weighted steps to close a distance that
        // opened up all at once).
        it('a burst of samples a couple of milliseconds apart barely moves the average', () => {
            __injectOrientationEvent({ alpha: 0, beta: 90, gamma: 0, timeStamp: 0 }, { absolute: true });
            __injectOrientationEvent({ alpha: 90, beta: 90, gamma: 0, timeStamp: 2 }, { absolute: true });
            // 2ms against a 120ms time constant: barely any weight at all.
            expect(getOrientationHeading()).toBeLessThan(5);
        });

        it('a long gap since the last sample lets one new reading catch nearly all the way up', () => {
            __injectOrientationEvent({ alpha: 0, beta: 90, gamma: 0, timeStamp: 0 }, { absolute: true });
            __injectOrientationEvent({ alpha: 90, beta: 90, gamma: 0, timeStamp: 5000 }, { absolute: true });
            // 5s against a 120ms time constant: the old value is stale and
            // the new one should be trusted almost outright.
            expect(getOrientationHeading()).toBeGreaterThan(89);
        });

        it('altitude follows the same time-based weighting as heading', () => {
            __injectOrientationEvent({ alpha: 0, beta: 90, gamma: 0, timeStamp: 0 }, { absolute: true });
            __injectOrientationEvent({ alpha: 0, beta: 0, gamma: 0, timeStamp: 5000 }, { absolute: true });
            // beta=90 -> altitude 0, beta=0 -> altitude -90 (see the
            // hand-worked special cases above); a 5s gap should land close
            // to the new -90 reading rather than lingering near 0.
            expect(getOrientationAltitude()).toBeLessThan(-89);
        });

        it('a malformed timestamp behind the last one moves the average not at all, rather than overshooting', () => {
            __injectOrientationEvent({ alpha: 0, beta: 90, gamma: 0, timeStamp: 1000 }, { absolute: true });
            // An out-of-order or clock-skewed timestamp earlier than the
            // last accepted sample must not compute a negative dt — that
            // would invert the exponent into a weight above 1 and overshoot
            // past the new reading rather than easing toward it.
            __injectOrientationEvent({ alpha: 90, beta: 90, gamma: 0, timeStamp: 500 }, { absolute: true });
            expect(getOrientationHeading()).toBeCloseTo(0, 4);
        });

        it('does not let an out-of-order timestamp inflate the next real sample\'s dt', () => {
            __injectOrientationEvent({ alpha: 0, beta: 90, gamma: 0, timeStamp: 1000 }, { absolute: true });
            __injectOrientationEvent({ alpha: 90, beta: 90, gamma: 0, timeStamp: 500 }, { absolute: true }); // ignored
            // Only 10ms after the *real* last sample (timeStamp: 1000) — a
            // small enough dt that this should barely move the average. If
            // lastSampleAt had instead regressed to the ignored event's 500,
            // this would compute as 510ms since "last sample" instead, long
            // enough to snap most of the way to 100 — so this only passes
            // if the regression genuinely didn't happen, not just because
            // both outcomes would look similar.
            __injectOrientationEvent({ alpha: 100, beta: 90, gamma: 0, timeStamp: 1010 }, { absolute: true });
            expect(getOrientationHeading()).toBeLessThan(20);
        });
    });

    describe('declination', () => {
        it('adds the WMM result to the reported heading', () => {
            magvarMock.mockReturnValue(12.5);
            setDeclinationLocation(51.5, -0.12);
            expect(magvarMock).toHaveBeenCalledWith(51.5, -0.12);
            __injectOrientationEvent({ alpha: 0, beta: 90, gamma: 0 }, { absolute: true });
            expect(getOrientationHeading()).toBeCloseTo(12.5, 4);
        });

        it('does not re-query the model for the same location', () => {
            setDeclinationLocation(10, 20);
            setDeclinationLocation(10, 20);
            expect(magvarMock).toHaveBeenCalledTimes(1);
        });

        it('re-queries when the location actually changes', () => {
            setDeclinationLocation(10, 20);
            setDeclinationLocation(10, 21);
            expect(magvarMock).toHaveBeenCalledTimes(2);
        });

        it('fails safe to no correction if the model throws', () => {
            magvarMock.mockImplementation(() => { throw new Error('out of range'); });
            setDeclinationLocation(89, 179);
            __injectOrientationEvent({ alpha: 0, beta: 90, gamma: 0 }, { absolute: true });
            expect(getOrientationHeading()).toBeCloseTo(0, 4);
        });
    });

    describe('calibration offset', () => {
        it('adds on top of the sensor reading without disturbing it', () => {
            __injectOrientationEvent({ alpha: 0, beta: 90, gamma: 0 }, { absolute: true });
            nudgeCalibrationOffset(15, -3);
            expect(getOrientationHeading()).toBeCloseTo(15, 4);
            expect(getOrientationAltitude()).toBeCloseTo(-3, 4);
        });

        it('wraps the azimuth side, leaves altitude unclamped (setLookDirection does that)', () => {
            __injectOrientationEvent({ alpha: 350, beta: 90, gamma: 0 }, { absolute: true });
            nudgeCalibrationOffset(20, 200);
            expect(getOrientationHeading()).toBeCloseTo(10, 4);
            expect(getOrientationAltitude()).toBeCloseTo(200, 4);
        });

        it('reset zeroes both without touching the underlying sensor reading', () => {
            __injectOrientationEvent({ alpha: 40, beta: 90, gamma: 0 }, { absolute: true });
            nudgeCalibrationOffset(15, 5);
            resetCalibrationOffset();
            expect(getOrientationHeading()).toBeCloseTo(40, 4);
            expect(getOrientationAltitude()).toBeCloseTo(0, 4);
        });
    });

    describe('permission', () => {
        const withRequestPermission = (impl) => {
            const original = window.DeviceOrientationEvent;
            window.DeviceOrientationEvent = impl
                ? Object.assign(function DeviceOrientationEvent() {}, { requestPermission: impl })
                : function DeviceOrientationEvent() {};
            return () => { window.DeviceOrientationEvent = original; };
        };

        it('reports nothing to ask when requestPermission does not exist', async () => {
            const restore = withRequestPermission(null);
            expect(needsOrientationPermission()).toBe(false);
            expect(await requestDeviceOrientationPermission()).toBe(true);
            restore();
        });

        it('resolves true on grant', async () => {
            const restore = withRequestPermission(() => Promise.resolve('granted'));
            expect(needsOrientationPermission()).toBe(true);
            expect(await requestDeviceOrientationPermission()).toBe(true);
            restore();
        });

        it('resolves false on denial rather than throwing', async () => {
            const restore = withRequestPermission(() => Promise.resolve('denied'));
            expect(await requestDeviceOrientationPermission()).toBe(false);
            restore();
        });

        it('resolves false, not a rejection, if the browser call itself throws', async () => {
            const restore = withRequestPermission(() => Promise.reject(new Error('nope')));
            await expect(requestDeviceOrientationPermission()).resolves.toBe(false);
            restore();
        });

        // DeviceMotionEvent has its own, separate requestPermission() static
        // — altitudeFromGravity's own reading depends on it, even though
        // iOS's own system UI often shows one combined prompt for both.
        const withMotionRequestPermission = (impl) => {
            const original = window.DeviceMotionEvent;
            window.DeviceMotionEvent = impl
                ? Object.assign(function DeviceMotionEvent() {}, { requestPermission: impl })
                : undefined;
            return () => { window.DeviceMotionEvent = original; };
        };

        it('also requests motion permission when both exist, and still resolves true on an orientation grant', async () => {
            const motionRequest = vi.fn(() => Promise.resolve('granted'));
            const restoreOrientation = withRequestPermission(() => Promise.resolve('granted'));
            const restoreMotion = withMotionRequestPermission(motionRequest);
            expect(await requestDeviceOrientationPermission()).toBe(true);
            expect(motionRequest).toHaveBeenCalledTimes(1);
            restoreMotion();
            restoreOrientation();
        });

        it('a denied or missing motion permission does not fail an otherwise-successful orientation grant', async () => {
            const restoreOrientation = withRequestPermission(() => Promise.resolve('granted'));
            const restoreMotion = withMotionRequestPermission(() => Promise.reject(new Error('nope')));
            expect(await requestDeviceOrientationPermission()).toBe(true);
            restoreMotion();
            restoreOrientation();
        });

        it('skips the motion request cleanly when DeviceMotionEvent does not exist', async () => {
            const restoreOrientation = withRequestPermission(() => Promise.resolve('granted'));
            const restoreMotion = withMotionRequestPermission(null);
            expect(await requestDeviceOrientationPermission()).toBe(true);
            restoreMotion();
            restoreOrientation();
        });
    });

    describe('subscribe', () => {
        it('notifies on a new sensor sample', () => {
            const fn = vi.fn();
            const unsub = subscribeDeviceOrientation(fn);
            __injectOrientationEvent({ alpha: 0, beta: 90, gamma: 0 }, { absolute: true });
            expect(fn).toHaveBeenCalled();
            unsub();
        });

        it('notifies on a calibration nudge', () => {
            const fn = vi.fn();
            const unsub = subscribeDeviceOrientation(fn);
            nudgeCalibrationOffset(5, 0);
            expect(fn).toHaveBeenCalled();
            unsub();
        });

        it('stops notifying after unsubscribing', () => {
            const fn = vi.fn();
            const unsub = subscribeDeviceOrientation(fn);
            unsub();
            __injectOrientationEvent({ alpha: 0, beta: 90, gamma: 0 }, { absolute: true });
            expect(fn).not.toHaveBeenCalled();
        });
    });
});
