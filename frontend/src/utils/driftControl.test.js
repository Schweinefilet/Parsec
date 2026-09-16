import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import {
    DRIFT_DEFAULTS, DRIFT_MAX, PITCH_LIMIT,
    getDrift, setDriftAxis, resetDrift, driftRates, subscribeDrift, pitchPendulum,
    __resetDriftStore,
} from './driftControl';

beforeEach(() => {
    try { window.localStorage.clear(); } catch { /* jsdom */ }
    __resetDriftStore();
});
afterEach(() => vi.restoreAllMocks());

describe('drift store', () => {
    it('starts at the defaults', () => {
        expect(getDrift()).toEqual(DRIFT_DEFAULTS);
    });

    it('sets an axis and clamps to -1..1', () => {
        setDriftAxis('yaw', 0.5);
        expect(getDrift().yaw).toBe(0.5);
        setDriftAxis('pitch', 4);
        expect(getDrift().pitch).toBe(1);
        setDriftAxis('pitch', -9);
        expect(getDrift().pitch).toBe(-1);
    });

    it('ignores an unknown axis', () => {
        const before = getDrift();
        setDriftAxis('zoom', 1);
        expect(getDrift()).toBe(before);
    });

    // Removed in 5.5.0 — the slider is gone and the scene no longer reads a
    // roll rate at all, so accepting one here would put a value in storage
    // that nothing can ever show or clear.
    it('no longer has a roll axis', () => {
        const before = getDrift();
        setDriftAxis('roll', 1);
        expect(getDrift()).toBe(before);
        expect(getDrift()).not.toHaveProperty('roll');
        expect(driftRates()).not.toHaveProperty('roll');
    });

    it('resets to the defaults', () => {
        setDriftAxis('yaw', 1);
        setDriftAxis('pitch', -1);
        resetDrift();
        expect(getDrift()).toEqual(DRIFT_DEFAULTS);
    });

    it('maps sliders to signed rad/s through DRIFT_MAX', () => {
        setDriftAxis('yaw', 1);
        setDriftAxis('pitch', -0.5);
        const r = driftRates();
        expect(r.yaw).toBeCloseTo(DRIFT_MAX.yaw, 9);
        expect(r.pitch).toBeCloseTo(-0.5 * DRIFT_MAX.pitch, 9);
    });
});

describe('persistence', () => {
    it('survives a reload via localStorage', async () => {
        setDriftAxis('yaw', -0.8);
        vi.resetModules();
        const fresh = await import('./driftControl');
        expect(fresh.getDrift()).toEqual({ yaw: -0.8, pitch: DRIFT_DEFAULTS.pitch });
    });

    // Anyone who used the roll slider before 5.5.0 has one sitting in storage.
    // Their yaw and pitch are still theirs; only the axis that no longer
    // exists is dropped.
    it('keeps a pre-5.5.0 setting that still carries a roll', async () => {
        try {
            window.localStorage.setItem('p4rsec.drift', '{"yaw":0.5,"pitch":-0.2,"roll":0.9}');
        } catch { /* jsdom */ }
        vi.resetModules();
        const fresh = await import('./driftControl');
        expect(fresh.getDrift()).toEqual({ yaw: 0.5, pitch: -0.2 });
    });

    it('falls back to defaults on a corrupt value', async () => {
        try { window.localStorage.setItem('p4rsec.drift', '{"yaw":"nope"}'); } catch { /* jsdom */ }
        vi.resetModules();
        const fresh = await import('./driftControl');
        expect(fresh.getDrift()).toEqual(DRIFT_DEFAULTS);
    });
});

describe('subscribers', () => {
    it('fire on a real change only, and unsubscribe cleanly', () => {
        const seen = vi.fn();
        const off = subscribeDrift(seen);
        setDriftAxis('yaw', 0.4);
        setDriftAxis('yaw', 0.4);   // no-op
        expect(seen).toHaveBeenCalledTimes(1);
        off();
        setDriftAxis('yaw', 0.9);
        expect(seen).toHaveBeenCalledTimes(1);
    });
});

describe('the pitch pendulum', () => {
    // The scene rotates the target->camera vector about the camera's right
    // axis; d(sinElev)/d(angle) is -cameraUp.y. Holding the camera level
    // (up ~ world up) near the ecliptic, that is about -1, which is what
    // these pass unless they are testing the other sign.
    const LEVEL = -1;

    it('leaves a rate alone well inside the band', () => {
        const { rate, dir } = pitchPendulum(0.1, LEVEL, 0.05, 1);
        expect(rate).toBeCloseTo(0.05, 9);
        expect(dir).toBe(1);
    });

    it('tapers toward zero as it nears the limit', () => {
        // elevPerRad -1 with dir +1 means rising, so these are all outbound.
        const near = pitchPendulum(0.90, LEVEL, -0.05, 1).rate;
        const mid  = pitchPendulum(0.85, LEVEL, -0.05, 1).rate;
        const far  = pitchPendulum(0.78, LEVEL, -0.05, 1).rate;
        expect(Math.abs(near)).toBeLessThan(Math.abs(mid));
        expect(Math.abs(mid)).toBeLessThan(Math.abs(far));
        expect(Math.abs(far)).toBeLessThan(0.05);
    });

    it('turns around at the limit', () => {
        const { dir } = pitchPendulum(PITCH_LIMIT, LEVEL, -0.05, 1);
        expect(dir).toBe(-1);
    });

    it('turns around at the limit on the underside too', () => {
        const { dir } = pitchPendulum(-PITCH_LIMIT, LEVEL, 0.05, 1);
        expect(dir).toBe(-1);
    });

    it('does not slow a camera already heading back toward the ecliptic', () => {
        // Up near the limit, but moving down: full rate, no taper, no flip.
        const { rate, dir } = pitchPendulum(0.93, LEVEL, 0.05, 1);
        expect(rate).toBeCloseTo(0.05, 9);
        expect(dir).toBe(1);
    });

    // The regression this exists for. Before 5.5.0 pitch ran without a band,
    // so idling for a few minutes carried the camera over a pole; the scene's
    // roll-to-level corrector then faced a huge error and drove at it, which
    // is what "the entire screen pans uncontrollably" was. Simulated here at
    // the real default rate: an hour of idling must never take the camera
    // near a pole, and must turn around repeatedly instead.
    it('keeps an hour of idling inside the band, reversing rather than tumbling', () => {
        const rate = DRIFT_DEFAULTS.pitch * DRIFT_MAX.pitch;
        const dt = 1 / 60;
        let elev = 0;           // radians above the ecliptic
        let dir = 1;
        let peak = 0;
        let reversals = 0;
        for (let f = 0; f < 60 * 60 * 60; f++) {
            const before = dir;
            // A level camera: up.y = cos(elev), so elevPerRad = -cos(elev).
            // The rotation is in the vertical plane, so the elevation angle
            // itself moves at exactly the applied rate — one radian of
            // rotation is one radian of elevation, downward for a positive
            // rate (which is what the negative elevPerRad says).
            const step = pitchPendulum(Math.sin(elev), -Math.cos(elev), rate, dir);
            dir = step.dir;
            if (dir !== before) reversals++;
            elev -= step.rate * dt;
            peak = Math.max(peak, Math.abs(Math.sin(elev)));
        }
        expect(peak).toBeLessThanOrEqual(PITCH_LIMIT + 1e-6);
        expect(peak).toBeGreaterThan(0.8);   // it does use the band, not hover near zero
        expect(reversals).toBeGreaterThan(2);
    });
});
