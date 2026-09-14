import { describe, it, expect } from 'vitest';
import { bodyRadiusKm, moonOrbitKm } from './trueSize';
import { PLANETS, SMALL_BODIES, MOON_DATA } from '../data/solarSystemBodies';

// These radii come out of objectCatalog.js's display strings, which is what
// keeps the scene and the object pages telling one story — and what makes a
// reworded stat row able to silently drop a body back to its drawn size. That
// is the failure these tests exist to catch.

const SCENE_BODIES = [
    { id: 'sun' },
    ...PLANETS,
    ...SMALL_BODIES,
    ...MOON_DATA,
];

describe('real radii', () => {
    it('resolves one for every body the scene draws', () => {
        for (const body of SCENE_BODIES) {
            expect(bodyRadiusKm(body.id), body.id).toBeGreaterThan(0);
        }
    });

    it('reads the figures the object pages show', () => {
        expect(bodyRadiusKm('sun')).toBe(695_700);
        expect(bodyRadiusKm('earth')).toBe(6371);
        expect(bodyRadiusKm('jupiter')).toBe(71_492);
        expect(bodyRadiusKm('luna')).toBe(1737.4);
        expect(bodyRadiusKm('phobos')).toBe(11.3);
    });

    it('orders the planets the way the solar system does', () => {
        const byId = (id) => bodyRadiusKm(id);
        expect(byId('jupiter')).toBeGreaterThan(byId('saturn'));
        expect(byId('saturn')).toBeGreaterThan(byId('uranus'));
        expect(byId('uranus')).toBeGreaterThan(byId('neptune'));
        expect(byId('neptune')).toBeGreaterThan(byId('earth'));
        expect(byId('earth')).toBeGreaterThan(byId('venus'));
        expect(byId('venus')).toBeGreaterThan(byId('mars'));
        expect(byId('mars')).toBeGreaterThan(byId('mercury'));
        expect(byId('mercury')).toBeGreaterThan(byId('pluto'));
        expect(byId('sun')).toBeGreaterThan(byId('jupiter') * 9);
    });

    it('refuses radii quoted in anything but km', () => {
        // The exoplanets carry theirs in R⊕ and RJup, which must not be read
        // as kilometres — 2.38 km of planet would be a startling thing to draw
        expect(bodyRadiusKm('kepler-452b')).toBeNull();
    });

    it('has nothing to say about a body it has never heard of', () => {
        expect(bodyRadiusKm('not-a-body')).toBeNull();
    });
});

describe('real moon orbits', () => {
    it('resolves one for every moon the scene draws', () => {
        for (const moon of MOON_DATA) {
            expect(moonOrbitKm(moon.id), moon.id).toBeGreaterThan(0);
        }
    });

    it('puts every moon outside the planet it orbits', () => {
        for (const moon of MOON_DATA) {
            const planet = PLANETS.find(p => p.name === moon.parent);
            expect(moonOrbitKm(moon.id), moon.id)
                .toBeGreaterThan(bodyRadiusKm(planet.id));
        }
    });

    it('reads the figures the object pages show', () => {
        expect(moonOrbitKm('luna')).toBe(384_400);
        expect(moonOrbitKm('phobos')).toBe(9376);
        expect(moonOrbitKm('iapetus')).toBe(3_560_820);
    });
});
