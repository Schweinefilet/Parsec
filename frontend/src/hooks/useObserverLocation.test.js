import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useObserverLocation } from './useObserverLocation';

const KEY = 'parsec.observer';

const withGeolocation = (impl) => {
    const original = navigator.geolocation;
    Object.defineProperty(navigator, 'geolocation', { value: impl, configurable: true });
    return () => Object.defineProperty(navigator, 'geolocation', { value: original, configurable: true });
};

describe('useObserverLocation', () => {
    beforeEach(() => localStorage.clear());
    afterEach(() => localStorage.clear());

    it('starts with nothing and asks for nothing', () => {
        const { result } = renderHook(() => useObserverLocation());
        expect(result.current.location).toBeNull();
    });

    it('keeps only about a kilometre of precision', () => {
        // The sky does not change measurably across a kilometre, so the rest of
        // someone's GPS fix is precision we have no use for and no business
        // storing.
        const restore = withGeolocation({
            getCurrentPosition: (ok) => ok({ coords: { latitude: 51.4839271, longitude: -0.1362614 } }),
        });
        const { result } = renderHook(() => useObserverLocation());
        act(() => result.current.request());
        expect(result.current.location).toEqual({ lat: 51.48, lon: -0.14 });
        expect(JSON.parse(localStorage.getItem(KEY))).toEqual({ lat: 51.48, lon: -0.14 });
        restore();
    });

    it('remembers between visits, so a nightly check does not re-prompt', () => {
        localStorage.setItem(KEY, JSON.stringify({ lat: -33.87, lon: 151.21 }));
        const { result } = renderHook(() => useObserverLocation());
        expect(result.current.location).toEqual({ lat: -33.87, lon: 151.21 });
    });

    it('forgets on request, and clears the store with it', () => {
        localStorage.setItem(KEY, JSON.stringify({ lat: 10, lon: 20 }));
        const { result } = renderHook(() => useObserverLocation());
        act(() => result.current.forget());
        expect(result.current.location).toBeNull();
        expect(localStorage.getItem(KEY)).toBeNull();
    });

    it('ignores a stored value that is not a coordinate', () => {
        localStorage.setItem(KEY, '{"lat":"north","lon":null}');
        const { result } = renderHook(() => useObserverLocation());
        expect(result.current.location).toBeNull();
    });

    it('reports a refusal rather than hanging', () => {
        const restore = withGeolocation({
            getCurrentPosition: (_ok, fail) => fail({ code: 1 }),
        });
        const { result } = renderHook(() => useObserverLocation());
        act(() => result.current.request());
        expect(result.current.error).toBe('Permission denied');
        expect(result.current.asking).toBe(false);
        restore();
    });

    it('survives a browser that refuses storage entirely', () => {
        const spy = vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
            throw new Error('denied');
        });
        expect(() => renderHook(() => useObserverLocation())).not.toThrow();
        spy.mockRestore();
    });
});
