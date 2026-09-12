import { useRef, useEffect } from 'react';
import * as THREE from 'three';
import * as Astronomy from 'astronomy-engine';
import { loadSkyCatalog } from '../utils/skyCatalog';
import { quality, pixelRatioFor } from '../utils/quality';
import {
    updateSkyRotation, getSkyRotation,
    getAzimuth, getAltitude, nudgeLookDirection, subscribeLook,
} from '../utils/skyRotation';
import { useReducedMotion } from '../hooks/useMediaQuery';

// The night sky, from one point on the ground, looking up.
//
// Reads the same real astronomy as utils/skyPositions.js (the /tonight page)
// but answers a different question with it: not "what's up and how high",
// an explorable dome you look around inside rather than a flat readout. See
// utils/skyRotation.js for the coordinate pipeline — the short version is
// that every star is a fixed EQJ (J2000) direction, and the whole dome turns
// each frame via one 3x3 matrix built from the observer's location and the
// real current time.
//
// The camera never moves — it sits at the scene origin for the component's
// entire life, and only its *rotation* changes, driven by drag / scroll /
// arrow keys via utils/skyRotation.js's azimuth+altitude singleton. That
// singleton, not React state, is what the render loop reads every frame —
// same reasoning as simTime.js and driftControl.js: the scene is built once
// in an effect with an empty dependency list, and nothing here may cause
// that effect to re-run.
//
// Phase 1 (this file): the real star field, the constellation figures, and
// look-around. Time is simply "now" — full utils/simTime.js scrubbing and
// the Sun/Moon/planets sharing this dome are a later phase.

const FOV_MIN = 25;
const FOV_MAX = 70;
const FOV_DEFAULT = 55;

// Pogson's ratio: each step of 5 magnitudes is a factor of 100 in flux, so
// one magnitude is 100^(1/5). Point *area* (not radius) should track flux,
// which is what makes Sirius (mag -1.4) read as unmistakably brighter than
// a star at the naked-eye limit rather than merely a bit bigger.
const STAR_VERTEX_SHADER = /* glsl */`
    attribute float aMag;
    attribute float aCi;
    uniform mat3 uRot;
    uniform float uPixelRatio;
    uniform float uTwinkle;
    uniform float uTime;
    varying float vAlpha;
    varying float vCi;

    void main() {
        vec3 rotated = uRot * position;
        vec4 mvPosition = modelViewMatrix * vec4(rotated, 1.0);
        gl_Position = projectionMatrix * mvPosition;

        float flux = pow(2.512, -aMag);
        float size = clamp(sqrt(flux) * 2.6, 1.4, 7.0) * uPixelRatio;

        // A star's own per-vertex phase (from its rotated position, so it's
        // stable frame to frame without a second attribute) keeps every star
        // twinkling out of step with its neighbours.
        float twinkle = 1.0;
        if (uTwinkle > 0.5) {
            float phase = dot(rotated, vec3(12.9898, 78.233, 37.719));
            twinkle = 0.85 + 0.15 * sin(uTime * 2.2 + phase * 43758.5453);
        }
        gl_PointSize = size * twinkle;

        // Horizon extinction: a soft fade from a couple of degrees below the
        // horizon to a few above, rather than a hard pop when a star crosses
        // rotated.y == 0. rotated is unit-length (position is a unit EQJ
        // vector and rotation preserves length), so its y component is
        // directly sin(altitude) — see skyRotation.js's HOR -> scene basis.
        vAlpha = smoothstep(-0.02, 0.05, rotated.y);
        vCi = aCi;
    }
`;

