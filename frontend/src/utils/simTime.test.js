import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import {
    RATES, RANGE_DAYS, simNow, simDate, getRate, isPaused, isLive,
    setRate, setPaused, togglePaused, setSimTime, setOffsetDays,
    offsetDays, resetToNow, subscribe, __reset,
} from './simTime';

const DAY = 86400000;

beforeEach(() => { vi.useFakeTimers(); __reset(); });
afterEach(() => { vi.useRealTimers(); });

describe('live clock', () => {
    it('starts live and tracks the real clock', () => {
        expect(isLive()).toBe(true);
        const before = simNow();
        vi.advanceTimersByTime(10_000);
        expect(simNow() - before).toBeCloseTo(10_000, -1);
    });

    it('reports no offset while live', () => {
        expect(Math.abs(offsetDays())).toBeLessThan(1e-6);
    });
});

describe('rates', () => {
    it('advances a day per second at 1 day/s', () => {
        setRate(86400);
        const start = simNow();
        vi.advanceTimersByTime(1000);
        expect((simNow() - start) / DAY).toBeCloseTo(1, 6);
    });

    it('runs backwards on a negative rate', () => {
        setRate(-86400);
        const start = simNow();
        vi.advanceTimersByTime(2000);
        expect((simNow() - start) / DAY).toBeCloseTo(-2, 6);
    });

    it('is no longer live once the rate changes', () => {
        setRate(3600);
        vi.advanceTimersByTime(5000);
        expect(isLive()).toBe(false);
    });

    it('keeps the instant continuous across a rate change', () => {
        setRate(86400);
        vi.advanceTimersByTime(3000);
        const before = simNow();
        setRate(604800);                 // switching must not jump the clock
        expect(simNow()).toBeCloseTo(before, -1);
    });

    it('offers only sensible, ordered rates', () => {
        expect(RATES[0].value).toBe(1);
        for (let i = 1; i < RATES.length; i++) {
            expect(RATES[i].value).toBeGreaterThan(RATES[i - 1].value);
            expect(RATES[i].label).toBeTruthy();
            expect(RATES[i].short).toBeTruthy();
        }
    });
});

describe('pausing', () => {
    it('holds the instant still', () => {
        setRate(86400);
        vi.advanceTimersByTime(2000);
        setPaused(true);
        const held = simNow();
        vi.advanceTimersByTime(10_000);
        expect(simNow()).toBe(held);
        expect(isPaused()).toBe(true);
    });

    it('resumes from where it stopped', () => {
        setRate(86400);
        setPaused(true);
        const held = simNow();
        vi.advanceTimersByTime(5000);      // wall time passes; sim time must not
        togglePaused();
        expect(simNow()).toBeCloseTo(held, -1);
        vi.advanceTimersByTime(1000);
        expect((simNow() - held) / DAY).toBeCloseTo(1, 5);
    });
});

describe('scrubbing', () => {
    it('jumps to an offset in days', () => {
        setOffsetDays(365);
        expect(offsetDays()).toBeCloseTo(365, 3);
    });

    it('jumps backwards too', () => {
        setOffsetDays(-730);
        expect(offsetDays()).toBeCloseTo(-730, 3);
        expect(simDate().getTime()).toBeLessThan(Date.now());
    });

    it('keeps running at the current rate after a jump', () => {
        setRate(86400);
        setOffsetDays(100);
        vi.advanceTimersByTime(1000);
        expect(offsetDays()).toBeCloseTo(101, 2);
    });

    it('covers a decade either way', () => {
        expect(RANGE_DAYS / 365.25).toBeCloseTo(10, 1);
    });

    // The scene keys "should I recompute planet positions" off isLive(), so a
    // plain jump at rate 1 has to register as not-live or nothing would move.
    it('is not live once jumped, even at rate 1', () => {
        setOffsetDays(30);
        expect(getRate()).toBe(1);
        expect(isLive()).toBe(false);
    });
});

describe('reset', () => {
    it('returns to now and to live', () => {
        setRate(-604800);
        setOffsetDays(-500);
        resetToNow();
        expect(isLive()).toBe(true);
        expect(getRate()).toBe(1);
        expect(isPaused()).toBe(false);
        expect(Math.abs(offsetDays())).toBeLessThan(1e-6);
    });
});

describe('subscribers', () => {
    it('fires on control changes and unsubscribes cleanly', () => {
        const seen = vi.fn();
        const off = subscribe(seen);
        setRate(3600);
        setPaused(true);
        setSimTime(Date.now());
        expect(seen).toHaveBeenCalledTimes(3);
        off();
        setRate(1);
        expect(seen).toHaveBeenCalledTimes(3);
    });
});

describe('never produces a bad date', () => {
    it('stays finite across every rate over a long run', () => {
        for (const r of [...RATES.map(x => x.value), ...RATES.map(x => -x.value)]) {
            setRate(r);
            vi.advanceTimersByTime(60_000);
            expect(Number.isFinite(simNow())).toBe(true);
            expect(Number.isNaN(simDate().getTime())).toBe(false);
        }
    });
});
