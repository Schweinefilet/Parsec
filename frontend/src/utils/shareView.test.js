import { describe, it, expect, beforeEach } from 'vitest';
import {
    encodeView, decodeView, buildShareUrl, setCameraSnapshot, getCameraSnapshot,
} from './shareView';

const NOW = new Date('2026-09-07T12:00:00Z');
const CAM = { theta: 123.456, phi: 56.78, distance: 580.4 };

beforeEach(() => setCameraSnapshot(null));

describe('encodeView', () => {
    it('leaves out anything sitting at its default', () => {
        // A link to the scene as it opens should just be the address
        expect([...encodeView({ now: NOW }).keys()]).toEqual([]);
        expect([...encodeView({ simDate: NOW, trueScale: false, now: NOW }).keys()]).toEqual([]);
    });

    it('rounds the camera to something short enough to read', () => {
        expect(encodeView({ camera: CAM, now: NOW }).get('cam')).toBe('123.5_56.8_580');
    });

    it('writes an instant, not an offset', () => {
        // "30 days ahead" would mean something different tomorrow
        const when = new Date('2027-08-02T09:00:00Z');
        expect(encodeView({ simDate: when, now: NOW }).get('at')).toBe('2027-08-02T09:00Z');
    });

    it('ignores a clock that is merely a few seconds off live', () => {
        const nearly = new Date(NOW.getTime() + 20_000);
        expect(encodeView({ simDate: nearly, now: NOW }).has('at')).toBe(false);
    });
});

describe('decodeView', () => {
    it('round-trips a view', () => {
        const at = new Date('2027-08-02T09:00:00Z');
        const params = encodeView({ camera: CAM, simDate: at, trueScale: true, now: NOW });
        const back = decodeView(params.toString());
        expect(back.camera).toEqual({ theta: 123.5, phi: 56.8, distance: 580 });
        expect(back.at.toISOString()).toBe('2027-08-02T09:00:00.000Z');
        expect(back.trueScale).toBe(true);
    });

    it('gives defaults for an empty query', () => {
        expect(decodeView('')).toEqual({ camera: null, at: null, trueScale: false });
    });

    it('discards nonsense rather than flying the camera into the Sun', () => {
        // Links get truncated, hand-edited and mangled by chat clients
        expect(decodeView('cam=abc').camera).toBeNull();
        expect(decodeView('cam=1_2').camera).toBeNull();
        expect(decodeView('cam=1_2_0').camera).toBeNull();
        expect(decodeView('cam=1_2_-50').camera).toBeNull();
        expect(decodeView('at=yesterday').at).toBeNull();
        expect(decodeView('scale=yes').trueScale).toBe(false);
    });
});

describe('buildShareUrl', () => {
    it('keeps the params the page already had', () => {
        const url = buildShareUrl({
            href: 'https://example.com/object/saturn?tab=moons',
            camera: CAM, trueScale: true, now: NOW,
        });
        expect(url).toContain('/object/saturn');
        expect(url).toContain('tab=moons');
        expect(url).toContain('cam=123.5_56.8_580');
        expect(url).toContain('scale=true');
    });

    it('replaces a stale view rather than stacking a second one', () => {
        const url = buildShareUrl({
            href: 'https://example.com/?cam=1_1_1&scale=true',
            camera: CAM, now: NOW,
        });
        expect(url.match(/cam=/g)).toHaveLength(1);
        expect(url).not.toContain('scale=true');
    });

    it('returns the address unchanged where there is no camera', () => {
        const url = buildShareUrl({ href: 'https://example.com/tonight', now: NOW });
        expect(url).toBe('https://example.com/tonight');
    });
});

describe('the camera snapshot', () => {
    it('is whatever the scene last wrote', () => {
        expect(getCameraSnapshot()).toBeNull();
        setCameraSnapshot(CAM);
        expect(getCameraSnapshot()).toEqual(CAM);
    });
});
