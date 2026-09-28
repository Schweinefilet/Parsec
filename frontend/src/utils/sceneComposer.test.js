import { describe, it, expect, vi } from 'vitest';
import { createSceneRenderer, BLOOM_LAYER, OCCLUDER_LAYER } from './sceneComposer.js';

describe('createSceneRenderer', () => {
    it('is a plain renderer.render() with no bloom config', () => {
        const renderer = { render: vi.fn() };
        const scene = {}, camera = {};
        const r = createSceneRenderer(renderer, scene, camera, null);
        expect(r.active).toBe(false);
        r.render();
        expect(renderer.render).toHaveBeenCalledTimes(1);
        expect(renderer.render).toHaveBeenCalledWith(scene, camera);
        // The rest are safe no-ops on this path
        r.setSize(100, 100, 1);
        r.setGain(2);
        r.dispose();
    });

    it('keeps its layers off the default layer and apart from each other', () => {
        expect(BLOOM_LAYER).not.toBe(0);
        expect(OCCLUDER_LAYER).not.toBe(0);
        expect(BLOOM_LAYER).not.toBe(OCCLUDER_LAYER);
    });
});
