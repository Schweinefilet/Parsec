import { describe, it, expect } from 'vitest';
import {
    createSunSurfaceMaterial, setSunSurfaceMap,
    createCoronaMaterial, createCoronaMesh, CORONA_EXTENT,
    createSunGlare, setSunGlare,
} from './sunShaders.js';

describe('createSunSurfaceMaterial', () => {
    it('starts on the fallback colour until the photograph arrives', () => {
        const mat = createSunSurfaceMaterial();
        expect(mat.uniforms.hasMap.value).toBe(0);
        expect(mat.uniforms.map.value).toBeNull();
        const tex = { isTexture: true };
        setSunSurfaceMap(mat, tex);
        expect(mat.uniforms.hasMap.value).toBe(1);
        expect(mat.uniforms.map.value).toBe(tex);
    });

    it('compiles the tier\'s noise detail in as a constant', () => {
        expect(createSunSurfaceMaterial({ octaves: 2 }).defines.OCTAVES).toBe(2);
        expect(createSunSurfaceMaterial({ octaves: 4 }).defines.OCTAVES).toBe(4);
    });

    it('goes through the renderer\'s tone mapping like the material it replaced', () => {
        const { fragmentShader } = createSunSurfaceMaterial();
        expect(fragmentShader).toContain('#include <tonemapping_fragment>');
        expect(fragmentShader).toContain('#include <colorspace_fragment>');
    });
});

describe('createCoronaMaterial', () => {
    it('is sized in solar radii off the Sun it is given', () => {
        const mat = createCoronaMaterial({ radius: 12, octaves: 3 });
        expect(mat.uniforms.uRadius.value).toBe(12);
        expect(mat.uniforms.uExtent.value).toBe(CORONA_EXTENT);
        // Past the limb, or it would be hidden inside the disc entirely
        expect(CORONA_EXTENT).toBeGreaterThan(1);
    });

    it('adds light without writing depth, and is hidden by what is in front', () => {
        const mat = createCoronaMaterial({ radius: 12 });
        expect(mat.depthWrite).toBe(false);
        expect(mat.depthTest).toBe(true);
        expect(mat.transparent).toBe(true);
    });

    it('is never frustum-culled on its unexpanded bounds', () => {
        const mesh = createCoronaMesh(createCoronaMaterial({ radius: 12 }));
        expect(mesh.frustumCulled).toBe(false);
    });
});

describe('the wide glare', () => {
    it('starts hidden and is only drawn while it has any brightness', () => {
        const glare = createSunGlare();
        expect(glare.material.uniforms.uGain.value).toBe(0);
        setSunGlare(glare, { sizePx: 900, viewportW: 1440, viewportH: 900, gain: 1.8 });
        expect(glare.visible).toBe(true);
        expect(glare.material.uniforms.uSizePx.value).toBe(900);
        expect(glare.material.uniforms.uViewport.value.x).toBe(1440);
        setSunGlare(glare, { sizePx: 900, viewportW: 1440, viewportH: 900, gain: 0 });
        expect(glare.visible).toBe(false);
    });

    it('carries its own alpha, not the stock additive blend', () => {
        const { material, frustumCulled } = createSunGlare();
        expect(material.blending).not.toBe(2); // THREE.AdditiveBlending
        expect(material.depthWrite).toBe(false);
        expect(frustumCulled).toBe(false);
    });
});
