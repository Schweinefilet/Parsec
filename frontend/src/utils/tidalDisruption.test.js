import { describe, it, expect } from 'vitest';
import {
    STAR_RADIUS, M_KM, tidalRadius, parabolicL, circularL, circularE, constants, advance, energySpread,
    mostBoundA, mostBoundPeriod, shockRadial, circularisationRadius, createEvent, stepEvent, debrisBudget, tidalStretch,
} from './tidalDisruption';

// A particle on a circular orbit at r, moving counter-clockwise from +x.
const circular = (r) => [r, 0, 0, circularL(r) / r];

describe('tidal disruption', () => {
    it('tears a white dwarf apart at about 15 M of a ten-thousand-sun hole', () => {
        expect(M_KM).toBeCloseTo(14766, 0);
        expect(STAR_RADIUS).toBeCloseTo(8700 / 14766, 10);
        const rt = tidalRadius();
        expect(rt).toBeCloseTo(STAR_RADIUS * Math.cbrt(1e4 / 0.6), 10);
        expect(rt).toBeGreaterThan(14);
        expect(rt).toBeLessThan(16);
    });

    it('has the Schwarzschild orbits’ closed forms', () => {
        // A parabolic orbit's turning point is where E² = (1 − 2/r)(1 + L²/r²) = 1.
        for (const rp of [5, 10, 30]) {
            const L = parabolicL(rp);
            expect((1 - 2 / rp) * (1 + (L * L) / (rp * rp))).toBeCloseTo(1, 12);
        }
        expect(parabolicL(4)).toBeCloseTo(4, 12); // the capture edge
        // The ISCO: a circular orbit at 6M has E = √(8/9).
        expect(circularE(6)).toBeCloseTo(Math.sqrt(8 / 9), 12);
        expect(constants(...circular(6)).E).toBeCloseTo(Math.sqrt(8 / 9), 12);
    });

    it('keeps a circular orbit circular, turning at Kepler’s rate in coordinate time', () => {
        const r = 12;
        const s = circular(r);
        const { E } = constants(...s);
        const P = 2 * Math.PI * Math.pow(r, 1.5);
        advance(s, E, P, 0.005);
        expect(Math.hypot(s[0], s[1])).toBeCloseTo(r, 4);
        expect(s[0]).toBeCloseTo(r, 2);
        expect(Math.abs(s[1])).toBeLessThan(0.02);
        expect(constants(...s).E).toBeCloseTo(E, 8);
    });

    it('precesses by 6πM/p per orbit, far from the hole', () => {
        // An orbit between r = 400 and ~800: weak field, so the shift per
        // orbit is close to its first-order value, 6π/p with p = a(1 − e²).
        const rp = 400;
        const s = [rp, 0, 0, 1.15 * Math.sqrt(1 / rp)];
        const { E, L } = constants(...s);
        // The other turning point, where E² = (1 − 2/r)(1 + L²/r²).
        const V = (r) => (1 - 2 / r) * (1 + (L * L) / (r * r)) - E * E;
        let lo = rp * 1.01, hi = rp * 10;
        for (let i = 0; i < 200; i++) { const m = (lo + hi) / 2; if (V(m) < 0) lo = m; else hi = m; }
        const ra = lo;
        // Track the angle and find the next pericentre, interpolating where
        // the radial velocity changes sign.
        let phi = 0, prev = 0, lastUr = 0, lastPhi = 0, peri = null;
        const a = (rp + ra) / 2;
        const dt = 50;
        for (let t = 0; t < 2.2 * 2 * Math.PI * a ** 1.5; t += dt) {
            advance(s, E, dt, 0.004);
            const ang = Math.atan2(s[1], s[0]);
            let d = ang - prev;
            if (d < -Math.PI) d += 2 * Math.PI;
            if (d > Math.PI) d -= 2 * Math.PI;
            phi += d;
            prev = ang;
            const ur = s[0] * s[2] + s[1] * s[3];
            if (lastUr < 0 && ur >= 0 && phi > Math.PI) {
                peri = lastPhi + (phi - lastPhi) * (-lastUr / (ur - lastUr));
                break;
            }
            lastUr = ur;
            lastPhi = phi;
        }
        expect(ra).toBeGreaterThan(1.5 * rp);
        const p = (2 * rp * ra) / (rp + ra);
        expect(peri).not.toBeNull();
        // Within the step's resolution of the angle at pericentre.
        expect(peri - 2 * Math.PI).toBeCloseTo((6 * Math.PI) / p, 2);
    });

    it('swallows a parabolic orbit inside the capture edge and lets one outside go', () => {
        const fall = (rp) => {
            const L = parabolicL(rp) * (rp < 4 ? 0.98 : 1);
            const r0 = 60;
            const ur = -Math.sqrt(1 - (1 - 2 / r0) * (1 + (L * L) / (r0 * r0)));
            const s = [r0, 0, ur, L / r0];
            return advance(s, 1, 4000, 0.01);
        };
        expect(fall(4.6)).toBe(true);
        expect(fall(4)).toBe(false);
    });

    it('spreads the debris in energy as the frozen-in picture says, half of it bound', () => {
        const ev = createEvent(1);
        let guard = 0;
        while (ev.released == null && guard++ < 5000) stepEvent(ev, 2);
        expect(ev.released).not.toBeNull();
        let lo = Infinity, hi = -Infinity;
        for (let k = 0; k < ev.n; k++) { lo = Math.min(lo, ev.E[k]); hi = Math.max(hi, ev.E[k]); }
        // Within a fifth of ±R*/r_t², and centred on the star's parabolic E = 1.
        const dE = energySpread();
        expect((hi - lo) / 2).toBeGreaterThan(0.8 * dE);
        expect((hi - lo) / 2).toBeLessThan(1.25 * dE);
        expect(Math.abs((hi + lo) / 2 - 1)).toBeLessThan(0.1 * dE);
        const { bound, leaving } = debrisBudget(ev);
        expect(bound).toBeGreaterThan(0.4);
        expect(leaving).toBeGreaterThan(0.4);
        expect(bound + leaving).toBeCloseTo(1, 10);
    });

    it('brings the most bound debris back after a few hundred M’s swing, within minutes for this hole', () => {
        const a = mostBoundA();
        expect(a).toBeGreaterThan(80);
        expect(a).toBeLessThan(250);
        // Minutes of real time: M is 0.049 s here.
        const minutes = (mostBoundPeriod() * 0.049) / 60;
        expect(minutes).toBeGreaterThan(3);
        expect(minutes).toBeLessThan(30);
    });

    it('takes energy out at a shock but keeps the angular momentum, settling at about 2 r_p', () => {
        const c = circular(20);
        expect(shockRadial(c.slice(), 0.5)).toBeCloseTo(0, 10);
        const s = [20, 0, -0.1, 0.25];
        const before = constants(...s);
        const lost = shockRadial(s, 0.5);
        expect(lost).toBeCloseTo(0.5 * 0.01 * 0.75, 12);
        const after = constants(...s);
        expect(after.E).toBeLessThan(before.E);
        expect(after.L).toBeCloseTo(before.L, 12);
        // A circular orbit's own L puts it back where it is.
        expect(circularisationRadius(circularL(25))).toBeCloseTo(25, 9);
        // A parabolic orbit's settles about twice as far out as its pericentre.
        const rc = circularisationRadius(parabolicL(12));
        expect(rc / 12).toBeGreaterThan(1.7);
        expect(rc / 12).toBeLessThan(2.4);
    });

    it('stretches the star towards the hole as it nears the tidal radius', () => {
        expect(tidalStretch(1000, 15)).toBeCloseTo(1, 4);
        expect(tidalStretch(15, 15)).toBeCloseTo(1.8, 12);
        expect(tidalStretch(30, 15)).toBeLessThan(tidalStretch(20, 15));
    });
});
