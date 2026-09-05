import { describe, it, expect } from 'vitest';
import * as Astronomy from 'astronomy-engine';
import {
    computePlanetPos, buildOrbitPoints, keplerianScenePos,
    buildKeplerOrbitPoints, eclipticQuaternion, DEG2RAD,
} from './orbits';
import { PLANETS, SMALL_BODIES, MOON_DATA, ORBITAL_PERIODS } from '../data/solarSystemBodies';

describe('computePlanetPos', () => {
    it('places every planet at exactly its display radius', () => {
        for (const p of PLANETS) {
            const v = computePlanetPos(p.name, p.orbitR);
            expect(Math.hypot(v.x, v.y, v.z), `${p.name}`).toBeCloseTo(p.orbitR, 6);
        }
    });

    it('keeps the real heliocentric direction, only compressing distance', () => {
        // The unit direction must match astronomy-engine, with the scene's
        // axis mapping (astronomical z -> scene y, astronomical y -> scene z)
        const date = new Date(Date.UTC(2026, 5, 15));
        for (const name of ['Earth', 'Jupiter', 'Neptune']) {
            const vec = Astronomy.HelioVector(name, date);
            const d = Math.hypot(vec.x, vec.y, vec.z);
            const p = computePlanetPos(name, 100, date);
            expect(p.x / 100, `${name} x`).toBeCloseTo(vec.x / d, 9);
            expect(p.y / 100, `${name} y`).toBeCloseTo(vec.z / d, 9);
            expect(p.z / 100, `${name} z`).toBeCloseTo(vec.y / d, 9);
        }
    });

    it('moves a planet over time', () => {
        const now = computePlanetPos('Earth', 96, new Date(Date.UTC(2026, 0, 1)));
        const later = computePlanetPos('Earth', 96, new Date(Date.UTC(2026, 6, 1)));
        // Half a year on, Earth should be roughly opposite
        expect(Math.hypot(now.x - later.x, now.y - later.y, now.z - later.z))
            .toBeGreaterThan(96);
    });

    it('falls back to a valid position for an unknown body', () => {
        const p = computePlanetPos('Vulcan', 50);
        expect(Number.isFinite(p.x) && Number.isFinite(p.y) && Number.isFinite(p.z)).toBe(true);
        expect(Math.hypot(p.x, p.y, p.z)).toBeCloseTo(50, 6);
    });
});

describe('buildOrbitPoints', () => {
    it('samples a closed ring at the display radius for each planet', () => {
        for (const p of PLANETS) {
            const pts = buildOrbitPoints(p.name, p.orbitR);
            expect(pts.length).toBeGreaterThan(100);
            for (const v of pts) {
                expect(v.length(), `${p.name} ring radius`).toBeCloseTo(p.orbitR, 4);
            }
        }
    });

    it('has a period for every planet it draws', () => {
        for (const p of PLANETS) {
            expect(ORBITAL_PERIODS[p.name], `no period for ${p.name}`).toBeGreaterThan(0);
        }
    });
});

describe('keplerianScenePos', () => {
    it('keeps small bodies between perihelion and aphelion', () => {
        for (const body of SMALL_BODIES) {
            const { a, e } = body.el;
            const peri = a * (1 - e) * body.scale;
            const aph = a * (1 + e) * body.scale;
            // Sample a full period so the extremes are covered
            for (let f = 0; f < 1; f += 0.05) {
                const t = new Date(Date.UTC(2026, 0, 1) + f * body.el.period * 86400000);
                const p = keplerianScenePos(body.el, body.scale, t);
                const r = Math.hypot(p.x, p.y, p.z);
                expect(r, `${body.name} below perihelion`).toBeGreaterThanOrEqual(peri - 1e-6);
                expect(r, `${body.name} beyond aphelion`).toBeLessThanOrEqual(aph + 1e-6);
            }
        }
    });

    it('returns to the same place after one full period', () => {
        const body = SMALL_BODIES[0];
        const t0 = new Date(Date.UTC(2026, 0, 1));
        const t1 = new Date(t0.getTime() + body.el.period * 86400000);
        const a = keplerianScenePos(body.el, body.scale, t0);
        const b = keplerianScenePos(body.el, body.scale, t1);
        expect(Math.hypot(a.x - b.x, a.y - b.y, a.z - b.z)).toBeLessThan(0.5);
    });

    it("traces Halley's high eccentricity without going non-finite", () => {
        const halley = SMALL_BODIES.find(b => b.id === 'halley');
        expect(halley.el.e).toBeGreaterThan(0.9);
        for (let f = 0; f < 1; f += 0.01) {
            const t = new Date(Date.UTC(2026, 0, 1) + f * halley.el.period * 86400000);
            const p = keplerianScenePos(halley.el, halley.scale, t);
            expect(Number.isFinite(p.x) && Number.isFinite(p.y) && Number.isFinite(p.z)).toBe(true);
        }
    });
});

describe('buildKeplerOrbitPoints', () => {
    it('closes the ellipse', () => {
        for (const body of SMALL_BODIES) {
            const pts = buildKeplerOrbitPoints(body.el, body.scale, 180);
            const first = pts[0];
            const last = pts[pts.length - 1];
            expect(first.distanceTo(last), `${body.name} ring is open`).toBeLessThan(1e-6);
        }
    });
});

describe('eclipticQuaternion', () => {
    it('produces a normalised rotation', () => {
        const q = eclipticQuaternion();
        expect(q.length()).toBeCloseTo(1, 9);
    });

    it('tilts the belt plane by the obliquity of the ecliptic', () => {
        // HelioVector returns J2000 *equatorial* coordinates, so an orbit plane
        // expressed in scene space sits ~23.44° off the scene's XZ plane. Mars,
        // whose samples derive the normal, adds its own 1.85° inclination.
        // Pinning this range documents the frame convention: if a future change
        // switched to ecliptic coordinates, this angle would collapse to ~0 and
        // the belts would silently stop matching the orbit rings.
        const q = eclipticQuaternion();
        const tiltDeg = (2 * Math.acos(Math.min(1, Math.abs(q.w))) * 180) / Math.PI;
        expect(tiltDeg).toBeGreaterThan(20);
        expect(tiltDeg).toBeLessThan(27);
    });
});

describe('moon table', () => {
    it('gives every moon a parent that exists', () => {
        const names = new Set(PLANETS.map(p => p.name));
        for (const m of MOON_DATA) {
            expect(names.has(m.parent), `${m.name}: unknown parent ${m.parent}`).toBe(true);
        }
    });

    it('gives every moon a positive period and radius', () => {
        for (const m of MOON_DATA) {
            expect(m.period, `${m.name}`).toBeGreaterThan(0);
            expect(m.orbitR, `${m.name}`).toBeGreaterThan(0);
            expect(m.radius, `${m.name}`).toBeGreaterThan(0);
        }
    });

    it('keeps moons clear of their parent planet', () => {
        for (const m of MOON_DATA) {
            const parent = PLANETS.find(p => p.name === m.parent);
            expect(m.orbitR, `${m.name} orbits inside ${m.parent}`).toBeGreaterThan(parent.r);
        }
    });

    it('uses degrees for inclination', () => {
        for (const m of MOON_DATA) {
            expect(m.inc, `${m.name}`).toBeGreaterThanOrEqual(0);
            expect(m.inc, `${m.name}`).toBeLessThanOrEqual(180);
        }
    });

    it('converts degrees consistently', () => {
        expect(180 * DEG2RAD).toBeCloseTo(Math.PI, 12);
    });
});
