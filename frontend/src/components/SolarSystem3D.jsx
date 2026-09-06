import { useRef, useEffect, useLayoutEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { STLLoader } from 'three/examples/jsm/loaders/STLLoader.js';
import {
    PLANETS, PLANET_PBR, AXIAL_TILT_DEG, PLANET_TEXTURES, MOON_TEXTURES,
    MOON_DATA, SMALL_BODIES,
} from '../data/solarSystemBodies';
import {
    DEG2RAD, ORBIT_EPOCH_MS, ORBIT_BASE_OPACITY, ORBIT_HOVER_OPACITY,
    PLANET_EMISSIVE_INTENSITY, computePlanetPos, buildOrbitPoints, buildOrbitTube,
    keplerianScenePos, buildKeplerOrbitPoints, eclipticQuaternion,
} from '../utils/orbits';
import { proceduralSurface } from '../utils/proceduralTextures';
import { quality, texturePath, pixelRatioFor } from '../utils/quality';
import {
    targetOrbitSpeed, stepOrbitSpeed, targetIssSpeed,
    advanceMoonAngle, moonOffset, DEFAULT_ORBIT_SPEED,
} from '../utils/orbitalMotion';

let _exitState = { active: false, cameraPos: null, targetPos: null };

const SolarSystem3D = ({ focusedId, focusOffsetY = 0, height = 'var(--app-vh, 100vh)' }) => {
    const mountRef  = useRef(null);
    const navigate  = useNavigate();
    const [objectLabels, setObjectLabels] = useState([]);
    const [moonLabelsReady, setMoonLabelsReady] = useState(false);

    const focusedIdRef = useRef(focusedId);
    useLayoutEffect(() => {
        focusedIdRef.current = focusedId;
    }, [focusedId]);

    // Fraction of the viewport height to lift the focused body by, so a panel
    // covering the lower screen (mobile sheet) never sits on top of it.
    const focusOffsetRef = useRef(focusOffsetY);
    useLayoutEffect(() => {
        focusOffsetRef.current = focusOffsetY;
    }, [focusOffsetY]);

    // navigateRef keeps navigate stable so the main effect never re-runs on navigation
    const navigateRef = useRef(navigate);
    useEffect(() => { navigateRef.current = navigate; }, [navigate]);

    useEffect(() => {
        const mount = mountRef.current;
        if (!mount) return;
        let mounted = true;

        const w = mount.clientWidth  || 800;
        const h = mount.clientHeight || 480;

        // ── Scene ──────────────────────────────────────────────────────────────
        const scene = new THREE.Scene();

        // ── Camera ─────────────────────────────────────────────────────────────
        const camera = new THREE.PerspectiveCamera(45, w / h, 1, 10000);
        camera.position.set(-350, 280, 365);
        camera.lookAt(0, 0, 0);

        // ── Renderer ───────────────────────────────────────────────────────────
        const q = quality();
        const renderer = new THREE.WebGLRenderer({ antialias: q.antialias, alpha: true, premultipliedAlpha: false });
        renderer.setSize(w, h);
        renderer.setPixelRatio(pixelRatioFor(w, h));
        renderer.setClearColor(0x000000, 0);
        // Shadow maps are the single most expensive thing here on a mobile GPU.
        // The analytic ring and moon shadows are shader maths and stay on.
        renderer.shadowMap.enabled = q.shadows;
        renderer.shadowMap.type    = THREE.PCFSoftShadowMap;
        mount.appendChild(renderer.domElement);
        renderer.domElement.setAttribute('role', 'img');
        renderer.domElement.setAttribute('aria-label',
            'Interactive 3D solar system. Drag to orbit, scroll to zoom, click an object to explore it.');

        // Mobile GPUs reclaim contexts under memory pressure. Without these the
        // canvas silently freezes on whatever frame it died on, with no way back
        // short of a manual reload.
        const onContextLost = (e) => {
            e.preventDefault();               // required for restore to ever fire
            cancelAnimationFrame(animId);
            console.warn('[Parsec] WebGL context lost — pausing render loop');
        };
        const onContextRestored = () => {
            console.warn('[Parsec] WebGL context restored');
            if (mounted) animate();
        };
        renderer.domElement.addEventListener('webglcontextlost', onContextLost);
        renderer.domElement.addEventListener('webglcontextrestored', onContextRestored);

        // ── OrbitControls ──────────────────────────────────────────────────────
        const controls = new OrbitControls(camera, renderer.domElement);
        controls.enableDamping = true;
        controls.enablePan     = false;
        controls.autoRotate = true;
        controls.autoRotateSpeed = 0.09;
        controls.minDistance   = 30;
        controls.maxDistance   = 1200;

        let isInteracting = false;
        controls.addEventListener('start', () => { isInteracting = true; });
        controls.addEventListener('end', () => { isInteracting = false; });

        // ── Exit-animation state (declared early so restore can pre-set them) ──
        let prevFocusedId          = null;
        let prevFocusedPlanetName  = null;
        let exitPhase      = 0; // 0=normal  1=pull-back  2=fly-to-sun
        let exitFrames     = 0;
        let targetAutoRotateSpeed = 0.11; // smoothly updated on hover

        // ── Focus zoom-in animation state ──────────────────────────────────────
        let focusAnimating   = false;
        let focusProgress    = 0;
        const focusStartCamPos  = new THREE.Vector3();
        const focusEndCamPos    = new THREE.Vector3();
        const focusStartTarget  = new THREE.Vector3();
        const _focusLookTarget  = new THREE.Vector3();
        const _camUpVec         = new THREE.Vector3();
        // Camera position captured at click time — guarantees start pos regardless of rAF timing
        let pendingFocusCamPos = null;

        // If React Router remounted this component while a planet was focused
        // (path="*" usually prevents this but isn't guaranteed), restore the camera
        // position so the exit animation plays from the correct starting point.
        if (!focusedId && _exitState.active) {
            camera.position.copy(_exitState.cameraPos);
            controls.target.copy(_exitState.targetPos);
            exitPhase      = 1;
            exitFrames     = 0;
            prevFocusedId  = '__restored__'; // truthy — lets phase detection work correctly
            _exitState.active = false;
        }

        // ── Lights ─────────────────────────────────────────────────────────────
        const mainLight = new THREE.PointLight(0xffffff, 3.2, 0, 0); // decay=0: no distance falloff
        mainLight.castShadow         = q.shadows;
        mainLight.shadow.camera.near    = 1;
        mainLight.shadow.camera.far     = 2000;
        mainLight.shadow.mapSize.width  = 2048;
        mainLight.shadow.mapSize.height = 2048;
        mainLight.shadow.bias           = -0.002;
        mainLight.shadow.normalBias     = 0.05;
        scene.add(mainLight);

        const coronaLight = new THREE.PointLight(0xfff4e0, 1.8, 750);
        scene.add(coronaLight);

        scene.add(new THREE.AmbientLight(0xffffff, 0.28));

        // ── Shared loader + texture list (declared early for sun texture) ──────
        const loader   = new THREE.TextureLoader();
        const textures = [];

        // Heavy meshes (ISS, Vesta) are several MB and are only ever seen close
        // up, so they wait for an idle moment instead of competing with the
        // textures that make up the first frame.
        const idleTimers = [];
        const whenIdle = (fn) => {
            if (typeof window.requestIdleCallback === 'function') {
                const h = window.requestIdleCallback(fn, { timeout: 4000 });
                idleTimers.push(() => window.cancelIdleCallback(h));
            } else {
                const t = setTimeout(fn, 1500);
                idleTimers.push(() => clearTimeout(t));
            }
        };

        // ── Sun ────────────────────────────────────────────────────────────────
        const sunGeo = new THREE.SphereGeometry(12, 64, 64);
        // MeshBasicMaterial — self-luminous, not affected by scene lights
        const sunMat = new THREE.MeshBasicMaterial({ color: '#FFF4A0' });
        const sunMesh = new THREE.Mesh(sunGeo, sunMat);
        sunMesh.userData = { id: 'sun', name: 'Sun' };
        scene.add(sunMesh);

        loader.load(texturePath('sun.jpg'), (tex) => {
            if (!mounted) { tex.dispose(); return; }
            textures.push(tex);
            sunMat.map   = tex;
            sunMat.color.set(0xffffff);
            sunMat.needsUpdate = true;
        });

        // ── Milky Way skysphere ────────────────────────────────────────────────
        // Skipped entirely on phones (q.skyTexture === null): a full-screen
        // backdrop is the worst case for a mobile GPU's fill rate, and it is the
        // one thing you are always looking past. Desktop gets the 8K map.
        let skySphere = null;
        let skyGeo = null;
        let skyMat = null;
        if (q.skyTexture) {
            skyGeo = new THREE.SphereGeometry(8000, q.skySegments, q.skySegments);
            const skyTex = loader.load('/textures/' + q.skyTexture);
            textures.push(skyTex);
            skyMat = new THREE.MeshBasicMaterial({
                map:         skyTex,
                side:        THREE.BackSide,
                depthWrite:  false,
                transparent: true,
                opacity:     0.35,
            });
            skySphere = new THREE.Mesh(skyGeo, skyMat);
            scene.add(skySphere);
        }

        // ── Resource tracking (for cleanup) ────────────────────────────────────
        const geos     = [sunGeo, skyGeo].filter(Boolean);
        const mats     = [sunMat, skyMat].filter(Boolean);

        // Additive glow layers — colors add on top of the scene, building a bright halo
        const GLOW_LAYERS = [
            { r: 13.2, op: 0.11, color: '#FFFF90' },
            { r: 15.5, op: 0.11, color: '#FFEE60' },
            { r: 20,   op: 0.05, color: '#FFE030' },
            { r: 30,   op: 0.018,color: '#FFD020' },
            { r: 48,   op: 0.006,color: '#FFB800' },
        ];
        GLOW_LAYERS.forEach(({ r, op, color }) => {
            const geo = new THREE.SphereGeometry(r, 32, 32);
            const mat = new THREE.MeshBasicMaterial({
                color,
                transparent: true,
                opacity: op,
                depthWrite: false,
                blending: THREE.AdditiveBlending,
            });
            scene.add(new THREE.Mesh(geo, mat));
            geos.push(geo);
            mats.push(mat);
        });

        const planetMeshes    = [sunMesh];  // raycaster targets
        const planetGroups    = [];         // for position refresh
        const planetMeshRefs  = new Map();  // name → group, for moon positioning
        const planetHitboxRefs  = new Map(); // planet.name → hitbox mesh
        const smallBodyHitRefs  = new Map(); // body.id → hitbox mesh
        const smallBodyHitRadii = new Map(); // body.id → hitbox geometry radius
        const moonMeshRefs      = new Map();  // moon.name → visual mesh
        const moonHitRefs      = new Map();  // moon.name → hitbox mesh (scene-direct, position synced each frame)
        const moonHitRadii     = new Map();  // moon.name → hitbox geometry radius (for scale restoration)
        const moonAngles       = new Map();  // moon.name → current liveAngle (radians)

        // Earth day/night shader references — set once textures load, used in rAF loop
        let earthMesh      = null;
        let earthShaderMat = null;
        const sRingRefs = { mat: null, group: null };

        // ── Planets ────────────────────────────────────────────────────────────
        PLANETS.forEach(planet => {
            const pbr = PLANET_PBR[planet.name] ?? { roughness: 0.8, metalness: 0.05 };

            // Orbit path sampled from HelioVector — same source as planet positions
            const orbitGeo = buildOrbitTube(buildOrbitPoints(planet.name, planet.orbitR));
            const orbitMat = new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: ORBIT_BASE_OPACITY, depthWrite: false });
            const orbitLine = new THREE.Mesh(orbitGeo, orbitMat);
            orbitLine.userData = { baseOpacity: ORBIT_BASE_OPACITY, hoverOpacity: ORBIT_HOVER_OPACITY };

            scene.add(orbitLine);
            geos.push(orbitGeo);
            mats.push(orbitMat);

            // Planet sphere
            const geo      = new THREE.SphereGeometry(planet.r, q.planetSegments, q.planetSegments);
            const colorMat = new THREE.MeshStandardMaterial({
                color:     planet.color,
                roughness: pbr.roughness,
                metalness: pbr.metalness,
                emissive:  new THREE.Color(planet.color),
                emissiveIntensity: PLANET_EMISSIVE_INTENSITY,
            });
            const mesh     = new THREE.Mesh(geo, colorMat);
            mesh.userData      = { id: planet.id, name: planet.name, orbitLine };
            mesh.castShadow    = q.shadows;
            mesh.receiveShadow = q.shadows;
            geos.push(geo);
            mats.push(colorMat);

            // Earth atmosphere glow
            if (planet.name === 'Earth') {
                const atmoGeo = new THREE.SphereGeometry(planet.r + 0.6, 32, 32);
                const atmoMat = new THREE.MeshPhongMaterial({
                    color:             '#1a6fa8',
                    emissive:          '#1a6fa8',
                    emissiveIntensity: 0.15,
                    transparent:       true,
                    opacity:           0.18,
                    side:              THREE.FrontSide,
                    depthWrite:        false,
                });
                mesh.add(new THREE.Mesh(atmoGeo, atmoMat));
                geos.push(atmoGeo);
                mats.push(atmoMat);
            }

            // Venus atmosphere glow
            if (planet.name === 'Venus') {
                const atmoGeo = new THREE.SphereGeometry(planet.r + 0.5, 32, 32);
                const atmoMat = new THREE.MeshPhongMaterial({
                    color:             '#c8a040',
                    emissive:          '#c8a040',
                    emissiveIntensity: 0.12,
                    transparent:       true,
                    opacity:           0.11,
                    side:              THREE.FrontSide,
                    depthWrite:        false,
                });
                mesh.add(new THREE.Mesh(atmoGeo, atmoMat));
                geos.push(atmoGeo);
                mats.push(atmoMat);
            }

            // Group: sphere + optional rings move together on position update
            const group = new THREE.Group();
            group.add(mesh);

            // Falls back to a painted surface, whether we skipped the request
            // outright or the file failed to load.
            const applyPaintedSurface = () => {
                if (!mounted) return;
                const surf = proceduralSurface(planet.id, planet.color,
                    planet.name === 'Pluto' ? 'icy' : 'rocky');
                textures.push(surf.map);
                colorMat.map = surf.map;
                colorMat.color.set(0xffffff);
                if (surf.bumpMap) {
                    textures.push(surf.bumpMap);
                    colorMat.bumpMap = surf.bumpMap;
                    colorMat.bumpScale = surf.bumpScale;
                }
                colorMat.needsUpdate = true;
            };

            // Texture (async)
            if (planet.name === 'Earth') {
                // Earth: day/night/clouds shader — load three textures in parallel
                let dayTex = null, nightTex = null, cloudsTex = null;
                const tryApplyEarthShader = () => {
                    if (!dayTex || !nightTex || !cloudsTex || !mounted) return;
                    textures.push(dayTex, nightTex, cloudsTex);
                    const shaderMat = new THREE.ShaderMaterial({
                        uniforms: {
                            dayMap:       { value: dayTex },
                            nightMap:     { value: nightTex },
                            cloudsMap:    { value: cloudsTex },
                            sunDirection: { value: new THREE.Vector3(1, 0, 0) },
                        },
                        vertexShader: `
                            varying vec2 vUv;
                            varying vec3 vWorldNormal;
                            void main() {
                                vUv = uv;
                                vWorldNormal = normalize(mat3(modelMatrix) * normal);
                                gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
                            }
                        `,
                        fragmentShader: `
                            uniform sampler2D dayMap;
                            uniform sampler2D nightMap;
                            uniform sampler2D cloudsMap;
                            uniform vec3 sunDirection;
                            varying vec2 vUv;
                            varying vec3 vWorldNormal;
                            void main() {
                                vec3 normal = normalize(vWorldNormal);
                                float cosAngle = dot(normal, sunDirection);
                                float dayBlend = smoothstep(-0.12, 0.12, cosAngle);
                                vec4 day    = texture2D(dayMap,    vUv);
                                vec4 night  = texture2D(nightMap,  vUv);
                                vec4 clouds = texture2D(cloudsMap, vUv);
                                vec3 surface = mix(night.rgb, day.rgb, dayBlend);
                                float cloudDensity = clouds.r;
                                vec3 cloudColor = mix(clouds.rgb * 0.05, clouds.rgb, dayBlend);
                                surface = mix(surface, cloudColor, cloudDensity * 0.85);
                                gl_FragColor = vec4(surface, 1.0);
                            }
                        `,
                    });
                    mesh.material = shaderMat;
                    colorMat.dispose();
                    mats.push(shaderMat);
                    earthMesh    = mesh;
                    earthShaderMat = shaderMat;
                };
                loader.load(texturePath('earth.jpg'),        (t) => { dayTex    = t; tryApplyEarthShader(); }, undefined, () => {});
                loader.load(texturePath('earth_night.jpg'),  (t) => { nightTex  = t; tryApplyEarthShader(); }, undefined, () => {});
                loader.load(texturePath('earth_clouds.jpg'), (t) => { cloudsTex = t; tryApplyEarthShader(); }, undefined, () => {});
            } else if (PLANET_TEXTURES.has(planet.id)) {
                loader.load(
                    texturePath(`${planet.id}.jpg`),
                    (tex) => {
                        if (!mounted) { tex.dispose(); return; }
                        textures.push(tex);
                        const texMat = new THREE.MeshStandardMaterial({
                            map:       tex,
                            roughness: pbr.roughness,
                            metalness: pbr.metalness,
                            emissive:  new THREE.Color(planet.color),
                            emissiveIntensity: PLANET_EMISSIVE_INTENSITY,
                        });
                        mesh.material = texMat;
                        colorMat.dispose();
                        mats.push(texMat);
                    },
                    undefined,
                    applyPaintedSurface,
                );
            } else {
                // No map ships for this planet (Pluto) — paint it instead of
                // firing a request we know will 404.
                applyPaintedSurface();
            }

            // Saturn rings — proportions and UV fix match PlanetViewer.jsx
            if (planet.name === 'Saturn') {
                const scale  = planet.r / 1.5;
                const innerR = 2.0 * scale;
                const outerR = 3.5 * scale;

                const sRingGeo = new THREE.RingGeometry(innerR, outerR, 256, 8);
                const posAttr  = sRingGeo.attributes.position;
                const uvAttr   = sRingGeo.attributes.uv;
                for (let i = 0; i < posAttr.count; i++) {
                    const v = new THREE.Vector3().fromBufferAttribute(posAttr, i);
                    uvAttr.setXY(i, (v.length() - innerR) / (outerR - innerR), 0);
                }

                // Analytic ray-sphere shadow: no shadow maps needed, no resolution limits.
                // For each ring fragment, cast a ray toward the sun (at origin) and test
                // whether it passes through Saturn's sphere — if so, darken the fragment.
                const sRingMat = new THREE.MeshBasicMaterial({
                    side: THREE.DoubleSide,
                    transparent: true,
                    alphaTest: 0.05,
                    depthWrite: false,
                });
                sRingMat.userData.shader = null;
                sRingMat.onBeforeCompile = (shader) => {
                    shader.uniforms.uSaturnPos    = { value: new THREE.Vector3() };
                    shader.uniforms.uSaturnRadius = { value: planet.r };
                    sRingMat.userData.shader = shader;
                    // Prepend varying declaration; inject world-pos write after project_vertex
                    shader.vertexShader = 'varying vec3 vRingWorldPos;\n' +
                        shader.vertexShader.replace(
                            '#include <project_vertex>',
                            '#include <project_vertex>\nvRingWorldPos = (modelMatrix * vec4(position, 1.0)).xyz;'
                        );
                    // Prepend uniform/varying; inject shadow just before tonemapping
                    shader.fragmentShader =
                        'varying vec3 vRingWorldPos;\nuniform vec3 uSaturnPos;\nuniform float uSaturnRadius;\n' +
                        shader.fragmentShader.replace(
                            '#include <tonemapping_fragment>',
                            `{
                                vec3  toSun = normalize(-vRingWorldPos);
                                vec3  oc    = uSaturnPos - vRingWorldPos;
                                float tca   = dot(oc, toSun);
                                if (tca > 0.0) {
                                    float d2     = max(0.0, dot(oc, oc) - tca * tca);
                                    float r2     = uSaturnRadius * uSaturnRadius;
                                    float r2soft = r2 * 1.1;
                                    float shadow = 1.0 - smoothstep(r2, r2soft, d2);
                                    gl_FragColor.rgb *= mix(1.0, 0.08, shadow);
                                }
                            }
                            #include <tonemapping_fragment>`
                        );
                };
                sRingRefs.mat   = sRingMat;
                sRingRefs.group = group;

                const sRing = new THREE.Mesh(sRingGeo, sRingMat);
                sRing.rotation.x    = Math.PI / 2 - 0.5;
                sRing.rotation.z    = 0.2;
                sRing.castShadow    = false;
                sRing.receiveShadow = false;
                group.add(sRing);
                geos.push(sRingGeo);
                mats.push(sRingMat);

                loader.load(
                    texturePath('saturn_ring.png'),
                    (tex) => {
                        if (!mounted) { tex.dispose(); return; }
                        textures.push(tex);
                        sRingMat.map = tex;
                        sRingMat.needsUpdate = true;
                    },
                );
            }

            // ── Jupiter halo ring ─────────────────────────────────────────────────
            if (planet.name === 'Jupiter') {
                const jIR = planet.r * 1.72;
                const jOR = planet.r * 1.81;

                const jCanvas = document.createElement('canvas');
                jCanvas.width = 256; jCanvas.height = 2;
                const jCtx = jCanvas.getContext('2d');
                const jGrad = jCtx.createLinearGradient(0, 0, 256, 0);
                jGrad.addColorStop(0,    'rgba(58,42,26,0)');
                jGrad.addColorStop(0.15, 'rgba(58,42,26,0.045)');
                jGrad.addColorStop(0.5,  'rgba(58,42,26,0.07)');
                jGrad.addColorStop(0.85, 'rgba(58,42,26,0.045)');
                jGrad.addColorStop(1,    'rgba(58,42,26,0)');
                jCtx.fillStyle = jGrad;
                jCtx.fillRect(0, 0, 256, 2);
                const jTex = new THREE.CanvasTexture(jCanvas);
                textures.push(jTex);

                const jGeo = new THREE.RingGeometry(jIR, jOR, 128, 8);
                const jPa  = jGeo.attributes.position;
                const jUa  = jGeo.attributes.uv;
                for (let i = 0; i < jPa.count; i++) {
                    const jvec = new THREE.Vector3().fromBufferAttribute(jPa, i);
                    jUa.setXY(i, (jvec.length() - jIR) / (jOR - jIR), 0);
                }
                const jMat = new THREE.MeshBasicMaterial({
                    map: jTex, side: THREE.DoubleSide,
                    transparent: true, depthWrite: false, alphaTest: 0.005,
                });
                const jRing = new THREE.Mesh(jGeo, jMat);
                jRing.rotation.x = Math.PI / 2;
                jRing.rotation.z = AXIAL_TILT_DEG['Jupiter'] * DEG2RAD;
                geos.push(jGeo); mats.push(jMat);
                group.add(jRing);
            }

            // ── Uranus rings — 5 narrow bands, ~vertical at 97.77° tilt ──────────
            if (planet.name === 'Uranus') {
                // c = center radius ×planet.r, hw = half-width ×planet.r, op = opacity
                // Epsilon defined by explicit inner/outer multiples instead
                const uDefs = [
                    { c: 1.638, hw: 0.010, op: 0.35 },         // 6 Ring
                    { c: 1.748, hw: 0.010, op: 0.40 },         // Alpha
                    { c: 1.786, hw: 0.010, op: 0.40 },         // Beta
                    { c: 1.826, hw: 0.010, op: 0.30 },         // Eta
                    { inner: 1.950, outer: 2.000, op: 0.75 },  // Epsilon (widest, brightest)
                ];
                uDefs.forEach(def => {
                    const uIR = def.inner !== undefined ? def.inner * planet.r : (def.c - def.hw) * planet.r;
                    const uOR = def.outer !== undefined ? def.outer * planet.r : (def.c + def.hw) * planet.r;

                    const uCanvas = document.createElement('canvas');
                    uCanvas.width = 64; uCanvas.height = 2;
                    const uCtx = uCanvas.getContext('2d');
                    const uGrad = uCtx.createLinearGradient(0, 0, 64, 0);
                    uGrad.addColorStop(0,    `rgba(22,22,28,0)`);
                    uGrad.addColorStop(0.06, `rgba(22,22,28,${def.op})`);
                    uGrad.addColorStop(0.94, `rgba(22,22,28,${def.op})`);
                    uGrad.addColorStop(1,    `rgba(22,22,28,0)`);
                    uCtx.fillStyle = uGrad;
                    uCtx.fillRect(0, 0, 64, 2);
                    const uTex = new THREE.CanvasTexture(uCanvas);
                    textures.push(uTex);

                    const uGeo = new THREE.RingGeometry(uIR, uOR, 128, 8);
                    const uPa  = uGeo.attributes.position;
                    const uUa  = uGeo.attributes.uv;
                    for (let i = 0; i < uPa.count; i++) {
                        const uvec = new THREE.Vector3().fromBufferAttribute(uPa, i);
                        uUa.setXY(i, (uvec.length() - uIR) / (uOR - uIR), 0);
                    }
                    const uMat = new THREE.MeshBasicMaterial({
                        map: uTex, side: THREE.DoubleSide,
                        transparent: true, depthWrite: false, alphaTest: 0.01,
                    });
                    const uRingMesh = new THREE.Mesh(uGeo, uMat);
                    uRingMesh.rotation.y = Math.PI / 2;
                    geos.push(uGeo); mats.push(uMat);
                    group.add(uRingMesh);
                });
            }

            // ── Neptune rings — 4 rings + Adams arc clumps ───────────────────────
            if (planet.name === 'Neptune') {
                const nTiltZ = AXIAL_TILT_DEG['Neptune'] * DEG2RAD;

                // Helper: build one ring or partial arc and add to group
                const addNRing = (iR, oR, op, feather, thetaStart, thetaLength) => {
                    const nCanvas = document.createElement('canvas');
                    nCanvas.width = 128; nCanvas.height = 2;
                    const nCtx = nCanvas.getContext('2d');
                    const nGrad = nCtx.createLinearGradient(0, 0, 128, 0);
                    if (feather) {
                        nGrad.addColorStop(0,   `rgba(30,30,32,0)`);
                        nGrad.addColorStop(0.2, `rgba(30,30,32,${op})`);
                        nGrad.addColorStop(0.8, `rgba(30,30,32,${op})`);
                        nGrad.addColorStop(1,   `rgba(30,30,32,0)`);
                    } else {
                        nGrad.addColorStop(0,    `rgba(30,30,32,0)`);
                        nGrad.addColorStop(0.06, `rgba(30,30,32,${op})`);
                        nGrad.addColorStop(0.94, `rgba(30,30,32,${op})`);
                        nGrad.addColorStop(1,    `rgba(30,30,32,0)`);
                    }
                    nCtx.fillStyle = nGrad;
                    nCtx.fillRect(0, 0, 128, 2);
                    const nTex = new THREE.CanvasTexture(nCanvas);
                    textures.push(nTex);

                    const isArc = thetaStart !== undefined;
                    const nGeo = isArc
                        ? new THREE.RingGeometry(iR, oR, 32, 4, thetaStart, thetaLength)
                        : new THREE.RingGeometry(iR, oR, 128, 8);
                    const nPa = nGeo.attributes.position;
                    const nUa = nGeo.attributes.uv;
                    for (let i = 0; i < nPa.count; i++) {
                        const nvec = new THREE.Vector3().fromBufferAttribute(nPa, i);
                        nUa.setXY(i, (nvec.length() - iR) / (oR - iR), 0);
                    }
                    const nMat = new THREE.MeshBasicMaterial({
                        map: nTex, side: THREE.DoubleSide,
                        transparent: true, depthWrite: false, alphaTest: 0.005,
                    });
                    const nRingMesh = new THREE.Mesh(nGeo, nMat);
                    nRingMesh.rotation.x = Math.PI / 2;
                    nRingMesh.rotation.z = nTiltZ;
                    geos.push(nGeo); mats.push(nMat);
                    group.add(nRingMesh);
                };

                // Full rings: Galle (diffuse), Le Verrier (narrow), Lassell (haze), Adams (narrow)
                addNRing(planet.r * 1.677, planet.r * 1.707, 0.05, true);
                addNRing(planet.r * 2.141, planet.r * 2.155, 0.20, false);
                addNRing(planet.r * 2.155, planet.r * 2.400, 0.04, true);
                addNRing(planet.r * 2.539, planet.r * 2.549, 0.30, false);

                // Adams ring arcs — Liberté, Égalité, Fraternité (three bright clumps)
                const aIR = planet.r * 2.539;
                const aOR = planet.r * 2.549;
                addNRing(aIR, aOR, 0.65, false, 0,                 40 * DEG2RAD);
                addNRing(aIR, aOR, 0.65, false, 120 * DEG2RAD,     10 * DEG2RAD);
                addNRing(aIR, aOR, 0.65, false, 230 * DEG2RAD,     30 * DEG2RAD);
            }

            // Place at real position and add to scene
            const p = computePlanetPos(planet.name, planet.orbitR);
            group.position.set(p.x, p.y, p.z);
            scene.add(group);
            planetMeshes.push(mesh);

            // Invisible hitbox — larger than visual sphere so small planets are easy to click
            const hitboxR  = Math.max(planet.r * 2 + 2.5, planet.name === 'Pluto' ? 11.25 : 6.0);
            const pHitGeo  = new THREE.SphereGeometry(hitboxR, 8, 8);
            const pHitMat  = new THREE.MeshBasicMaterial({ transparent: true, opacity: 0, depthWrite: false });
            const pHitMesh = new THREE.Mesh(pHitGeo, pHitMat);
            pHitMesh.userData = mesh.userData; // shared reference — same id, name, orbitLine
            group.add(pHitMesh);
            geos.push(pHitGeo);
            mats.push(pHitMat);
            planetMeshes.push(pHitMesh);
            planetHitboxRefs.set(planet.name, pHitMesh);

            planetMeshRefs.set(planet.name, group);
            planetGroups.push({ group, planet });
        });

        // ── Belt orientation ───────────────────────────────────────────────────
        // Derive the ecliptic plane normal from two Mars HelioVector samples
        // 90 days apart. The cross product of the two unit-direction vectors
        // gives the exact orbital plane normal in scene-space, so both belts
        // align with the same plane the planet orbit rings live in.
        const beltQuat = eclipticQuaternion();

        // Belt config — declared in outer scope so the LOD system can read them.
        const AB_COUNT  = q.beltParticles.asteroid;
        const AB_INNER  = 134;
        const AB_OUTER  = 158;
        const KB_COUNT  = q.beltParticles.kuiper;
        const KB_INNER  = 342;
        const KB_OUTER  = 490;

        // Belt shape helpers — Box-Muller Gaussian, used by particles and LOD placement.
        const gaussRand = () => {
            let u, v;
            do { u = Math.random(); } while (u === 0);
            do { v = Math.random(); } while (v === 0);
            return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v);
        };

        // AB: 2.2–3.2 AU → AB_INNER–AB_OUTER scene units (24 scene units/AU)
        const AB_AU_SCALE   = (AB_OUTER - AB_INNER) / 1.0;   // scene units per AU of belt width
        const AB_PEAK_R     = AB_INNER + (2.70 - 2.2) * AB_AU_SCALE;  // 2.7 AU density peak
        const AB_SIGMA_R    = 0.33 * AB_AU_SCALE;            // radial density sigma (~0.33 AU)
        const AB_SIGMA_Z    = 7;                              // Gaussian vertical sigma (scene units)
        const KIRKWOOD_GAPS = [
            { r: AB_INNER + (2.50 - 2.2) * AB_AU_SCALE, hw: 1.8 }, // 3:1 resonance (widest gap)
            { r: AB_INNER + (2.82 - 2.2) * AB_AU_SCALE, hw: 1.2 }, // 5:2 resonance
            { r: AB_INNER + (2.96 - 2.2) * AB_AU_SCALE, hw: 1.0 }, // 7:3 resonance
        ];

        // KB: density peaks in the classical belt (inner half), KBOs have high inclinations
        const KB_PEAK_R     = KB_INNER + (KB_OUTER - KB_INNER) * 0.38;
        const KB_SIGMA_R    = (KB_OUTER - KB_INNER) * 0.30;
        const KB_SIGMA_Z    = 40;  // much wider than AB — KBO inclinations average ~15-20°

        // LOD tracking — populated below, used in the animate loop and cleanup.
        let abParticles = null;
        let kbParticles = null;
        const abLODGroups    = [];
        const kbLODGroups    = [];
        const beltLODInstances = [];
        const lodDummy = new THREE.Object3D();

        // ── Asteroid Belt ─────────────────────────────────────────────────────
        // Torus shape: Gaussian Z spread, density peaked at 2.7 AU, Kirkwood gaps excluded.
        // Inner belt S-type (brownish) → outer belt C-type (dark neutral) via vertex color.
        {
            const positions = new Float32Array(AB_COUNT * 3);
            const colors    = new Float32Array(AB_COUNT * 3);
            const innerRGB  = [0.478, 0.396, 0.376];  // #7a6560 S-type silicate
            const outerRGB  = [0.184, 0.184, 0.173];  // #4a4a46 C-type carbonaceous
            const _p = new THREE.Vector3();
            let placed = 0, attempts = 0;
            while (placed < AB_COUNT && attempts < AB_COUNT * 25) {
                attempts++;
                const r = Math.sqrt(Math.random() * (AB_OUTER ** 2 - AB_INNER ** 2) + AB_INNER ** 2);
                const density = 0.1 + 0.9 * Math.exp(-0.5 * ((r - AB_PEAK_R) / AB_SIGMA_R) ** 2);
                if (Math.random() > density) continue;
                let inGap = false;
                for (const g of KIRKWOOD_GAPS) { if (Math.abs(r - g.r) < g.hw) { inGap = true; break; } }
                if (inGap) continue;
                const theta = Math.random() * Math.PI * 2;
                _p.set(r * Math.cos(theta), gaussRand() * AB_SIGMA_Z, r * Math.sin(theta));
                _p.applyQuaternion(beltQuat);
                positions[placed * 3]     = _p.x;
                positions[placed * 3 + 1] = _p.y;
                positions[placed * 3 + 2] = _p.z;
                const t = Math.max(0, Math.min(1, (r - AB_INNER) / (AB_OUTER - AB_INNER)));
                colors[placed * 3]     = innerRGB[0] + t * (outerRGB[0] - innerRGB[0]);
                colors[placed * 3 + 1] = innerRGB[1] + t * (outerRGB[1] - innerRGB[1]);
                colors[placed * 3 + 2] = innerRGB[2] + t * (outerRGB[2] - innerRGB[2]);
                placed++;
            }
            const abGeo = new THREE.BufferGeometry();
            abGeo.setAttribute('position', new THREE.BufferAttribute(positions.subarray(0, placed * 3), 3));
            abGeo.setAttribute('color',    new THREE.BufferAttribute(colors.subarray(0, placed * 3), 3));
            const abMat = new THREE.PointsMaterial({
                vertexColors: true,
                size: 0.9,
                transparent: true,
                opacity: 0.55,
                sizeAttenuation: true,
                depthWrite: false,
            });
            abParticles = new THREE.Points(abGeo, abMat);
            scene.add(abParticles);
            geos.push(abGeo);
            mats.push(abMat);
        }

        // ── Kuiper Belt ────────────────────────────────────────────────────────
        // Torus shape: Gaussian Z spread (much wider than AB), density peaked in classical belt.
        {
            const positions = new Float32Array(KB_COUNT * 3);
            const _p = new THREE.Vector3();
            let placed = 0, attempts = 0;
            while (placed < KB_COUNT && attempts < KB_COUNT * 15) {
                attempts++;
                const r = Math.sqrt(Math.random() * (KB_OUTER ** 2 - KB_INNER ** 2) + KB_INNER ** 2);
                const density = 0.1 + 0.9 * Math.exp(-0.5 * ((r - KB_PEAK_R) / KB_SIGMA_R) ** 2);
                if (Math.random() > density) continue;
                const theta = Math.random() * Math.PI * 2;
                _p.set(r * Math.cos(theta), gaussRand() * KB_SIGMA_Z, r * Math.sin(theta));
                _p.applyQuaternion(beltQuat);
                positions[placed * 3]     = _p.x;
                positions[placed * 3 + 1] = _p.y;
                positions[placed * 3 + 2] = _p.z;
                placed++;
            }
            const kbGeo = new THREE.BufferGeometry();
            kbGeo.setAttribute('position', new THREE.BufferAttribute(positions.subarray(0, placed * 3), 3));
            const kbMat = new THREE.PointsMaterial({
                color: '#7aaec8',
                size: 1.2,
                transparent: true,
                opacity: 0.40,
                sizeAttenuation: true,
                depthWrite: false,
            });
            kbParticles = new THREE.Points(kbGeo, kbMat);
            scene.add(kbParticles);
            geos.push(kbGeo);
            mats.push(kbMat);
        }

        // ── Belt LOD: swap particle clouds for real 3D geometry when close ──────
        {
            const abAstMat = new THREE.MeshStandardMaterial({ color: '#b0a48e', roughness: 0.75, metalness: 0.30, emissive: '#6e5c3a', emissiveIntensity: 0.18 });
            const kbAstMat = new THREE.MeshStandardMaterial({ color: '#7a8494', roughness: 0.78, metalness: 0.25, emissive: '#2a3a52', emissiveIntensity: 0.22 });
            mats.push(abAstMat, kbAstMat);

            const ASTEROID_DEFS = [
                { key: 'geographos', abCount: 600, kbCount: 200, abSize: 0.15, kbSize: 0.52 },
                { key: 'mithra',     abCount: 480, kbCount: 160, abSize: 0.15, kbSize: 0.52 },
                { key: 'vesta',      abCount: 240, kbCount:  80, abSize: 0.15, kbSize: 0.52 },
                { key: 'bennu',      abCount: 240, kbCount:  80, abSize: 0.15, kbSize: 0.52 },
                { key: 'golevka',    abCount: 240, kbCount:  80, abSize: 0.15, kbSize: 0.52 },
            ];

            const buildABPositions = (count) => {
                const positions = [];
                const _p = new THREE.Vector3();
                let placed = 0, attempts = 0;
                while (placed < count && attempts < count * 25) {
                    attempts++;
                    const r = Math.sqrt(Math.random() * (AB_OUTER**2 - AB_INNER**2) + AB_INNER**2);
                    const density = 0.1 + 0.9 * Math.exp(-0.5 * ((r - AB_PEAK_R) / AB_SIGMA_R)**2);
                    if (Math.random() > density) continue;
                    let inGap = false;
                    for (const g of KIRKWOOD_GAPS) { if (Math.abs(r - g.r) < g.hw) { inGap = true; break; } }
                    if (inGap) continue;
                    const theta = Math.random() * Math.PI * 2;
                    _p.set(r * Math.cos(theta), gaussRand() * AB_SIGMA_Z, r * Math.sin(theta));
                    _p.applyQuaternion(beltQuat);
                    positions.push(_p.clone());
                    placed++;
                }
                return positions;
            };
            const buildKBPositions = (count) => {
                const positions = [];
                const _p = new THREE.Vector3();
                let placed = 0, attempts = 0;
                while (placed < count && attempts < count * 15) {
                    attempts++;
                    const r = Math.sqrt(Math.random() * (KB_OUTER**2 - KB_INNER**2) + KB_INNER**2);
                    const density = 0.1 + 0.9 * Math.exp(-0.5 * ((r - KB_PEAK_R) / KB_SIGMA_R)**2);
                    if (Math.random() > density) continue;
                    const theta = Math.random() * Math.PI * 2;
                    _p.set(r * Math.cos(theta), gaussRand() * KB_SIGMA_Z, r * Math.sin(theta));
                    _p.applyQuaternion(beltQuat);
                    positions.push(_p.clone());
                    placed++;
                }
                return positions;
            };

            const loader = new STLLoader();
            const loadSTL = (key) => new Promise((resolve, reject) => {
                loader.load(`/models/asteroids/${key}.stl`,
                    geo => resolve(geo),
                    undefined,
                    err => reject(err)
                );
            });

            // Low tier keeps the particle clouds: no STL fetch, no instancing.
            // (Guarded with a conditional rather than an early return — this is a
            // bare block inside the effect, so `return` would abandon the rest of
            // the scene setup entirely.)
            if (q.beltLOD) Promise.all(ASTEROID_DEFS.map(d => loadSTL(d.key))).then(geometries => {
                geometries.forEach((geo, idx) => {
                    geo.computeVertexNormals();
                    // Normalize to unit scale so abSize/kbSize directly control scene-unit diameter,
                    // regardless of the original units the STL was exported in (km, m, etc.).
                    geo.computeBoundingBox();
                    const bb = geo.boundingBox;
                    const maxDim = Math.max(
                        bb.max.x - bb.min.x,
                        bb.max.y - bb.min.y,
                        bb.max.z - bb.min.z
                    );
                    if (maxDim > 0) {
                        const center = new THREE.Vector3();
                        bb.getCenter(center);
                        geo.translate(-center.x, -center.y, -center.z);
                        geo.scale(1 / maxDim, 1 / maxDim, 1 / maxDim);
                    }
                    const def = ASTEROID_DEFS[idx];

                    // AB InstancedMesh
                    const abPositions = buildABPositions(def.abCount);
                    const abScales    = new Float32Array(def.abCount).map(() => 0.4 + Math.random() * 1.2);
                    const abAngles    = Array.from({ length: def.abCount }, () => ({
                        ax: Math.random() * Math.PI * 2,
                        ay: Math.random() * Math.PI * 2,
                        az: Math.random() * Math.PI * 2,
                        sx: (Math.random() - 0.5) * 0.0005,
                        sy: (Math.random() - 0.5) * 0.0005,
                        sz: (Math.random() - 0.5) * 0.0005,
                    }));
                    const abMesh = new THREE.InstancedMesh(geo, abAstMat, def.abCount);
                    abMesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
                    abMesh.visible = true;
                    abMesh.frustumCulled = false;
                    abMesh.userData.abAngles = abAngles;
                    abPositions.forEach((pos, i) => {
                        lodDummy.position.copy(pos);
                        lodDummy.rotation.set(abAngles[i].ax, abAngles[i].ay, abAngles[i].az);
                        lodDummy.scale.setScalar(def.abSize * abScales[i]);
                        lodDummy.updateMatrix();
                        abMesh.setMatrixAt(i, lodDummy.matrix);
                    });
                    abMesh.instanceMatrix.needsUpdate = true;
                    scene.add(abMesh);
                    abLODGroups.push({ mesh: abMesh, positions: abPositions, scales: abScales, def });
                    beltLODInstances.push(abMesh);

                    // KB InstancedMesh
                    const kbPositions = buildKBPositions(def.kbCount);
                    const kbScales    = new Float32Array(def.kbCount).map(() => 0.4 + Math.random() * 1.2);
                    const kbAngles    = Array.from({ length: def.kbCount }, () => ({
                        ax: Math.random() * Math.PI * 2,
                        ay: Math.random() * Math.PI * 2,
                        az: Math.random() * Math.PI * 2,
                        sx: (Math.random() - 0.5) * 0.0003,
                        sy: (Math.random() - 0.5) * 0.0003,
                        sz: (Math.random() - 0.5) * 0.0003,
                    }));
                    const kbMesh = new THREE.InstancedMesh(geo, kbAstMat, def.kbCount);
                    kbMesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
                    kbMesh.visible = true;
                    kbMesh.frustumCulled = false;
                    kbMesh.userData.kbAngles = kbAngles;
                    kbPositions.forEach((pos, i) => {
                        lodDummy.position.copy(pos);
                        lodDummy.rotation.set(kbAngles[i].ax, kbAngles[i].ay, kbAngles[i].az);
                        lodDummy.scale.setScalar(def.kbSize * kbScales[i]);
                        lodDummy.updateMatrix();
                        kbMesh.setMatrixAt(i, lodDummy.matrix);
                    });
                    kbMesh.instanceMatrix.needsUpdate = true;
                    scene.add(kbMesh);
                    kbLODGroups.push({ mesh: kbMesh, positions: kbPositions, scales: kbScales, def });
                    beltLODInstances.push(kbMesh);
                });
            }).catch(err => console.warn('Belt LOD STL load failed:', err));
        }

        // ── Small bodies: dwarf planets, asteroids, comet ─────────────────────
        const smallBodyGroups = [];
        let halleyGroupRef = null; // for per-frame coma orientation

        SMALL_BODIES.forEach(body => {
            const rawP = keplerianScenePos(body.el, body.scale);
            const pv   = new THREE.Vector3(rawP.x, rawP.y, rawP.z).applyQuaternion(beltQuat);
            const p    = { x: pv.x, y: pv.y, z: pv.z };

            // Orbit ring — true keplerian ellipse, thinner tube than planets
            const orbitPts = buildKeplerOrbitPoints(body.el, body.scale, body.isComet ? 512 : 360)
                .map(pt => pt.applyQuaternion(beltQuat));
            const orbitGeo = buildOrbitTube(orbitPts, 0.18, body.isComet ? 512 : 256);
            const orbitMat = new THREE.MeshBasicMaterial({
                color: 0xffffff, transparent: true,
                opacity: ORBIT_BASE_OPACITY * 0.8, depthWrite: false,
            });
            const orbitLine = new THREE.Mesh(orbitGeo, orbitMat);
            orbitLine.userData = { baseOpacity: ORBIT_BASE_OPACITY * 0.8, hoverOpacity: ORBIT_HOVER_OPACITY };
            scene.add(orbitLine);
            geos.push(orbitGeo);
            mats.push(orbitMat);

            // Nucleus sphere
            // 16 segments showed obvious facets on the limb once you could fly
            // right up to these bodies; the tier picks a smooth-enough count.
            const geo = new THREE.SphereGeometry(body.r, q.moonSegments, q.moonSegments);
            const mat = new THREE.MeshStandardMaterial({
                color: body.color, roughness: 0.9, metalness: 0.0,
                emissive: new THREE.Color(body.color),
                emissiveIntensity: PLANET_EMISSIVE_INTENSITY,
            });
            const mesh = new THREE.Mesh(geo, mat);
            mesh.userData = { id: body.id, name: body.name, orbitLine };
            // Deliberately outside the shadow map. These bodies are a fraction
            // of a scene unit across while the point light's shadow camera spans
            // 2000, so they fall well under one shadow texel and end up
            // self-shadowed into near-blackness — which is why Pallas rendered
            // three times darker than Luna despite a brighter texture. Nothing
            // meaningful casts onto them anyway.
            mesh.castShadow    = false;
            mesh.receiveShadow = false;
            geos.push(geo);
            mats.push(mat);

            // Painted surface. Vesta and Halley are skipped — their STL geometry
            // carries no UVs, so a map can't apply; their shape does the work.
            if (!['vesta', 'halley'].includes(body.id)) {
                const icy = ['haumea', 'makemake', 'eris'].includes(body.id);
                const surf = proceduralSurface(body.id, body.color, icy ? 'icy' : 'rocky');
                textures.push(surf.map);
                mat.map = surf.map;
                mat.color.set(0xffffff);
                if (surf.bumpMap) {
                    textures.push(surf.bumpMap);
                    mat.bumpMap = surf.bumpMap;
                    mat.bumpScale = surf.bumpScale;
                }
            }

            // STL model for Vesta
            if (body.id === 'vesta') {
                whenIdle(() => { if (!mounted) return; new STLLoader().load(
                    '/models/vesta.stl',
                    (stlGeo) => {
                        if (!mounted) { stlGeo.dispose(); return; }
                        stlGeo.computeVertexNormals();
                        stlGeo.center();
                        // Scale so the bounding sphere matches body.r
                        stlGeo.computeBoundingSphere();
                        const modelR = stlGeo.boundingSphere.radius;
                        const scaleFactor = body.r / modelR;
                        stlGeo.scale(scaleFactor, scaleFactor, scaleFactor);
                        mesh.geometry.dispose();
                        mesh.geometry = stlGeo;
                        geos.push(stlGeo);
                    },
                    undefined,
                    () => {}, // silently keep sphere fallback
                ); });
            }

            // Elongated STL nucleus for Halley — the Geographos asteroid model has
            // a similar peanut shape to Halley's imaged nucleus.
            if (body.id === 'halley') {
                new STLLoader().load(
                    '/models/asteroids/geographos.stl',
                    (stlGeo) => {
                        if (!mounted) { stlGeo.dispose(); return; }
                        stlGeo.computeVertexNormals();
                        stlGeo.center();
                        stlGeo.computeBoundingSphere();
                        const sf = body.r / stlGeo.boundingSphere.radius;
                        stlGeo.scale(sf, sf, sf);
                        mesh.geometry.dispose();
                        mesh.geometry = stlGeo;
                        geos.push(stlGeo);
                    },
                    undefined,
                    () => {}, // silently keep sphere fallback
                );
            }

            const group = new THREE.Group();
            group.add(mesh);
            group.position.set(p.x, p.y, p.z);

            // ── Halley: glowing coma + twin tails, streaming along local +Z ──────
            // The group is re-oriented every frame so +Z points anti-sunward.
            if (body.isComet) {
                // No coma shells here: concentric additive spheres read as flat
                // rings around the nucleus rather than a halo. The tails below
                // carry the comet's shape on their own.

                // Soft radial sprite — without a map, points render as hard squares
                // that are very visible at the close focused-camera distance.
                const puffCanvas = document.createElement('canvas');
                puffCanvas.width = puffCanvas.height = 64;
                const pctx = puffCanvas.getContext('2d');
                const pGrad = pctx.createRadialGradient(32, 32, 0, 32, 32, 32);
                pGrad.addColorStop(0,    'rgba(255,255,255,1)');
                pGrad.addColorStop(0.35, 'rgba(255,255,255,0.45)');
                pGrad.addColorStop(1,    'rgba(255,255,255,0)');
                pctx.fillStyle = pGrad;
                pctx.fillRect(0, 0, 64, 64);
                const puffTex = new THREE.CanvasTexture(puffCanvas);
                textures.push(puffTex);

                // Tail builder — cone of points along +Z, denser and brighter near
                // the nucleus; `curve` bends the tip sideways (dust lags the orbit).
                const buildTail = ({ count, len, baseSpread, flare, curve, rgb, size }) => {
                    const pos = new Float32Array(count * 3);
                    const col = new Float32Array(count * 3);
                    for (let j = 0; j < count; j++) {
                        const t      = Math.pow(Math.random(), 1.6); // cluster near nucleus
                        const dist   = t * len;
                        const spread = (baseSpread + flare * dist) * Math.sqrt(Math.random());
                        const theta  = Math.random() * Math.PI * 2;
                        pos[j * 3]     = spread * Math.cos(theta) + curve * t * t * len * 0.18;
                        pos[j * 3 + 1] = spread * Math.sin(theta);
                        pos[j * 3 + 2] = dist;
                        // Additive blending: fading color to black fades the point out
                        const fade = Math.pow(1 - t, 1.4) * (0.55 + Math.random() * 0.45);
                        col[j * 3]     = rgb[0] * fade;
                        col[j * 3 + 1] = rgb[1] * fade;
                        col[j * 3 + 2] = rgb[2] * fade;
                    }
                    const g = new THREE.BufferGeometry();
                    g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
                    g.setAttribute('color',    new THREE.BufferAttribute(col, 3));
                    const m = new THREE.PointsMaterial({
                        map: puffTex, vertexColors: true, size,
                        transparent: true, opacity: 0.9,
                        sizeAttenuation: true, depthWrite: false,
                        blending: THREE.AdditiveBlending,
                    });
                    group.add(new THREE.Points(g, m));
                    geos.push(g);
                    mats.push(m);
                };

                // Ion tail — long, straight, narrow, blue
                buildTail({ count: 900, len: 17, baseSpread: 0.05, flare: 0.045, curve: 0, rgb: [0.45, 0.65, 1.0], size: 0.22 });
                // Dust tail — shorter, broad, warm, gently curved
                buildTail({ count: 650, len: 10, baseSpread: 0.08, flare: 0.15, curve: 1.0, rgb: [1.0, 0.9, 0.72], size: 0.34 });

                halleyGroupRef = group;
            }

            scene.add(group);

            // Invisible hitbox — KBO dwarf planets get 2× larger radius (tiny, very far out)
            const isKBO   = ['haumea', 'makemake', 'eris'].includes(body.id);
            const hitR    = Math.max(body.r * 2 + 2.5, isKBO ? 14.0 : 7.0);
            const hitGeo  = new THREE.SphereGeometry(hitR, 8, 8);
            const hitMat  = new THREE.MeshBasicMaterial({ transparent: true, opacity: 0, depthWrite: false });
            const hitMesh = new THREE.Mesh(hitGeo, hitMat);
            hitMesh.userData = { id: body.id, name: body.name, orbitLine };
            group.add(hitMesh);
            geos.push(hitGeo);
            mats.push(hitMat);
            planetMeshes.push(mesh);
            planetMeshes.push(hitMesh);
            smallBodyHitRefs.set(body.id, hitMesh);
            smallBodyHitRadii.set(body.id, hitR);

            smallBodyGroups.push({ group, body });
        });

        // ── Moon meshes (MOON_DATA) ────────────────────────────────────────────
        let issOrbitMat  = null; // fades in/out with Earth focus
        let issRingMesh  = null; // billboard selection ring at ISS position
        let issRingMat   = null;

        MOON_DATA.forEach(moon => {
            const parentGroup = planetMeshRefs.get(moon.parent);
            if (!parentGroup) return;

            const parentPlanet = PLANETS.find(p => p.name === moon.parent);
            const planetR      = parentPlanet?.r ?? 1.0;

            const moonGeo = new THREE.SphereGeometry(moon.radius, q.moonSegments, q.moonSegments);
            const moonMat = new THREE.MeshStandardMaterial({
                color: moon.color,
                roughness: 0.95,
                metalness: 0.0,
                emissive: new THREE.Color(moon.color),
                emissiveIntensity: 0.04,
            });

            // Analytic planet-shadow on moon: same ray-sphere test as Saturn ring.
            // Store the planet-position Vector3 in userData so the animate loop can
            // mutate it in place — the shader uniform points to the same object.
            moonMat.userData.planetShadowPos = new THREE.Vector3();
            moonMat.onBeforeCompile = (shader) => {
                shader.uniforms.uPlanetPos    = { value: moonMat.userData.planetShadowPos };
                shader.uniforms.uPlanetRadius = { value: planetR };
                moonMat.userData.shader = shader;
                shader.vertexShader = 'varying vec3 vMoonWorldPos;\n' +
                    shader.vertexShader.replace(
                        '#include <project_vertex>',
                        '#include <project_vertex>\nvMoonWorldPos = (modelMatrix * vec4(position, 1.0)).xyz;'
                    );
                shader.fragmentShader =
                    'varying vec3 vMoonWorldPos;\nuniform vec3 uPlanetPos;\nuniform float uPlanetRadius;\n' +
                    shader.fragmentShader.replace(
                        '#include <tonemapping_fragment>',
                        `{
                            vec3  toSun = normalize(-vMoonWorldPos);
                            vec3  oc    = uPlanetPos - vMoonWorldPos;
                            float tca   = dot(oc, toSun);
                            if (tca > 0.0) {
                                float d2     = max(0.0, dot(oc, oc) - tca * tca);
                                float r2     = uPlanetRadius * uPlanetRadius;
                                float shadow = 1.0 - smoothstep(r2 * 0.85, r2 * 1.15, d2);
                                gl_FragColor.rgb *= mix(1.0, 0.06, shadow);
                            }
                        }
                        #include <tonemapping_fragment>`
                    );
            };

            const moonMesh = new THREE.Mesh(moonGeo, moonMat);
            moonMesh.userData = { id: moon.id, name: moon.name };
            scene.add(moonMesh);
            geos.push(moonGeo);
            mats.push(moonMat);
            moonMeshRefs.set(moon.name, moonMesh);

            if (moon.id && MOON_TEXTURES[moon.id]) {
                loader.load(texturePath(MOON_TEXTURES[moon.id]), (tex) => {
                    if (!mounted) { tex.dispose(); return; }
                    textures.push(tex);
                    moonMat.map = tex;
                    moonMat.color.set(0xffffff);
                    moonMat.emissiveIntensity = 0;
                    moonMat.needsUpdate = true;
                });
            } else if (moon.id !== 'iss') {
                // Painted surface (ISS is excluded — its sphere becomes the STL model).
                // Icy moons keep a faint self-glow so they stay readable against space.
                const icy = ['europa', 'enceladus', 'triton', 'titan'].includes(moon.id);
                const surf = proceduralSurface(moon.id ?? moon.name, moon.color, icy ? 'icy' : 'rocky');
                textures.push(surf.map);
                moonMat.map = surf.map;
                moonMat.color.set(0xffffff);
                if (surf.bumpMap) {
                    textures.push(surf.bumpMap);
                    moonMat.bumpMap = surf.bumpMap;
                    moonMat.bumpScale = surf.bumpScale;
                }
                // Icy surfaces are highly reflective in reality but render grey
                // this far from the Sun, so give them a little self-glow and a
                // smoother finish to catch the light.
                moonMat.emissiveIntensity = icy ? 0.10 : 0.03;
                if (icy) moonMat.roughness = 0.72;
            }

            // Invisible hitbox — added directly to scene so its matrixWorld is
            // always independent and up to date. Position is synced to moonMesh
            // explicitly every rAF frame via moonHitRefs.
            const hitR    = Math.max(moon.radius * 6, 4.5);
            const hitGeo  = new THREE.SphereGeometry(hitR, 8, 8);
            const hitMat  = new THREE.MeshBasicMaterial({ transparent: true, opacity: 0, depthWrite: false });
            const hitMesh = new THREE.Mesh(hitGeo, hitMat);
            hitMesh.userData = { id: moon.id, name: moon.name };
            scene.add(hitMesh);
            geos.push(hitGeo);
            mats.push(hitMat);
            moonHitRefs.set(moon.name, hitMesh);
            moonHitRadii.set(moon.name, hitR);
            planetMeshes.push(hitMesh);

            // Place at the phase0 orbital position immediately. Without this, a
            // direct page load focused on a moon computes its fly-in destination
            // from the hitbox's default (0,0,0) position on the first frame.
            {
                const incR0 = moon.inc * Math.PI / 180;
                moonMesh.position.set(
                    parentGroup.position.x + Math.cos(moon.phase0) * moon.orbitR,
                    parentGroup.position.y + Math.sin(moon.phase0) * moon.orbitR * Math.sin(incR0),
                    parentGroup.position.z + Math.sin(moon.phase0) * moon.orbitR * Math.cos(incR0),
                );
                hitMesh.position.copy(moonMesh.position);
            }

            // ── ISS-specific extras ────────────────────────────────────────────
            if (moon.id === 'iss') {
                // Replace sphere with STL model
                whenIdle(() => { if (!mounted) return; new STLLoader().load(
                    '/models/iss.stl',
                    (stlGeo) => {
                        if (!mounted) { stlGeo.dispose(); return; }
                        stlGeo.computeVertexNormals();
                        stlGeo.center();
                        stlGeo.computeBoundingSphere();
                        const sf = moon.radius / stlGeo.boundingSphere.radius;
                        stlGeo.scale(sf, sf, sf);
                        moonMesh.geometry.dispose();
                        moonMesh.geometry = stlGeo;
                        geos.push(stlGeo);
                    },
                    undefined,
                    () => {},
                ); });

                // Orbital path ring (line loop in Earth's local space, moves with Earth)
                const incR = moon.inc * Math.PI / 180;
                const orbitPts = [];
                for (let j = 0; j <= 256; j++) {
                    const a = (j / 256) * Math.PI * 2;
                    orbitPts.push(new THREE.Vector3(
                        Math.cos(a) * moon.orbitR,
                        Math.sin(a) * moon.orbitR * Math.sin(incR),
                        Math.sin(a) * moon.orbitR * Math.cos(incR),
                    ));
                }
                const orbitLineGeo = new THREE.BufferGeometry().setFromPoints(orbitPts);
                issOrbitMat = new THREE.LineBasicMaterial({
                    color: '#7799bb', transparent: true, opacity: 0, depthWrite: false,
                });
                const issOrbitLine = new THREE.LineLoop(orbitLineGeo, issOrbitMat);
                parentGroup.add(issOrbitLine);
                geos.push(orbitLineGeo);
                mats.push(issOrbitMat);

                // Billboard selection ring (follows ISS, always faces camera)
                const ringGeo = new THREE.RingGeometry(0.152, 0.216, 64);
                issRingMat  = new THREE.MeshBasicMaterial({
                    color: '#aaccff', transparent: true, opacity: 0,
                    side: THREE.DoubleSide, depthWrite: false,
                });
                issRingMesh = new THREE.Mesh(ringGeo, issRingMat);
                scene.add(issRingMesh);
                geos.push(ringGeo);
                mats.push(issRingMat);
            }
        });
        MOON_DATA.forEach(moon => moonAngles.set(moon.name, moon.phase0));

        // Refresh positions every 60 s
        const posInterval = setInterval(() => {
            if (!mounted) return;
            planetGroups.forEach(({ group, planet }) => {
                const p = computePlanetPos(planet.name, planet.orbitR);
                group.position.set(p.x, p.y, p.z);
            });
        }, 60000);

        // ── Raycaster helpers ──────────────────────────────────────────────────
        const raycaster    = new THREE.Raycaster();
        const mouse        = new THREE.Vector2();
        let activeOrbit       = null;
        let hoveredMoonId     = null;
        let prevHoveredMoonId = null;

        const toNDC = (e) => {
            const rect = renderer.domElement.getBoundingClientRect();
            mouse.x =  ((e.clientX - rect.left) / rect.width)  * 2 - 1;
            mouse.y = -((e.clientY - rect.top)  / rect.height) * 2 + 1;
        };

        // Moons are only selectable when their parent planet (or a sibling moon) is focused.
        // The focused object itself is excluded — it can't be re-focused, and keeping it in
        // would let Earth's hitbox block rays aimed at the ISS when ISS passes behind Earth.
        const getSelectableMeshes = () => {
            const focused = focusedIdRef.current;
            const planet  = focused ? PLANETS.find(p => p.id === focused) : null;
            const moon    = focused ? MOON_DATA.find(m => m.id === focused) : null;
            const focusedParent = planet?.name ?? moon?.parent ?? null;
            return planetMeshes.filter(m => {
                if (focused && m.userData.id === focused) return false; // already focused — skip
                const moonDef = MOON_DATA.find(mm => mm.id === m.userData.id);
                if (!moonDef) return true; // sun / planet / small-body — always selectable
                return moonDef.parent === focusedParent;
            });
        };

        const handleClick = (e) => {
            toNDC(e);
            raycaster.setFromCamera(mouse, camera);
            const hits = raycaster.intersectObjects(getSelectableMeshes(), false);
            if (hits.length > 0) {
                const id = hits[0].object.userData.id;
                if (id) {
                    pendingFocusCamPos = camera.position.clone();
                    navigateRef.current(`/object/${id}`);
                }
            }
        };

        const handleMouseMove = (e) => {
            toNDC(e);
            raycaster.setFromCamera(mouse, camera);
            const hits = raycaster.intersectObjects(getSelectableMeshes(), false);
            if (hits.length > 0) {
                const hitMesh  = hits[0].object;
                const orbit    = hitMesh.userData.orbitLine;

                if (orbit !== activeOrbit) {
                    if (activeOrbit) {
                        activeOrbit.material.opacity = focusedIdRef.current ? 0 : (activeOrbit.userData.baseOpacity ?? ORBIT_BASE_OPACITY);
                    }
                    if (orbit && !focusedIdRef.current) {
                        orbit.material.opacity = orbit.userData.hoverOpacity ?? ORBIT_HOVER_OPACITY;
                    }
                    activeOrbit = orbit ?? null;
                }

                renderer.domElement.style.cursor = hitMesh.userData.id ? 'pointer' : '';
                // Track moon hover for orbital speed slow-down
                hoveredMoonId = (focusedIdRef.current && MOON_DATA.some(m => m.id === hitMesh.userData.id))
                    ? hitMesh.userData.id : null;
                // Decelerate auto-rotate only in home view (focused mode already disables it)
                if (!focusedIdRef.current) targetAutoRotateSpeed = 0;
            } else {
                if (activeOrbit) {
                    activeOrbit.material.opacity = focusedIdRef.current ? 0 : (activeOrbit.userData.baseOpacity ?? ORBIT_BASE_OPACITY);
                    activeOrbit = null;
                }
                renderer.domElement.style.cursor = '';
                hoveredMoonId = null;
                targetAutoRotateSpeed = 0.11;
            }
        };

        renderer.domElement.addEventListener('click',     handleClick);
        renderer.domElement.addEventListener('mousemove', handleMouseMove);

        // ── ResizeObserver ─────────────────────────────────────────────────────
        const ro = new ResizeObserver(([entry]) => {
            const { width, height } = entry.contentRect;
            if (!width || !height) return;
            // Re-budget on resize too: rotating a tablet changes the surface
            // area enough to matter.
            renderer.setPixelRatio(pixelRatioFor(width, height));
            renderer.setSize(width, height);
            camera.aspect = width / height;
            camera.updateProjectionMatrix();
        });
        ro.observe(mount);

        // ── Animation loop ─────────────────────────────────────────────────────
        let animId;
        let frameCount = 0;
        let prevNowDays = null;
        let meshRotSpeed = 0.002;
        let liveOrbitSpeed = 2000;
        let liveISSSpeed   = 2000; // tracked independently so hover response is immediate
        // Target axial-tilt z-rotation per planet — lerped smoothly each frame
        const tiltTargets = new Map(); // mesh uuid → target rotation.z (radians)

        const animate = () => {
            animId = requestAnimationFrame(animate);
            frameCount++;
            const nowDays = (Date.now() - ORBIT_EPOCH_MS) / 86400000;
            const currentFocusedId = focusedIdRef.current;

            // ── Detect focus changes ───────────────────────────────────────────
            if (currentFocusedId !== prevFocusedId) {
                // Restore previous focused planet's orbit + tilt + hitbox scale
                if (prevFocusedId) {
                    const prevMesh = planetMeshes.find(m => m.userData.id === prevFocusedId);
                    if (prevMesh && prevMesh.userData.name !== 'Saturn') {
                        tiltTargets.set(prevMesh.uuid, 0); // lerp tilt back to upright
                    }
                    // Restore ALL orbit rings when exiting any focused state
                    planetMeshes.forEach(m => {
                        if (m.userData.orbitLine) {
                            const base = m.userData.orbitLine.userData.baseOpacity;
                            m.userData.orbitLine.material.opacity = base ?? ORBIT_BASE_OPACITY;
                        }
                    });
                    // Restore all hitboxes to full inflated size
                    PLANETS.forEach(p => {
                        const hb = planetHitboxRefs.get(p.name);
                        if (hb) hb.scale.setScalar(1.0);
                    });
                    SMALL_BODIES.forEach(b => {
                        const hb = smallBodyHitRefs.get(b.id);
                        if (hb) hb.scale.setScalar(1.0);
                    });
                    MOON_DATA.forEach(moon => {
                        const hm = moonHitRefs.get(moon.name);
                        if (hm) hm.scale.setScalar(1.0);
                    });
                }
                // Apply axial tilt + hide ALL orbit rings when focusing
                if (currentFocusedId) {
                    const newMesh = planetMeshes.find(m => m.userData.id === currentFocusedId);
                    // Queue axial tilt as a lerp target (except Saturn — always tilted)
                    if (newMesh && newMesh.userData.name !== 'Saturn') {
                        const tilt = AXIAL_TILT_DEG[newMesh.userData.name];
                        tiltTargets.set(newMesh.uuid, tilt !== undefined ? tilt * Math.PI / 180 : 0);
                    }
                    // Hide ALL orbit rings in the scene when any planet is focused
                    planetMeshes.forEach(m => {
                        if (m.userData.orbitLine) {
                            m.userData.orbitLine.material.opacity = 0;
                        }
                    });
                    // Shrink all hitboxes to 1× visual radius when anything is focused
                    PLANETS.forEach(p => {
                        const hb = planetHitboxRefs.get(p.name);
                        const hr = hb?.geometry?.parameters?.radius ?? 1;
                        if (hb) hb.scale.setScalar(p.r / hr);
                    });
                    SMALL_BODIES.forEach(b => {
                        const hb = smallBodyHitRefs.get(b.id);
                        const hr = smallBodyHitRadii.get(b.id) ?? 1;
                        if (hb) hb.scale.setScalar(b.r / hr);
                    });
                    MOON_DATA.forEach(moon => {
                        const hm = moonHitRefs.get(moon.name);
                        const hr = moonHitRadii.get(moon.name) ?? 1;
                        if (hm) hm.scale.setScalar((moon.hitRadius ?? moon.radius) * 2 / hr);
                    });
                    // Compute smooth focus animation — starts from current camera,
                    // ends at 30° elevation above the planet at the correct zoom distance
                    if (newMesh) {
                        const planetPos = new THREE.Vector3();
                        newMesh.getWorldPosition(planetPos);
                        // Radius from the data tables — geometry.parameters is undefined
                        // for meshes whose sphere was swapped for an STL model (Vesta).
                        const focusDef = PLANETS.find(b => b.id === currentFocusedId)
                            ?? SMALL_BODIES.find(b => b.id === currentFocusedId)
                            ?? MOON_DATA.find(b => b.id === currentFocusedId);
                        const radius = focusDef?.r ?? focusDef?.radius
                            ?? newMesh.geometry?.parameters?.radius ?? 3.5;
                        const isTinyBody = SMALL_BODIES.some(b => b.id === currentFocusedId)
                            || MOON_DATA.some(b => b.id === currentFocusedId);
                        const baseDist = newMesh.userData.id === 'sun' ? 50
                                     : newMesh.userData.id === 'iss' ? 0.3
                                     // Back off further for Halley so coma + tails frame the shot
                                     : newMesh.userData.id === 'halley' ? 7
                                     // Small bodies & moons scale with radius — the flat +2
                                     // pushed tiny objects much too far from the camera
                                     : isTinyBody ? Math.max(radius * 5.5, 0.5)
                                     : radius * 3.5 + 2;
                        // A portrait viewport has a far narrower horizontal field of
                        // view, so a distance framed for landscape pushes the body off
                        // both edges. Back off in proportion, with a ceiling so phones
                        // don't end up looking at a distant speck.
                        const dist = baseDist * (camera.aspect < 1
                            ? Math.min(2.0, Math.pow(1 / camera.aspect, 0.8))
                            : 1);
                        const TILT   = 30 * Math.PI / 180; // 30° above equatorial = looking 30° down
                        const startCamPos = pendingFocusCamPos ?? camera.position;
                        pendingFocusCamPos = null;
                        const diff   = startCamPos.clone().sub(planetPos);
                        const az     = Math.atan2(diff.x, diff.z); // maintain user's azimuth
                        focusStartCamPos.copy(startCamPos);
                        focusStartTarget.copy(controls.target);
                        focusEndCamPos.set(
                            planetPos.x + dist * Math.cos(TILT) * Math.sin(az),
                            planetPos.y + dist * Math.sin(TILT),
                            planetPos.z + dist * Math.cos(TILT) * Math.cos(az)
                        );
                        focusProgress  = 0;
                        focusAnimating = true;
                    }
                }
                // Trigger cinematic zoom-out when going focused → home
                if (prevFocusedId && !currentFocusedId) {
                    exitPhase  = 1;
                    exitFrames = 0;
                }
                setMoonLabelsReady(false);
                prevFocusedId  = currentFocusedId;
            }

            // ── Moon positions (MOON_DATA) ─────────────────────────────────────
            // Delta-time keeps motion continuous (no snapping between frames).
            // liveOrbitSpeed only applies to the focused planet's moons; all others
            // stay at 2000 so switching focus doesn't accelerate unrelated moons.
            const moonFocused       = currentFocusedId && MOON_DATA.some(m => m.id === currentFocusedId);
            const focusedMoon       = moonFocused ? MOON_DATA.find(m => m.id === currentFocusedId) : null;
            const focusedMoonParent = focusedMoon?.parent ?? null;
            const focusedPlanet     = !moonFocused ? (PLANETS.find(p => p.id === currentFocusedId) ?? null) : null;
            const currentFocusedPlanetName = focusedPlanet?.name ?? null;
            const speedTarget = targetOrbitSpeed({
                hoveredMoonId, focusedMoon, focusedPlanet, moons: MOON_DATA,
            });
            const planetFocusChanged = currentFocusedPlanetName !== prevFocusedPlanetName;
            liveOrbitSpeed = stepOrbitSpeed(liveOrbitSpeed, speedTarget, { planetFocusChanged });
            prevFocusedPlanetName = currentFocusedPlanetName;
            const MOON_SPEED = liveOrbitSpeed;

            // The ISS tracks its own speed so hover and focus respond immediately
            // instead of easing down from the outer moons' much larger values.
            {
                const issMoon = MOON_DATA.find(m => m.noSpeedScaling);
                const parentFocused = !!issMoon && (
                    (focusedPlanet && issMoon.parent === focusedPlanet.name) ||
                    (focusedMoonParent && issMoon.parent === focusedMoonParent)
                );
                liveISSSpeed = stepOrbitSpeed(
                    liveISSSpeed,
                    targetIssSpeed({ issMoon, focusedId: currentFocusedId, hoveredMoonId, parentFocused }),
                );
            }

            const deltaDays = prevNowDays != null ? Math.min(nowDays - prevNowDays, 0.005) : 0;
            prevNowDays = nowDays;
            MOON_DATA.forEach(moon => {
                const parentGroup = planetMeshRefs.get(moon.parent);
                const moonMesh    = moonMeshRefs.get(moon.name);
                if (!parentGroup || !moonMesh) return;
                // Keep planet-shadow uniform in sync with the planet's current world position
                const shadowVec = moonMesh.material?.userData?.planetShadowPos;
                if (shadowVec) parentGroup.getWorldPosition(shadowVec);
                const parentFocused = (focusedPlanet && moon.parent === focusedPlanet.name)
                    || (focusedMoonParent && moon.parent === focusedMoonParent);
                const effectiveSpeed = moon.noSpeedScaling
                    ? liveISSSpeed
                    : parentFocused ? MOON_SPEED : DEFAULT_ORBIT_SPEED;
                const angle = advanceMoonAngle(
                    moon, moonAngles.get(moon.name) ?? moon.phase0, deltaDays, effectiveSpeed,
                );
                moonAngles.set(moon.name, angle);
                const off = moonOffset(moon, angle);
                const mx = parentGroup.position.x + off.x;
                const my = parentGroup.position.y + off.y;
                const mz = parentGroup.position.z + off.z;
                moonMesh.position.set(mx, my, mz);
                const hitMesh = moonHitRefs.get(moon.name);
                if (hitMesh) hitMesh.position.set(mx, my, mz);
            });

            // Scale hovered moon hitbox to 1.5× visual radius; restore previous on change
            if (hoveredMoonId !== prevHoveredMoonId) {
                const focusedPlanet = PLANETS.find(p => p.id === currentFocusedId);
                if (focusedPlanet) {
                    if (prevHoveredMoonId) {
                        const prev = MOON_DATA.find(m => m.id === prevHoveredMoonId);
                        if (prev && prev.parent === focusedPlanet.name) {
                            const hm = moonHitRefs.get(prev.name);
                            const hr = moonHitRadii.get(prev.name) ?? 1;
                            if (hm) hm.scale.setScalar((prev.hitRadius ?? prev.radius) * 2 / hr);
                        }
                    }
                    if (hoveredMoonId) {
                        const hov = MOON_DATA.find(m => m.id === hoveredMoonId);
                        if (hov && hov.parent === focusedPlanet.name) {
                            const hm = moonHitRefs.get(hov.name);
                            const hr = moonHitRadii.get(hov.name) ?? 1;
                            if (hm) hm.scale.setScalar((hov.hitRadius ?? hov.radius) * 3 / hr);
                        }
                    }
                }
                prevHoveredMoonId = hoveredMoonId;
            }

            // ── ISS orbit ring + billboard selection ring ─────────────────────
            const earthFocused = currentFocusedId === 'earth'
                || (moonFocused && focusedMoonParent === 'Earth');
            const issHovered   = hoveredMoonId === 'iss';
            const issFocused   = currentFocusedId === 'iss';

            if (issOrbitMat) {
                const tgt = (earthFocused || issFocused) ? 0.35 : 0;
                issOrbitMat.opacity += (tgt - issOrbitMat.opacity) * 0.08;
            }
            if (issRingMesh && issRingMat) {
                const issMesh = moonMeshRefs.get('ISS');
                if (issMesh) {
                    issRingMesh.position.copy(issMesh.position);
                    issRingMesh.quaternion.copy(camera.quaternion);
                }
                const tgt = issFocused ? 0 : issHovered ? 0.92 : earthFocused ? 0.42 : 0;
                issRingMat.opacity += (tgt - issRingMat.opacity) * 0.1;
            }

            // ── Small body positions (updated every frame; orbits are slow) ───
            smallBodyGroups.forEach(({ group, body }) => {
                const rawP = keplerianScenePos(body.el, body.scale);
                const pv   = new THREE.Vector3(rawP.x, rawP.y, rawP.z).applyQuaternion(beltQuat);
                group.position.set(pv.x, pv.y, pv.z);
            });

            // ── Halley coma: orient group so local +Z points anti-sunward ─────
            if (halleyGroupRef) {
                const hp  = halleyGroupRef.position;
                const len = Math.sqrt(hp.x * hp.x + hp.y * hp.y + hp.z * hp.z);
                if (len > 0.01) {
                    halleyGroupRef.quaternion.setFromUnitVectors(
                        new THREE.Vector3(0, 0, 1),
                        new THREE.Vector3(hp.x / len, hp.y / len, hp.z / len),
                    );
                }
            }

            // ── Self-rotation ──────────────────────────────────────────────────
            const targetRotSpeed = moonFocused ? 0.00008 : 0.002;
            meshRotSpeed += (targetRotSpeed - meshRotSpeed) * 0.03;
            sunMesh.rotation.y      += 0.0008;
            if (skySphere) skySphere.rotation.y += 0.00002;
            planetMeshes.forEach(m => {
                // Halley holds still while focused. Its nucleus is an irregular
                // lump and the tails are fixed anti-sunward, so spinning it just
                // makes the shape wobble under a static tail.
                if (!(m.userData.id === 'halley' && currentFocusedId === 'halley')) {
                    m.rotation.y += meshRotSpeed;
                }
                // Smoothly lerp axial tilt instead of snapping (avoids surface-texture jump)
                const targetZ = tiltTargets.get(m.uuid);
                if (targetZ !== undefined) {
                    const diff = targetZ - m.rotation.z;
                    if (Math.abs(diff) < 0.0002) {
                        m.rotation.z = targetZ;
                        tiltTargets.delete(m.uuid);
                    } else {
                        m.rotation.z += diff * 0.04;
                    }
                }
            });
            moonMeshRefs.forEach(m => { m.rotation.y += meshRotSpeed; });

            // ── Earth day/night shader: update sun direction each frame ──────────
            if (earthMesh && earthShaderMat) {
                const _earthWorldPos = new THREE.Vector3();
                earthMesh.getWorldPosition(_earthWorldPos);
                earthShaderMat.uniforms.sunDirection.value
                    .copy(_earthWorldPos).negate().normalize();
            }

            // ── Camera / focus logic ───────────────────────────────────────────
            const targetMesh = currentFocusedId
                ? planetMeshes.find(m => m.userData.id === currentFocusedId)
                : null;

            // Hoisted so the post-controls.update() block can reference it
            const targetPos = new THREE.Vector3();

            if (targetMesh) {
                exitPhase = 0;
                targetMesh.getWorldPosition(targetPos);

                // Aim below the body by a fraction of the visible height — the
                // body then sits that much higher in frame.
                const vOffset = focusOffsetRef.current;
                if (vOffset) {
                    const d = camera.position.distanceTo(targetPos);
                    const viewH = 2 * d * Math.tan((camera.fov * Math.PI / 180) / 2);
                    _camUpVec.set(0, 1, 0).applyQuaternion(camera.quaternion);
                    targetPos.addScaledVector(_camUpVec, -vOffset * viewH);
                }

                const bodyDef = PLANETS.find(b => b.id === currentFocusedId)
                    ?? SMALL_BODIES.find(b => b.id === currentFocusedId)
                    ?? MOON_DATA.find(b => b.id === currentFocusedId);
                const planetRadius = bodyDef?.r ?? bodyDef?.radius ?? 3.5;
                controls.minDistance = planetRadius * 2.5;
                // Near plane must stay smaller than the closest moon can get to the camera.
                // e.g. Saturn r=3.56 → cam at 14.46, Mimas orbitR=13 → gap=1.46.
                // Using 0.1× radius keeps near well below that gap for all planet/moon combos.
                camera.near = Math.max(0.01, planetRadius * 0.1);
                camera.updateProjectionMatrix();

                if (focusAnimating) {
                    if (isInteracting) {
                        // User grabbed control mid-animation — hand off immediately
                        focusAnimating = false;
                        controls.target.copy(targetPos);
                        setMoonLabelsReady(true);
                    } else {
                        // Point target at planet immediately so controls.update() calls
                        // camera.lookAt(planet) — prevents "looking at origin" visual glitch
                        controls.target.copy(targetPos);
                    }
                } else {
                    controls.target.lerp(targetPos, 0.08);
                }
                controls.autoRotate = false;

            } else if (exitPhase === 1) {
                controls.minDistance = 30;
                camera.near = 1;
                camera.updateProjectionMatrix();
                // Phase 1: constant-velocity pull-back from the planet (50 frames ≈ 0.8s)
                exitFrames++;
                if (!isInteracting) {
                    const currentDist = camera.position.distanceTo(controls.target);
                    const dir = new THREE.Vector3().subVectors(camera.position, controls.target).normalize();
                    // Move camera 6 units further from planet every frame — always outward,
                    // never snaps back regardless of starting distance.
                    camera.position.copy(controls.target).addScaledVector(dir, currentDist + 6);
                }
                if (exitFrames >= 50) exitPhase = 2;
                controls.autoRotate = false;

            } else if (exitPhase === 2) {
                // Phase 2: smoothly fly camera back toward the sun
                const defaultTarget = new THREE.Vector3(0, 0, 0);
                controls.target.lerp(defaultTarget, 0.04);
                if (!isInteracting) {
                    const currentDistance = camera.position.distanceTo(controls.target);
                    const nextDistance = THREE.MathUtils.lerp(currentDistance, 556, 0.04);
                    const dir = new THREE.Vector3().subVectors(camera.position, controls.target).normalize();
                    camera.position.copy(controls.target).addScaledVector(dir, nextDistance);
                }
                controls.autoRotate = false;
                if (controls.target.length() < 8) {
                    exitPhase = 0;
                    controls.autoRotate = true;
                }

            } else {
                // Normal home state — let the user zoom freely; only nudge the slow vertical drift
                const defaultTarget = new THREE.Vector3(0, 0, 0);
                controls.target.lerp(defaultTarget, 0.08);
                if (!isInteracting) {
                    // Sine wave on the vertical axis → diagonal orbit (bottom-left to top-right feel)
                    controls.rotateUp(Math.sin(Date.now() / 10000) * 0.00018);
                }
                controls.autoRotate = true;
            }

            // Smoothly lerp autoRotateSpeed toward target (hover deceleration / re-acceleration)
            controls.autoRotateSpeed = THREE.MathUtils.lerp(controls.autoRotateSpeed, targetAutoRotateSpeed, 0.05);

            controls.update();

            // Override camera position + lookAt AFTER controls.update()
            if (focusAnimating && targetMesh && !isInteracting) {
                focusProgress = Math.min(1, focusProgress + 0.014); // ~72 frames ≈ 1.2s
                // Cubic ease-in-out: slow start → accelerates → gentle brake
                const t = focusProgress < 0.5
                    ? 4 * focusProgress * focusProgress * focusProgress
                    : 1 - Math.pow(-2 * focusProgress + 2, 3) / 2;
                camera.position.lerpVectors(focusStartCamPos, focusEndCamPos, t);
                // Gradually rotate toward the planet instead of snapping the look direction
                _focusLookTarget.lerpVectors(focusStartTarget, targetPos, t);
                controls.target.copy(_focusLookTarget);
                camera.lookAt(_focusLookTarget);
                if (focusProgress >= 1) {
                    focusAnimating = false;
                    controls.target.copy(targetPos);
                    setMoonLabelsReady(true);
                }
            }

            // ── Object labels ──────────────────────────────────────────────────
            if (mounted) {
                const rect = renderer.domElement.getBoundingClientRect();
                const project = (mesh) => {
                    const wp = new THREE.Vector3();
                    mesh.getWorldPosition(wp);
                    const pr = wp.clone().project(camera);
                    // Clip labels outside the viewport — off-screen absolutely-positioned
                    // labels would otherwise stretch the document height while zooming.
                    if (pr.z > 1 || Math.abs(pr.x) > 1.05 || Math.abs(pr.y) > 1.05) return null;
                    return {
                        x: (pr.x + 1) / 2 * rect.width,
                        y: -(pr.y - 1) / 2 * rect.height,
                        depth: pr.z,
                    };
                };
                const newLabels = [];
                if (!currentFocusedId) {
                    // Home view — label every planet
                    planetGroups.forEach(({ group, planet }) => {
                        const pos = project(group);
                        if (pos) newLabels.push({ name: planet.name, kind: 'planet', ...pos });
                    });
                    // Small body labels (dimmer, same size as moon labels)
                    smallBodyGroups.forEach(({ group, body }) => {
                        const pos = project(group);
                        if (pos) newLabels.push({ name: body.name, kind: 'small-body', ...pos });
                    });
                } else {
                    // Focused on a planet — show its moons only
                    const focusedPlanet = planetGroups.find(({ planet }) => planet.id === currentFocusedId);
                    if (focusedPlanet) {
                        MOON_DATA.forEach(moon => {
                            if (moon.parent !== focusedPlanet.planet.name) return;
                            const mesh = moonMeshRefs.get(moon.name);
                            if (!mesh) return;
                            const pos = project(mesh);
                            if (pos) newLabels.push({ name: moon.name, kind: 'moon', ...pos });
                        });
                    } else {
                        // Focused on a moon — label the moon itself
                        const focusedMoon = MOON_DATA.find(m => m.id === currentFocusedId);
                        if (focusedMoon) {
                            const mesh = moonMeshRefs.get(focusedMoon.name);
                            if (mesh) {
                                const pos = project(mesh);
                                if (pos) newLabels.push({ name: focusedMoon.name, kind: 'moon', ...pos });
                            }
                        }
                    }
                }
                setObjectLabels(prev => {
                    if (prev.length === 0 && newLabels.length === 0) return prev;
                    return newLabels;
                });
            }

            // ── Belt LOD ──────────────────────────────────────────────────────
            // Tumbling the instances means rebuilding ~3,200 matrices on the CPU
            // every frame, for rocks a couple of pixels across. Only the top tier
            // pays for it, and even there only every third frame — the motion is
            // far too slow to tell apart.
            if (abLODGroups.length > 0 && abParticles) abParticles.visible = false;
            if (kbLODGroups.length > 0 && kbParticles) kbParticles.visible = false;

            if (q.beltLODRotate && frameCount % 3 === 0) {
                const spin = (groups, anglesKey, sizeKey) => {
                    groups.forEach(({ mesh, positions, scales, def }) => {
                        const angles = mesh.userData[anglesKey];
                        for (let i = 0; i < positions.length; i++) {
                            const a = angles[i];
                            a.ax += a.sx * 3; a.ay += a.sy * 3; a.az += a.sz * 3;
                            lodDummy.position.copy(positions[i]);
                            lodDummy.rotation.set(a.ax, a.ay, a.az);
                            lodDummy.scale.setScalar(def[sizeKey] * scales[i]);
                            lodDummy.updateMatrix();
                            mesh.setMatrixAt(i, lodDummy.matrix);
                        }
                        mesh.instanceMatrix.needsUpdate = true;
                    });
                };
                spin(abLODGroups, 'abAngles', 'abSize');
                spin(kbLODGroups, 'kbAngles', 'kbSize');
            }

            if (sRingRefs.mat?.userData?.shader) {
                sRingRefs.group.getWorldPosition(
                    sRingRefs.mat.userData.shader.uniforms.uSaturnPos.value
                );
            }

            renderer.render(scene, camera);
        };
        animate();

        // ── Cleanup ────────────────────────────────────────────────────────────
        return () => {
            // Snapshot camera for exit animation in case React Router remounts this component
            if (focusedIdRef.current) {
                _exitState = {
                    active:    true,
                    cameraPos: camera.position.clone(),
                    targetPos: controls.target.clone(),
                };
            }
            mounted = false;
            cancelAnimationFrame(animId);
            idleTimers.forEach(cancel => cancel());
            clearInterval(posInterval);
            ro.disconnect();
            renderer.domElement.removeEventListener('click',     handleClick);
            renderer.domElement.removeEventListener('mousemove', handleMouseMove);
            renderer.domElement.removeEventListener('webglcontextlost',     onContextLost);
            renderer.domElement.removeEventListener('webglcontextrestored', onContextRestored);
            if (mount.contains(renderer.domElement)) mount.removeChild(renderer.domElement);
            controls.dispose();
            geos.forEach(g => g.dispose());
            mats.forEach(m => m.dispose());
            textures.forEach(t => t.dispose());
            beltLODInstances.forEach(m => { m.geometry.dispose(); scene.remove(m); });
            renderer.dispose();
        };
    }, []); // eslint-disable-line react-hooks/exhaustive-deps

    return (
        <div style={{ position: 'relative' }}>
            {/* Canvas mount — fills full viewport height, sits behind transparent header */}
            <div
                ref={mountRef}
                style={{ width: '100%', height, position: 'relative', overflow: 'hidden' }}
            >
                {/* Not-to-scale disclaimer */}
                <div style={{
                    position: 'absolute',
                    bottom: '14px',
                    left: '16px',
                    pointerEvents: 'none',
                    color: 'rgba(255,255,255,0.28)',
                    fontSize: '10px',
                    fontWeight: 600,
                    letterSpacing: '0.04em',
                    textShadow: '0 1px 3px rgba(0,0,0,0.8)',
                    zIndex: 2,
                }}>
                    *not to scale
                </div>

                {/* Floating object labels */}
                {objectLabels.map((label, i) => {
                    // Planet labels: 20–28. Moon labels: 4–8.
                    // Within each band, closer objects (lower depth) get higher z.
                    const isMoon       = label.kind === 'moon';
                    const isSmallBody  = label.kind === 'small-body';
                    const base   = isMoon ? 4 : isSmallBody ? 12 : 20;
                    const range  = isMoon ? 4 : isSmallBody ? 4  : 8;
                    const zIndex = base + Math.round((1 - label.depth) * range * 0.5);
                    return (
                    <div key={`${label.name}-${i}`} style={{
                        position: 'absolute',
                        left: label.x,
                        top: label.y,
                        transform: 'translate(12px, -50%)',
                        pointerEvents: 'none',
                        zIndex,
                        opacity: isMoon ? (moonLabelsReady ? 1 : 0) : isSmallBody ? 0.72 : 1,
                        transition: isMoon ? 'opacity 0.5s ease' : 'none',
                    }}>
                        <div style={{
                            color: 'rgba(255,255,255,0.92)',
                            fontSize: isMoon || isSmallBody ? 8 : 11,
                            fontWeight: 700,
                            letterSpacing: '0.07em',
                            lineHeight: 1.3,
                            textShadow: '0 1px 4px rgba(0,0,0,0.9)',
                            whiteSpace: 'nowrap',
                        }}>
                            {label.name}
                        </div>
                    </div>
                    );
                })}
            </div>
        </div>
    );
};

export default SolarSystem3D;
