import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useHoldTips, useTipsHeld } from '../hooks/useCoachTips';
import { holdTips, releaseTips, tipsHeld, subscribeTips, __resetTips } from './coachTips';

beforeEach(__resetTips);

describe('coachTips', () => {
    it('is clear until something holds it', () => {
        expect(tipsHeld()).toBe(false);
        holdTips('loading');
        expect(tipsHeld()).toBe(true);
    });

    it('stays held until every holder has let go', () => {
        holdTips('loading');
        holdTips('greeting');
        releaseTips('loading');
        expect(tipsHeld()).toBe(true);
        releaseTips('greeting');
        expect(tipsHeld()).toBe(false);
    });

    it('counts a name once, however many times it holds', () => {
        holdTips('greeting');
        holdTips('greeting');
        releaseTips('greeting');
        expect(tipsHeld()).toBe(false);
    });

    it('lets go of a name that was never held without complaint', () => {
        expect(() => releaseTips('nothing')).not.toThrow();
        expect(tipsHeld()).toBe(false);
    });

    it('tells a subscriber the current state at once, and then each change', () => {
        holdTips('loading');
        const seen = vi.fn();
        const off = subscribeTips(seen);
        expect(seen).toHaveBeenLastCalledWith(true);
        releaseTips('loading');
        expect(seen).toHaveBeenLastCalledWith(false);
        off();
        holdTips('loading');
        expect(seen).toHaveBeenCalledTimes(2);
    });

    it('does not announce a hold that changes nothing', () => {
        const seen = vi.fn();
        subscribeTips(seen);
        holdTips('a');
        holdTips('a');
        releaseTips('b');
        expect(seen).toHaveBeenCalledTimes(2);   // the initial call, then the one real change
    });
});

describe('the hooks', () => {
    it('hold while active, and let go when it stops', () => {
        const { rerender } = renderHook(({ on }) => useHoldTips('greeting', on), { initialProps: { on: true } });
        expect(tipsHeld()).toBe(true);
        rerender({ on: false });
        expect(tipsHeld()).toBe(false);
    });

    it('let go on unmount, so a page that leaves does not strand the tips', () => {
        const { unmount } = renderHook(() => useHoldTips('scene-tips', true));
        expect(tipsHeld()).toBe(true);
        unmount();
        expect(tipsHeld()).toBe(false);
    });

    it('report the state to whoever is waiting', () => {
        const { result } = renderHook(() => useTipsHeld());
        expect(result.current).toBe(false);
        act(() => holdTips('loading'));
        expect(result.current).toBe(true);
        act(() => releaseTips('loading'));
        expect(result.current).toBe(false);
    });
});
