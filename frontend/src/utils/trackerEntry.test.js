import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import * as THREE from 'three';
import {
    IDLE, ARMED, APPROACHING, HANDOFF, SETTLING, FRAME_FRACTION,
    handoffDistance, armTrackerEntry, getTrackerPhase, getTrackerSnapshot,
    getTrackerSatId, isTrackerArriving, isTrackerGlobeReady, markTrackerGlobeReady,
    setTrackerSnapshot, setTrackerPhase, resetTrackerEntry, subscribeTracker,
    __resetTrackerEntry,
} from './trackerEntry';
import { subsolar, latLonToVec3 } from './subsolar';

beforeEach(() => { vi.useFakeTimers(); __resetTrackerEntry(); });
afterEach(() => { vi.useRealTimers(); });

// The whole hand-off rests on these two numbers agreeing. SatelliteGlobe
// frames Earth with a 38° camera at 3.89 radii, which is where its
// (0, 2.4, 7.4) came from; the solar scene has to solve its own 45° camera
// for the same share of the frame or the cut is between two different sizes.
describe('the framing contract', () => {
    it('reproduces the globe\'s existing framing at its own fov', () => {
        expect(handoffDistance(38)).toBeCloseTo(3.89, 2);
        // 7.78 is |(0, 2.4, 7.4)|, the distance the globe has always opened at
        expect(handoffDistance(38) * 2).toBeCloseTo(7.78, 1);
    });

    it('solves the solar scene\'s wider camera for the same share of frame', () => {
        expect(handoffDistance(45)).toBeCloseTo(3.30, 2);
    });

    it('puts the disc across FRAME_FRACTION of the vertical fov, at any fov', () => {
        for (const fov of [30, 38, 45, 60]) {
            const d = handoffDistance(fov);
            const discDeg = 2 * Math.asin(1 / d) * 180 / Math.PI;
            expect(discDeg / fov).toBeCloseTo(FRAME_FRACTION, 6);
        }
    });

    it('is further out for a narrower camera', () => {
        expect(handoffDistance(30)).toBeGreaterThan(handoffDistance(45));
    });
});

describe('the phase machine', () => {
    it('starts idle and arms once', () => {
        expect(getTrackerPhase()).toBe(IDLE);
        armTrackerEntry();
        expect(getTrackerPhase()).toBe(ARMED);
        setTrackerPhase(APPROACHING);
        armTrackerEntry();            // a second click mid-sequence
        expect(getTrackerPhase()).toBe(APPROACHING);
    });

    it('carries the requested craft, and forgets it on reset', () => {
        armTrackerEntry('hubble');
        expect(getTrackerSatId()).toBe('hubble');
        resetTrackerEntry();
        expect(getTrackerSatId()).toBeNull();
    });

    it('only counts handoff and settling as arriving', () => {
        expect(isTrackerArriving()).toBe(false);
        armTrackerEntry();
        expect(isTrackerArriving()).toBe(false);   // still flying, scene-side
        setTrackerPhase(HANDOFF);
        expect(isTrackerArriving()).toBe(true);
        setTrackerPhase(SETTLING);
        expect(isTrackerArriving()).toBe(true);
        setTrackerPhase(IDLE);
        expect(isTrackerArriving()).toBe(false);
    });

    it('drops the captured frame when it goes idle, so the next arm is clean', () => {
        armTrackerEntry();
        setTrackerSnapshot('data:image/jpeg;base64,abc');
        expect(getTrackerSnapshot()).toBe('data:image/jpeg;base64,abc');
        resetTrackerEntry();
        expect(getTrackerSnapshot()).toBeNull();
    });

    it('notifies subscribers on a phase change and stops after unsubscribe', () => {
        const seen = [];
        const unsub = subscribeTracker(() => seen.push(getTrackerPhase()));
        armTrackerEntry();
        setTrackerPhase(HANDOFF);
        expect(seen).toEqual([ARMED, HANDOFF]);
        unsub();
        setTrackerPhase(IDLE);
        expect(seen).toHaveLength(2);
    });

    it('lands on the tracker anyway if the scene never picks the flag up', () => {
        armTrackerEntry();
        vi.advanceTimersByTime(20000);
        expect(getTrackerPhase()).toBe(HANDOFF);
    });

    it('does not fire the watchdog once the sequence has got there on its own', () => {
        armTrackerEntry();
        setTrackerPhase(APPROACHING);
        setTrackerPhase(HANDOFF);
        setTrackerPhase(SETTLING);
        vi.advanceTimersByTime(20000);
        expect(getTrackerPhase()).toBe(SETTLING);
    });
});