// ci (B-V colour index) roughly: negative/low = hot blue-white, ~0.6 = the
// Sun's own white-yellow, high = cool orange-red. A gentle lerp rather than
// a physically exact black-body table — the point is "Betelgeuse reads
// warmer than Rigel", not a colorimetry lesson.
const STAR_FRAGMENT_SHADER = /* glsl */`
    precision mediump float;
    varying float vAlpha;
    varying float vCi;
    uniform float uOpacity;

    void main() {
        vec2 d = gl_PointCoord - vec2(0.5);
        float r = length(d);
        if (r > 0.5) discard;
        float edge = 1.0 - smoothstep(0.3, 0.5, r);

        vec3 cool = vec3(0.70, 0.80, 1.0);
        vec3 warm = vec3(1.0, 0.78, 0.58);
        float t = clamp((vCi + 0.2) / 1.6, 0.0, 1.0);
        vec3 tint = mix(cool, warm, t);

        gl_FragColor = vec4(tint, edge * vAlpha * uOpacity);
    }
`;

const LINE_VERTEX_SHADER = /* glsl */`
    uniform mat3 uRot;
    varying float vAlpha;
    void main() {
        vec3 rotated = uRot * position;
        vAlpha = smoothstep(-0.02, 0.05, rotated.y);
        gl_Position = projectionMatrix * modelViewMatrix * vec4(rotated, 1.0);
    }
`;
const LINE_FRAGMENT_SHADER = /* glsl */`
    precision mediump float;
    varying float vAlpha;
    uniform vec3 uColor;
    uniform float uOpacity;
    void main() {
        gl_FragColor = vec4(uColor, vAlpha * uOpacity);
    }
`;

// The ground hemisphere below the horizon — reuses the "camera inside a
// sphere" technique the solar-system scene already uses for its Milky Way
// backdrop (SolarSystem3D.jsx's buildSky()), at the same radius as the
// stars, so there's no seam at the horizon. Colour ramps from a horizon
// tint (set from the Sun's real current altitude, see horizonColorFor
// below) at the equator to near-black at the nadir.
const GROUND_VERTEX_SHADER = /* glsl */`
    varying float vY;
    void main() {
        vY = normalize(position).y;
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
    }
`;
const GROUND_FRAGMENT_SHADER = /* glsl */`
    precision mediump float;
    varying float vY;
    uniform vec3 uHorizonColor;
    void main() {
        float t = clamp(-vY, 0.0, 1.0);
        vec3 color = mix(uHorizonColor, vec3(0.01, 0.012, 0.016), smoothstep(0.0, 0.6, t));
        gl_FragColor = vec4(color, 1.0);
    }
`;

const DOME_RADIUS = 1; // stars/lines/ground all live on this unit sphere

const NIGHT   = new THREE.Color('#050608');
const DUSK    = new THREE.Color('#241d3d');
const SUNSET  = new THREE.Color('#e8823c');
const DAY_SKY = new THREE.Color('#3d6ea6');
const _lerpColor = new THREE.Color();

/**
 * A continuous horizon tint from the Sun's altitude, ramped through the same
 * boundaries utils/skyPositions.js's twilightPhase() uses (civil/nautical/
 * astronomical twilight), so this scene's horizon and /tonight's twilight
 * label always agree about where night begins.
 */
function horizonColorFor(sunAltDeg, out) {
    if (sunAltDeg <= -18) return out.copy(NIGHT);
    if (sunAltDeg <= -6) return out.copy(NIGHT).lerp(DUSK, (sunAltDeg + 18) / 12);
    if (sunAltDeg <= -0.833) return out.copy(DUSK).lerp(SUNSET, (sunAltDeg + 6) / 5.167);
    if (sunAltDeg <= 10) return out.copy(SUNSET).lerp(DAY_SKY, (sunAltDeg + 0.833) / 10.833);
    return out.copy(DAY_SKY);
}

/** [ra, dec] in degrees -> a J2000 (EQJ) unit vector, degrees version of the
 * same spherical->Cartesian conversion skyRotation.test.js pins in radians. */
function eqjFromRaDec(raDeg, decDeg, out) {
    const ra = (raDeg * Math.PI) / 180;
    const dec = (decDeg * Math.PI) / 180;
    const cosDec = Math.cos(dec);
    return out.set(cosDec * Math.cos(ra), cosDec * Math.sin(ra), Math.sin(dec));
}

