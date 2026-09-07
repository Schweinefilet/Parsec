import { describe, it, expect } from 'vitest';
import { radiusKm, isComparable, volumeRatio } from './objectSize';
import { OBJECTS, getObjectById } from '../data/objectCatalog';

const r = (id) => radiusKm(getObjectById(id));

describe('radiusKm', () => {
    it('reads a plain radius', () => {
        expect(r('earth')).toBeCloseTo(6371, 1);
        expect(r('jupiter')).toBeCloseTo(71492, 1);
        expect(r('sun')).toBeCloseTo(695700, 1);
    });

    it('halves a diameter', () => {
        // Vesta is listed as "~525 km" mean diameter
        expect(r('vesta')).toBeCloseTo(262.5, 1);
    });

    it('drops the ~ on approximate figures', () => {
        expect(r('makemake')).toBeCloseTo(715, 1);
    });

    it('converts metres and centimetres', () => {
        // Bennu, "~492 m" across
        expect(r('bennu')).toBeCloseTo(0.246, 4);
        // Sputnik, a 58 cm sphere
        expect(r('sputnik1')).toBeCloseTo(0.00029, 6);
    });

    it('takes the midpoint of a range', () => {
        // 2023 BU is "3.5–8.5 m" across, so 6 m, so a 3 m radius
        expect(r('2023-bu')).toBeCloseTo(0.003, 5);
    });

    it('converts exoplanet radii from Earth and Jupiter units', () => {
        expect(r('trappist-1e')).toBeCloseTo(0.92 * 6371, 0);
        expect(r('kepler-22b')).toBeCloseTo(2.38 * 6371, 0);
        // HD 209458 b is quoted in Jupiter radii, not Earth ones — reading it
        // as Earth radii would make a hot Jupiter smaller than Neptune
        expect(r('hd-209458b')).toBeCloseTo(1.380 * 69911, 0);
        expect(r('hd-209458b')).toBeGreaterThan(r('neptune'));
    });

    it('takes the mean of a triaxial body rather than one axis', () => {
        // Haumea is "1,960 × 1,518 × 996 km" — grabbing the last number would
        // call it 498 km, which is its shortest semi-axis and half its size
        expect(r('haumea')).toBeGreaterThan(700);
        expect(r('haumea')).toBeLessThan(820);
    });

    it('refuses sizes that are not the object', () => {
        // A telescope's mirror is a component; an apparent diameter is an angle
        expect(r('hubble')).toBeNull();
        expect(r('jwst')).toBeNull();
        expect(r('helix-nebula')).toBeNull();
    });

    it('refuses light-years, which do not belong beside a planet', () => {
        for (const id of ['andromeda', 'orion-nebula', 'crab-nebula', 'whirlpool-galaxy']) {
            expect(r(id), id).toBeNull();
        }
    });

    it('returns null rather than guessing when there is no size row', () => {
        expect(r('voyager1')).toBeNull();
        expect(r('proxima-centauri-b')).toBeNull();
    });
});

describe('the catalog as a whole', () => {
    it('parses every object without throwing, and never negative or absurd', () => {
        for (const o of OBJECTS) {
            const v = radiusKm(o);
            if (v == null) continue;
            expect(Number.isFinite(v), o.id).toBe(true);
            expect(v, o.id).toBeGreaterThan(0);
            // Nothing in this catalog is wider than the Sun except nothing
            expect(v, o.id).toBeLessThanOrEqual(695700);
        }
    });

    it('keeps the bodies in the order everyone knows', () => {
        // A sanity net over the whole parse: if a unit or a label were
        // misread, one of these would fall out of order.
        //
        // Ganymede after Mercury is not a typo — Jupiter's largest moon is
        // wider than the innermost planet, which is precisely the sort of thing
        // putting two bodies side by side is meant to show you.
        const order = ['sputnik1', 'bennu', 'phobos', 'enceladus', 'ceres', 'pluto',
            'luna', 'mercury', 'ganymede', 'mars', 'earth', 'neptune', 'uranus',
            'saturn', 'jupiter', 'sun'];
        for (let i = 1; i < order.length; i++) {
            expect(r(order[i]), `${order[i]} vs ${order[i - 1]}`)
                .toBeGreaterThan(r(order[i - 1]));
        }
    });

    it('offers a decent set to compare — the solar system, not three planets', () => {
        const n = OBJECTS.filter(isComparable).length;
        expect(n).toBeGreaterThanOrEqual(45);
    });
});

describe('volumeRatio', () => {
    it('gives the figure the textbooks give, not the width ratio cubed', () => {
        // Jupiter is 6.5% flattened, so cubing its equatorial radius says 1,413
        // Earths fit inside it. The accepted answer is 1,321.
        const v = volumeRatio(getObjectById('jupiter'), getObjectById('earth'));
        expect(v).toBeGreaterThan(1300);
        expect(v).toBeLessThan(1345);

        // Saturn, flatter still, is about 764
        const s = volumeRatio(getObjectById('saturn'), getObjectById('earth'));
        expect(s).toBeGreaterThan(750);
        expect(s).toBeLessThan(785);

        // And the Sun is about 1.3 million
        const sun = volumeRatio(getObjectById('sun'), getObjectById('earth'));
        expect(sun).toBeGreaterThan(1.25e6);
        expect(sun).toBeLessThan(1.35e6);
    });

    it('is the plain cube for bodies that are not flattened', () => {
        const a = getObjectById('luna'), b = getObjectById('enceladus');
        const byRadius = (radiusKm(a) / radiusKm(b)) ** 3;
        expect(volumeRatio(a, b)).toBeCloseTo(byRadius, 5);
    });

    it('declines when either side has no size', () => {
        expect(volumeRatio(getObjectById('earth'), getObjectById('voyager1'))).toBeNull();
    });
});
