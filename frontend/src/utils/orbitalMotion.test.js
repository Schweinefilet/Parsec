import { describe, it, expect } from 'vitest';
import {
    targetOrbitSpeed, stepOrbitSpeed, targetIssSpeed,
    advanceMoonAngle, moonOffset,
    DEFAULT_ORBIT_SPEED, HOVER_ORBIT_SPEED, MOON_FOCUS_ORBIT_SPEED,
} from './orbitalMotion';

const MOONS = [
    { id: 'luna', name: 'Moon', parent: 'Earth', period: 27.321, orbitR: 14, inc: 5.1, phase0: 2.35, retrograde: false },
    { id: 'iss', name: 'ISS', parent: 'Earth', period: 0.0642, orbitR: 2.8, inc: 51.6, phase0: 1, retrograde: false, noSpeedScaling: true },
    { id: 'io', name: 'Io', parent: 'Jupiter', period: 1.769, orbitR: 17, inc: 0.05, phase0: 1.5, retrograde: false },
    { id: 'callisto', name: 'Callisto', parent: 'Jupiter', period: 16.689, orbitR: 34, inc: 0.19, phase0: 5.2, retrograde: false },
    { id: 'triton', name: 'Triton', parent: 'Neptune', period: 5.877, orbitR: 13, inc: 157, phase0: 0.9, retrograde: true },
];

const EARTH = { id: 'earth', name: 'Earth' };
const JUPITER = { id: 'jupiter', name: 'Jupiter' };
const MERCURY = { id: 'mercury', name: 'Mercury' };   // has no moons
const VENUS = { id: 'venus', name: 'Venus' };         // has no moons

describe('targetOrbitSpeed', () => {
    it('always returns a finite number, for every planet', () => {
        for (const planet of [EARTH, JUPITER, MERCURY, VENUS]) {
            const speed = targetOrbitSpeed({ focusedPlanet: planet, moons: MOONS });
            expect(Number.isFinite(speed), `${planet.name} produced ${speed}`).toBe(true);
        }
    });

    // The original defect: Math.min() of an empty list is Infinity
    it('falls back to the default speed for a planet with no moons', () => {
        expect(targetOrbitSpeed({ focusedPlanet: MERCURY, moons: MOONS })).toBe(DEFAULT_ORBIT_SPEED);
        expect(targetOrbitSpeed({ focusedPlanet: VENUS, moons: MOONS })).toBe(DEFAULT_ORBIT_SPEED);
    });

    it('ignores noSpeedScaling bodies when picking the shortest period', () => {
        // Earth's moons are Luna (27.3d) and the ISS (0.064d). The ISS must not win,
        // or its tiny period collapses the speed for everything else.
        const speed = targetOrbitSpeed({ focusedPlanet: EARTH, moons: MOONS });
        expect(speed).toBe(Math.max(DEFAULT_ORBIT_SPEED, (27.321 * 86400) / 30));
    });

    it('prioritises hover over focus', () => {
        expect(targetOrbitSpeed({
            hoveredMoonId: 'io', focusedPlanet: JUPITER, moons: MOONS,
        })).toBe(HOVER_ORBIT_SPEED);
    });

    it('slows down when a moon itself is focused', () => {
        expect(targetOrbitSpeed({
            focusedMoon: MOONS[2], moons: MOONS,
        })).toBe(MOON_FOCUS_ORBIT_SPEED);
    });

    it('returns the default when nothing is focused', () => {
        expect(targetOrbitSpeed({ moons: MOONS })).toBe(DEFAULT_ORBIT_SPEED);
    });
});

