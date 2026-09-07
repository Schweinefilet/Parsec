import { describe, it, expect } from 'vitest';
import * as Astronomy from 'astronomy-engine';
import { parseTLE, isSunlit, footprintRadiusKm } from './useSatelliteTracking';
import { SATELLITES, DEFAULT_SATELLITE, satelliteById } from '../data/trackedSatellites';
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
        expect(tle[0]).toMatch(/^1 20580U/);
        expect(tle[1]).toMatch(/^2 20580/);
    });

    it('copes without the name line', () => {
        expect(parseTLE(HUBBLE.split('\r\n').slice(1).join('\r\n'))[0]).toMatch(/^1 20580U/);
    });

    it('returns null for the "no data" reply rather than half a set', () => {
        // What CelesTrak sends for a catalog number it does not know. Handing
        // this to a propagator yields a position, and the position is junk.
        expect(parseTLE('No GP data found')).toBeNull();
        expect(parseTLE('')).toBeNull();
        expect(parseTLE(HUBBLE.split('\r\n').slice(0, 2).join('\r\n'))).toBeNull();
    });
});

describe('isSunlit', () => {
    // Build positions relative to the actual Sun direction on a fixed date, so
    // the geometry is under test rather than the ephemeris.
    const when = new Date('2026-06-01T12:00:00Z');
    const sun = Astronomy.GeoVector('Sun', when, false);
    const m = Math.hypot(sun.x, sun.y, sun.z);
    const dir = { x: sun.x / m, y: sun.y / m, z: sun.z / m };
    const scale = (v, k) => ({ x: v.x * k, y: v.y * k, z: v.z * k });

    it('calls the sunward side lit', () => {
        expect(isSunlit(scale(dir, 6800), when)).toBe(true);
    });

    it('calls the shadow behind Earth eclipsed', () => {
        expect(isSunlit(scale(dir, -6800), when)).toBe(false);
    });

    it('lets something pass beside the shadow rather than through it', () => {
        // Same anti-sunward distance, but stepped off the axis by more than an
        // Earth radius — out in the light, not in the cone.
        const perp = { x: -dir.y, y: dir.x, z: 0 };
        const pm = Math.hypot(perp.x, perp.y, perp.z);
        const off = scale(perp, 9000 / pm);
        const behind = scale(dir, -6800);
        expect(isSunlit({ x: behind.x + off.x, y: behind.y + off.y, z: behind.z + off.z }, when))
            .toBe(true);
    });
});

describe('footprintRadiusKm', () => {
    it('grows with altitude and matches the low-orbit figure', () => {
        // From ~420 km the horizon is a little over 2,200 km away
        expect(footprintRadiusKm(420)).toBeGreaterThan(2100);
        expect(footprintRadiusKm(420)).toBeLessThan(2350);
        expect(footprintRadiusKm(540)).toBeGreaterThan(footprintRadiusKm(420));
    });

    it('is zero on the ground and refuses nonsense', () => {
        expect(footprintRadiusKm(0)).toBe(0);
        expect(footprintRadiusKm(-10)).toBe(0);
        expect(footprintRadiusKm(undefined)).toBe(0);
    });
});

describe('the tracked list', () => {
    it('includes the ISS as an ordinary entry', () => {
        // It used to be the exception, with its own feed and its own half of
        // the page. Anything that treats it specially again fails here.
        const iss = satelliteById('iss');
        expect(iss).toBeTruthy();
        expect(iss.norad).toBe(25544);
        expect(Object.keys(iss).sort()).toEqual(Object.keys(satelliteById('hubble')).sort());
    });

    it('gives each one a catalog page that exists', () => {
        for (const sat of SATELLITES) {
            expect(getObjectById(sat.catalogId), sat.id).toBeTruthy();
        }
    });

    it('keeps ids, catalog numbers and colours distinct', () => {
        const ids = SATELLITES.map(s => s.id);
        const norads = SATELLITES.map(s => s.norad);
        const colors = SATELLITES.map(s => s.color);
        expect(new Set(ids).size).toBe(ids.length);
        expect(new Set(norads).size).toBe(norads.length);
        // Two the same colour would make the picker's dots a lie
        expect(new Set(colors).size).toBe(colors.length);
        for (const n of norads) expect(Number.isInteger(n) && n > 0).toBe(true);
    });

    it('defaults to something it actually tracks', () => {
        expect(satelliteById(DEFAULT_SATELLITE)).toBeTruthy();
    });
});
