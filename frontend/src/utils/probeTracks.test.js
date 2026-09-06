import { describe, it, expect } from 'vitest';
import { PLANETS } from '../data/solarSystemBodies';
import { computePlanetPos } from './orbits';
import {
    probeScenePos, probeDistanceAU, sceneRadiusForAU,
    buildProbeTrack, trackDrawCount, hasTrack,
} from './probeTracks';
import { heliocentricDistanceAU } from '../hooks/useHorizons';
import TRACKS from '../data/voyagerTracks.json';

const ring = (id) => PLANETS.find(p => p.id === id);
const gap = (a, b) => Math.hypot(a.x - b.x, a.y - b.y, a.z - b.z);
const at = (iso) => new Date(iso + 'T00:00:00Z');

// The encounters, as flown. Voyager 1 is not on the Uranus or Neptune list and
// never was: Saturn was used to buy a close pass of Titan, which threw it up
// out of the ecliptic and ended its tour of planets.
const ENCOUNTERS = {
    voyager1: [['Jupiter', '1979-03-05'], ['Saturn', '1980-11-12']],
    voyager2: [['Jupiter', '1979-07-09'], ['Saturn', '1981-08-25'],
               ['Uranus',  '1986-01-24'], ['Neptune', '1989-08-25']],
};

describe('sceneRadiusForAU', () => {
    it('puts every planet on exactly the ring it is drawn on', () => {
        // The map is derived from these pairs, so this is the check that the
        // derivation still holds if someone moves a ring or corrects an axis.
        for (const p of PLANETS) {
            expect(sceneRadiusForAU(p.au), p.id).toBeCloseTo(p.orbitR, 6);
        }
    });

    it('never doubles back', () => {
        let prev = 0;
        for (let au = 0.05; au < 250; au *= 1.05) {
            const r = sceneRadiusForAU(au);
            expect(r).toBeGreaterThan(prev);
            prev = r;
        }
    });

    it('compresses — the outer system is not 30× the inner one', () => {
        // Neptune is 30 AU to Earth's 1, but only 3.5 rings out
        expect(sceneRadiusForAU(30.069) / sceneRadiusForAU(1)).toBeLessThan(4);
    });
});

describe('Voyager tracks', () => {
    it('has a flown path for both craft', () => {
        expect(hasTrack('voyager1')).toBe(true);
        expect(hasTrack('voyager2')).toBe(true);
        expect(hasTrack('new-horizons')).toBe(false);
    });

    it('starts where Earth was on launch day, not where Earth is now', () => {
        // The bug this replaced anchored the line to Earth's live position, so
        // the launch point wandered a whole orbit every year.
        for (const id of ['voyager1', 'voyager2']) {
            const launch = new Date(TRACKS[id].launch);
            const start = buildProbeTrack(id)[0];
            const earthThen = computePlanetPos('Earth', ring('earth').orbitR, launch);
            // Inside Earth's own drawn sphere
            expect(gap(start, earthThen), id).toBeLessThan(ring('earth').r);

            // And it is that instant, not Earth in general: half an orbit on,
            // Earth is right across the ring from where the launch point sits.
            // (Not compared against Earth *today* on purpose — run this on the
            // launch anniversary and today's Earth is in almost the same place.)
            const halfAYearOn = new Date(launch.getTime() + 182.6 * 86400000);
            const earthOpposite = computePlanetPos('Earth', ring('earth').orbitR, halfAYearOn);
            expect(gap(earthThen, earthOpposite)).toBeGreaterThan(ring('earth').orbitR);
        }
    });

    it('passes through every planet it actually used', () => {
        // This is also the frame check. The pinned vectors this replaced were
        // ecliptic while the scene is equatorial, which would throw the probe
        // ~77 units off Jupiter's ring rather than the ~1 seen here.
        for (const [id, encounters] of Object.entries(ENCOUNTERS)) {
            for (const [planet, when] of encounters) {
                const body = ring(planet.toLowerCase());
                const d = at(when);
                const g = gap(probeScenePos({ id }, d), computePlanetPos(planet, body.orbitR, d));
                expect(g, `${id} at ${planet}`).toBeLessThan(body.r);
            }
        }
    });

    it('keeps Voyager 1 away from Uranus and Neptune, which it never visited', () => {
        for (const [planet, when] of [['Uranus', '1986-01-24'], ['Neptune', '1989-08-25']]) {
            const body = ring(planet.toLowerCase());
            const d = at(when);
            const g = gap(probeScenePos({ id: 'voyager1' }, d), computePlanetPos(planet, body.orbitR, d));
            expect(g, planet).toBeGreaterThan(100);
        }
    });

    it('agrees with the distance model the detail panel uses', () => {
        // Two independent sources — the baked ephemeris here, a linear fit in
        // useHorizons — so drift between them means one has gone stale.
        for (const id of ['voyager1', 'voyager2']) {
            const now = new Date();
            expect(probeDistanceAU({ id }, now), id)
                .toBeCloseTo(heliocentricDistanceAU(id, now), 0);
        }
    });

    it('has Voyager 1 further out and climbing away from the plane', () => {
        const now = new Date();
        expect(probeDistanceAU({ id: 'voyager1' }, now))
            .toBeGreaterThan(probeDistanceAU({ id: 'voyager2' }, now));
        // Voyager 1 went north over Saturn, Voyager 2 south under Neptune
        expect(probeScenePos({ id: 'voyager1' }, now).y).toBeGreaterThan(0);
        expect(probeScenePos({ id: 'voyager2' }, now).y).toBeLessThan(0);
    });

    it('draws more of the path as the clock advances, and none of it before launch', () => {
        const id = 'voyager2';
        const total = buildProbeTrack(id).length;
        expect(trackDrawCount(id, at('1970-01-01'))).toBe(0);
        expect(trackDrawCount(id, at('1980-01-01')))
            .toBeLessThan(trackDrawCount(id, at('1990-01-01')));
        expect(trackDrawCount(id, at('2035-01-01'))).toBe(total);
    });

    it('holds at the pad rather than extrapolating backwards before launch', () => {
        const first = buildProbeTrack('voyager1')[0];
        const early = probeScenePos({ id: 'voyager1' }, at('1970-01-01'));
        expect(gap(early, first)).toBeCloseTo(0, 6);
    });
});
