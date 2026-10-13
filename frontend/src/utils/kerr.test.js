import { describe, it, expect } from 'vitest';
import {
    horizonRadius, iscoRadius, criticalImpact, keplerOmega, hoverTimeDilation,
    orbitTimeDilation, ksGeometry, launchRay, hamiltonian, traceRay, rayDerivative,
    MAX_SPIN, FILM_SPIN,
} from './kerr';
import { blackbodyRGB, blackbodyCoord, blackbodyTable, BLACKBODY_MIN_K, BLACKBODY_MAX_K } from './blackbody';

// Equatorial ray coming in from far down -x with impact parameter b along y.
const fromFar = (b, a, opts) => traceRay([-400, b, 0], [1, 0, 0], a, opts);

// Bisect the largest |b| that still falls in, on one side.
function captureEdge(a, sign) {
    let lo = 0.5, hi = 9;
    for (let i = 0; i < 22; i++) {
        const m = (lo + hi) / 2;
        if (fromFar(sign * m, a).fate === 'captured') lo = m; else hi = m;
    }
    return lo;
}

describe('closed-form Kerr quantities', () => {
    it('puts the horizon at 2M without spin and at M when maximal', () => {
        expect(horizonRadius(0)).toBe(2);
        expect(horizonRadius(1)).toBe(1);
    });

    it('has the textbook ISCO radii', () => {
        expect(iscoRadius(0)).toBeCloseTo(6, 6);
        expect(iscoRadius(1)).toBeCloseTo(1, 3);
        // The film's spin: the disk reaches in to about 3.8M.
        expect(iscoRadius(FILM_SPIN)).toBeCloseTo(3.829, 2);
        expect(iscoRadius(MAX_SPIN)).toBeGreaterThan(horizonRadius(MAX_SPIN));
    });

    it('slows time near the hole and not far away', () => {
        expect(hoverTimeDilation(1e9)).toBeCloseTo(1, 6);
        expect(hoverTimeDilation(2)).toBe(0);
        expect(hoverTimeDilation(8)).toBeCloseTo(Math.sqrt(0.75), 9);
        expect(orbitTimeDilation(1e9, 0)).toBeCloseTo(1, 4);
        // No circular orbit inside the photon orbit.
        expect(orbitTimeDilation(2.9, 0)).toBeNull();
        expect(keplerOmega(4, 0)).toBeCloseTo(1 / 8, 12);
    });

    it('reduces Kerr–Schild r to the plain radius without spin', () => {
        const g = ksGeometry(3, 4, 12, 0);
        expect(g.r).toBeCloseTo(13, 12);
        expect(g.f).toBeCloseTo(2 / 13, 12);
    });
});

describe('ray integration', () => {
    it('launches null rays', () => {
        for (const a of [0, 0.6, MAX_SPIN]) {
            const s = launchRay([12, -5, 3], [-0.6, 0.64, 0.48], a);
            expect(Math.abs(hamiltonian(s, a))).toBeLessThan(1e-12);
        }
    });

    it('matches the analytic gradient against finite differences', () => {
        // The force term is where a sign slip would hide: check every component.
        const a = 0.8;
        const s = [3.1, -2.2, 1.7, 0.3, 0.9, -0.4];
        const d = rayDerivative(s, a);
        const e = 1e-6;
        for (let i = 0; i < 3; i++) {
            const up = [...s]; up[i] += e;
            const dn = [...s]; dn[i] -= e;
            const fd = -(hamiltonian(up, a) - hamiltonian(dn, a)) / (2 * e);
            expect(d[3 + i]).toBeCloseTo(fd, 6);
        }
    });

    it('keeps rays null over a whole flight', () => {
        const a = 0.9;
        const { fate, state } = fromFar(8, a);
        expect(fate).toBe('escaped');
        expect(Math.abs(hamiltonian(state, a))).toBeLessThan(1e-4);
    });

    it('casts a shadow of radius 3√3 M without spin', () => {
        expect(captureEdge(0, 1)).toBeCloseTo(3 * Math.sqrt(3), 2);
        expect(captureEdge(0, -1)).toBeCloseTo(3 * Math.sqrt(3), 2);
    });

    it('flattens the shadow on the prograde side when spinning', () => {
        // Rays moving +x at +y circle the z axis clockwise, against the spin:
        // they are the retrograde ones and are caught from further out.
        const a = 0.9;
        const { prograde, retrograde } = criticalImpact(a);
        expect(captureEdge(a, 1)).toBeCloseTo(retrograde, 2);
        expect(captureEdge(a, -1)).toBeCloseTo(prograde, 2);
    });

    it('bends a distant ray by about 4M/b', () => {
        const b = 60;
        const { fate, state } = traceRay([-3000, b, 0], [1, 0, 0], 0, { escape: 3000, scale: 0.02 });
        expect(fate).toBe('escaped');
        const bend = Math.atan2(-state[4], state[3]);
        // Weak-field value, plus the first correction and the finite start.
        expect(bend).toBeGreaterThan(4 / b);
        expect(bend).toBeLessThan((4 / b) * 1.12);
    });

    it('sees the far side of the disk over the top of the hole', () => {
        // The Interstellar picture: a ray aimed just over the hole from near
        // the disk plane is bent down onto the disk behind it.
        const a = FILM_SPIN;
        const n = Math.hypot(1, 0.15);
        const { crossings } = traceRay([-30, 0, 1.5], [1 / n, 0, 0.15 / n], a);
        expect(crossings.length).toBeGreaterThan(0);
        // Aimed upward, yet it lands on the disk behind the hole, inside
        // where the film's disk reaches.
        expect(crossings[0].x).toBeGreaterThan(0);
        expect(crossings[0].r).toBeLessThan(15);
    });
});

describe('blackbody colour', () => {
    it('is about white near the sRGB white point and neutral in luminance', () => {
        const [r, g, b] = blackbodyRGB(6504);
        expect(r).toBeCloseTo(1, 1);
        expect(g).toBeCloseTo(1, 1);
        expect(b).toBeCloseTo(1, 1);
        const lum = (c) => 0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2];
        expect(lum(blackbodyRGB(3000))).toBeCloseTo(1, 1);
    });

    it('runs from red to blue with temperature', () => {
        const [r1, g1, b1] = blackbodyRGB(2500);
        expect(r1).toBeGreaterThan(g1);
        expect(g1).toBeGreaterThan(b1);
        const [r2, , b2] = blackbodyRGB(25000);
        expect(b2).toBeGreaterThan(r2);
    });

    it('fills a lookup across its whole range', () => {
        const t = blackbodyTable(64);
        expect(t.length).toBe(256);
        expect(blackbodyCoord(BLACKBODY_MIN_K)).toBe(0);
        expect(blackbodyCoord(BLACKBODY_MAX_K)).toBe(1);
        expect(t.every(Number.isFinite)).toBe(true);
    });
});
