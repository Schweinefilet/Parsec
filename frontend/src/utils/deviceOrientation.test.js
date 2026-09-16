import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import * as THREE from 'three';

// vi.hoisted(), not a plain top-level const — vi.mock()'s factory runs
// before ordinary module-scope initialization, so a plainly-declared
// magvarMock would still be in its temporal dead zone the first time the
// factory closes over it.
const { magvarMock } = vi.hoisted(() => ({ magvarMock: vi.fn(() => 0) }));
vi.mock('magvar', () => ({ magvar: (...args) => magvarMock(...args) }));

import {
    getOrientationHeading, getOrientationAltitude, getOrientationRoll,
    isOrientationAbsolute, nudgeCalibrationOffset, resetCalibrationOffset,
    setDeclinationLocation, needsOrientationPermission,
    requestDeviceOrientationPermission, subscribeDeviceOrientation,
    __injectOrientationEvent, __resetDeviceOrientation,
} from './deviceOrientation.js';

const DEG2RAD = Math.PI / 180;

// The spec's own device -> ENU rotation (x=east, y=north, z=up), built here
// independently of the module so these tests can reason about where a
// physical device is actually pointing rather than re-run the module's
// extraction against itself.
function deviceRotation(alpha, beta, gamma) {
    return new THREE.Quaternion().setFromEuler(
        new THREE.Euler(beta * DEG2RAD, gamma * DEG2RAD, alpha * DEG2RAD, 'ZXY'),
    );
}
const backCamera = (a, b, g) => new THREE.Vector3(0, 0, -1).applyQuaternion(deviceRotation(a, b, g));
const deviceTop = (a, b, g) => new THREE.Vector3(0, 1, 0).applyQuaternion(deviceRotation(a, b, g));
const bearing = v => ((Math.atan2(v.x, v.y) * 180) / Math.PI + 360) % 360;
/** ENU -> the night sky scene's own basis (x=east, y=zenith, z=south). */
const toScene = v => new THREE.Vector3(v.x, v.z, -v.y);