const NightSky3D = ({ location, height = 'var(--app-vh, 100vh)' }) => {
    const mountRef = useRef(null);
    const locationRef = useRef(location);
    const reducedMotionRef = useRef(false);
    const reducedMotion = useReducedMotion();

    useEffect(() => { locationRef.current = location; }, [location]);
    useEffect(() => { reducedMotionRef.current = reducedMotion; }, [reducedMotion]);

    useEffect(() => {
        const mount = mountRef.current;
        if (!mount) return;
        let mounted = true;
        const q = quality();

        const w = mount.clientWidth || 800;
        const h = mount.clientHeight || 480;

        const scene = new THREE.Scene();
        const camera = new THREE.PerspectiveCamera(FOV_DEFAULT, w / h, 0.01, 10);
        camera.position.set(0, 0, 0);

        const renderer = new THREE.WebGLRenderer({ antialias: q.antialias, alpha: true });
        renderer.setSize(w, h);
        renderer.setPixelRatio(pixelRatioFor(w, h));
        renderer.setClearColor(0x000000, 0);
        renderer.outputColorSpace = THREE.SRGBColorSpace;
        mount.appendChild(renderer.domElement);
        renderer.domElement.setAttribute('role', 'img');
        renderer.domElement.style.touchAction = 'none'; // this scene owns drag — no browser panning/zoom fighting it
        renderer.domElement.setAttribute(
            'aria-label',
            'The night sky, looking up from your location. Drag to look around.',
        );

        // ── Ground hemisphere ────────────────────────────────────────────────
        const groundGeo = new THREE.SphereGeometry(
            DOME_RADIUS * 0.999, 32, 16, 0, Math.PI * 2, Math.PI / 2, Math.PI / 2,
        );
        const groundMat = new THREE.ShaderMaterial({
            vertexShader: GROUND_VERTEX_SHADER,
            fragmentShader: GROUND_FRAGMENT_SHADER,
            uniforms: { uHorizonColor: { value: NIGHT.clone() } },
            side: THREE.BackSide,
            depthWrite: false,
        });
        const ground = new THREE.Mesh(groundGeo, groundMat);
        scene.add(ground);

        // ── Stars + constellation lines: built once the catalog resolves ────
        const geos = [groundGeo];
        const mats = [groundMat];
        let starPoints = null;
        let starMat = null;

        const stripsToSegments = (strips) => {
            const positions = [];
            for (const strip of strips) {
                for (let i = 1; i < strip.length; i++) {
                    const a = strip[i - 1], b = strip[i];
                    const va = eqjFromRaDec(a[0], a[1], new THREE.Vector3());
                    const vb = eqjFromRaDec(b[0], b[1], new THREE.Vector3());
                    positions.push(va.x, va.y, va.z, vb.x, vb.y, vb.z);
                }
            }
            return new Float32Array(positions);
        };

        loadSkyCatalog().then(({ stars, constellations }) => {
            if (!mounted) return;

            // Brightest-first (see build-sky-catalog.mjs), so the tier count is
            // a plain slice — no runtime sort.
            const shown = stars.slice(0, q.nightSkyStars);
            const positions = new Float32Array(shown.length * 3);
            const mags = new Float32Array(shown.length);
            const cis = new Float32Array(shown.length);
            const v = new THREE.Vector3();
            shown.forEach((s, i) => {
                eqjFromRaDec(s[0], s[1], v);
                positions[i * 3] = v.x; positions[i * 3 + 1] = v.y; positions[i * 3 + 2] = v.z;
                mags[i] = s[2];
                cis[i] = s[8] ?? 0.6; // the Sun's own B-V, a reasonable default for unknowns
            });

            const starGeo = new THREE.BufferGeometry();
            starGeo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
            starGeo.setAttribute('aMag', new THREE.BufferAttribute(mags, 1));
            starGeo.setAttribute('aCi', new THREE.BufferAttribute(cis, 1));
            starMat = new THREE.ShaderMaterial({
                vertexShader: STAR_VERTEX_SHADER,
                fragmentShader: STAR_FRAGMENT_SHADER,
                uniforms: {
                    uRot: { value: getSkyRotation() },
                    uPixelRatio: { value: renderer.getPixelRatio() },
                    uTwinkle: { value: (q.nightSkyTwinkle && !reducedMotionRef.current) ? 1 : 0 },
                    uTime: { value: 0 },
                    uOpacity: { value: 1 },
                },
                transparent: true,
                depthWrite: false,
                blending: THREE.AdditiveBlending,
            });
            starPoints = new THREE.Points(starGeo, starMat);
            scene.add(starPoints);
            geos.push(starGeo);
            mats.push(starMat);

            if (q.nightSkyLines) {
                const mainSegs = [];
                const thinSegs = [];
                for (const [, , , main, thin] of constellations) {
                    mainSegs.push(stripsToSegments(main));
                    thinSegs.push(stripsToSegments(thin));
                }
                const concat = (arrays) => {
                    const total = arrays.reduce((s, a) => s + a.length, 0);
                    const out = new Float32Array(total);
                    let off = 0;
                    for (const a of arrays) { out.set(a, off); off += a.length; }
                    return out;
                };
                const makeLineMesh = (posArray, opacity) => {
                    const geo = new THREE.BufferGeometry();
                    geo.setAttribute('position', new THREE.BufferAttribute(posArray, 3));
                    const mat = new THREE.ShaderMaterial({
                        vertexShader: LINE_VERTEX_SHADER,
                        fragmentShader: LINE_FRAGMENT_SHADER,
                        uniforms: {
                            uRot: { value: getSkyRotation() },
                            uColor: { value: new THREE.Color('#9fc4ff') },
                            uOpacity: { value: opacity },
                        },
                        transparent: true,
                        depthWrite: false,
                    });
                    const mesh = new THREE.LineSegments(geo, mat);
                    scene.add(mesh);
                    geos.push(geo);
                    mats.push(mat);
                    return mesh;
                };
                makeLineMesh(concat(mainSegs), 0.32);
                makeLineMesh(concat(thinSegs), 0.16);
            }
        });

        // ── Look-around controls ─────────────────────────────────────────────
        // Drag-the-world convention (matches most panorama/street-view style
        // viewers): dragging right reveals what was to your left, i.e. turns
        // the view left, not right.
        let dragging = false;
        let lastX = 0, lastY = 0;
        const onPointerDown = (e) => {
            dragging = true;
            lastX = e.clientX; lastY = e.clientY;
            renderer.domElement.setPointerCapture(e.pointerId);
        };
        const onPointerMove = (e) => {
            if (!dragging) return;
            const dx = e.clientX - lastX;
            const dy = e.clientY - lastY;
            lastX = e.clientX; lastY = e.clientY;
            const scale = camera.fov / Math.max(1, renderer.domElement.clientWidth);
            nudgeLookDirection(-dx * scale, dy * scale);
        };
        const onPointerUp = (e) => {
            dragging = false;
            if (renderer.domElement.hasPointerCapture?.(e.pointerId)) {
                renderer.domElement.releasePointerCapture(e.pointerId);
            }
        };
        const onWheel = (e) => {
            e.preventDefault();
            camera.fov = Math.max(FOV_MIN, Math.min(FOV_MAX, camera.fov + e.deltaY * 0.03));
            camera.updateProjectionMatrix();
        };
        const NUDGE_DEG = 3;
        const onKeyDown = (e) => {
            switch (e.key) {
                case 'ArrowLeft':  nudgeLookDirection(-NUDGE_DEG, 0); break;
                case 'ArrowRight': nudgeLookDirection(NUDGE_DEG, 0); break;
                case 'ArrowUp':    nudgeLookDirection(0, NUDGE_DEG); break;
                case 'ArrowDown':  nudgeLookDirection(0, -NUDGE_DEG); break;
                default: return;
            }
            e.preventDefault();
        };
        renderer.domElement.addEventListener('pointerdown', onPointerDown);
        renderer.domElement.addEventListener('pointermove', onPointerMove);
        renderer.domElement.addEventListener('pointerup', onPointerUp);
        renderer.domElement.addEventListener('pointercancel', onPointerUp);
        renderer.domElement.addEventListener('wheel', onWheel, { passive: false });
        renderer.domElement.tabIndex = 0;
        renderer.domElement.addEventListener('keydown', onKeyDown);

        // Applies the singleton's azimuth/altitude to the camera immediately
        // (drag, wheel and arrow keys all funnel through skyRotation.js, not
        // through this component's own state) and again every frame, since
        // the render loop is the source of truth for what's actually drawn.
        const applyLook = () => {
            camera.rotation.set(
                (getAltitude() * Math.PI) / 180,
                (-getAzimuth() * Math.PI) / 180,
                0,
                'YXZ',
            );
        };
        const unsubLook = subscribeLook(applyLook);
        applyLook();

        // ── Resize ────────────────────────────────────────────────────────────
        const ro = new ResizeObserver(([entry]) => {
            const { width, height } = entry.contentRect;
            if (!width || !height) return;
            camera.aspect = width / height;
            camera.updateProjectionMatrix();
            renderer.setSize(width, height);
            renderer.setPixelRatio(pixelRatioFor(width, height));
            if (starMat) starMat.uniforms.uPixelRatio.value = renderer.getPixelRatio();
        });
        ro.observe(mount);

        // ── Render loop ───────────────────────────────────────────────────────
        let animId;
        const clock = new THREE.Clock();
        const animate = () => {
            animId = requestAnimationFrame(animate);
            const loc = locationRef.current;
            if (loc) {
                const observer = new Astronomy.Observer(loc.lat, loc.lon, 0);
                const now = new Date();
                updateSkyRotation(now, observer);

                // Cheap (one Equator + one Horizon call), and only used for a
                // colour ramp that changes over minutes, but there's no reason
                // not to keep it exactly current.
                const sunEq = Astronomy.Equator('Sun', now, observer, true, true);
                const sunHz = Astronomy.Horizon(now, observer, sunEq.ra, sunEq.dec, null);
                horizonColorFor(sunHz.altitude, _lerpColor);
                groundMat.uniforms.uHorizonColor.value.copy(_lerpColor);
            }
            if (starMat) starMat.uniforms.uTime.value = clock.getElapsedTime();

            renderer.render(scene, camera);
        };
        animate();

        return () => {
            mounted = false;
            cancelAnimationFrame(animId);
            ro.disconnect();
            unsubLook();
            renderer.domElement.removeEventListener('pointerdown', onPointerDown);
            renderer.domElement.removeEventListener('pointermove', onPointerMove);
            renderer.domElement.removeEventListener('pointerup', onPointerUp);
            renderer.domElement.removeEventListener('pointercancel', onPointerUp);
            renderer.domElement.removeEventListener('wheel', onWheel);
            renderer.domElement.removeEventListener('keydown', onKeyDown);
            if (mount.contains(renderer.domElement)) mount.removeChild(renderer.domElement);
            // geos/mats already carries the ground, the stars (once loaded) and
            // both line meshes (pushed inside makeLineMesh) — one list, so
            // nothing added after the catalog resolves is missed here.
            geos.forEach(g => g.dispose());
            mats.forEach(m => m.dispose());
            renderer.dispose();
        };
    }, []);

    return (
        <div
            ref={mountRef}
            style={{ position: 'relative', width: '100%', height, outline: 'none' }}
        />
    );
};

export default NightSky3D;
