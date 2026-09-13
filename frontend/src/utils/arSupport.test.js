import { describe, it, expect, afterEach } from 'vitest';
import { isArViewerSupported } from './arSupport';

const withMatchMedia = (coarse) => {
    const original = window.matchMedia;
    window.matchMedia = (query) => ({
        matches: query === '(pointer: coarse)' ? coarse : false,
        media: query,
        addEventListener() {}, removeEventListener() {},
    });
    return () => { window.matchMedia = original; };
};

const withDeviceOrientationEvent = (present) => {
    const had = 'DeviceOrientationEvent' in window;
    const original = window.DeviceOrientationEvent;
    if (present) window.DeviceOrientationEvent = function DeviceOrientationEvent() {};
    else delete window.DeviceOrientationEvent;
    return () => {
        if (had) window.DeviceOrientationEvent = original;
        else delete window.DeviceOrientationEvent;
    };
};

const withGetUserMedia = (present) => {
    const original = navigator.mediaDevices;
    Object.defineProperty(navigator, 'mediaDevices', {
        value: present ? { getUserMedia: () => {} } : undefined,
        configurable: true,
    });
    return () => Object.defineProperty(navigator, 'mediaDevices', { value: original, configurable: true });
};

describe('isArViewerSupported', () => {
    afterEach(() => {});

    it('is true on a touchscreen with both APIs', () => {
        const r1 = withMatchMedia(true);
        const r2 = withDeviceOrientationEvent(true);
        const r3 = withGetUserMedia(true);
        expect(isArViewerSupported()).toBe(true);
        r3(); r2(); r1();
    });

    it('is false on a mouse/trackpad device, even with both APIs present', () => {
        // A narrow desktop window is the exact false-positive useIsMobile()
        // would give — this is why the probe leads with (pointer: coarse).
        const r1 = withMatchMedia(false);
        const r2 = withDeviceOrientationEvent(true);
        const r3 = withGetUserMedia(true);
        expect(isArViewerSupported()).toBe(false);
        r3(); r2(); r1();
    });

    it('is false without DeviceOrientationEvent', () => {
        const r1 = withMatchMedia(true);
        const r2 = withDeviceOrientationEvent(false);
        const r3 = withGetUserMedia(true);
        expect(isArViewerSupported()).toBe(false);
        r3(); r2(); r1();
    });

    it('is false without getUserMedia', () => {
        const r1 = withMatchMedia(true);
        const r2 = withDeviceOrientationEvent(true);
        const r3 = withGetUserMedia(false);
        expect(isArViewerSupported()).toBe(false);
        r3(); r2(); r1();
    });
});
