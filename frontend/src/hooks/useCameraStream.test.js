import { describe, it, expect, afterEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useCameraStream } from './useCameraStream';

const withMediaDevices = (impl) => {
    const original = navigator.mediaDevices;
    Object.defineProperty(navigator, 'mediaDevices', { value: impl, configurable: true });
    return () => Object.defineProperty(navigator, 'mediaDevices', { value: original, configurable: true });
};

const fakeTrack = () => ({ stopped: false, stop() { this.stopped = true; } });
const fakeStream = (tracks) => ({ getTracks: () => tracks });

describe('useCameraStream', () => {
    afterEach(() => {});

    it('starts with nothing and asks for nothing', () => {
        const { result } = renderHook(() => useCameraStream());
        expect(result.current.stream).toBeNull();
        expect(result.current.asking).toBe(false);
        expect(result.current.error).toBeNull();
    });

    it('resolves a stream on success, requesting the back camera', async () => {
        let requested = null;
        const track = fakeTrack();
        const stream = fakeStream([track]);
        const restore = withMediaDevices({
            getUserMedia: (constraints) => { requested = constraints; return Promise.resolve(stream); },
        });
        const { result } = renderHook(() => useCameraStream());
        await act(async () => {
            const s = await result.current.request();
            expect(s).toBe(stream);
        });
        expect(result.current.stream).toBe(stream);
        expect(result.current.asking).toBe(false);
        expect(requested).toEqual({ video: { facingMode: 'environment' }, audio: false });
        restore();
    });

    it('reports a permission refusal rather than hanging', async () => {
        const restore = withMediaDevices({
            getUserMedia: () => Promise.reject(Object.assign(new Error('denied'), { name: 'NotAllowedError' })),
        });
        const { result } = renderHook(() => useCameraStream());
        await act(async () => {
            const s = await result.current.request();
            expect(s).toBeNull();
        });
        expect(result.current.error).toBe('Permission denied');
        expect(result.current.asking).toBe(false);
        expect(result.current.stream).toBeNull();
        restore();
    });

    it('reports a browser with no camera API at all', async () => {
        const restore = withMediaDevices(undefined);
        const { result } = renderHook(() => useCameraStream());
        await act(async () => {
            const s = await result.current.request();
            expect(s).toBeNull();
        });
        expect(result.current.error).toBe('This browser cannot use the camera');
        restore();
    });

    it('stop() halts every track and clears the stream', async () => {
        const track = fakeTrack();
        const stream = fakeStream([track]);
        const restore = withMediaDevices({ getUserMedia: () => Promise.resolve(stream) });
        const { result } = renderHook(() => useCameraStream());
        await act(async () => { await result.current.request(); });
        expect(result.current.stream).toBe(stream);
        act(() => result.current.stop());
        expect(result.current.stream).toBeNull();
        expect(track.stopped).toBe(true);
        restore();
    });

    it('stops any live track on unmount, so the camera indicator does not stay lit', async () => {
        const track = fakeTrack();
        const stream = fakeStream([track]);
        const restore = withMediaDevices({ getUserMedia: () => Promise.resolve(stream) });
        const { result, unmount } = renderHook(() => useCameraStream());
        await act(async () => { await result.current.request(); });
        unmount();
        expect(track.stopped).toBe(true);
        restore();
    });
});
