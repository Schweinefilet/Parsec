import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import {
    IDLE, ARMED, APPROACHING, CURTAIN,
    armSkyEntry, getSkyEntryPhase, getSkyEntryObserver, setSkyEntryPhase,
    resetSkyEntry, subscribeSkyEntry, __resetSkyEntry,
} from './skyEntry';

beforeEach(() => { vi.useFakeTimers(); __resetSkyEntry(); });
afterEach(() => { vi.useRealTimers(); });

describe('arming', () => {
    it('starts idle with no observer', () => {
        expect(getSkyEntryPhase()).toBe(IDLE);
        expect(getSkyEntryObserver()).toBe(null);
    });

    it('arms with the observer and moves to ARMED', () => {
        armSkyEntry({ lat: 51.5, lon: -0.12 });
        expect(getSkyEntryPhase()).toBe(ARMED);
        expect(getSkyEntryObserver()).toEqual({ lat: 51.5, lon: -0.12 });
    });

    it('ignores a re-arm while a sequence is already in flight', () => {
        armSkyEntry({ lat: 1, lon: 1 });
        armSkyEntry({ lat: 99, lon: 99 });
        expect(getSkyEntryObserver()).toEqual({ lat: 1, lon: 1 });
    });

    it('allows a fresh arm once the previous sequence has reset to idle', () => {
        armSkyEntry({ lat: 1, lon: 1 });
        resetSkyEntry();
        armSkyEntry({ lat: 2, lon: 2 });
        expect(getSkyEntryObserver()).toEqual({ lat: 2, lon: 2 });
    });
});

describe('phase machine', () => {
    it('advances through the stages SolarSystem3D drives', () => {
        armSkyEntry({ lat: 0, lon: 0 });
        setSkyEntryPhase(APPROACHING);
        expect(getSkyEntryPhase()).toBe(APPROACHING);
        setSkyEntryPhase(CURTAIN);
        expect(getSkyEntryPhase()).toBe(CURTAIN);
    });

    it('clears the observer once reset to idle from any phase', () => {
        armSkyEntry({ lat: 3, lon: 4 });
        setSkyEntryPhase(APPROACHING);
        resetSkyEntry();
        expect(getSkyEntryPhase()).toBe(IDLE);
        expect(getSkyEntryObserver()).toBe(null);
    });

    it('ignores setting the same phase again', () => {
        armSkyEntry({ lat: 0, lon: 0 });
        const seen = vi.fn();
        subscribeSkyEntry(seen);
        setSkyEntryPhase(ARMED);
        expect(seen).not.toHaveBeenCalled();
    });
});

describe('watchdog', () => {
    it('forces CURTAIN if nothing advances the sequence in time', () => {
        armSkyEntry({ lat: 0, lon: 0 });
        vi.advanceTimersByTime(6999);
        expect(getSkyEntryPhase()).toBe(ARMED);
        vi.advanceTimersByTime(2);
        expect(getSkyEntryPhase()).toBe(CURTAIN);
    });

    it('does not fire once the sequence already reached curtain on its own', () => {
        armSkyEntry({ lat: 0, lon: 0 });
        setSkyEntryPhase(APPROACHING);
        setSkyEntryPhase(CURTAIN);
        const seen = vi.fn();
        subscribeSkyEntry(seen);
        vi.advanceTimersByTime(8000);
        expect(seen).not.toHaveBeenCalled();
        expect(getSkyEntryPhase()).toBe(CURTAIN);
    });

    it('does not fire once the sequence was reset to idle', () => {
        armSkyEntry({ lat: 0, lon: 0 });
        resetSkyEntry();
        const seen = vi.fn();
        subscribeSkyEntry(seen);
        vi.advanceTimersByTime(8000);
        expect(seen).not.toHaveBeenCalled();
    });

    it('does not leak a watchdog from an earlier sequence into a new one', () => {
        armSkyEntry({ lat: 0, lon: 0 });
        resetSkyEntry();
        armSkyEntry({ lat: 5, lon: 5 });
        vi.advanceTimersByTime(6999);
        expect(getSkyEntryPhase()).toBe(ARMED);
        vi.advanceTimersByTime(2);
        expect(getSkyEntryPhase()).toBe(CURTAIN);
    });
});

describe('subscribers', () => {
    it('fire on every real transition and unsubscribe cleanly', () => {
        const seen = vi.fn();
        const off = subscribeSkyEntry(seen);
        armSkyEntry({ lat: 0, lon: 0 });   // -> ARMED
        setSkyEntryPhase(APPROACHING);
        expect(seen).toHaveBeenCalledTimes(2);
        off();
        setSkyEntryPhase(CURTAIN);
        expect(seen).toHaveBeenCalledTimes(2);
    });
});
