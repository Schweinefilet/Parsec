import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import {
    DRIFT_DEFAULTS, DRIFT_MAX,
    getDrift, setDriftAxis, resetDrift, driftRates, subscribeDrift, __resetDriftStore,
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
        setDriftAxis('roll', -9);
        expect(getDrift().roll).toBe(-1);
    });

    it('ignores an unknown axis', () => {
        const before = getDrift();
        setDriftAxis('zoom', 1);
        expect(getDrift()).toBe(before);
    });

    it('resets to the defaults', () => {
        setDriftAxis('yaw', 1);
        setDriftAxis('roll', -1);
        resetDrift();
        expect(getDrift()).toEqual(DRIFT_DEFAULTS);
    });

    it('maps sliders to signed rad/s through DRIFT_MAX', () => {
        setDriftAxis('yaw', 1);
        setDriftAxis('pitch', -0.5);
        setDriftAxis('roll', 0);
        const r = driftRates();
        expect(r.yaw).toBeCloseTo(DRIFT_MAX.yaw, 9);
        expect(r.pitch).toBeCloseTo(-0.5 * DRIFT_MAX.pitch, 9);
        expect(r.roll).toBe(0);
    });
});

describe('persistence', () => {
    it('survives a reload via localStorage', async () => {
        setDriftAxis('yaw', -0.8);
        setDriftAxis('roll', 0.3);
        vi.resetModules();
        const fresh = await import('./driftControl');
        expect(fresh.getDrift()).toEqual({ yaw: -0.8, pitch: DRIFT_DEFAULTS.pitch, roll: 0.3 });
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