describe('the globe-ready handshake', () => {
    it('is false until the globe has drawn, and clears on the next arm', () => {
        armTrackerEntry();
        expect(isTrackerGlobeReady()).toBe(false);
        markTrackerGlobeReady();
        expect(isTrackerGlobeReady()).toBe(true);
        resetTrackerEntry();
        armTrackerEntry();
        expect(isTrackerGlobeReady()).toBe(false);
    });

    it('notifies, so a waiting cross-fade is woken rather than polled', () => {
        let hits = 0;
        subscribeTracker(() => { hits += 1; });
        markTrackerGlobeReady();
        expect(hits).toBe(1);
        markTrackerGlobeReady();     // idempotent
        expect(hits).toBe(1);
    });
});

// Both scenes centre the frame on this point, each computing it for itself.
// If they ever disagreed the planet would jump at the cut, so the shared
// module is the thing under test here as much as the formula.
describe('the sub-solar point both sides aim at', () => {
    it('stays within the tropics', () => {
        for (let m = 0; m < 12; m++) {
            const { lat } = subsolar(new Date(Date.UTC(2026, m, 15, 12, 0, 0)));
            expect(Math.abs(lat)).toBeLessThanOrEqual(23.45);
        }
    });

    it('is north of the equator in June and south in December', () => {
        expect(subsolar(new Date(Date.UTC(2026, 5, 21, 12))).lat).toBeGreaterThan(20);
        expect(subsolar(new Date(Date.UTC(2026, 11, 21, 12))).lat).toBeLessThan(-20);
    });

    it('tracks west at about 15° an hour', () => {
        const a = subsolar(new Date(Date.UTC(2026, 3, 1, 0, 0)));
        const b = subsolar(new Date(Date.UTC(2026, 3, 1, 1, 0)));
        let d = a.lon - b.lon;
        if (d < -180) d += 360;
        if (d > 180) d -= 360;
        expect(d).toBeCloseTo(15, 0);
    });

    it('is near the anti-meridian at 00:00 UTC and near Greenwich at noon', () => {
        expect(Math.abs(subsolar(new Date(Date.UTC(2026, 3, 1, 0, 0))).lon)).toBeGreaterThan(175);
        expect(Math.abs(subsolar(new Date(Date.UTC(2026, 3, 1, 12, 0))).lon)).toBeLessThan(5);
    });
});

describe('the lat/lon convention the two scenes share', () => {
    const v = (lat, lon, r = 1) => latLonToVec3(lat, lon, r, new THREE.Vector3());

    it('puts north at +Y', () => {
        const n = v(90, 0);
        expect(n.y).toBeCloseTo(1, 6);
        expect(n.x).toBeCloseTo(0, 6);
        expect(n.z).toBeCloseTo(0, 6);
    });

    it('puts 0°N 0°E at +X and 90°E at −Z', () => {
        expect(v(0, 0).x).toBeCloseTo(1, 6);
        expect(v(0, 90).z).toBeCloseTo(-1, 6);
    });

    it('scales by the radius and stays on the sphere', () => {
        for (const [lat, lon] of [[0, 0], [45, 120], [-30, -75], [12, 179]]) {
            expect(v(lat, lon, 2.5).length()).toBeCloseTo(2.5, 6);
        }
    });

    it('writes into the vector it was handed rather than allocating', () => {
        const out = new THREE.Vector3();
        expect(latLonToVec3(10, 20, 1, out)).toBe(out);
    });
});
