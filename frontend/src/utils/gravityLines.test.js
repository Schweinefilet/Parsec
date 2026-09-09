import { describe, it, expect } from 'vitest';
import * as THREE from 'three';
import { makeGravityLines } from './gravityLines';
import { GRAVITY_FIELD_DEFAULTS } from './gravityField';

const bodies = [
    { pos: new THREE.Vector3(0, 0, 0),   color: '#FFF4A0', weights: { fieldMass: 60, minRadius: 20, lineCount: 14 } },
    { pos: new THREE.Vector3(96, 0, 0),  color: '#4fa3e0', weights: { fieldMass: 12, minRadius: 3,  lineCount: 9 } },
    { pos: new THREE.Vector3(-190, 0, 0), color: '#c1440e', weights: { fieldMass: 20, minRadius: 4, lineCount: 10 } },
];

// The colour buffer holds `tint * fade` per vertex; slice it to what's drawn.
const drawnColors = (l) => l.object.geometry.attributes.aColor.array
    .slice(0, l.object.geometry.drawRange.count * 3);
const range = (arr) => {
    let lo = Infinity, hi = -Infinity;
    for (let i = 0; i < arr.length; i++) { if (arr[i] < lo) lo = arr[i]; if (arr[i] > hi) hi = arr[i]; }
    return { lo, hi };
};

describe('field lines', () => {
    it('starts empty and invisible', () => {
        const l = makeGravityLines();
        expect(l.object.geometry.drawRange.count).toBe(0);
        expect(l.object.material.uniforms.uOpacity.value).toBe(0);
        l.dispose();
    });

    it('retrace fills the vertex buffer and reports totals', () => {
        const l = makeGravityLines();
        const r = l.retrace(bodies, { ...GRAVITY_FIELD_DEFAULTS, bounds: 520 });
        expect(r.lines).toBeGreaterThan(15);
        expect(r.segments).toBeGreaterThan(0);
        expect(l.object.geometry.drawRange.count).toBe(r.segments * 2);
        // colour = tint * fade, so it runs from ~full tint at the body end
        // down toward the dim seed end
        const { lo, hi } = range(drawnColors(l));
        expect(hi).toBeGreaterThan(0.6);    // near-full tint where a line meets its body
        expect(lo).toBeLessThan(0.2);       // dim at the seed end
        l.dispose();
    });

    it('grows the buffer rather than dropping segments', () => {
        const l = makeGravityLines({ initialCapacity: 200 });   // deliberately tiny
        const r = l.retrace(bodies, { ...GRAVITY_FIELD_DEFAULTS, bounds: 520 });
        expect(l.object.geometry.attributes.position.count).toBeGreaterThanOrEqual(r.segments * 2);
        expect(l.object.geometry.drawRange.count).toBe(r.segments * 2);
        l.dispose();
    });

    it('is stable across repeated retraces at the same positions', () => {
        const l = makeGravityLines();
        const a = l.retrace(bodies, { ...GRAVITY_FIELD_DEFAULTS, bounds: 520 });
        const b = l.retrace(bodies, { ...GRAVITY_FIELD_DEFAULTS, bounds: 520 });
        expect(b.segments).toBe(a.segments);
        l.dispose();
    });

    it('tints each line with the colour of the body it flows into', () => {
        const l = makeGravityLines();
        l.retrace(
            [{ pos: new THREE.Vector3(0, 0, 0), color: '#ff0000',
                weights: { fieldMass: 40, minRadius: 6, lineCount: 20 } }],
            { ...GRAVITY_FIELD_DEFAULTS, bounds: 400 },
        );
        const cols = drawnColors(l);
        let rSum = 0, gSum = 0, bSum = 0;
        for (let i = 0; i < cols.length; i += 3) { rSum += cols[i]; gSum += cols[i + 1]; bSum += cols[i + 2]; }
        // red body → red-dominant tint (the base blue is mixed most of the way out)
        expect(rSum).toBeGreaterThan(gSum);
        expect(rSum).toBeGreaterThan(bSum);
        l.dispose();
    });

    it('setOpacity drives the fade', () => {
        const l = makeGravityLines();
        l.setOpacity(0.5);
        expect(l.object.material.uniforms.uOpacity.value).toBe(0.5);
        l.dispose();
    });
});
