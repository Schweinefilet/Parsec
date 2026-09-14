import { describe, it, expect, beforeEach, vi } from 'vitest';
import { getTrailsOn, setTrailsOn, toggleTrails, subscribeTrails, __resetTrails } from './trailMode';

beforeEach(() => { __resetTrails(); });

describe('trailMode', () => {
    it('starts off', () => {
        expect(getTrailsOn()).toBe(false);
    });

    it('toggles', () => {
        toggleTrails();
        expect(getTrailsOn()).toBe(true);
        toggleTrails();
        expect(getTrailsOn()).toBe(false);
    });

    it('setTrailsOn sets an explicit value', () => {
        setTrailsOn(true);
        expect(getTrailsOn()).toBe(true);
        setTrailsOn(true); // idempotent
        expect(getTrailsOn()).toBe(true);
    });

    it('notifies subscribers only on a real change', () => {
        const seen = vi.fn();
        const off = subscribeTrails(seen);
        setTrailsOn(false); // already off — no-op
        expect(seen).not.toHaveBeenCalled();
        toggleTrails();
        expect(seen).toHaveBeenCalledTimes(1);
        off();
        toggleTrails();
        expect(seen).toHaveBeenCalledTimes(1);
    });
});
