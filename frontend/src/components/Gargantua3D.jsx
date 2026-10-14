import { useEffect, useRef } from 'react';
import * as THREE from 'three';
import { UnrealBloomPass } from 'three/examples/jsm/postprocessing/UnrealBloomPass.js';
import { FullScreenQuad } from 'three/examples/jsm/postprocessing/Pass.js';
import { FULLSCREEN_VERT, TRACE_FRAG, COMPOSITE_FRAG } from '../utils/gargantuaShaders';
import { blackbodyTable, BLACKBODY_MIN_K, BLACKBODY_MAX_K } from '../utils/blackbody';
import { horizonRadius, iscoRadius, hoverTimeDilation, ksGeometry } from '../utils/kerr';
import {
    QUALITY, SHOTS, divePose, damp, nearestAngle, cameraFrame, clampCamera,
} from '../utils/gargantuaCamera';

// Gargantua: the black hole from Interstellar, ray traced per pixel.
//
// Unlike the solar-system scene there is no scene graph here at all: one
// full-screen fragment shader (utils/gargantuaShaders.js) is the whole picture,
// then bloom, then a film curve. three.js is only the WebGL plumbing.
//
// The same rule as SolarSystem3D holds: the scene is built once in an effect
// with no dependencies, and everything that changes per frame — the camera,
// the disk's clock, the spin easing from one value to another — lives in refs
// and plain objects the render loop reads, never in React state. Settings come
// in as props and are copied into a ref; the readouts go out through onHud a
// few times a second.
//
// This page is meant to be expensive. Each pixel integrates its ray with
// fourth-order Runge–Kutta for up to thousands of steps; there is no
// adaptive resolution and no frame cap. The quality picker is the only brake.

const DEG = Math.PI / 180;
const HUD_MS = 250;
// Disk time, in units of GM/c³, that pass per real second far from the hole.
const TIME_RATE = 2.2;
const DISK_OUTER = 15;

