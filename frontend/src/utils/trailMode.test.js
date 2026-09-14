import { describe, it, expect, beforeEach, vi } from 'vitest';
import { getTrailsOn, setTrailsOn, toggleTrails, subscribeTrails, __resetTrails } from './trailMode';

beforeEach(() => { __resetTrails(); });

describe('trailMode', () => {
    it('starts on by default', () => {
        expect(getTrailsOn()).toBe(true);
    });

    it('toggles', () => {
        toggleTrails();
        expect(getTrailsOn()).toBe(false);
        toggleTrails();
        expect(getTrailsOn()).toBe(true);
    });

    it('setTrailsOn sets an explicit value', () => {
        setTrailsOn(false);
        expect(getTrailsOn()).toBe(false);
        setTrailsOn(false); // idempotent
        expect(getTrailsOn()).toBe(false);
    });

    it('notifies subscribers only on a real change', () => {
        const seen = vi.fn();
        const off = subscribeTrails(seen);
        setTrailsOn(true); // already on — no-op
        expect(seen).not.toHaveBeenCalled();
        toggleTrails();
        expect(seen).toHaveBeenCalledTimes(1);
        off();
        toggleTrails();
        expect(seen).toHaveBeenCalledTimes(1);
    });
});