describe('deviceOrientation', () => {
    beforeEach(() => {
        __resetDeviceOrientation();
        magvarMock.mockReset();
        magvarMock.mockReturnValue(0);
    });
    afterEach(() => { __resetDeviceOrientation(); });

    // ── The physical facts ───────────────────────────────────────────────
    // Every case below is one whose right answer can be reasoned out from
    // the geometry without touching the formula: where a phone in a
    // describable pose is actually pointing. These are what caught the bug
    // this module was rewritten for (a mirrored heading whose own tests
    // asserted the mirror), so they are stated as physical claims first and
    // numbers second.

    describe('altitude — where the back camera points', () => {
        it('flat on a table, screen up: the camera faces the floor, -90', () => {
            __injectOrientationEvent({ alpha: 0, beta: 0, gamma: 0 });
            expect(getOrientationAltitude()).toBeCloseTo(-90, 5);
        });

        it('upright, the AR "magic window" hold: level with the horizon, 0', () => {
            __injectOrientationEvent({ alpha: 0, beta: 90, gamma: 0 });
            expect(getOrientationAltitude()).toBeCloseTo(0, 5);
        });

        it('flat, screen down: the camera faces the zenith, +90', () => {
            __injectOrientationEvent({ alpha: 0, beta: 180, gamma: 0 });
            expect(getOrientationAltitude()).toBeCloseTo(90, 5);
        });

        it('tilted back halfway reads halfway up', () => {
            __injectOrientationEvent({ alpha: 0, beta: 135, gamma: 0 });
            expect(getOrientationAltitude()).toBeCloseTo(45, 5);
        });

        it('never runs past the zenith — a camera axis cannot point more than straight up', () => {
            for (const beta of [-170, -90, -20, 0, 45, 90, 135, 180, 200, 300]) {
                __resetDeviceOrientation();
                __injectOrientationEvent({ alpha: 17, beta, gamma: 23 });
                expect(getOrientationAltitude()).toBeGreaterThanOrEqual(-90.0001);
                expect(getOrientationAltitude()).toBeLessThanOrEqual(90.0001);
            }
        });

        it('does not depend on alpha at all', () => {
            __injectOrientationEvent({ alpha: 37, beta: 62, gamma: 0 });
            const withAlpha37 = getOrientationAltitude();
            __resetDeviceOrientation();
            __injectOrientationEvent({ alpha: 260, beta: 62, gamma: 0 });
            expect(getOrientationAltitude()).toBeCloseTo(withAlpha37, 5);
        });
    });

    describe('heading — which way the back camera faces', () => {
        // Alpha is a counter-clockwise rotation about the up axis and
        // compass bearings run clockwise, so an upright phone reads
        // heading = 360 - alpha. The version of this module these tests
        // replace asserted heading = alpha, which mirrors the whole sky
        // across the north-south line; all four cardinals are listed so the
        // mirror cannot pass again by agreeing with itself.
        it('alpha=0, upright: north', () => {
            __injectOrientationEvent({ alpha: 0, beta: 90, gamma: 0 });
            expect(getOrientationHeading()).toBeCloseTo(0, 4);
        });

        it('alpha=90, upright: west, not east', () => {
            __injectOrientationEvent({ alpha: 90, beta: 90, gamma: 0 });
            expect(getOrientationHeading()).toBeCloseTo(270, 4);
        });

        it('alpha=180, upright: south', () => {
            __injectOrientationEvent({ alpha: 180, beta: 90, gamma: 0 });
            expect(getOrientationHeading()).toBeCloseTo(180, 4);
        });

        it('alpha=270, upright: east', () => {
            __injectOrientationEvent({ alpha: 270, beta: 90, gamma: 0 });
            expect(getOrientationHeading()).toBeCloseTo(90, 4);
        });

        it('agrees with the independently-built rotation for arbitrary poses', () => {
            for (const [a, b, g] of [[37, 52, -19], [210, 123, 64], [300, 71, 80], [12, 95, -4]]) {
                __resetDeviceOrientation();
                __injectOrientationEvent({ alpha: a, beta: b, gamma: g });
                expect(getOrientationHeading()).toBeCloseTo(bearing(backCamera(a, b, g)), 4);
            }
        });
    });

    describe('roll — how far the screen is spun about the axis it looks along', () => {
        it('is zero for an upright, untilted hold', () => {
            __injectOrientationEvent({ alpha: 0, beta: 90, gamma: 0 });
            expect(getOrientationRoll()).toBeCloseTo(0, 4);
        });

        it('is zero whatever the heading and pitch, as long as the phone is not tilted sideways', () => {
            for (const [a, b] of [[0, 45], [130, 120], [285, 20], [90, 160]]) {
                __resetDeviceOrientation();
                __injectOrientationEvent({ alpha: a, beta: b, gamma: 0 });
                expect(getOrientationRoll()).toBeCloseTo(0, 3);
            }
        });

        it('reads -90 with the phone turned onto its side, top edge to the east', () => {
            // alpha=270, beta=0, gamma=90 rolls a flat phone onto its long
            // edge: the camera comes up to the horizon facing north, and the
            // top of the screen swings round to point east.
            __injectOrientationEvent({ alpha: 270, beta: 0, gamma: 90 });
            expect(getOrientationHeading()).toBeCloseTo(0, 3);
            expect(getOrientationAltitude()).toBeCloseTo(0, 3);
            expect(getOrientationRoll()).toBeCloseTo(-90, 3);
        });

        it('follows the layout when the screen itself rotates', () => {
            // Same physical pose as the upright hold above, but with the page
            // rotated into landscape: "up the screen" is now the device's
            // right edge, which is 90 degrees round from where it was.
            const screenObj = window.screen;
            Object.defineProperty(window, 'screen', {
                value: { ...screenObj, orientation: { angle: 90, type: 'landscape-primary' } },
                configurable: true,
            });
            try {
                __injectOrientationEvent({ alpha: 0, beta: 90, gamma: 0 });
                expect(getOrientationRoll()).toBeCloseTo(-90, 3);
            } finally {
                Object.defineProperty(window, 'screen', { value: screenObj, configurable: true });
            }
        });
    });

    describe('the camera the scene actually builds from these three numbers', () => {
        // The contract with NightSky3D.jsx, end to end: it composes
        // camera.rotation.set(altitude, -azimuth, roll, 'YXZ') in a scene
        // whose basis is x=east, y=zenith, z=south, and points the camera
        // down its own -Z with +Y up the screen. Reconstructing that here
        // and comparing against where the device is independently known to
        // be pointing is the one test that would have failed for every
        // broken version of this module, including the ones whose own
        // altitude and heading tests passed.
        const sceneCamera = () => {
            const e = new THREE.Euler(
                getOrientationAltitude() * DEG2RAD,
                -getOrientationHeading() * DEG2RAD,
                getOrientationRoll() * DEG2RAD,
                'YXZ',
            );
            return {
                forward: new THREE.Vector3(0, 0, -1).applyEuler(e),
                up: new THREE.Vector3(0, 1, 0).applyEuler(e),
            };
        };

        it('points where the phone points, and is upright the way the phone is', () => {
            const poses = [
                [0, 90, 0], [90, 90, 0], [180, 45, 0], [270, 135, 0],
                [37, 52, -19], [210, 123, 64], [300, 71, 80], [12, 95, -40],
                [145, 20, 33], [88, 170, -70],
            ];
            for (const [a, b, g] of poses) {
                __resetDeviceOrientation();
                __injectOrientationEvent({ alpha: a, beta: b, gamma: g });
                const cam = sceneCamera();
                const wantForward = toScene(backCamera(a, b, g));
                const wantUp = toScene(deviceTop(a, b, g));
                expect(cam.forward.angleTo(wantForward) * 180 / Math.PI).toBeLessThan(0.01);
                expect(cam.up.angleTo(wantUp) * 180 / Math.PI).toBeLessThan(0.01);
            }
        });

        it('holds through the zenith, where heading and roll are each ill-conditioned', () => {
            // beta sweeping past 180 takes the camera straight up and out the
            // far side. Heading is meaningless at the pole itself and roll
            // absorbs whatever it does there; the composed camera is what has
            // to stay right, and does.
            for (const beta of [176, 178, 179.5, 180, 180.5, 182, 184]) {
                __resetDeviceOrientation();
                __injectOrientationEvent({ alpha: 40, beta, gamma: 3 });
                const cam = sceneCamera();
                expect(cam.forward.angleTo(toScene(backCamera(40, beta, 3))) * 180 / Math.PI)
                    .toBeLessThan(0.05);
                expect(cam.up.angleTo(toScene(deviceTop(40, beta, 3))) * 180 / Math.PI)
                    .toBeLessThan(0.05);
            }
        });
    });

    describe('empty and partial events', () => {
        it('marks the reading as earth-referenced when flagged absolute', () => {
            __injectOrientationEvent({ alpha: 10, beta: 90, gamma: 0 }, { absolute: true });
            expect(isOrientationAbsolute()).toBe(true);
        });

        it('marks a plain relative reading as not earth-referenced', () => {
            __injectOrientationEvent({ alpha: 10, beta: 90, gamma: 0 });
            expect(isOrientationAbsolute()).toBe(false);
        });

        it('ignores a null-valued absolute event rather than latching onto it', () => {
            __injectOrientationEvent({ alpha: null, beta: null, gamma: null }, { absolute: true });
            // The plain listener must still be live: an empty absolute event
            // is not proof the absolute stream carries anything.
            __injectOrientationEvent({ alpha: 90, beta: 90, gamma: 0 });
            expect(getOrientationHeading()).toBeCloseTo(270, 4);
        });

        it('ignores a null-valued plain event too, without corrupting a real sample that follows', () => {
            __injectOrientationEvent({ alpha: null, beta: null, gamma: null });
            __injectOrientationEvent({ alpha: 0, beta: 90, gamma: 0 });
            expect(getOrientationAltitude()).toBeCloseTo(0, 4);
        });

        it('defers to the absolute stream once it has proven itself', () => {
            __injectOrientationEvent({ alpha: 0, beta: 90, gamma: 0 }, { absolute: true });
            __injectOrientationEvent({ alpha: 180, beta: 90, gamma: 0 });
            expect(getOrientationHeading()).toBeCloseTo(0, 4); // the plain event was dropped
        });
    });

    describe('webkitCompassHeading — iOS\'s north, as an anchor rather than a substitute', () => {
        it('an upright phone reads the compass bearing it was handed', () => {
            __injectOrientationEvent({ alpha: 0, beta: 90, gamma: 0, webkitCompassHeading: 130 });
            expect(getOrientationHeading()).toBeCloseTo(130, 3);
        });

        it('counts as earth-referenced even with no absolute flag (iOS never sets one)', () => {
            __injectOrientationEvent({ alpha: 0, beta: 90, gamma: 0, webkitCompassHeading: 42 });
            expect(isOrientationAbsolute()).toBe(true);
        });

        it('turning the phone turns the reported heading with it', () => {
            __injectOrientationEvent({
                alpha: 0, beta: 90, gamma: 0, webkitCompassHeading: 100, timeStamp: 0,
            });
            // Physically turned 30 degrees clockwise: alpha falls by 30 (it
            // runs the other way), the compass rises by 30.
            __injectOrientationEvent({
                alpha: 330, beta: 90, gamma: 0, webkitCompassHeading: 130, timeStamp: 4000,
            });
            expect(getOrientationHeading()).toBeCloseTo(130, 1);
        });

        it('rides through both of iOS\'s reference switches without a pole jump', () => {
            // A phone raised smoothly from flat to pointing straight up, with
            // alpha offset from true north by a constant the module has to
            // solve for. webkitCompassHeading is modelled the way iOS
            // behaves: the bearing of whichever device axis is nearer
            // horizontal, which swaps at 45 and 135 degrees of pitch.
            const K = 130;   // how far iOS's arbitrary alpha zero sits from north
            const gamma = 4; // a real hand is never at exactly zero roll
            let t = 0;
            let previous = null;
            for (let beta = 2; beta <= 178; beta += 2) {
                const alphaTrue = 200;
                const cam = backCamera(alphaTrue, beta, gamma);
                const top = deviceTop(alphaTrue, beta, gamma);
                const camFlat = Math.hypot(cam.x, cam.y);
                const topFlat = Math.hypot(top.x, top.y);
                const webkit = bearing(camFlat >= topFlat ? cam : top);
                t += 400;
                __injectOrientationEvent({
                    alpha: ((alphaTrue - K) % 360 + 360) % 360,
                    beta,
                    gamma,
                    webkitCompassHeading: webkit,
                    timeStamp: t,
                });
                const reported = getOrientationHeading();
                // Tracks the camera's real bearing all the way up...
                expect(Math.abs((((reported - bearing(cam)) % 360) + 540) % 360 - 180))
                    .toBeLessThan(2);
                // ...and never lurches, including across either switch.
                if (previous !== null) {
                    const step = Math.abs((((reported - previous) % 360) + 540) % 360 - 180);
                    // Near the zenith the camera's own bearing legitimately
                    // swings fast; the point is that it never flips by 180.
                    expect(step).toBeLessThan(100);
                }
                previous = reported;
            }
        });
    });

    describe('smoothing', () => {
        it('the first sample snaps directly, with no blur to seed from', () => {
            __injectOrientationEvent({ alpha: 270, beta: 90, gamma: 0, timeStamp: 1000 });
            expect(getOrientationHeading()).toBeCloseTo(90, 4);
        });

        it('eases toward a new heading rather than jumping to it', () => {
            __injectOrientationEvent({ alpha: 0, beta: 90, gamma: 0, timeStamp: 0 });
            __injectOrientationEvent({ alpha: 300, beta: 90, gamma: 0, timeStamp: 60 });
            const h = getOrientationHeading();
            // Target is 60 (= 360 - 300); one 60ms step at tau=120 closes
            // about 39% of the way there.
            expect(h).toBeGreaterThan(10);
            expect(h).toBeLessThan(50);
        });

        it('takes the short way around the 0/360 seam', () => {
            // From 350 toward 10: a plain average would sweep back through
            // 180, the long way round.
            __injectOrientationEvent({ alpha: 10, beta: 90, gamma: 0, timeStamp: 0 });   // heading 350
            __injectOrientationEvent({ alpha: 350, beta: 90, gamma: 0, timeStamp: 60 }); // heading 10
            const h = getOrientationHeading();
            expect(h > 350 || h < 10).toBe(true);
        });

        it('a burst of samples a couple of milliseconds apart barely moves the average', () => {
            __injectOrientationEvent({ alpha: 0, beta: 90, gamma: 0, timeStamp: 0 });
            for (let i = 1; i <= 5; i++) {
                __injectOrientationEvent({ alpha: 270, beta: 90, gamma: 0, timeStamp: i * 2 });
            }
            expect(getOrientationHeading()).toBeLessThan(10);
        });

        it('a long gap since the last sample lets one new reading catch nearly all the way up', () => {
            __injectOrientationEvent({ alpha: 0, beta: 90, gamma: 0, timeStamp: 0 });
            __injectOrientationEvent({ alpha: 270, beta: 90, gamma: 0, timeStamp: 1000 });
            expect(getOrientationHeading()).toBeCloseTo(90, 1);
        });

        it('altitude follows the same time-based weighting as heading', () => {
            __injectOrientationEvent({ alpha: 0, beta: 90, gamma: 0, timeStamp: 0 });
            __injectOrientationEvent({ alpha: 0, beta: 180, gamma: 0, timeStamp: 1000 });
            expect(getOrientationAltitude()).toBeCloseTo(90, 1);
        });

        it('a malformed timestamp behind the last one moves the average not at all', () => {
            __injectOrientationEvent({ alpha: 0, beta: 90, gamma: 0, timeStamp: 5000 });
            __injectOrientationEvent({ alpha: 180, beta: 90, gamma: 0, timeStamp: 4000 });
            expect(getOrientationHeading()).toBeCloseTo(0, 4);
        });

        it('does not let an out-of-order timestamp inflate the next real sample\'s dt', () => {
            __injectOrientationEvent({ alpha: 0, beta: 90, gamma: 0, timeStamp: 5000 });
            __injectOrientationEvent({ alpha: 180, beta: 90, gamma: 0, timeStamp: 0 });
            __injectOrientationEvent({ alpha: 270, beta: 90, gamma: 0, timeStamp: 5060 });
            // Toward heading 90, weighted by the 60ms of real time since the
            // last accepted sample rather than the 5060 the rejected one
            // would have opened up — about a third of the way, not all of it.
            const h = getOrientationHeading();
            expect(h).toBeGreaterThan(20);
            expect(h).toBeLessThan(50);
        });

        it('smooths the rotation itself, so a pass through the zenith stays on course', () => {
            // Heading and roll each swing hard here while the rotation they
            // describe barely moves; averaging them separately wobbles, and
            // slerping does not. Checked against the composed camera, since
            // that is the thing that has to stay right.
            let t = 0;
            for (let beta = 150; beta <= 210; beta += 2) {
                t += 40;
                __injectOrientationEvent({ alpha: 40, beta, gamma: 5, timeStamp: t });
                const e = new THREE.Euler(
                    getOrientationAltitude() * DEG2RAD,
                    -getOrientationHeading() * DEG2RAD,
                    getOrientationRoll() * DEG2RAD,
                    'YXZ',
                );
                const forward = new THREE.Vector3(0, 0, -1).applyEuler(e);
                // Within ordinary smoothing lag of where the phone is: a
                // 2-degree step every 40ms at tau=120 trails by a couple of
                // degrees, never by the tens a wobble would produce.
                const lag = forward.angleTo(toScene(backCamera(40, beta, 5))) * 180 / Math.PI;
                expect(lag).toBeLessThan(6);
            }
        });
    });

    describe('declination', () => {
        it('adds the WMM result to the reported heading', () => {
            magvarMock.mockReturnValue(12);
            setDeclinationLocation(51.5, -0.12);
            __injectOrientationEvent({ alpha: 0, beta: 90, gamma: 0 });
            expect(getOrientationHeading()).toBeCloseTo(12, 4);
        });

        it('does not re-query the model for the same location', () => {
            setDeclinationLocation(51.5, -0.12);
            setDeclinationLocation(51.5, -0.12);
            expect(magvarMock).toHaveBeenCalledTimes(1);
        });

        it('re-queries when the location actually changes', () => {
            setDeclinationLocation(51.5, -0.12);
            setDeclinationLocation(40.7, -74);
            expect(magvarMock).toHaveBeenCalledTimes(2);
        });

        it('fails safe to no correction if the model throws', () => {
            magvarMock.mockImplementation(() => { throw new Error('out of range'); });
            setDeclinationLocation(999, 999);
            __injectOrientationEvent({ alpha: 0, beta: 90, gamma: 0 });
            expect(getOrientationHeading()).toBeCloseTo(0, 4);
        });
    });

    describe('calibration offset', () => {
        it('adds on top of the sensor reading without disturbing it', () => {
            __injectOrientationEvent({ alpha: 0, beta: 90, gamma: 0 });
            nudgeCalibrationOffset(15, -5);
            expect(getOrientationHeading()).toBeCloseTo(15, 4);
            expect(getOrientationAltitude()).toBeCloseTo(-5, 4);
        });

        it('wraps the azimuth side, leaves altitude unclamped (setLookDirection does that)', () => {
            __injectOrientationEvent({ alpha: 0, beta: 90, gamma: 0 });
            nudgeCalibrationOffset(-30, 200);
            expect(getOrientationHeading()).toBeCloseTo(330, 4);
            expect(getOrientationAltitude()).toBeCloseTo(200, 4);
        });

        it('reset zeroes both without touching the underlying sensor reading', () => {
            __injectOrientationEvent({ alpha: 270, beta: 90, gamma: 0 });
            nudgeCalibrationOffset(40, 10);
            resetCalibrationOffset();
            expect(getOrientationHeading()).toBeCloseTo(90, 4);
            expect(getOrientationAltitude()).toBeCloseTo(0, 4);
        });
    });

    describe('permission', () => {
        const withDeviceOrientationEvent = (value) => {
            const had = 'DeviceOrientationEvent' in window;
            const before = window.DeviceOrientationEvent;
            window.DeviceOrientationEvent = value;
            return () => {
                if (had) window.DeviceOrientationEvent = before;
                else delete window.DeviceOrientationEvent;
            };
        };

        it('reports nothing to ask when requestPermission does not exist', async () => {
            const restore = withDeviceOrientationEvent(function DOE() {});
            try {
                expect(needsOrientationPermission()).toBe(false);
                await expect(requestDeviceOrientationPermission()).resolves.toBe(true);
            } finally { restore(); }
        });

        it('resolves true on grant', async () => {
            const restore = withDeviceOrientationEvent({
                requestPermission: () => Promise.resolve('granted'),
            });
            try {
                expect(needsOrientationPermission()).toBe(true);
                await expect(requestDeviceOrientationPermission()).resolves.toBe(true);
            } finally { restore(); }
        });

        it('resolves false on denial rather than throwing', async () => {
            const restore = withDeviceOrientationEvent({
                requestPermission: () => Promise.resolve('denied'),
            });
            try {
                await expect(requestDeviceOrientationPermission()).resolves.toBe(false);
            } finally { restore(); }
        });

        it('resolves false, not a rejection, if the browser call itself throws', async () => {
            const restore = withDeviceOrientationEvent({
                requestPermission: () => Promise.reject(new Error('needs a user gesture')),
            });
            try {
                await expect(requestDeviceOrientationPermission()).resolves.toBe(false);
            } finally { restore(); }
        });
    });

    describe('subscribe', () => {
        it('notifies on a new sensor sample', () => {
            const fn = vi.fn();
            subscribeDeviceOrientation(fn);
            __injectOrientationEvent({ alpha: 0, beta: 90, gamma: 0 });
            expect(fn).toHaveBeenCalled();
        });

        it('notifies on a calibration nudge', () => {
            const fn = vi.fn();
            subscribeDeviceOrientation(fn);
            nudgeCalibrationOffset(5, 0);
            expect(fn).toHaveBeenCalledTimes(1);
        });

        it('stops notifying after unsubscribing', () => {
            const fn = vi.fn();
            const off = subscribeDeviceOrientation(fn);
            off();
            __injectOrientationEvent({ alpha: 0, beta: 90, gamma: 0 });
            expect(fn).not.toHaveBeenCalled();
        });
    });
});