export default function Gargantua3D({ settings, shot, onHud, onShotDone, onLost }) {
    const mountRef = useRef(null);
    const settingsRef = useRef(settings);
    const shotRef = useRef(shot);
    const hudRef = useRef(onHud);
    const doneRef = useRef(onShotDone);
    const lostRef = useRef(onLost);
    useEffect(() => { settingsRef.current = settings; }, [settings]);
    useEffect(() => { shotRef.current = shot; }, [shot]);
    useEffect(() => { hudRef.current = onHud; }, [onHud]);
    useEffect(() => { doneRef.current = onShotDone; }, [onShotDone]);
    useEffect(() => { lostRef.current = onLost; }, [onLost]);

    useEffect(() => {
        const mount = mountRef.current;
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

        const skyRot = new THREE.Matrix3().setFromMatrix4(
            new THREE.Matrix4().makeRotationFromEuler(new THREE.Euler(1.05, 0.35, 0.6, 'XYZ')),
        );

        // ── passes ───────────────────────────────────────────────────────────
        const traceUniforms = {
            uResolution: { value: new THREE.Vector2(1, 1) },
            uJitter: { value: new THREE.Vector2(0, 0) },
            uCamPos: { value: new THREE.Vector3() },
            uCamRight: { value: new THREE.Vector3() },
            uCamUp: { value: new THREE.Vector3() },
            uCamFwd: { value: new THREE.Vector3() },
            uTanHalfFov: { value: 0.4 },
            uPixelAngle: { value: 0.001 },
            uSpin: { value: 0.6 },
            uRh: { value: 1.8 },
            uIsco: { value: 3.8 },
            uDiskOuter: { value: DISK_OUTER },
            uDiskTemp: { value: 4500 },
            uDoppler: { value: 0 },
            uDiskGain: { value: 2.4 },
            uDiskOpacity: { value: 1.25 },
            uHaze: { value: 0.06 },
            uObsFactor: { value: 1 },
            uTime: { value: 0 },
            uStepScale: { value: 0.035 },
            uMaxSteps: { value: 700 },
            uEscape: { value: 60 },
            uBlackbody: { value: bbTex },
            uBlackbodyRange: { value: new THREE.Vector2(Math.log(BLACKBODY_MIN_K), Math.log(BLACKBODY_MAX_K)) },
            uSkyRot: { value: skyRot },
            uStarGain: { value: 0.6 },
            uMilkyWay: { value: 0.03 },
        };
        const traceMat = new THREE.ShaderMaterial({
            glslVersion: THREE.GLSL3,
            uniforms: traceUniforms,
            vertexShader: FULLSCREEN_VERT,
            fragmentShader: TRACE_FRAG,
            depthTest: false,
            depthWrite: false,
        });
        const compositeUniforms = {
            tScene: { value: null },
            uExposure: { value: 1 },
            uFade: { value: 0 },
            uTime: { value: 0 },
            uGrain: { value: 0.022 },
            uAberration: { value: 0.012 },
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
        // The film's "veiling flare": a wide, soft glow around everything
        // bright, the way an IMAX lens smears a light source (§4.4). Not a
        // threshold glow on the disk alone — the photon ring and the brightest
        // stars catch it too.
        const bloom = new UnrealBloomPass(new THREE.Vector2(1, 1), 0.45, 0.85, 1.6);

        // ── sizing ───────────────────────────────────────────────────────────
        const size = { w: 1, h: 1, scale: 0, dpr: 1 };
        const resize = () => {
            const w = Math.max(1, mount.clientWidth);
            const h = Math.max(1, mount.clientHeight);
            const dpr = Math.min(window.devicePixelRatio || 1, 2);
            const scale = QUALITY[settingsRef.current.quality]?.scale ?? 1;
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
        const film = SHOTS.film;
        const cam = { dist: 95, az: -0.55, el: 24 * DEG, roll: -2 * DEG, fov: 40 * DEG };
        const goal = { dist: film.dist, az: 0.25, el: film.el, roll: 0, fov: film.fov };
        const phys = {
            spin: settingsRef.current.spin, doppler: settingsRef.current.doppler ? 1 : 0,
            temp: settingsRef.current.temp,
        };
        let fade = 0;
        let diskTime = 0;
        let appliedShot = null;
        let dive = null; // { t, baseAz } while the dive runs
        let lastInput = -1e9;
        let cinePhase = 0;

        const applyShot = (id) => {
            const s = SHOTS[id] ?? film;
            dive = null;
            if (id === 'dive') {
                dive = { t: 0, baseAz: cam.az };
                goal.dist = s.dist;
                return;
            }
            goal.dist = s.dist;
            goal.el = s.el;
            goal.fov = s.fov;
            goal.roll = 0;
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
            if (dive) dive = null;
            goal.dist *= factor;
            Object.assign(goal, clampCamera(goal));
            lastInput = performance.now();
        };
        const onDown = (e) => {
            canvas.setPointerCapture?.(e.pointerId);
            pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
            if (pointers.size === 2) { pinch = spread(); drag = null; } else drag = { x: e.clientX, y: e.clientY };
            canvas.style.cursor = 'grabbing';
            lastInput = performance.now();
            if (dive) { dive = null; fade = Math.max(fade, 0.001); }
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
            goal.az -= dx * 0.0045;
            goal.el += dy * 0.0035;
            Object.assign(goal, clampCamera(goal));
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
            const dt = Math.min((now - last) / 1000, 0.25);
            last = now;
            const s = settingsRef.current;
            resize();

            if (shotRef.current && shotRef.current.nonce !== appliedShot) {
                appliedShot = shotRef.current.nonce;
                applyShot(shotRef.current.id);
            }

            // The hole itself eases between settings rather than snapping.
            phys.spin = damp(phys.spin, s.spin, 1.6, dt);
            phys.doppler = damp(phys.doppler, s.doppler ? 1 : 0, 2.2, dt);
            phys.temp = damp(phys.temp, s.temp, 2.2, dt);
            const rh = horizonRadius(phys.spin);
            const isco = iscoRadius(phys.spin);

            // Camera.
            let fadeGoal = 1;
            if (dive) {
                dive.t += dt;
                const p = divePose(dive.t, rh);
                goal.dist = p.dist;
                goal.el = p.el;
                goal.az = dive.baseAz + p.az;
                goal.fov = p.fov;
                goal.roll = -6 * DEG * p.dist / 30;
                fadeGoal = p.fade;
                if (p.done) {
                    dive = null;
                    fade = 0;
                    Object.assign(cam, { dist: 70, el: 18 * DEG });
                    applyShot('film');
                    doneRef.current?.('dive');
                }
            } else if (s.cinematic && !drag && now - lastInput > 4000) {
                // An idle camera drifts round the hole and bobs gently through
                // the disk's plane, the slow push of the film's own shots.
                cinePhase += dt;
                goal.az += dt * 0.022;
                goal.roll = damp(goal.roll, Math.sin(cinePhase * 0.05) * 3 * DEG, 0.5, dt);
            }
            const rate = dive ? 1.8 : 2.4;
            cam.dist = damp(cam.dist, goal.dist, dive ? 6 : (fade < 0.99 ? 0.55 : 1.4), dt);
            cam.az = damp(cam.az, nearestAngle(cam.az, goal.az), rate, dt);
            cam.el = damp(cam.el, goal.el, rate * 0.8, dt);
            cam.roll = damp(cam.roll, goal.roll, 1.5, dt);
            cam.fov = damp(cam.fov, goal.fov, 1.5, dt);
            fade = dive ? fadeGoal : damp(fade, fadeGoal, 0.9, dt);

            // The disk's clock runs at the camera's view of it: deep in the
            // well the camera's own time slows, so everything outside it —
            // the disk included — is seen sped up.
            const dil = Math.max(hoverTimeDilation(cam.dist), 0.125);
            diskTime += dt * TIME_RATE / dil;

            const f = cameraFrame(cam);
            const u = traceUniforms;
            const q = QUALITY[s.quality] ?? QUALITY.high;
            u.uCamPos.value.fromArray(f.pos);
            u.uCamRight.value.fromArray(f.right);
            u.uCamUp.value.fromArray(f.up);
            u.uCamFwd.value.fromArray(f.fwd);
            u.uTanHalfFov.value = Math.tan(cam.fov / 2);
            u.uPixelAngle.value = (2 * Math.tan(cam.fov / 2)) / u.uResolution.value.y;
            u.uSpin.value = phys.spin;
            u.uRh.value = rh;
            u.uIsco.value = isco;
            u.uDiskTemp.value = phys.temp;
            u.uDoppler.value = phys.doppler;
            u.uTime.value = diskTime;
            u.uStepScale.value = q.stepScale;
            u.uMaxSteps.value = q.maxSteps;
            u.uEscape.value = Math.max(cam.dist * 1.4, 60);
            const geo = ksGeometry(f.pos[0], f.pos[1], f.pos[2], phys.spin);
            u.uObsFactor.value = 1 / Math.sqrt(Math.max(1 - geo.f, 0.05));
            // A disk with beaming on is far brighter on its near side: hold
            // the overall level about steady as it turns on.
            u.uDiskGain.value = 1.7 / (1 + 1.4 * phys.doppler * phys.spin);

            renderer.setRenderTarget(target);
            traceQuad.render(renderer);
            bloom.render(renderer, null, target, dt, false);
            renderer.setRenderTarget(null);
            compositeUniforms.tScene.value = target.texture;
            compositeUniforms.uFade.value = fade;
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
                    dist: cam.dist, spin: phys.spin, rh, isco,
                    dilation: hoverTimeDilation(cam.dist),
                    speedup: 1 / dil, fps,
                    pixels: u.uResolution.value.x * u.uResolution.value.y,
                    diving: !!dive,
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
            renderer.dispose();
            // Give the GPU back now rather than whenever the browser collects
            // the context: this page holds a lot of it.
            renderer.forceContextLoss();
            canvas.remove();
        };
    }, []);

    return <div ref={mountRef} style={{ position: 'absolute', inset: 0 }} />;
}
