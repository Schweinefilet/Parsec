import { useEffect, useRef } from 'react';
import * as THREE from 'three';
import { UnrealBloomPass } from 'three/examples/jsm/postprocessing/UnrealBloomPass.js';
import { FullScreenQuad } from 'three/examples/jsm/postprocessing/Pass.js';
import { FULLSCREEN_VERT, COMPOSITE_FRAG } from '../utils/gargantuaShaders';
import { EXOTIC_FRAGS } from '../utils/exoticShaders';
import { blackbodyTable, BLACKBODY_MIN_K, BLACKBODY_MAX_K } from '../utils/blackbody';
import { damp, nearestAngle, cameraFrame } from '../utils/gargantuaCamera';
import { EXOTIC, DEFAULT_SKY, exoticQuality, clampExoticCamera, turnFrame } from '../utils/exoticScenes';
import { traversePose } from '../utils/wormhole';
import { positions } from '../utils/roche';
import { createExoticScene } from './exoticSceneSetup';

// The /exotic objects, ray traced per pixel. The same plumbing as
// Gargantua3D: no scene graph, one full-screen fragment shader per object
// (utils/exoticShaders.js), then bloom, then Gargantua's film curve.
//
// Built once per object in an effect with no dependencies; the page remounts
// it (by key) to switch object or after a lost context. The camera, the
// physics clocks and everything else that moves per frame live in plain
// objects the loop reads. Settings come in through a ref; readouts go out
// through onHud a few times a second.

const HUD_MS = 250;

