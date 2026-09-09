import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import {
    VIZ_OFF, VIZ_GRID, VIZ_FIELD,
    getVizMode, vizWeight, isVizSettling, setVizMode, cycleVizMode, subscribeViz, __resetViz,
} from './vizMode';

beforeEach(() => { vi.useFakeTimers(); __resetViz(); });
afterEach(() => { vi.useRealTimers(); });

describe('mode', () => {
    it('starts off, with both layers hidden', () => {
        expect(getVizMode()).toBe(VIZ_OFF);
        expect(vizWeight(VIZ_GRID)).toBe(0);
        expect(vizWeight(VIZ_FIELD)).toBe(0);
    });

    it('cycles off → grid → field → off', () => {
        cycleVizMode(); expect(getVizMode()).toBe(VIZ_GRID);
        cycleVizMode(); expect(getVizMode()).toBe(VIZ_FIELD);
        cycleVizMode(); expect(getVizMode()).toBe(VIZ_OFF);
    });

    it('ignores a set to the mode already showing', () => {
        const seen = vi.fn();
        subscribeViz(seen);
        setVizMode(VIZ_OFF);
        expect(seen).not.toHaveBeenCalled();
    });
});

describe('crossfade', () => {
    it('eases the selected layer in and the rest out', () => {
        setVizMode(VIZ_GRID);
        expect(vizWeight(VIZ_GRID)).toBeCloseTo(0, 2);
        vi.advanceTimersByTime(190);              // halfway through 380ms
        expect(vizWeight(VIZ_GRID)).toBeCloseTo(0.5, 1);
        vi.advanceTimersByTime(190);
        expect(vizWeight(VIZ_GRID)).toBeCloseTo(1, 3);
        expect(vizWeight(VIZ_FIELD)).toBe(0);
        expect(isVizSettling()).toBe(false);
    });

    it('hands one layer to the other without either jumping', () => {
        setVizMode(VIZ_GRID);
        vi.advanceTimersByTime(400);
        setVizMode(VIZ_FIELD);
        // grid full, field zero at the switch
        expect(vizWeight(VIZ_GRID)).toBeCloseTo(1, 3);
        expect(vizWeight(VIZ_FIELD)).toBeCloseTo(0, 3);
        vi.advanceTimersByTime(190);
        const g = vizWeight(VIZ_GRID), f = vizWeight(VIZ_FIELD);
        expect(g).toBeGreaterThan(0.2);
        expect(g).toBeLessThan(0.8);
        expect(f).toBeGreaterThan(0.2);
        expect(f).toBeLessThan(0.8);
        vi.advanceTimersByTime(200);
        expect(vizWeight(VIZ_GRID)).toBeCloseTo(0, 2);
        expect(vizWeight(VIZ_FIELD)).toBeCloseTo(1, 2);
    });

    it('does not jump when reversed mid-fade', () => {
        setVizMode(VIZ_GRID);
        vi.advanceTimersByTime(190);
        const mid = vizWeight(VIZ_GRID);
        setVizMode(VIZ_OFF);
        expect(vizWeight(VIZ_GRID)).toBeCloseTo(mid, 2);   // continues from where it was
        vi.advanceTimersByTime(400);
        expect(vizWeight(VIZ_GRID)).toBeCloseTo(0, 2);
    });
});

describe('subscribers', () => {
    it('fire on a real change and unsubscribe cleanly', () => {
        const seen = vi.fn();
        const off = subscribeViz(seen);
        cycleVizMode();
        cycleVizMode();
        expect(seen).toHaveBeenCalledTimes(2);
        off();
        cycleVizMode();
        expect(seen).toHaveBeenCalledTimes(2);
    });
});
