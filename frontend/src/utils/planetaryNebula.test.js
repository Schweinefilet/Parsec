import { describe, it, expect } from 'vitest';
import {
    RING, LINES, SHELL, lineRGB, paletteColours, ionisingFraction, ionisingPhotonRate, stromgrenRadius,
    expansionAge, shellRadius, nebulaDensity, zoneWeights, ALPHA_B,
} from './planetaryNebula';

const PC_CM = 3.0857e18;

describe('the Ring Nebula', () => {
    it('draws each line in its own colour: H-α and [N II] red, [O III] teal, He II blue', () => {
        const [r1, g1, b1] = lineRGB(LINES.ha.nm);
        expect(r1).toBeGreaterThan(10 * g1);
        expect(b1).toBe(0);
        const [r2, g2, b2] = lineRGB(LINES.o3.nm);
        expect(g2).toBeGreaterThan(r2);
        expect(b2).toBeGreaterThan(0.2 * g2);
        const [r3, g3, b3] = lineRGB(LINES.he2.nm);
        expect(b3).toBeGreaterThan(g3);
        expect(b3).toBeGreaterThan(r3);
        // [N II] sits 2 nm from H-α: the eye can't tell them apart.
        const n2 = lineRGB(LINES.n2.nm);
        expect(n2[0] / (n2[0] + n2[1])).toBeCloseTo(r1 / (r1 + g1), 1);
    });

    it('weights the lines by the eye’s sensitivity: a watt of [O III] looks brighter than a watt of H-α', () => {
        const lum = ([r, g, b]) => 0.2126 * r + 0.7152 * g + 0.0722 * b;
        expect(lum(lineRGB(LINES.o3.nm))).toBeGreaterThan(3 * lum(lineRGB(LINES.ha.nm)));
    });

    it('maps the Hubble palette sulphur–hydrogen–oxygen to red–green–blue', () => {
        const c = paletteColours('hubble');
        expect(c.s2[0]).toBeGreaterThan(c.s2[2]);
        expect(c.ha[1]).toBeGreaterThan(c.ha[0]);
        expect(c.o3[2]).toBeGreaterThan(c.o3[0]);
        expect(Object.keys(paletteColours('eye'))).toEqual(Object.keys(LINES));
    });

    it('has a star hot enough to ionise its nebula, and a Sun that isn’t', () => {
        expect(ionisingFraction(5772)).toBeLessThan(1e-8);
        expect(ionisingFraction(135000)).toBeGreaterThan(0.75);
        expect(ionisingFraction(30000)).toBeGreaterThan(ionisingFraction(20000));
        // 310 suns in 31 eV photons, most of them ionising: about 2 × 10^46 a second.
        const Q = ionisingPhotonRate(RING.starTemp, RING.starLuminosity);
        expect(Math.log10(Q)).toBeGreaterThan(46);
        expect(Math.log10(Q)).toBeLessThan(46.6);
    });

    it('matches Strömgren’s closed form, and could ionise a region the Ring’s size', () => {
        const Q = 1e47;
        const n = 1000;
        expect(stromgrenRadius(Q, n)).toBeCloseTo(Math.cbrt((3 * Q) / (4 * Math.PI * n * n * ALPHA_B)), 6);
        // Four times the density, the radius shrinks by 4^(2/3).
        expect(stromgrenRadius(Q, 4 * n) / stromgrenRadius(Q, n)).toBeCloseTo(Math.pow(4, -2 / 3), 10);
        // The ring's density is a few hundred per cm³; its radius about 0.15 pc.
        const R = stromgrenRadius(ionisingPhotonRate(RING.starTemp, RING.starLuminosity), 600) / PC_CM;
        expect(R).toBeGreaterThan(0.1);
        expect(R).toBeLessThan(0.6);
    });

    it('is a few thousand years old at a few tens of km/s', () => {
        // 1 AU/yr is 4.74 km/s.
        expect(expansionAge(1, 4.74047)).toBeCloseTo(1000, 0);
        const age = expansionAge(SHELL.a, 30);
        expect(age).toBeGreaterThan(3000);
        expect(age).toBeLessThan(8000);
    });

    it('is densest in the ring round its waist, thinner over the poles and inside', () => {
        const waist = nebulaDensity(SHELL.a, 0, 0);
        expect(shellRadius(SHELL.a, 0, 0)).toBeCloseTo(1, 12);
        expect(nebulaDensity(0, 0, SHELL.c)).toBeLessThan(0.5 * waist);
        expect(nebulaDensity(0, 0, 0)).toBeLessThan(0.25 * waist);
        expect(nebulaDensity(SHELL.a * 1.7, 0, 0)).toBeLessThan(0.1 * waist);
        expect(nebulaDensity(SHELL.a * 1.7, 0, 0)).toBeGreaterThanOrEqual(0);
    });

    it('layers its colours: helium and oxygen inside, nitrogen at the edge', () => {
        const inner = zoneWeights(0.4);
        const edge = zoneWeights(1.02);
        expect(inner.he2).toBeCloseTo(1, 6);
        expect(inner.o3).toBeCloseTo(1, 6);
        expect(edge.he2).toBe(0);
        expect(edge.o3).toBeLessThan(0.05);
        expect(edge.n2).toBeGreaterThan(inner.n2 * 5);
        expect(edge.ha).toBeGreaterThan(0.9);
        // The halo is lit too (its density, not its ionisation, keeps it faint).
        expect(zoneWeights(1.6).ha).toBe(1);
        expect(zoneWeights(1.6).he2).toBe(0);
    });
});
