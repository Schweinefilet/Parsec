import { describe, it, expect } from 'vitest';
import {
    skyView, compassIndex, twilightPhase, visibilityFor, altitudeKey, SKY_BODIES,
} from './skyPositions';

// The compass is sixteen points; these are the four cardinals and two
// intercardinals by index, which is what the module returns now. The words
// belong to the locale — see the note on compassIndex.
const N = 0, NE = 2, E = 4, SE = 6, S = 8, SW = 10, W = 12;

const LONDON = { lat: 51.48, lon: -0.13 };
const at = (iso) => new Date(iso);

describe('compassIndex', () => {
    it('names the cardinals and the points between', () => {
        expect(compassIndex(0)).toBe(N);
        expect(compassIndex(90)).toBe(E);
        expect(compassIndex(180)).toBe(S);
        expect(compassIndex(270)).toBe(W);
        expect(compassIndex(45)).toBe(NE);
        expect(compassIndex(225)).toBe(SW);
        expect(compassIndex(135)).toBe(SE);
    });

    it('wraps rather than falling off the end', () => {
        expect(compassIndex(359)).toBe(N);
        expect(compassIndex(360)).toBe(N);
        expect(compassIndex(-90)).toBe(W);
    });
});

describe('twilightPhase', () => {
    it('draws the conventional boundaries', () => {
        expect(twilightPhase(10).phase).toBe('day');
        expect(twilightPhase(-3).phase).toBe('civil');
        expect(twilightPhase(-9).phase).toBe('nautical');
        expect(twilightPhase(-15).phase).toBe('astronomical');
        expect(twilightPhase(-30).phase).toBe('night');
    });

    it('counts the sky as dark only past astronomical twilight', () => {
        expect(twilightPhase(-5).dark).toBe(false);
        expect(twilightPhase(-13).dark).toBe(true);
    });
});

describe('visibilityFor', () => {
    it('places the planets where they belong', () => {
        expect(visibilityFor(-4.5)).toBe('naked-eye');   // Venus
        expect(visibilityFor(0.3)).toBe('naked-eye');    // Saturn
        expect(visibilityFor(5.7)).toBe('dark-sky');     // Uranus
        expect(visibilityFor(7.8)).toBe('binoculars');   // Neptune
        expect(visibilityFor(14)).toBe('telescope');     // Pluto
        expect(visibilityFor(null)).toBe('unknown');
    });
});

describe('altitudeKey', () => {
    it('says where to look rather than quoting degrees', () => {
        expect(altitudeKey(-5)).toBe('sky.altBelow');
        expect(altitudeKey(5)).toBe('sky.altJustAbove');
        expect(altitudeKey(20)).toBe('sky.altLow');
        expect(altitudeKey(45)).toBe('sky.altHigh');
        expect(altitudeKey(80)).toBe('sky.altOverhead');
    });
});

describe('skyView', () => {
    it('reports every body, with self-consistent numbers', () => {
        const { bodies } = skyView(LONDON, at('2026-09-07T22:00:00Z'));
        expect(bodies).toHaveLength(SKY_BODIES.length);
        for (const b of bodies) {
            expect(b.altitude, b.name).toBeGreaterThanOrEqual(-90);
            expect(b.altitude, b.name).toBeLessThanOrEqual(90);
            expect(b.azimuth, b.name).toBeGreaterThanOrEqual(0);
            expect(b.azimuth, b.name).toBeLessThan(360);
            expect(b.up, b.name).toBe(b.altitude > 0);
            expect(b.compass, b.name).toBe(compassIndex(b.azimuth));
        }
    });

    it('lists what is up first, brightest first', () => {
        const { bodies } = skyView(LONDON, at('2026-09-07T22:00:00Z'));
        const firstDown = bodies.findIndex(b => !b.up);
        if (firstDown > 0) {
            expect(bodies.slice(0, firstDown).every(b => b.up)).toBe(true);
            expect(bodies.slice(firstDown).every(b => !b.up)).toBe(true);
            const mags = bodies.slice(0, firstDown).map(b => b.magnitude ?? 99);
            expect([...mags].sort((x, y) => x - y)).toEqual(mags);
        }
    });

    it('puts the midday Sun where it actually is', () => {
        // Solar noon at the equator on the June solstice: the Sun stands 66.6°
        // up and due north. Swap the latitude and longitude, or flip a sign,
        // and none of these three survive.
        const { sun } = skyView({ lat: 0, lon: 0 }, at('2026-06-21T12:00:00Z'));
        expect(sun.altitude).toBeGreaterThan(64);
        expect(sun.altitude).toBeLessThan(69);
        expect(compassIndex(sun.azimuth)).toBe(N);
    });

    it('knows the Sun does not set in an Arctic summer, or rise in winter', () => {
        const midsummerMidnight = skyView({ lat: 85, lon: 0 }, at('2026-06-21T00:00:00Z'));
        expect(midsummerMidnight.sun.altitude).toBeGreaterThan(0);
        expect(midsummerMidnight.twilight.phase).toBe('day');

        const midwinterNoon = skyView({ lat: 85, lon: 0 }, at('2026-12-21T12:00:00Z'));
        expect(midwinterNoon.sun.altitude).toBeLessThan(0);
        expect(midwinterNoon.twilight.dark).toBe(true);
    });

    it('keeps the Moon between new and full', () => {
        const moon = skyView(LONDON, at('2026-09-07T22:00:00Z')).bodies.find(b => b.id === 'luna');
        expect(moon.illuminated).toBeGreaterThanOrEqual(0);
        expect(moon.illuminated).toBeLessThanOrEqual(1);
    });

    it('never says something rises in the past', () => {
        const when = at('2026-09-07T22:00:00Z');
        for (const b of skyView(LONDON, when).bodies) {
            if (b.eventAt) expect(b.eventAt.getTime(), b.name).toBeGreaterThanOrEqual(when.getTime());
        }
    });

    it('sees a different sky from the other side of the world', () => {
        const when = at('2026-09-07T22:00:00Z');
        const here = skyView(LONDON, when);
        const antipode = skyView({ lat: -51.48, lon: 179.87 }, when);
        // Whatever is overhead in one place is underfoot in the other
        expect(Math.sign(here.sun.altitude)).not.toBe(Math.sign(antipode.sun.altitude));
    });
});