export default function Exotic3D({ id, settings, shot, onHud, onShotDone, onLost }) {
    const mountRef = useRef(null);
    const settingsRef = useRef(settings);
    const shotRef = useRef(shot);
    const hudRef = useRef(onHud);
    const doneRef = useRef(onShotDone);
    const lostRef = useRef(onLost);
    const idRef = useRef(id);
    useEffect(() => { settingsRef.current = settings; }, [settings]);
    useEffect(() => { shotRef.current = shot; }, [shot]);
    useEffect(() => { hudRef.current = onHud; }, [onHud]);
    useEffect(() => { doneRef.current = onShotDone; }, [onShotDone]);
    useEffect(() => { lostRef.current = onLost; }, [onLost]);

    useEffect(() => {
        const mount = mountRef.current;
        const sceneId = idRef.current;
        const def = EXOTIC[sceneId];
        let renderer;
        try {
            renderer = new THREE.WebGLRenderer({
                antialias: false, alpha: false, depth: false, stencil: false,
                powerPreference: 'high-performance',
            });
        } catch {
            lostRef.current?.('nowebgl');
            return undefined;
        }
        if (!renderer.capabilities.isWebGL2) {
            renderer.dispose();
            lostRef.current?.('nowebgl');
            return undefined;
        }
        renderer.autoClear = false;
        const canvas = renderer.domElement;
        canvas.style.cssText = 'display:block;width:100%;height:100%;touch-action:none;cursor:grab';
        mount.appendChild(canvas);

        // ── lookups ──────────────────────────────────────────────────────────
        const BB_SIZE = 512;
        const bbTex = new THREE.DataTexture(blackbodyTable(BB_SIZE), BB_SIZE, 1, THREE.RGBAFormat, THREE.FloatType);
        bbTex.magFilter = THREE.LinearFilter;
        bbTex.minFilter = THREE.LinearFilter;
        bbTex.wrapS = THREE.ClampToEdgeWrapping;
        bbTex.needsUpdate = true;
        const skyDef = { ...DEFAULT_SKY, ...def.sky };
        const skyBase = new THREE.Matrix4().makeRotationFromEuler(new THREE.Euler(...skyDef.euler, 'XYZ'));
        const skyTurn = new THREE.Matrix4();
        const skyRot = new THREE.Matrix3().setFromMatrix4(skyBase);

        // ── passes ───────────────────────────────────────────────────────────
        const scene = createExoticScene(sceneId, renderer);
        const traceUniforms = {
            uResolution: { value: new THREE.Vector2(1, 1) },
            uCamPos: { value: new THREE.Vector3() },
            uCamRight: { value: new THREE.Vector3() },
            uCamUp: { value: new THREE.Vector3() },
            uCamFwd: { value: new THREE.Vector3() },
            uTanHalfFov: { value: 0.4 },
            uPixelAngle: { value: 0.001 },
            uTime: { value: 0 },
            uStepScale: { value: 0.03 },
            uMaxSteps: { value: 700 },
            uEscape: { value: 60 },
            uBlackbody: { value: bbTex },
            uBlackbodyRange: { value: new THREE.Vector2(Math.log(BLACKBODY_MIN_K), Math.log(BLACKBODY_MAX_K)) },
            uSkyRot: { value: skyRot },
            uStarGain: { value: 0.6 },
            uMilkyWay: { value: skyDef.milkyWay },
            ...scene.uniforms,
        };
        const traceMat = new THREE.ShaderMaterial({
            glslVersion: THREE.GLSL3,
            uniforms: traceUniforms,
            vertexShader: FULLSCREEN_VERT,
            fragmentShader: EXOTIC_FRAGS[sceneId],
            depthTest: false,
            depthWrite: false,
        });
        const compositeUniforms = {
            tScene: { value: null },
            uExposure: { value: def.exposure },
            uFade: { value: 0 },
            uTime: { value: 0 },
            uGrain: { value: 0.02 },
            uAberration: { value: 0.01 },
            uAspect: { value: new THREE.Vector2(1, 1) },
        };
        const compositeMat = new THREE.ShaderMaterial({
            glslVersion: THREE.GLSL3,
            uniforms: compositeUniforms,
            vertexShader: FULLSCREEN_VERT,
            fragmentShader: COMPOSITE_FRAG,
            depthTest: false,
            depthWrite: false,
        });
        const traceQuad = new FullScreenQuad(traceMat);
        const compositeQuad = new FullScreenQuad(compositeMat);
        const target = new THREE.WebGLRenderTarget(1, 1, {
            type: THREE.HalfFloatType,
            depthBuffer: false,
            magFilter: THREE.LinearFilter,
            minFilter: THREE.LinearFilter,
        });
        const bloom = new UnrealBloomPass(new THREE.Vector2(1, 1), 0.5, 0.8, 1.4);

        // ── sizing ───────────────────────────────────────────────────────────
        const size = { w: 1, h: 1, scale: 0, dpr: 1 };
        const resize = () => {
            const w = Math.max(1, mount.clientWidth);
            const h = Math.max(1, mount.clientHeight);
            const dpr = Math.min(window.devicePixelRatio || 1, 2);
            const { scale } = exoticQuality(sceneId, settingsRef.current.quality);
            if (w === size.w && h === size.h && dpr === size.dpr && scale === size.scale) return;
            Object.assign(size, { w, h, dpr, scale });
            renderer.setPixelRatio(dpr);
            renderer.setSize(w, h, false);
            const tw = Math.max(1, Math.round(w * dpr * scale));
            const th = Math.max(1, Math.round(h * dpr * scale));
            target.setSize(tw, th);
            bloom.setSize(tw, th);
            traceUniforms.uResolution.value.set(tw, th);
            compositeUniforms.uAspect.value.set(w / h, 1);
        };
        const ro = new ResizeObserver(resize);
        ro.observe(mount);
        resize();

        // ── state the loop owns ──────────────────────────────────────────────
        const cam = { ...def.start, roll: 0, turn: 0 };
        const first = def.shots[def.shotOrder[0]];
        const goal = { dist: first.dist, az: def.start.az + 0.3, el: first.el, fov: first.fov, roll: 0, turn: 0 };
        const look = [0, 0, 0];
        let lookGoal = [0, 0, 0];
        let fade = 0;
        let appliedShot = null;
        let traverse = null; // { t } while the wormhole's "Go through" runs
        let following = false; // a shot that lets the scene frame itself
        let lastInput = -1e9;

        const applyShot = (shotId) => {
            const s = def.shots[shotId] ?? first;
            traverse = s.scripted ? { t: 0 } : null;
            following = !!s.follow;
            goal.dist = s.dist;
            goal.el = s.el;
            goal.fov = s.fov;
            goal.turn = s.turn ?? 0;
            goal.roll = 0;
            lookGoal = s.target === 'accretor' ? [positions(settingsRef.current.q).xa, 0, 0] : [0, 0, 0];
            // Jump straight to the far side rather than flying through to it.
            if (sceneId === 'wormhole' && Math.sign(goal.dist) !== Math.sign(cam.dist) && !traverse) {
                cam.dist = goal.dist * 1.6;
                cam.turn = goal.turn;
                fade = 0;
            }
            if (traverse) cam.turn = 0;
        };

        // ── input ────────────────────────────────────────────────────────────
        // One pointer orbits; two pinch, the touch twin of the wheel.
        let drag = null;
        const pointers = new Map();
        let pinch = 0;
        const spread = () => {
            const [a, b] = [...pointers.values()];
            return Math.hypot(a.x - b.x, a.y - b.y) || 1;
        };
        const zoom = (factor) => {
            if (traverse) { traverse = null; goal.dist = cam.dist; }
            following = false;
            goal.dist *= factor;
            Object.assign(goal, clampExoticCamera(sceneId, goal));
            lastInput = performance.now();
        };
        const onDown = (e) => {
            canvas.setPointerCapture?.(e.pointerId);
            pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
            if (pointers.size === 2) { pinch = spread(); drag = null; } else drag = { x: e.clientX, y: e.clientY };
            canvas.style.cursor = 'grabbing';
            lastInput = performance.now();
        };
        const onMove = (e) => {
            if (pointers.has(e.pointerId)) pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
            if (pinch && pointers.size >= 2) {
                const d = spread();
                zoom(pinch / d);
                pinch = d;
                return;
            }
            if (!drag) return;
            const dx = e.clientX - drag.x;
            const dy = e.clientY - drag.y;
            drag = { x: e.clientX, y: e.clientY };
            // Looking back through the throat the view is turned round, so a
            // drag has to turn the other way to feel the same.
            const flip = Math.cos(cam.turn) < 0 ? -1 : 1;
            goal.az -= flip * dx * 0.0045;
            goal.el += dy * 0.0035;
            Object.assign(goal, clampExoticCamera(sceneId, goal));
            lastInput = performance.now();
        };
        const onUp = (e) => {
            pointers.delete(e.pointerId);
            if (pointers.size < 2) pinch = 0;
            // The finger left behind after a pinch carries on orbiting from
            // where it is, not from where the first one went down.
            const rest = [...pointers.values()][0];
            drag = pointers.size === 1 ? { ...rest } : null;
            if (!pointers.size) canvas.style.cursor = 'grab';
        };
        const onWheel = (e) => {
            e.preventDefault();
            zoom(Math.exp(e.deltaY * 0.0012));
        };
        canvas.addEventListener('pointerdown', onDown);
        canvas.addEventListener('pointermove', onMove);
        canvas.addEventListener('pointerup', onUp);
        canvas.addEventListener('pointercancel', onUp);
        canvas.addEventListener('wheel', onWheel, { passive: false });

        let lost = false;
        const onContextLost = (e) => {
            e.preventDefault();
            lost = true;
            lostRef.current?.('lost');
        };
        canvas.addEventListener('webglcontextlost', onContextLost);

        // ── loop ─────────────────────────────────────────────────────────────
        let raf = 0;
        let last = performance.now();
        let hudAt = 0;
        let frames = 0;
        let fpsAt = last;
        let fps = 0;

        const frame = (now) => {
            raf = requestAnimationFrame(frame);
            if (lost) return;
            // The first frame's timestamp can come before `last`: never step back.
            const dt = Math.min(Math.max((now - last) / 1000, 0), 0.25);
            last = now;
            const s = settingsRef.current;
            resize();

            if (shotRef.current && shotRef.current.nonce !== appliedShot) {
                appliedShot = shotRef.current.nonce;
                applyShot(shotRef.current.id);
            }

            if (traverse) {
                traverse.t += dt;
                const p = traversePose(traverse.t);
                cam.dist = p.l;
                cam.turn = p.turn;
                goal.dist = p.l;
                goal.turn = p.turn;
                if (p.done) {
                    traverse = null;
                    doneRef.current?.('through');
                }
            } else {
                if (s.cinematic && !drag && now - lastInput > 4000) goal.az += dt * 0.03;
                cam.dist = damp(cam.dist, goal.dist, fade < 0.99 ? 0.8 : 1.6, dt);
                cam.turn = damp(cam.turn, goal.turn, 1.6, dt);
            }
            cam.az = damp(cam.az, nearestAngle(cam.az, goal.az), 2.4, dt);
            cam.el = damp(cam.el, goal.el, 1.9, dt);
            cam.fov = damp(cam.fov, goal.fov, 1.5, dt);
            for (let i = 0; i < 3; i++) look[i] = damp(look[i], lookGoal[i], 1.6, dt);
            fade = damp(fade, 1, 0.9, dt);

            const u = traceUniforms;
            const q = exoticQuality(sceneId, s.quality);
            u.uStepScale.value = q.stepScale;
            u.uMaxSteps.value = q.maxSteps;
            u.uTanHalfFov.value = Math.tan(cam.fov / 2);
            u.uPixelAngle.value = (2 * Math.tan(cam.fov / 2)) / u.uResolution.value.y;

            const hud = scene.update({ dt, s, u, cam }) ?? {};
            // The disruption's "Follow" shot: the scene says how far out.
            if (following && hud.frameDist) {
                goal.dist = clampExoticCamera(sceneId, { ...goal, dist: hud.frameDist }).dist;
            }
            // A system that orbits (Roche) turns under a camera that holds
            // still: in its own turning frame the camera goes the other way
            // round and the sky turns with it.
            const turned = hud.skyTurn ?? 0;
            const f = turnFrame(cameraFrame({
                dist: Math.max(Math.abs(cam.dist), 1e-3), az: cam.az - turned, el: cam.el, roll: cam.roll,
            }), cam.turn);
            u.uCamPos.value.fromArray(f.pos.map((v, i) => v + look[i]));
            u.uCamRight.value.fromArray(f.right);
            u.uCamUp.value.fromArray(f.up);
            u.uCamFwd.value.fromArray(f.fwd);
            if (turned) {
                skyRot.setFromMatrix4(skyTurn.makeRotationZ(turned).premultiply(skyBase));
            }

            renderer.setRenderTarget(target);
            traceQuad.render(renderer);
            bloom.render(renderer, null, target, dt, false);
            renderer.setRenderTarget(null);
            compositeUniforms.tScene.value = target.texture;
            // A scene can fade itself out and in (the disruption between runs).
            compositeUniforms.uFade.value = fade * (hud.fade ?? 1);
            compositeUniforms.uTime.value = now / 1000;
            compositeQuad.render(renderer);

            frames += 1;
            if (now - fpsAt >= 1000) {
                fps = (frames * 1000) / (now - fpsAt);
                frames = 0;
                fpsAt = now;
            }
            if (now - hudAt > HUD_MS) {
                hudAt = now;
                hudRef.current?.({
                    ...hud, dist: cam.dist, fps,
                    pixels: u.uResolution.value.x * u.uResolution.value.y,
                    traversing: !!traverse,
                });
            }
        };
        raf = requestAnimationFrame(frame);

        return () => {
            cancelAnimationFrame(raf);
            ro.disconnect();
            canvas.removeEventListener('pointerdown', onDown);
            canvas.removeEventListener('pointermove', onMove);
            canvas.removeEventListener('pointerup', onUp);
            canvas.removeEventListener('pointercancel', onUp);
            canvas.removeEventListener('wheel', onWheel);
            canvas.removeEventListener('webglcontextlost', onContextLost);
            traceQuad.dispose();
            compositeQuad.dispose();
            traceMat.dispose();
            compositeMat.dispose();
            target.dispose();
            bloom.dispose();
            bbTex.dispose();
            scene.dispose?.();
            renderer.dispose();
            renderer.forceContextLoss();
            canvas.remove();
        };
    }, []);

    return <div ref={mountRef} style={{ position: 'absolute', inset: 0 }} />;
}

