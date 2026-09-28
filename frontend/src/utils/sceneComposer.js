// How a frame of the solar-system scene reaches the screen.
//
// Everywhere, the scene is drawn exactly as it always was: one
// renderer.render() straight to the canvas. On the desktop tier
// (quality.js `bloom`) the Sun's glare is then added on top of that frame:
//
//   1. Into a half-resolution half-float target, draw every body that can
//      stand in front of the Sun (OCCLUDER_LAYER) as flat black, for depth.
//   2. Into the same target, draw the Sun's disc and corona (BLOOM_LAYER).
//      The bodies from step 1 hide exactly the part of it they cover.
//   3. Blur that with three's UnrealBloomPass (its mip chain, not its own
//      final blend, which would overwrite the canvas).
//   4. Add the blurred glare onto the canvas, doing the exposure and sRGB
//      encode that three only applies to materials drawn to the screen.
//
// Why not the textbook route — the whole scene through an EffectComposer in
// a half-float target, with a luminance threshold picking out the Sun? It
// was tried first and it changes the whole picture: translucent things (the
// orbit lines, belts, rings) blend in linear light in a float target, and in
// sRGB-encoded values on the canvas, so every orbit line came out several
// times brighter. It also cost a full-resolution multisampled float target
// every frame, broke Lensflare's pixel read-back (illegal from a
// multisampled framebuffer), and needed Earth's raw shader corrected by
// hand. Glaring only the Sun leaves every other pixel of the frame exactly
// as it was, for the price of drawing a few spheres at half resolution.

import * as THREE from 'three';
import { UnrealBloomPass } from 'three/examples/jsm/postprocessing/UnrealBloomPass.js';
import { FullScreenQuad } from 'three/examples/jsm/postprocessing/Pass.js';

/** Layer the Sun's disc and corona are also drawn on, for the glare source. */
export const BLOOM_LAYER = 1;
/** Layer every body that can eclipse the Sun is also drawn on. */
export const OCCLUDER_LAYER = 2;

// The glare onto the canvas. The canvas holds sRGB-encoded, tone-mapped
// pixels; the glare is linear, so it gets the renderer's own Linear tone
// mapping (exposure, then clamp) and the sRGB encode before being added.
// Alpha is summed too, for a canvas that is transparent where nothing was
// drawn: there the page composites rgb * alpha, so the glare carries its own.
const compositeMaterial = () => new THREE.ShaderMaterial({
    uniforms: {
        tBloom:   { value: null },
        exposure: { value: 1 },
        gain:     { value: 1 },
    },
    vertexShader: /* glsl */ `
        varying vec2 vUv;
        void main() { vUv = uv; gl_Position = vec4(position.xy, 0.0, 1.0); }
    `,
    fragmentShader: /* glsl */ `
        uniform sampler2D tBloom;
        uniform float exposure;
        uniform float gain;
        varying vec2 vUv;
        vec3 srgbEncode(vec3 c) {
            vec3 lo = c * 12.92;
            vec3 hi = 1.055 * pow(c, vec3(1.0 / 2.4)) - 0.055;
            return mix(lo, hi, step(vec3(0.0031308), c));
        }
        void main() {
            vec3 c = clamp(texture2D(tBloom, vUv).rgb * exposure * gain, 0.0, 1.0);
            vec3 rgb = srgbEncode(c);
            gl_FragColor = vec4(rgb, clamp(max(rgb.r, max(rgb.g, rgb.b)), 0.0, 1.0));
        }
    `,
    depthTest: false,
    depthWrite: false,
    transparent: true,
    blending: THREE.CustomBlending,
    blendEquation: THREE.AddEquation,
    blendSrc: THREE.OneFactor,
    blendDst: THREE.OneFactor,
    blendSrcAlpha: THREE.OneFactor,
    blendDstAlpha: THREE.OneFactor,
});

/**
 * @param {THREE.WebGLRenderer} renderer
 * @param {THREE.Scene} scene
 * @param {THREE.Camera} camera
 * @param {?{strength:number, radius:number, threshold:number, resolution?:number}} cfg
 *   null for the direct path, where render() is renderer.render() and nothing else.
 */
export function createSceneRenderer(renderer, scene, camera, cfg) {
    if (!cfg) {
        return {
            active: false,
            render() { renderer.render(scene, camera); },
            setSize() {},
            setGain() {},
            dispose() {},
        };
    }

    const scale = cfg.resolution ?? 0.5;
    const drawSize = () => {
        const s = renderer.getDrawingBufferSize(new THREE.Vector2());
        return [Math.max(1, Math.round(s.x * scale)), Math.max(1, Math.round(s.y * scale))];
    };
    const [w0, h0] = drawSize();
    const source = new THREE.WebGLRenderTarget(w0, h0, { type: THREE.HalfFloatType });
    const bloom = new UnrealBloomPass(new THREE.Vector2(w0, h0), cfg.strength, cfg.radius, cfg.threshold);
    const black = new THREE.MeshBasicMaterial({ color: 0x000000 });
    const composite = compositeMaterial();
    const quad = new FullScreenQuad(composite);
    const clearColor = new THREE.Color();

    return {
        active: true,
        render() {
            renderer.render(scene, camera);

            const mask = camera.layers.mask;
            const autoClear = renderer.autoClear;
            const clearAlpha = renderer.getClearAlpha();
            renderer.getClearColor(clearColor);

            renderer.setRenderTarget(source);
            renderer.setClearColor(0x000000, 0);
            renderer.clear();
            renderer.autoClear = false;

            scene.overrideMaterial = black;
            camera.layers.set(OCCLUDER_LAYER);
            renderer.render(scene, camera);
            scene.overrideMaterial = null;

            camera.layers.set(BLOOM_LAYER);
            renderer.render(scene, camera);
            camera.layers.mask = mask;

            // Blends the glare back into `source` too, which is never read
            // again; what matters is the finished mip composite it leaves in
            // renderTargetsHorizontal[0].
            bloom.render(renderer, null, source, 0, false);

            renderer.setRenderTarget(null);
            composite.uniforms.tBloom.value = bloom.renderTargetsHorizontal[0].texture;
            composite.uniforms.exposure.value = renderer.toneMappingExposure;
            quad.render(renderer);

            renderer.autoClear = autoClear;
            renderer.setClearColor(clearColor, clearAlpha);
        },
        setSize() {
            const [w, h] = drawSize();
            source.setSize(w, h);
            bloom.setSize(w, h);
        },
        /** Scales the glare's brightness (0 turns it off without skipping the work). */
        setGain(gain) { composite.uniforms.gain.value = gain; },
        dispose() {
            source.dispose();
            bloom.dispose();
            black.dispose();
            composite.dispose();
            quad.dispose();
        },
    };
}
