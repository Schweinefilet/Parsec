import { useRef, useEffect, useLayoutEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import * as Astronomy from 'astronomy-engine';

const PLANETS = [
    { id: 'mercury', name: 'Mercury', r: 0.68, orbitR: 48,  color: '#b5b5b5' },
    { id: 'venus',   name: 'Venus',   r: 1.24, orbitR: 72,  color: '#e8cda0' },
    { id: 'earth',   name: 'Earth',   r: 1.31, orbitR: 96,  color: '#4fa3e0' },
    { id: 'mars',    name: 'Mars',    r: 0.83, orbitR: 128, color: '#c1440e' },
    { id: 'jupiter', name: 'Jupiter', r: 4.13, orbitR: 190, color: '#c88b3a' },
    { id: 'saturn',  name: 'Saturn',  r: 3.56, orbitR: 245, color: '#e4d191' },
    { id: 'uranus',  name: 'Uranus',  r: 2.25, orbitR: 295, color: '#7de8e8' },
    { id: 'neptune', name: 'Neptune', r: 2.18, orbitR: 340, color: '#5b7fdb' },
    { id: 'pluto',   name: 'Pluto',   r: 0.45, orbitR: 410, color: '#d9c3a8' },
];

// Orbital periods in days — used only for sampling the orbit path
const ORBITAL_PERIODS = {
    Mercury:  87.97,
    Venus:   224.70,
    Earth:   365.25,
    Mars:    686.97,
    Jupiter: 4332.6,
    Saturn:  10759.2,
    Uranus:  30688.5,
    Neptune: 60182.0,
    Pluto:   90560.0,
};

const PLANET_PBR = {
    Mercury: { roughness: 0.95, metalness: 0.05 },
    Venus:   { roughness: 0.45, metalness: 0.10 },
    Earth:   { roughness: 0.60, metalness: 0.05 },
    Mars:    { roughness: 0.90, metalness: 0.05 },
    Jupiter: { roughness: 0.30, metalness: 0.00 },
    Saturn:  { roughness: 0.35, metalness: 0.00 },
    Uranus:  { roughness: 0.25, metalness: 0.05 },
    Neptune: { roughness: 0.20, metalness: 0.05 },
    Pluto:   { roughness: 0.95, metalness: 0.00 },
};

// Axial tilt in degrees (angle between rotation axis and ecliptic normal).
// Saturn is intentionally omitted — its existing tilt + rings look great.
const AXIAL_TILT_DEG = {
    Mercury: 0.034,
    Venus:   177.4,
    Earth:   23.44,
    Mars:    25.19,
    Jupiter: 3.13,
    Uranus:  97.77,
    Neptune: 28.32,
    Pluto:   122.53,
};

const ORBIT_EPOCH_MS = Date.UTC(2000, 0, 1, 12, 0, 0);
const ORBIT_BASE_OPACITY = 0.20;
const ORBIT_HOVER_OPACITY = 0.86;
const ORBIT_TUBE_RADIUS = 0.28;
const PLANET_EMISSIVE_INTENSITY = 0.08;


const MOON_TEXTURES = {
    luna:      '/textures/moon.jpg',
    io:        '/textures/io.jpg',
    europa:    '/textures/europa.jpg',
    ganymede:  '/textures/ganymede.jpg',
    titan:     '/textures/titan.jpg',
    enceladus: '/textures/enceladus.jpg',
    triton:    '/textures/triton.jpg',
};

// 23 natural satellites — id matches objectCatalog (null = no detail page)
const MOON_DATA = [
    // Earth
    { id: 'luna',      name: 'Moon',      parent: 'Earth',   orbitR: 14,  radius: 0.41, color: '#c8c8c8', period: 27.321,  phase0: 2.35, inc: 5.1,   retrograde: false },
    // Mars
    { id: 'phobos',    name: 'Phobos',    parent: 'Mars',    orbitR: 5,   radius: 0.15, color: '#9b8e83', period: 0.319,   phase0: 1.20, inc: 1.1,   retrograde: false },
    { id: 'deimos',    name: 'Deimos',    parent: 'Mars',    orbitR: 8,   radius: 0.14, color: '#b7ada6', period: 1.262,   phase0: 3.70, inc: 1.8,   retrograde: false },
    // Jupiter
    { id: 'amalthea',  name: 'Amalthea',  parent: 'Jupiter', orbitR: 13,  radius: 0.19, color: '#c0826a', period: 0.498,   phase0: 0.80, inc: 0.4,   retrograde: false },
    { id: 'io',        name: 'Io',        parent: 'Jupiter', orbitR: 17,  radius: 0.38, color: '#d8b28b', period: 1.769,   phase0: 1.50, inc: 0.05,  retrograde: false },
    { id: 'europa',    name: 'Europa',    parent: 'Jupiter', orbitR: 21,  radius: 0.34, color: '#d8e0ea', period: 3.551,   phase0: 3.10, inc: 0.47,  retrograde: false },
    { id: 'ganymede',  name: 'Ganymede',  parent: 'Jupiter', orbitR: 27,  radius: 0.45, color: '#b8c3cc', period: 7.155,   phase0: 0.60, inc: 0.2,   retrograde: false },
    { id: 'callisto',  name: 'Callisto',  parent: 'Jupiter', orbitR: 34,  radius: 0.41, color: '#9a8f86', period: 16.689,  phase0: 5.20, inc: 0.19,  retrograde: false },
    // Saturn
    { id: 'mimas',     name: 'Mimas',     parent: 'Saturn',  orbitR: 13,  radius: 0.17, color: '#d0cdc8', period: 0.942,   phase0: 2.10, inc: 1.5,   retrograde: false },
    { id: 'enceladus', name: 'Enceladus', parent: 'Saturn',  orbitR: 16,  radius: 0.23, color: '#dfe9f2', period: 1.370,   phase0: 4.80, inc: 0.0,   retrograde: false },
    { id: 'tethys',    name: 'Tethys',    parent: 'Saturn',  orbitR: 19,  radius: 0.26, color: '#c8c4be', period: 1.888,   phase0: 1.00, inc: 1.1,   retrograde: false },
    { id: 'dione',     name: 'Dione',     parent: 'Saturn',  orbitR: 22,  radius: 0.26, color: '#c2bdb8', period: 2.737,   phase0: 3.50, inc: 0.0,   retrograde: false },
    { id: 'rhea',      name: 'Rhea',      parent: 'Saturn',  orbitR: 26,  radius: 0.32, color: '#bfbbb5', period: 4.518,   phase0: 5.60, inc: 0.3,   retrograde: false },
    { id: 'titan',     name: 'Titan',     parent: 'Saturn',  orbitR: 33,  radius: 0.45, color: '#d7c18b', period: 15.945,  phase0: 1.80, inc: 0.3,   retrograde: false },
    { id: 'iapetus',   name: 'Iapetus',   parent: 'Saturn',  orbitR: 45,  radius: 0.26, color: '#a09488', period: 79.330,  phase0: 4.20, inc: 15.5,  retrograde: false },
    // Uranus
    { id: 'miranda',   name: 'Miranda',   parent: 'Uranus',  orbitR: 10,  radius: 0.14, color: '#c5c5ca', period: 1.413,   phase0: 0.40, inc: 4.2,   retrograde: false },
    { id: 'ariel',     name: 'Ariel',     parent: 'Uranus',  orbitR: 13,  radius: 0.23, color: '#cccdd4', period: 2.520,   phase0: 2.80, inc: 0.0,   retrograde: false },
    { id: 'umbriel',   name: 'Umbriel',   parent: 'Uranus',  orbitR: 16,  radius: 0.23, color: '#8a8d94', period: 4.144,   phase0: 5.00, inc: 0.1,   retrograde: false },
    { id: 'titania',   name: 'Titania',   parent: 'Uranus',  orbitR: 20,  radius: 0.3,  color: '#c0bfc5', period: 8.706,   phase0: 1.60, inc: 0.1,   retrograde: false },
    { id: 'oberon',    name: 'Oberon',    parent: 'Uranus',  orbitR: 24,  radius: 0.3,  color: '#aaa8ae', period: 13.463,  phase0: 3.90, inc: 0.1,   retrograde: false },
    // Neptune
    { id: 'proteus',   name: 'Proteus',   parent: 'Neptune', orbitR: 9,   radius: 0.19, color: '#8a8f96', period: 1.122,   phase0: 2.50, inc: 0.0,   retrograde: false },
    { id: 'triton',    name: 'Triton',    parent: 'Neptune', orbitR: 13,  radius: 0.34, color: '#bcc7d4', period: 5.877,   phase0: 0.90, inc: 157.0, retrograde: true  },
    { id: 'nereid',    name: 'Nereid',    parent: 'Neptune', orbitR: 22,  radius: 0.15, color: '#9fa6b0', period: 360.14,  phase0: 5.10, inc: 7.2,   retrograde: false },
];

// Use astronomy-engine's HelioVector for true planet positions (includes perturbations).
// Normalize to a unit direction then scale by the visual orbitR so out-of-ecliptic
// displacement stays geometrically consistent with the compressed radii.
// Axis mapping: astronomical (x,y,z) → scene (x, z_astro→y, y_astro→z)
function computePlanetPos(name, orbitR, date = new Date()) {
    try {
        const vec  = Astronomy.HelioVector(name, date);
        const dist = Math.sqrt(vec.x * vec.x + vec.y * vec.y + vec.z * vec.z);
        if (dist === 0) return { x: orbitR, y: 0, z: 0 };
        return {
            x:  (vec.x / dist) * orbitR,
            y:  (vec.z / dist) * orbitR,
            z:  (vec.y / dist) * orbitR,
        };
    } catch {
        return { x: orbitR, y: 0, z: 0 };
    }
}

// Sample the real orbit path via HelioVector over one full period
function buildOrbitPoints(name, orbitR) {
    const period = ORBITAL_PERIODS[name];
    const now = Date.now();
    const N = 256;
    const pts = [];
    for (let i = 0; i < N; i++) {
        const date = new Date(now + (i / N) * period * 86400000);
        const p = computePlanetPos(name, orbitR, date);
        pts.push(new THREE.Vector3(p.x, p.y, p.z));
    }
    return pts;
}

function buildOrbitTube(points) {
    const curve = new THREE.CatmullRomCurve3(points, true);
    return new THREE.TubeGeometry(curve, 256, ORBIT_TUBE_RADIUS, 8, true);
}

// Persists across React Router remounts so the exit animation survives navigation
let _exitState = { active: false, cameraPos: null, targetPos: null };

const SolarSystem3D = ({ focusedId }) => {
    const mountRef  = useRef(null);
    const navigate  = useNavigate();
    const [objectLabels, setObjectLabels] = useState([]);
    const [moonLabelsReady, setMoonLabelsReady] = useState(false);

    const focusedIdRef = useRef(focusedId);
    useLayoutEffect(() => {
        focusedIdRef.current = focusedId;
    }, [focusedId]);

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
        camera.position.set(-70, 130, 480);
        camera.lookAt(0, 0, 0);

        // ── Renderer ───────────────────────────────────────────────────────────
        const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true, premultipliedAlpha: false });
        renderer.setSize(w, h);
        renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
        renderer.setClearColor(0x000000, 0);
        renderer.shadowMap.enabled = true;
        renderer.shadowMap.type    = THREE.PCFSoftShadowMap;
        mount.appendChild(renderer.domElement);

        // ── OrbitControls ──────────────────────────────────────────────────────
        const controls = new OrbitControls(camera, renderer.domElement);
        controls.enableDamping = true;
        controls.enablePan     = false;
        controls.autoRotate = true;
        controls.autoRotateSpeed = 0.11;
        controls.minDistance   = 30;
        controls.maxDistance   = 1200;

        let isInteracting = false;
        controls.addEventListener('start', () => { isInteracting = true; });
        controls.addEventListener('end', () => { isInteracting = false; });

        // ── Exit-animation state (declared early so restore can pre-set them) ──
        let prevFocusedId  = null;
        let exitPhase      = 0; // 0=normal  1=pull-back  2=fly-to-sun
        let exitFrames     = 0;
        let hasInitialZoom = false;
        let targetAutoRotateSpeed = 0.11; // smoothly updated on hover

        // ── Focus zoom-in animation state ──────────────────────────────────────
        let focusAnimating   = false;
        let focusProgress    = 0;
        const focusStartCamPos  = new THREE.Vector3();
        const focusEndCamPos    = new THREE.Vector3();
        const focusStartTarget  = new THREE.Vector3();
        const _focusLookTarget  = new THREE.Vector3();
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
        mainLight.castShadow         = true;
        mainLight.shadow.camera.near = 1;
        mainLight.shadow.camera.far  = 2000;
        scene.add(mainLight);

        const coronaLight = new THREE.PointLight(0xfff4e0, 1.8, 750);
        scene.add(coronaLight);

        scene.add(new THREE.AmbientLight(0xffffff, 0.28));

        // ── Shared loader + texture list (declared early for sun texture) ──────
        const loader   = new THREE.TextureLoader();
        const textures = [];

        // ── Sun ────────────────────────────────────────────────────────────────
        const sunGeo = new THREE.SphereGeometry(12, 64, 64);
        // MeshBasicMaterial — self-luminous, not affected by scene lights
        const sunMat = new THREE.MeshBasicMaterial({ color: '#FFF4A0' });
        const sunMesh = new THREE.Mesh(sunGeo, sunMat);
        sunMesh.userData = { id: 'sun', name: 'Sun' };
        scene.add(sunMesh);

        loader.load('/textures/sun.jpg', (tex) => {
            if (!mounted) { tex.dispose(); return; }
            textures.push(tex);
            sunMat.map   = tex;
            sunMat.color.set(0xffffff);
            sunMat.needsUpdate = true;
        });

        // ── Milky Way skysphere ────────────────────────────────────────────────
        const skyGeo = new THREE.SphereGeometry(8000, 64, 64);
        const skyTex = loader.load('/textures/milky_way.jpg');
        textures.push(skyTex);
        const skyMat = new THREE.MeshBasicMaterial({
            map:         skyTex,
            side:        THREE.BackSide,
            depthWrite:  false,
            transparent: true,
            opacity:     0.5,
        });
        const skySphere = new THREE.Mesh(skyGeo, skyMat);
        scene.add(skySphere);

        // ── Resource tracking (for cleanup) ────────────────────────────────────
        const geos     = [sunGeo, skyGeo];
        const mats     = [sunMat, skyMat];

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
        const planetHitboxRefs = new Map(); // name → planet hitbox mesh, for focus-scale
        const moonMeshRefs    = new Map();  // moon.name → visual mesh
        const moonHitRefs     = new Map();  // moon.name → hitbox mesh (scene-direct, position synced each frame)
        const moonAngles      = new Map();  // moon.name → current liveAngle (radians)

        // Earth day/night shader references — set once textures load, used in rAF loop
        let earthMesh      = null;
        let earthShaderMat = null;

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
            const geo      = new THREE.SphereGeometry(planet.r, 32, 32);
            const colorMat = new THREE.MeshStandardMaterial({
                color:     planet.color,
                roughness: pbr.roughness,
                metalness: pbr.metalness,
                emissive:  new THREE.Color(planet.color),
                emissiveIntensity: PLANET_EMISSIVE_INTENSITY,
            });
            const mesh     = new THREE.Mesh(geo, colorMat);
            mesh.userData      = { id: planet.id, name: planet.name, orbitLine };
            mesh.castShadow    = true;
            mesh.receiveShadow = true;
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
                loader.load('/textures/earth.jpg',        (t) => { dayTex    = t; tryApplyEarthShader(); }, undefined, () => {});
                loader.load('/textures/earth_night.jpg',  (t) => { nightTex  = t; tryApplyEarthShader(); }, undefined, () => {});
                loader.load('/textures/earth_clouds.jpg', (t) => { cloudsTex = t; tryApplyEarthShader(); }, undefined, () => {});
            } else {
                loader.load(
                    `/textures/${planet.id}.jpg`,
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
                    () => {}, // silently keep color fallback
                );
            }

            // Saturn rings — proportions and UV fix match PlanetViewer.jsx
            if (planet.name === 'Saturn') {
                const scale  = planet.r / 1.5;
                const innerR = 2.0 * scale;
                const outerR = 3.5 * scale;

                const sRingGeo = new THREE.RingGeometry(innerR, outerR, 64);
                const posAttr  = sRingGeo.attributes.position;
                const uvAttr   = sRingGeo.attributes.uv;
                for (let i = 0; i < posAttr.count; i++) {
                    const v = new THREE.Vector3().fromBufferAttribute(posAttr, i);
                    uvAttr.setXY(i, (v.length() - innerR) / (outerR - innerR), 0);
                }

                const sRingMat = new THREE.MeshBasicMaterial({
                    side: THREE.DoubleSide,
                    transparent: true,
                    opacity: 0.85,
                    alphaTest: 0.05,
                });
                const sRing = new THREE.Mesh(sRingGeo, sRingMat);
                sRing.rotation.x    = Math.PI / 2 - 0.5;
                sRing.rotation.z    = 0.2;
                sRing.castShadow    = false;
                sRing.receiveShadow = true;
                group.add(sRing);
                geos.push(sRingGeo);
                mats.push(sRingMat);

                loader.load(
                    '/textures/saturn_ring.png',
                    (tex) => {
                        if (!mounted) { tex.dispose(); return; }
                        textures.push(tex);
                        sRingMat.map = tex;
                        sRingMat.needsUpdate = true;
                    },
                );
            }

            // Place at real position and add to scene
            const p = computePlanetPos(planet.name, planet.orbitR);
            group.position.set(p.x, p.y, p.z);
            scene.add(group);
            planetMeshes.push(mesh);

            // Invisible hitbox — larger than visual sphere so small planets are easy to click
            const hitboxR  = Math.max(planet.r * 2 + 2.5, 4.5);
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
        const beltQuat = new THREE.Quaternion();
        try {
            const toSceneUnit = (v) => {
                const d = Math.sqrt(v.x * v.x + v.y * v.y + v.z * v.z);
                return new THREE.Vector3(v.x / d, v.z / d, v.y / d); // scene mapping
            };
            const sm1 = toSceneUnit(Astronomy.HelioVector('Mars', new Date()));
            const sm2 = toSceneUnit(Astronomy.HelioVector('Mars', new Date(Date.now() + 90 * 86400000)));
            const eclipticNormal = new THREE.Vector3().crossVectors(sm1, sm2).normalize();
            if (eclipticNormal.y < 0) eclipticNormal.negate(); // ensure north-facing
            beltQuat.setFromUnitVectors(new THREE.Vector3(0, 1, 0), eclipticNormal);
        } catch (_) { /* keep identity quaternion */ }

        // ── Asteroid Belt ─────────────────────────────────────────────────────
        // Between Mars (128) and Jupiter (190): 2.0–3.2 AU maps to ~136–156 scene units.
        // Uniform-area distribution: r = sqrt(rand*(R²-r²)+r²) avoids inner-edge clumping.
        {
            const AB_COUNT  = 3500;
            const AB_INNER  = 150;
            const AB_OUTER  = 162;
            const AB_HEIGHT = 5;
            const positions = new Float32Array(AB_COUNT * 3);
            const _p = new THREE.Vector3();
            for (let i = 0; i < AB_COUNT; i++) {
                const r     = Math.sqrt(Math.random() * (AB_OUTER ** 2 - AB_INNER ** 2) + AB_INNER ** 2);
                const theta = Math.random() * Math.PI * 2;
                _p.set(r * Math.cos(theta), (Math.random() - 0.5) * 2 * AB_HEIGHT, r * Math.sin(theta));
                _p.applyQuaternion(beltQuat);
                positions[i * 3]     = _p.x;
                positions[i * 3 + 1] = _p.y;
                positions[i * 3 + 2] = _p.z;
            }
            const abGeo = new THREE.BufferGeometry();
            abGeo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
            const abMat = new THREE.PointsMaterial({
                color: '#8a7a6a',
                size: 0.9,
                transparent: true,
                opacity: 0.55,
                sizeAttenuation: true,
                depthWrite: false,
            });
            scene.add(new THREE.Points(abGeo, abMat));
            geos.push(abGeo);
            mats.push(abMat);
        }

        // ── Kuiper Belt ────────────────────────────────────────────────────────
        // Beyond Neptune (340) out to ~50 AU → 490 scene units (extrapolating
        // Neptune 30AU/340 ↔ Pluto 39.5AU/410 scale: ~7.4 units/AU).
        // KBOs have higher inclinations → taller height spread.
        {
            const KB_COUNT  = 5000;
            const KB_INNER  = 342;
            const KB_OUTER  = 490;
            const KB_HEIGHT = 20;
            const positions = new Float32Array(KB_COUNT * 3);
            const _p = new THREE.Vector3();
            for (let i = 0; i < KB_COUNT; i++) {
                const r     = Math.sqrt(Math.random() * (KB_OUTER ** 2 - KB_INNER ** 2) + KB_INNER ** 2);
                const theta = Math.random() * Math.PI * 2;
                _p.set(r * Math.cos(theta), (Math.random() - 0.5) * 2 * KB_HEIGHT, r * Math.sin(theta));
                _p.applyQuaternion(beltQuat);
                positions[i * 3]     = _p.x;
                positions[i * 3 + 1] = _p.y;
                positions[i * 3 + 2] = _p.z;
            }
            const kbGeo = new THREE.BufferGeometry();
            kbGeo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
            const kbMat = new THREE.PointsMaterial({
                color: '#7aaec8',
                size: 1.2,
                transparent: true,
                opacity: 0.40,
                sizeAttenuation: true,
                depthWrite: false,
            });
            scene.add(new THREE.Points(kbGeo, kbMat));
            geos.push(kbGeo);
            mats.push(kbMat);
        }

        // ── Moon meshes (MOON_DATA) ────────────────────────────────────────────
        MOON_DATA.forEach(moon => {
            const parentGroup = planetMeshRefs.get(moon.parent);
            if (!parentGroup) return;

            const moonGeo = new THREE.SphereGeometry(moon.radius, 16, 16);
            const moonMat = new THREE.MeshStandardMaterial({
                color: moon.color,
                roughness: 0.95,
                metalness: 0.0,
                emissive: new THREE.Color(moon.color),
                emissiveIntensity: 0.04,
            });
            const moonMesh = new THREE.Mesh(moonGeo, moonMat);
            moonMesh.userData = { id: moon.id, name: moon.name };
            scene.add(moonMesh);
            geos.push(moonGeo);
            mats.push(moonMat);
            moonMeshRefs.set(moon.name, moonMesh);

            if (moon.id && MOON_TEXTURES[moon.id]) {
                loader.load(MOON_TEXTURES[moon.id], (tex) => {
                    if (!mounted) { tex.dispose(); return; }
                    textures.push(tex);
                    moonMat.map = tex;
                    moonMat.color.set(0xffffff);
                    moonMat.emissiveIntensity = 0;
                    moonMat.needsUpdate = true;
                });
            }

            // Invisible hitbox — added directly to scene so its matrixWorld is
            // always independent and up to date. Position is synced to moonMesh
            // explicitly every rAF frame via moonHitRefs.
            const hitR    = Math.max(moon.radius * 5, 2.5);
            const hitGeo  = new THREE.SphereGeometry(hitR, 8, 8);
            const hitMat  = new THREE.MeshBasicMaterial({ transparent: true, opacity: 0, depthWrite: false });
            const hitMesh = new THREE.Mesh(hitGeo, hitMat);
            hitMesh.userData = { id: moon.id, name: moon.name };
            scene.add(hitMesh);
            geos.push(hitGeo);
            mats.push(hitMat);
            moonHitRefs.set(moon.name, hitMesh);
            planetMeshes.push(hitMesh);
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
        let activeOrbit    = null;

        const toNDC = (e) => {
            const rect = renderer.domElement.getBoundingClientRect();
            mouse.x =  ((e.clientX - rect.left) / rect.width)  * 2 - 1;
            mouse.y = -((e.clientY - rect.top)  / rect.height) * 2 + 1;
        };

        const handleClick = (e) => {
            toNDC(e);
            raycaster.setFromCamera(mouse, camera);
            const hits = raycaster.intersectObjects(planetMeshes, false);
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
            const hits = raycaster.intersectObjects(planetMeshes, false);
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
                // Decelerate auto-rotate only in home view (focused mode already disables it)
                if (!focusedIdRef.current) targetAutoRotateSpeed = 0;
            } else {
                if (activeOrbit) {
                    activeOrbit.material.opacity = focusedIdRef.current ? 0 : (activeOrbit.userData.baseOpacity ?? ORBIT_BASE_OPACITY);
                    activeOrbit = null;
                }
                renderer.domElement.style.cursor = '';
                targetAutoRotateSpeed = 0.11;
            }
        };

        renderer.domElement.addEventListener('click',     handleClick);
        renderer.domElement.addEventListener('mousemove', handleMouseMove);

        // ── ResizeObserver ─────────────────────────────────────────────────────
        const ro = new ResizeObserver(([entry]) => {
            const { width, height } = entry.contentRect;
            if (!width || !height) return;
            renderer.setSize(width, height);
            camera.aspect = width / height;
            camera.updateProjectionMatrix();
        });
        ro.observe(mount);

        // ── Animation loop ─────────────────────────────────────────────────────
        let animId;
        let prevNowDays = null;
        let meshRotSpeed = 0.002;

        const animate = () => {
            animId = requestAnimationFrame(animate);
            const nowDays = (Date.now() - ORBIT_EPOCH_MS) / 86400000;
            const tau = Math.PI * 2;
            const currentFocusedId = focusedIdRef.current;

            // ── Detect focus changes ───────────────────────────────────────────
            if (currentFocusedId !== prevFocusedId) {
                // Restore previous focused planet's orbit + tilt + hitbox scale
                if (prevFocusedId) {
                    const prevMesh = planetMeshes.find(m => m.userData.id === prevFocusedId);
                    if (prevMesh && prevMesh.userData.name !== 'Saturn') {
                        prevMesh.rotation.z = 0;
                    }
                    // Restore ALL orbit rings when exiting any focused state
                    planetMeshes.forEach(m => {
                        if (m.userData.orbitLine) {
                            const base = m.userData.orbitLine.userData.baseOpacity;
                            m.userData.orbitLine.material.opacity = base ?? ORBIT_BASE_OPACITY;
                        }
                    });
                    // Restore hitbox to full 2× size
                    const prevPlanet = PLANETS.find(p => p.id === prevFocusedId);
                    if (prevPlanet) {
                        const hb = planetHitboxRefs.get(prevPlanet.name);
                        if (hb) hb.scale.setScalar(1.0);
                    }
                }
                // Apply axial tilt + hide ALL orbit rings when focusing
                if (currentFocusedId) {
                    const newMesh = planetMeshes.find(m => m.userData.id === currentFocusedId);
                    // Apply axial tilt (except Saturn — it already looks cool)
                    if (newMesh && newMesh.userData.name !== 'Saturn') {
                        const tilt = AXIAL_TILT_DEG[newMesh.userData.name];
                        if (tilt !== undefined) newMesh.rotation.z = tilt * Math.PI / 180;
                    }
                    // Hide ALL orbit rings in the scene when any planet is focused
                    planetMeshes.forEach(m => {
                        if (m.userData.orbitLine) {
                            m.userData.orbitLine.material.opacity = 0;
                        }
                    });
                    // Shrink focused planet's hitbox to 1× visual radius so nearby
                    // moons are clickable without the planet intercepting the ray
                    const focusedPlanet = PLANETS.find(p => p.id === currentFocusedId);
                    if (focusedPlanet) {
                        const hb   = planetHitboxRefs.get(focusedPlanet.name);
                        const geomR = hb?.geometry?.parameters?.radius ?? 1;
                        if (hb) hb.scale.setScalar(focusedPlanet.r / geomR);
                    }
                    // Compute smooth focus animation — starts from current camera,
                    // ends at 30° elevation above the planet at the correct zoom distance
                    if (newMesh) {
                        const planetPos = new THREE.Vector3();
                        newMesh.getWorldPosition(planetPos);
                        const radius = newMesh.geometry?.parameters?.radius ?? 3.5;
                        const dist   = newMesh.userData.id === 'sun' ? 50 : radius * 4.5 + 14;
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
                hasInitialZoom = false;
                prevFocusedId  = currentFocusedId;
            }

            // ── Moon positions (MOON_DATA) ─────────────────────────────────────
            // Delta-time keeps motion continuous (no snapping between frames).
            // 2000× visual speedup: Phobos ~14s/orbit, Io ~76s, Moon ~20min.
            const MOON_SPEED = 2000;
            const deltaDays = prevNowDays != null ? Math.min(nowDays - prevNowDays, 0.005) : 0;
            prevNowDays = nowDays;
            MOON_DATA.forEach(moon => {
                const parentGroup = planetMeshRefs.get(moon.parent);
                const moonMesh    = moonMeshRefs.get(moon.name);
                if (!parentGroup || !moonMesh) return;
                const dir   = moon.retrograde ? -1 : 1;
                const dAngle = dir * (tau / moon.period) * deltaDays * MOON_SPEED;
                moonAngles.set(moon.name, (moonAngles.get(moon.name) ?? moon.phase0) + dAngle);
                const angle  = moonAngles.get(moon.name);
                const incRad = moon.inc * Math.PI / 180;
                const mx = parentGroup.position.x + Math.cos(angle) * moon.orbitR;
                const my = parentGroup.position.y + Math.sin(angle) * moon.orbitR * Math.sin(incRad);
                const mz = parentGroup.position.z + Math.sin(angle) * moon.orbitR * Math.cos(incRad);
                moonMesh.position.set(mx, my, mz);
                const hitMesh = moonHitRefs.get(moon.name);
                if (hitMesh) hitMesh.position.set(mx, my, mz);
            });

            // ── Self-rotation ──────────────────────────────────────────────────
            const moonFocused = currentFocusedId && MOON_DATA.some(m => m.id === currentFocusedId);
            const targetRotSpeed = moonFocused ? 0.00008 : 0.002;
            meshRotSpeed += (targetRotSpeed - meshRotSpeed) * 0.03;
            sunMesh.rotation.y      += 0.0008;
            skySphere.rotation.y    += 0.00002;
            planetMeshes.forEach(m => { m.rotation.y += meshRotSpeed; });
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

                const planetRadius = targetMesh.geometry?.parameters?.radius ?? 3.5;
                controls.minDistance = Math.max(planetRadius * 3, 6);

                if (focusAnimating) {
                    if (isInteracting) {
                        // User grabbed control mid-animation — hand off immediately
                        focusAnimating = false;
                        hasInitialZoom = true;
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
                    hasInitialZoom = true;
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
                    if (pr.z > 1) return null;
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
            clearInterval(posInterval);
            ro.disconnect();
            renderer.domElement.removeEventListener('click',     handleClick);
            renderer.domElement.removeEventListener('mousemove', handleMouseMove);
            if (mount.contains(renderer.domElement)) mount.removeChild(renderer.domElement);
            controls.dispose();
            geos.forEach(g => g.dispose());
            mats.forEach(m => m.dispose());
            textures.forEach(t => t.dispose());
            renderer.dispose();
        };
    }, []); // eslint-disable-line react-hooks/exhaustive-deps

    return (
        <div style={{ position: 'relative' }}>
            {/* Canvas mount — fills full viewport height, sits behind transparent header */}
            <div
                ref={mountRef}
                style={{ width: '100%', height: '100vh', position: 'relative' }}
            >
                {/* Floating object labels */}
                {objectLabels.map((label, i) => {
                    // Planet labels: 20–28. Moon labels: 4–8.
                    // Within each band, closer objects (lower depth) get higher z.
                    const isMoon = label.kind === 'moon';
                    const base   = isMoon ? 4 : 20;
                    const range  = isMoon ? 4 : 8;
                    const zIndex = base + Math.round((1 - label.depth) * range * 0.5);
                    return (
                    <div key={`${label.name}-${i}`} style={{
                        position: 'absolute',
                        left: label.x,
                        top: label.y,
                        transform: 'translate(12px, -50%)',
                        pointerEvents: 'none',
                        zIndex,
                        opacity: isMoon ? (moonLabelsReady ? 1 : 0) : 1,
                        transition: isMoon ? 'opacity 0.5s ease' : 'none',
                    }}>
                        <div style={{
                            color: 'rgba(255,255,255,0.85)',
                            fontSize: 10,
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
