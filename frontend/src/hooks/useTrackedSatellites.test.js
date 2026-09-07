import { describe, it, expect } from 'vitest';
import { parseTLE } from './useTrackedSatellites';
import { TRACKED_SATELLITES, ISS_COLOR } from '../data/trackedSatellites';
import { getObjectById } from '../data/objectCatalog';

// A real CelesTrak reply, CRLF and all
const HUBBLE = [
    'HST                     ',
    '1 20580U 90037B   26249.68045545  .00003990  00000+0  11978-3 0  9993',
    '2 20580  28.4722 243.2424 0001542 335.0690  24.9843 15.11418748745383',
].join('\r\n');

describe('parseTLE', () => {
    it('reads the two element lines out of a named set', () => {
        const tle = parseTLE(HUBBLE);
        expect(tle).not.toBeNull();
        expect(tle[0]).toMatch(/^1 20580U/);
        expect(tle[1]).toMatch(/^2 20580/);
    });

    it('copes without the name line', () => {
        const tle = parseTLE(HUBBLE.split('\r\n').slice(1).join('\r\n'));
        expect(tle[0]).toMatch(/^1 20580U/);
    });

    it('returns null for the "no data" reply rather than half a set', () => {
        // What CelesTrak sends for a catalog number it does not know. Feeding
        // this to a propagator produces a position, and the position is junk.
        expect(parseTLE('No GP data found')).toBeNull();
        expect(parseTLE('')).toBeNull();
        // A set truncated mid-download is no good either
        expect(parseTLE(HUBBLE.split('\r\n').slice(0, 2).join('\r\n'))).toBeNull();
    });
});

describe('tracked satellites', () => {
    it('gives each one a catalog page that exists', () => {
        for (const sat of TRACKED_SATELLITES) {
            expect(getObjectById(sat.catalogId), sat.id).toBeTruthy();
        }
    });

    it('keeps the ids, catalog numbers and colours distinct', () => {
        const ids = TRACKED_SATELLITES.map(s => s.id);
        const norads = TRACKED_SATELLITES.map(s => s.norad);
        const colors = TRACKED_SATELLITES.map(s => s.color);
        expect(new Set(ids).size).toBe(ids.length);
        expect(new Set(norads).size).toBe(norads.length);
        // Sharing the ISS's colour would make the legend a lie
        expect(new Set([...colors, ISS_COLOR]).size).toBe(colors.length + 1);
        for (const n of norads) expect(Number.isInteger(n) && n > 0).toBe(true);
    });

    it('does not list the ISS, which has its own feed', () => {
        expect(TRACKED_SATELLITES.some(s => s.norad === 25544)).toBe(false);
    });
});
