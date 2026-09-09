import { describe, it, expect } from 'vitest';
import * as THREE from 'three';
import { makeGravityGrid } from './gravityGrid';
import { MAX_GRAVITY_BODIES } from './gravityModel';

// jsdom has no WebGL, so this covers the CPU side only: that update() lands the
// right numbers in the uniforms and the layout width eases with the scale.

const make = () => makeGravityGrid({
    segments: 64,
    halfExtent: 480,
    halfExtentTrue: 2200,
    cells: 96,
    orientation: new THREE.Quaternion(),
});

const bodies = [
    { pos: new THREE.Vector3(0, 0, 0),  weights: { gridDepth: 34, gridRadius: 95 } },
    { pos: new THREE.Vector3(96, 0, 0), weights: { gridDepth: 9,  gridRadius: 45 } },
];

describe('warped grid', () => {
    it('builds a dense mesh and starts invisible', () => {
        const g = make();
        expect(g.mesh.geometry.attributes.position.count).toBeGreaterThan(25 * 25);
        expect(g.mesh.material.uniforms.uOpacity.value).toBe(0);
        g.dispose();
    });

    it('writes body position and weight into the uniform arrays', () => {
        const g = make();
        g.update(bodies, 0);
        const u = g.mesh.material.uniforms;
        expect(u.uCount.value).toBe(2);
        expect(u.uBodies.value[1].x).toBeCloseTo(96, 3);
        expect(u.uBodies.value[1].y).toBe(9);       // depth rides in .y
        expect(u.uRadii.value[0]).toBe(95);
        g.dispose();
    });

    it('eases the half-extent from compressed toward true distances', () => {
        const g = make();
        g.update(bodies, 0);
        expect(g.mesh.material.uniforms.uHalfExtent.value).toBe(480);
        g.update(bodies, 1);
        expect(g.mesh.material.uniforms.uHalfExtent.value).toBe(2200);
        g.update(bodies, 0.5);
        expect(g.mesh.material.uniforms.uHalfExtent.value).toBeCloseTo(1340, 3);
        g.dispose();
    });

    it('never writes past the shader cap', () => {
        const g = make();
        const many = Array.from({ length: MAX_GRAVITY_BODIES + 6 }, (_, i) => ({
            pos: new THREE.Vector3(i, 0, 0), weights: { gridDepth: 5, gridRadius: 20 },
        }));
        g.update(many, 0);
        expect(g.mesh.material.uniforms.uCount.value).toBe(MAX_GRAVITY_BODIES);
        g.dispose();
    });

    it('setOpacity drives the fade', () => {
        const g = make();
        g.setOpacity(0.7);
        expect(g.mesh.material.uniforms.uOpacity.value).toBe(0.7);
        g.dispose();
    });
});
