import { describe, it, expect } from 'vitest';
import * as THREE from 'three';
import { makeGravityLines } from './gravityLines';
import { GRAVITY_FIELD_DEFAULTS } from './gravityField';

const bodies = [
    { pos: new THREE.Vector3(0, 0, 0),   weights: { fieldMass: 60, minRadius: 20, lineCount: 14 } },
    { pos: new THREE.Vector3(96, 0, 0),  weights: { fieldMass: 12, minRadius: 3,  lineCount: 9 } },
    { pos: new THREE.Vector3(-190, 0, 0), weights: { fieldMass: 20, minRadius: 4, lineCount: 10 } },
];

describe('field lines', () => {
    it('starts empty and invisible', () => {
        const l = makeGravityLines();
        expect(l.object.geometry.drawRange.count).toBe(0);
        expect(l.object.material.uniforms.uOpacity.value).toBe(0);
        l.dispose();
    });

    it('retrace fills a segment buffer and reports totals', () => {
        const l = makeGravityLines();
        const r = l.retrace(bodies, { ...GRAVITY_FIELD_DEFAULTS, bounds: 520 });
        expect(r.lines).toBeGreaterThan(15);
        expect(r.segments).toBeGreaterThan(0);
        expect(l.object.geometry.drawRange.count).toBe(r.segments * 2);
        // fade attribute runs from ~1 down toward the tail value
        const fades = l.object.geometry.attributes.aFade.array;
        expect(Math.max(...fades.slice(0, l.object.geometry.drawRange.count))).toBeGreaterThan(0.9);
        expect(Math.min(...fades.slice(0, l.object.geometry.drawRange.count))).toBeLessThan(0.3);
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

    it('setOpacity drives the fade', () => {
        const l = makeGravityLines();
        l.setOpacity(0.5);
        expect(l.object.material.uniforms.uOpacity.value).toBe(0.5);
        l.dispose();
    });
});
