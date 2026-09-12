import { describe, it, expect, beforeEach } from 'vitest';
import * as Astronomy from 'astronomy-engine';
import * as THREE from 'three';
import {
    updateSkyRotation, getSkyRotation, isSkyRotationReady,
    getAzimuth, getAltitude, setLookDirection, nudgeLookDirection, subscribeLook,
    __resetSkyRotation,
} from './skyRotation';

// The EQJ -> scene rotation is the one spot a silent axis-sign error would
// hide, so this pins it against astronomy-engine's own Equator()/Horizon()
// for real stars — an independent path through the same library, not this
// module checking its own arithmetic.

/** Standard equatorial spherical -> Cartesian, the convention the star
 * catalog's [ra, dec] pairs are converted through at render time. */
function eqjVector(raDeg, decDeg) {
    const ra = (raDeg * Math.PI) / 180;
    const dec = (decDeg * Math.PI) / 180;
    return new THREE.Vector3(
        Math.cos(dec) * Math.cos(ra),
        Math.cos(dec) * Math.sin(ra),
        Math.sin(dec),
    );
}

const STARS = [
    { name: 'Sirius',     ra: 101.2872, dec: -16.7161 },
    { name: 'Polaris',    ra: 37.9463,  dec: 89.2641 },
    { name: 'Betelgeuse', ra: 88.7929,  dec: 7.4071 },
    { name: 'Canopus',    ra: 95.9880,  dec: -52.6957 },
    { name: 'Vega',       ra: 279.2347, dec: 38.7837 },
];

const OBSERVERS = [
    { lat: 40.7,  lon: -74.0 },   // New York
    { lat: -33.9, lon: 151.2 },   // Sydney
    { lat: 64.1,  lon: -21.9 },   // Reykjavík
];

const DATES = [
    new Date('2026-01-15T20:00:00Z'),
    new Date('2026-07-04T03:30:00Z'),
];

beforeEach(() => { __resetSkyRotation(); });

describe('the EQJ -> scene rotation', () => {
    for (const obs of OBSERVERS) {
        for (const date of DATES) {
            it(`places every star at Astronomy.Horizon()'s own altitude/azimuth (lat ${obs.lat}, ${date.toISOString()})`, () => {
                const observer = new Astronomy.Observer(obs.lat, obs.lon, 0);
                updateSkyRotation(date, observer);
                const rot = getSkyRotation();

                for (const star of STARS) {
                    // Astronomy.Horizon expects RA/Dec of-date (EQD), not J2000
                    // (EQJ) — elsewhere in this codebase, utils/skyPositions.js
                    // gets that for free by calling Astronomy.Equator with
                    // ofdate=true. The star catalog is plain J2000, same as this
                    // module's own EQJ->HOR path, so the independent check has to
                    // do the J2000->of-date step itself via a *different*
                    // astronomy-engine rotation than the one skyRotation.js uses,
                    // or this "independent" cross-check would just be comparing
                    // against decades of unaccounted precession instead of
                    // against a real second path.
                    const eqj = new Astronomy.Vector(
                        Math.cos((star.dec * Math.PI) / 180) * Math.cos((star.ra * Math.PI) / 180),
                        Math.cos((star.dec * Math.PI) / 180) * Math.sin((star.ra * Math.PI) / 180),
                        Math.sin((star.dec * Math.PI) / 180),
                        date,
                    );
                    const eqd = Astronomy.EquatorFromVector(
                        Astronomy.RotateVector(Astronomy.Rotation_EQJ_EQD(date), eqj),
                    );
                    const hz = Astronomy.Horizon(date, observer, eqd.ra, eqd.dec, null);
                    const altRad = (hz.altitude * Math.PI) / 180;
                    const azRad = (hz.azimuth * Math.PI) / 180;
                    // Derived in skyRotation.js's header comment from the
                    // empirically-confirmed HOR axes (x=north, y=west, z=zenith)
                    // composed with this module's HOR -> scene relabelling.
                    const expected = new THREE.Vector3(
                        Math.cos(altRad) * Math.sin(azRad),
                        Math.sin(altRad),
                        -Math.cos(altRad) * Math.cos(azRad),
                    );

                    const got = eqjVector(star.ra, star.dec).applyMatrix3(rot);
                    expect(got.x).toBeCloseTo(expected.x, 6);
                    expect(got.y).toBeCloseTo(expected.y, 6);
                    expect(got.z).toBeCloseTo(expected.z, 6);
                }
            });
        }
    }

    it("keeps Polaris within a degree of the observer's own latitude, at any longitude or date", () => {
        for (const obs of OBSERVERS) {
            for (const date of DATES) {
                const observer = new Astronomy.Observer(obs.lat, obs.lon, 0);
                updateSkyRotation(date, observer);
                const scenePos = eqjVector(37.9463, 89.2641).applyMatrix3(getSkyRotation());
                const altitude = (Math.asin(scenePos.y) * 180) / Math.PI;
                expect(Math.abs(altitude - obs.lat)).toBeLessThan(1);
            }
        }
    });

    it('reports not-ready before the first update, and ready after', () => {
        expect(isSkyRotationReady()).toBe(false);
        updateSkyRotation(new Date(), new Astronomy.Observer(0, 0, 0));
        expect(isSkyRotationReady()).toBe(true);
    });
});

describe('look direction', () => {
    it('starts facing north, level', () => {
        expect(getAzimuth()).toBe(0);
        expect(getAltitude()).toBe(15);
    });

    it('wraps azimuth into [0, 360)', () => {
        setLookDirection(370, 10);
        expect(getAzimuth()).toBe(10);
        setLookDirection(-10, 10);
        expect(getAzimuth()).toBe(350);
    });

    it('clamps altitude to [-10, 90]', () => {
        setLookDirection(0, 200);
        expect(getAltitude()).toBe(90);
        setLookDirection(0, -50);
        expect(getAltitude()).toBe(-10);
    });

    it('nudges relative to the current direction', () => {
        setLookDirection(100, 20);
        nudgeLookDirection(10, -5);
        expect(getAzimuth()).toBe(110);
        expect(getAltitude()).toBe(15);
    });

    it('notifies subscribers only when the direction actually changes', () => {
        setLookDirection(45, 20);
        let calls = 0;
        const unsub = subscribeLook(() => { calls++; });
        setLookDirection(45, 20);   // no-op
        expect(calls).toBe(0);
        setLookDirection(46, 20);
        expect(calls).toBe(1);
        unsub();
    });
});
