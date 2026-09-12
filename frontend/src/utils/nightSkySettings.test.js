import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import {
    getNightSkySettings, setLinesVisible, setTwinkleEnabled, setStarDensity,
    resetNightSkySettings, subscribeNightSkySettings, __resetNightSkySettingsStore,
} from './nightSkySettings';

const DEFAULTS = { linesVisible: true, twinkle: true, density: 1 };

beforeEach(() => {
    try { window.localStorage.clear(); } catch { /* jsdom */ }
    __resetNightSkySettingsStore();
});
afterEach(() => vi.restoreAllMocks());

describe('night-sky settings store', () => {
    it('starts at the defaults', () => {
        expect(getNightSkySettings()).toEqual(DEFAULTS);
    });

    it('toggles lines and twinkle independently', () => {
        setLinesVisible(false);
        expect(getNightSkySettings()).toEqual({ ...DEFAULTS, linesVisible: false });
        setTwinkleEnabled(false);
        expect(getNightSkySettings()).toEqual({ ...DEFAULTS, linesVisible: false, twinkle: false });
    });

    it('clamps star density to 0..1', () => {
        setStarDensity(1.7);
        expect(getNightSkySettings().density).toBe(1);
        setStarDensity(-0.4);
        expect(getNightSkySettings().density).toBe(0);
        setStarDensity(0.35);
        expect(getNightSkySettings().density).toBe(0.35);
    });

    it('resets to the defaults', () => {
        setLinesVisible(false);
        setStarDensity(0.2);
        resetNightSkySettings();
        expect(getNightSkySettings()).toEqual(DEFAULTS);
    });
});

describe('persistence', () => {
    it('survives a reload via localStorage', async () => {
        setLinesVisible(false);
        setStarDensity(0.6);
        vi.resetModules();
        const fresh = await import('./nightSkySettings');
        expect(fresh.getNightSkySettings()).toEqual({ linesVisible: false, twinkle: true, density: 0.6 });
    });

    it('falls back to defaults on a corrupt value', async () => {
        try { window.localStorage.setItem('p4rsec.nightSky', '{"linesVisible":"nope"}'); } catch { /* jsdom */ }
        vi.resetModules();
        const fresh = await import('./nightSkySettings');
        expect(fresh.getNightSkySettings()).toEqual(DEFAULTS);
    });
});

describe('subscribers', () => {
    it('fire on a real change only, and unsubscribe cleanly', () => {
        const seen = vi.fn();
        const off = subscribeNightSkySettings(seen);
        setStarDensity(0.5);
        setStarDensity(0.5);   // no-op
        expect(seen).toHaveBeenCalledTimes(1);
        off();
        setStarDensity(0.2);
        expect(seen).toHaveBeenCalledTimes(1);
    });
});