describe('stepOrbitSpeed', () => {
    it('eases toward the target', () => {
        const next = stepOrbitSpeed(1000, 2000);
        expect(next).toBeGreaterThan(1000);
        expect(next).toBeLessThan(2000);
    });

    it('snaps down instantly when the focused planet changed', () => {
        expect(stepOrbitSpeed(78000, 2000, { planetFocusChanged: true })).toBe(2000);
    });

    it('still eases when the planet changed but the target is faster', () => {
        expect(stepOrbitSpeed(2000, 78000, { planetFocusChanged: true })).toBeLessThan(78000);
    });

    // Regression: Infinity - Infinity is NaN, and NaN is sticky forever after
    it('never returns NaN, even fed Infinity or NaN', () => {
        expect(stepOrbitSpeed(Infinity, Infinity)).toBe(DEFAULT_ORBIT_SPEED);
        expect(stepOrbitSpeed(2000, Infinity)).toBeTypeOf('number');
        expect(Number.isFinite(stepOrbitSpeed(2000, Infinity))).toBe(true);
        expect(Number.isFinite(stepOrbitSpeed(NaN, 2000))).toBe(true);
        expect(Number.isFinite(stepOrbitSpeed(Infinity, 2000))).toBe(true);
    });

    it('recovers to a finite value and stays there over many frames', () => {
        let speed = NaN;
        for (let i = 0; i < 200; i++) speed = stepOrbitSpeed(speed, 2000);
        expect(Number.isFinite(speed)).toBe(true);
        expect(speed).toBeCloseTo(2000, 5);
    });

    // The full path that broke: focus a moonless planet, then a planet with moons
    it('survives focusing a moonless planet and then one with moons', () => {
        let speed = DEFAULT_ORBIT_SPEED;
        for (const planet of [MERCURY, VENUS, JUPITER, EARTH]) {
            const target = targetOrbitSpeed({ focusedPlanet: planet, moons: MOONS });
            for (let i = 0; i < 60; i++) {
                speed = stepOrbitSpeed(speed, target, { planetFocusChanged: i === 0 });
            }
            expect(Number.isFinite(speed), `speed went bad on ${planet.name}`).toBe(true);
        }
    });
});

describe('targetIssSpeed', () => {
    const iss = MOONS[1];
    it('is slowest when the ISS is focused', () => {
        expect(targetIssSpeed({ issMoon: iss, focusedId: 'iss' })).toBe(10);
    });
    it('slows on hover', () => {
        expect(targetIssSpeed({ issMoon: iss, hoveredMoonId: 'iss' })).toBe(HOVER_ORBIT_SPEED);
    });
    it('is moderate when Earth is focused', () => {
        expect(targetIssSpeed({ issMoon: iss, parentFocused: true })).toBe(667);
    });
    it('defaults with no ISS in the table', () => {
        expect(targetIssSpeed({ issMoon: null })).toBe(DEFAULT_ORBIT_SPEED);
    });
});

describe('advanceMoonAngle', () => {
    it('advances prograde moons forward', () => {
        expect(advanceMoonAngle(MOONS[0], 0, 0.001, 2000)).toBeGreaterThan(0);
    });

    it('advances retrograde moons backward', () => {
        expect(advanceMoonAngle(MOONS[4], 0, 0.001, 2000)).toBeLessThan(0);
    });

    it('recovers to the moon phase when handed a bad angle or speed', () => {
        expect(advanceMoonAngle(MOONS[0], NaN, 0.001, 2000)).toBe(MOONS[0].phase0);
        expect(advanceMoonAngle(MOONS[0], 0, 0.001, Infinity)).toBe(MOONS[0].phase0);
        expect(advanceMoonAngle(MOONS[0], 0, 0.001, NaN)).toBe(MOONS[0].phase0);
    });
});

describe('moonOffset', () => {
    it('places a moon at its orbital radius', () => {
        const p = moonOffset(MOONS[0], 0);
        expect(Math.hypot(p.x, p.y, p.z)).toBeCloseTo(MOONS[0].orbitR, 6);
    });

    it('tilts with inclination', () => {
        // A moon at a quarter turn sits off the ecliptic by orbitR * sin(inc)
        const p = moonOffset(MOONS[0], Math.PI / 2);
        expect(p.y).toBeCloseTo(MOONS[0].orbitR * Math.sin((5.1 * Math.PI) / 180), 6);
    });

    it('returns the origin rather than NaN coordinates for a bad angle', () => {
        expect(moonOffset(MOONS[0], NaN)).toEqual({ x: 0, y: 0, z: 0 });
    });

    it('never produces a NaN coordinate across a full orbit', () => {
        for (const moon of MOONS) {
            for (let a = 0; a < Math.PI * 2; a += 0.1) {
                const p = moonOffset(moon, a);
                expect(Number.isFinite(p.x) && Number.isFinite(p.y) && Number.isFinite(p.z)).toBe(true);
            }
        }
    });
});
