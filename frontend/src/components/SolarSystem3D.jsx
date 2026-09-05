import { useRef, useEffect, useLayoutEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { STLLoader } from 'three/examples/jsm/loaders/STLLoader.js';
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
const ORBIT_BASE_OPACITY = 0.27;
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

// 23 natural satellites + ISS — id matches objectCatalog (null = no detail page)
// noSpeedScaling: true → excluded from the minP orbit-speed calculation so fast
// short-period bodies don't slow down all other moons; capped at speed 2000.
const MOON_DATA = [
    // Earth
    { id: 'luna',      name: 'Moon',      parent: 'Earth',   orbitR: 14,  radius: 0.41, color: '#c8c8c8', period: 27.321,  phase0: 2.35, inc: 5.1,   retrograde: false },
    { id: 'iss',       name: 'ISS',       parent: 'Earth',   orbitR: 2.8, radius: 0.036, hitRadius: 0.18, color: '#c0c8d0', period: 0.0642,  phase0: 1.0,  inc: 51.6,  retrograde: false, noSpeedScaling: true },
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

function buildOrbitTube(points, tubeRadius = ORBIT_TUBE_RADIUS, segments = 256) {
    const curve = new THREE.CatmullRomCurve3(points, true);
    return new THREE.TubeGeometry(curve, segments, tubeRadius, 8, true);
}

// ── Keplerian orbit helpers ────────────────────────────────────────────────
const DEG2RAD = Math.PI / 180;

function solveKepler(M, e) {
    let E = M;
    for (let j = 0; j < 12; j++) E -= (E - e * Math.sin(E) - M) / (1 - e * Math.cos(E));
    return E;
}

function _perifocalBasis(nodeRad, iRad, periRad) {
    const cN = Math.cos(nodeRad), sN = Math.sin(nodeRad);
    const cP = Math.cos(periRad), sP = Math.sin(periRad);
    const cI = Math.cos(iRad),    sI = Math.sin(iRad);
    return {
        Px:  cN*cP - sN*sP*cI,  Py:  sN*cP + cN*sP*cI,  Pz: sP*sI,
        Qx: -cN*sP - sN*cP*cI,  Qy: -sN*sP + cN*cP*cI,  Qz: cP*sI,
    };
}

// Position in scene units at a given date using J2000 keplerian elements.
// sceneScale: scene-units / AU based on each body's semi-major axis.
function keplerianScenePos(el, sceneScale, date = new Date()) {
    const t = (date - ORBIT_EPOCH_MS) / 86400000;
    const n = (2 * Math.PI) / el.period;
    const M = ((el.M0 ?? 0) + n * t);
    const Mnorm = ((M % (2 * Math.PI)) + 2 * Math.PI) % (2 * Math.PI);
    const E  = solveKepler(Mnorm, el.e);
    const nu = 2 * Math.atan2(Math.sqrt(1 + el.e) * Math.sin(E / 2), Math.sqrt(1 - el.e) * Math.cos(E / 2));
    const r  = el.a * (1 - el.e * Math.cos(E));
    const px = r * Math.cos(nu), py = r * Math.sin(nu);
    const b  = _perifocalBasis(el.node * DEG2RAD, el.i * DEG2RAD, el.peri * DEG2RAD);
    return {
        x: (px * b.Px + py * b.Qx) * sceneScale,
        y: (px * b.Pz + py * b.Qz) * sceneScale,   // ecliptic Z → scene Y
        z: (px * b.Py + py * b.Qy) * sceneScale,   // ecliptic Y → scene Z
    };
}

// 3D keplerian orbit ring, sampled in true anomaly for correct ellipse shape.
function buildKeplerOrbitPoints(el, sceneScale, N = 360) {
    const b   = _perifocalBasis(el.node * DEG2RAD, el.i * DEG2RAD, el.peri * DEG2RAD);
    const pts = [];
    for (let j = 0; j <= N; j++) {
        const nu = (j / N) * 2 * Math.PI;
        const r  = el.a * (1 - el.e * el.e) / (1 + el.e * Math.cos(nu));
        const px = r * Math.cos(nu), py = r * Math.sin(nu);
        pts.push(new THREE.Vector3(
            (px * b.Px + py * b.Qx) * sceneScale,
            (px * b.Pz + py * b.Qz) * sceneScale,
            (px * b.Py + py * b.Qy) * sceneScale,
        ));
    }
    return pts;
}

// Scene-units/AU scale factor for each body, derived by linear interpolation
// of the same compressed scale the planets use.
const SMALL_BODIES = [
    // i=0 so bodies sit visually in their belt plane (beltQuat handles ecliptic tilt)
    { id: 'ceres',    name: 'Ceres',           r: 0.10, color: '#8a8a7a', scale: 53.8,
      el: { a: 2.767, e: 0.076, i: 10.59, node:  80.3, peri:  73.60, period: 1682.0, M0: 1.68 } },
    { id: 'vesta',    name: 'Vesta',            r: 0.09, color: '#7a7060', scale: 60.2,
      el: { a: 2.361, e: 0.089, i:  7.14, node: 103.9, peri: 151.2,  period: 1325.0, M0: 0.36 } },
    { id: 'pallas',   name: 'Pallas',           r: 0.08, color: '#6a6a60', scale: 53.8,
      el: { a: 2.772, e: 0.231, i: 34.84, node: 173.1, peri: 310.1, period: 1686.0, M0: 1.37 } },
    { id: 'haumea',   name: 'Haumea',           r: 0.12, color: '#ccc8c0', scale: 10.14,
      el: { a: 43.13, e: 0.191, i: 0, node: 0, peri: 239.0,  period: 103468, M0: 1.8 } },
    { id: 'makemake', name: 'Makemake',         r: 0.12, color: '#c8c4b8', scale:  9.98,
      el: { a: 45.79, e: 0.159, i: 0, node: 0, peri: 294.8,  period: 113183, M0: 2.9 } },
    { id: 'eris',     name: 'Eris',             r: 0.15, color: '#d0cece', scale:  9.16,
      el: { a: 67.8,  e: 0.436, i: 0, node: 0, peri: 151.4,  period: 203469, M0: 3.2 } },
    // Halley keeps its real retrograde inclination — it's the defining feature of this comet
    { id: 'halley',   name: "Halley's Comet",   r: 0.11, color: '#57524a', scale: 16.15, isComet: true,
      el: { a: 17.834, e: 0.967, i: 162.3, node: 58.42, peri: 111.3,  period:  27494, M0: 1.159 } },
];

// ── Procedural fallback textures ───────────────────────────────────────────
// Bodies without a texture file get a generated surface: regional albedo
// patches, craters (rocky) or banding (icy), and fine grain — seeded from the
// body id so the surface is stable across reloads.
function _seededRand(seedKey) {
    let h = 2166136261;
    for (let i = 0; i < seedKey.length; i++) {
        h ^= seedKey.charCodeAt(i);
        h = Math.imul(h, 16777619);
    }
    let s = h >>> 0;
    return () => {
        s |= 0; s = (s + 0x6D2B79F5) | 0;
        let t = Math.imul(s ^ (s >>> 15), 1 | s);
        t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
        return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
}

function makeProceduralTexture(seedKey, baseColor, style = 'rocky') {
    const rand = _seededRand(seedKey);
    const W = 512, H = 256;
    const canvas = document.createElement('canvas');
    canvas.width = W; canvas.height = H;
    const ctx = canvas.getContext('2d');
    ctx.fillStyle = baseColor;
    ctx.fillRect(0, 0, W, H);

    // Draw at x and x±W so features wrap seamlessly across the UV seam
    const wrapped = (x, draw) => { draw(x); draw(x - W); draw(x + W); };

    // Large soft light/dark patches — regional albedo variation
    for (let i = 0; i < 46; i++) {
        const x = rand() * W, y = rand() * H;
        const r = 18 + rand() * 70;
        const light = rand() > 0.5;
        const a = 0.04 + rand() * (style === 'icy' ? 0.05 : 0.08);
        wrapped(x, (wx) => {
            const g = ctx.createRadialGradient(wx, y, 0, wx, y, r);
            g.addColorStop(0, light ? `rgba(255,255,255,${a})` : `rgba(0,0,0,${a})`);
            g.addColorStop(1, 'rgba(0,0,0,0)');
            ctx.fillStyle = g;
            ctx.fillRect(wx - r, y - r, r * 2, r * 2);
        });
    }

    if (style === 'rocky') {
        // Craters — soft dark floor + slightly offset bright rim
        for (let i = 0; i < 70; i++) {
            const x = rand() * W, y = rand() * H;
            const r = 1.5 + rand() * 7;
            const floorA = 0.10 + rand() * 0.16;
            const rimA   = 0.05 + rand() * 0.09;
            wrapped(x, (wx) => {
                const g = ctx.createRadialGradient(wx, y, 0, wx, y, r);
                g.addColorStop(0,   `rgba(0,0,0,${floorA})`);
                g.addColorStop(0.7, `rgba(0,0,0,${floorA * 0.5})`);
                g.addColorStop(1,   'rgba(0,0,0,0)');
                ctx.fillStyle = g;
                ctx.beginPath(); ctx.arc(wx, y, r, 0, Math.PI * 2); ctx.fill();
                ctx.strokeStyle = `rgba(255,255,255,${rimA})`;
                ctx.lineWidth = Math.max(0.6, r * 0.16);
                ctx.beginPath(); ctx.arc(wx - r * 0.15, y - r * 0.15, r * 0.9, 0, Math.PI * 2); ctx.stroke();
            });
        }
    } else {
        // Icy — faint latitudinal streaks
        for (let i = 0; i < 22; i++) {
            const y = rand() * H;
            const hgt = 3 + rand() * 14;
            ctx.fillStyle = `rgba(${rand() > 0.5 ? '255,255,255' : '0,0,0'},${0.025 + rand() * 0.04})`;
            ctx.fillRect(0, y, W, hgt);
        }
    }

    // Fine grain
    for (let i = 0; i < 900; i++) {
        ctx.fillStyle = `rgba(${rand() > 0.5 ? '255,255,255' : '0,0,0'},${0.03 + rand() * 0.05})`;
        ctx.fillRect(rand() * W, rand() * H, 1 + rand() * 2, 1 + rand() * 2);
    }

    const tex = new THREE.CanvasTexture(canvas);
    tex.colorSpace = THREE.SRGBColorSpace;
    return tex;
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
        camera.position.set(-350, 280, 365);
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
            opacity:     0.35,
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
                    () => {
                        // No texture file (e.g. Pluto) — generate a surface instead
                        if (!mounted) return;
                        const tex = makeProceduralTexture(planet.id, planet.color,
                            planet.name === 'Pluto' ? 'icy' : 'rocky');
                        textures.push(tex);
                        colorMat.map = tex;
                        colorMat.color.set(0xffffff);
                        colorMat.needsUpdate = true;
                    },
                );
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
                    '/textures/saturn_ring.png',
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
        } catch { /* keep identity quaternion */ }

        // Belt config — declared in outer scope so the LOD system can read them.
        const AB_COUNT  = 3500;
        const AB_INNER  = 134;
        const AB_OUTER  = 158;
        const KB_COUNT  = 5000;
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

            Promise.all(ASTEROID_DEFS.map(d => loadSTL(d.key))).then(geometries => {
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
            const geo = new THREE.SphereGeometry(body.r, 16, 16);
            const mat = new THREE.MeshStandardMaterial({
                color: body.color, roughness: 0.9, metalness: 0.0,
                emissive: new THREE.Color(body.color),
                emissiveIntensity: PLANET_EMISSIVE_INTENSITY,
            });
            const mesh = new THREE.Mesh(geo, mat);
            mesh.userData = { id: body.id, name: body.name, orbitLine };
            mesh.castShadow    = true;
            mesh.receiveShadow = true;
            geos.push(geo);
            mats.push(mat);

            // Procedural surface for bodies without texture files. Vesta and Halley
            // are skipped — their STL geometry has no UVs, so a map can't apply.
            if (!['vesta', 'halley', 'ceres'].includes(body.id)) {
                const icy = ['haumea', 'makemake', 'eris'].includes(body.id);
                const tex = makeProceduralTexture(body.id, body.color, icy ? 'icy' : 'rocky');
                textures.push(tex);
                mat.map = tex;
                mat.color.set(0xffffff);
            }

            // Optional texture load (Ceres only — NASA-mapped surface)
            if (body.id === 'ceres') {
                loader.load(
                    `/textures/${body.id}.jpg`,
                    (tex) => {
                        if (!mounted) { tex.dispose(); return; }
                        textures.push(tex);
                        const texMat = new THREE.MeshStandardMaterial({
                            map: tex, roughness: 0.9, metalness: 0.0,
                            emissive: new THREE.Color(body.color),
                            emissiveIntensity: PLANET_EMISSIVE_INTENSITY,
                        });
                        mesh.material = texMat;
                        mat.dispose();
                        mats.push(texMat);
                    },
                    undefined,
                    () => {
                        // ceres.jpg is not shipped — fall back to a generated surface
                        if (!mounted) return;
                        const tex = makeProceduralTexture(body.id, body.color, 'rocky');
                        textures.push(tex);
                        mat.map = tex;
                        mat.color.set(0xffffff);
                        mat.needsUpdate = true;
                    },
                );
            }

            // STL model for Vesta
            if (body.id === 'vesta') {
                new STLLoader().load(
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
                );
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
                // Coma — layered additive shells wrap the nucleus in a soft halo
                [
                    { r: 0.20, op: 0.34, color: '#f2f6ff' },
                    { r: 0.36, op: 0.16, color: '#d8e8ff' },
                    { r: 0.62, op: 0.07, color: '#b8d4ff' },
                    { r: 1.05, op: 0.03, color: '#96bcff' },
                ].forEach(({ r, op, color }) => {
                    const g = new THREE.SphereGeometry(r, 24, 24);
                    const m = new THREE.MeshBasicMaterial({
                        color, transparent: true, opacity: op,
                        depthWrite: false, blending: THREE.AdditiveBlending,
                    });
                    group.add(new THREE.Mesh(g, m));
                    geos.push(g);
                    mats.push(m);
                });

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

            const moonGeo = new THREE.SphereGeometry(moon.radius, 16, 16);
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
                loader.load(MOON_TEXTURES[moon.id], (tex) => {
                    if (!mounted) { tex.dispose(); return; }
                    textures.push(tex);
                    moonMat.map = tex;
                    moonMat.color.set(0xffffff);
                    moonMat.emissiveIntensity = 0;
                    moonMat.needsUpdate = true;
                });
            } else if (moon.id !== 'iss') {
                // No texture file — generate a cratered surface (ISS is excluded:
                // its sphere is replaced by the STL model)
                const tex = makeProceduralTexture(moon.id ?? moon.name, moon.color, 'rocky');
                textures.push(tex);
                moonMat.map = tex;
                moonMat.color.set(0xffffff);
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
                new STLLoader().load(
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
                );

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
            renderer.setSize(width, height);
            camera.aspect = width / height;
            camera.updateProjectionMatrix();
        });
        ro.observe(mount);

        // ── Animation loop ─────────────────────────────────────────────────────
        let animId;
        let prevNowDays = null;
        let meshRotSpeed = 0.002;
        let liveOrbitSpeed = 2000;
        let liveISSSpeed   = 2000; // tracked independently so hover response is immediate
        // Target axial-tilt z-rotation per planet — lerped smoothly each frame
        const tiltTargets = new Map(); // mesh uuid → target rotation.z (radians)

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
                        const dist   = newMesh.userData.id === 'sun' ? 50
                                     : newMesh.userData.id === 'iss' ? 0.3
                                     // Back off further for Halley so coma + tails frame the shot
                                     : newMesh.userData.id === 'halley' ? 7
                                     // Small bodies & moons scale with radius — the flat +2
                                     // pushed tiny objects much too far from the camera
                                     : isTinyBody ? Math.max(radius * 5.5, 0.5)
                                     : radius * 3.5 + 2;
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
            let targetOrbitSpeed;
            if (hoveredMoonId) {
                targetOrbitSpeed = 80;
            } else if (moonFocused) {
                targetOrbitSpeed = 500;
            } else if (focusedPlanet) {
                // Exclude noSpeedScaling bodies (e.g. ISS) — their ultra-short periods
                // would otherwise collapse the speed for all other moons.
                const moons = MOON_DATA.filter(m => m.parent === focusedPlanet.name && !m.noSpeedScaling);
                // Moonless planet (Mercury/Venus/Pluto): fall back to the default speed.
                // An Infinity target would poison liveOrbitSpeed with NaN via the lerp
                // (Infinity - Infinity), permanently hiding all moons until reload.
                targetOrbitSpeed = moons.length
                    ? Math.max(2000, Math.min(...moons.map(m => m.period)) * 86400 / 30)
                    : 2000;
            } else {
                targetOrbitSpeed = 2000;
            }
            // Snap down instantly only when the focused planet changes (avoids mach-speed
            // bleed on focus switch). Moon-hover deceleration uses the same lerp so it
            // feels gradual rather than instant.
            const planetFocusChanged = currentFocusedPlanetName !== prevFocusedPlanetName;
            if (planetFocusChanged && targetOrbitSpeed < liveOrbitSpeed) {
                liveOrbitSpeed = targetOrbitSpeed;
            } else {
                liveOrbitSpeed += (targetOrbitSpeed - liveOrbitSpeed) * 0.05;
            }
            prevFocusedPlanetName = currentFocusedPlanetName;
            const MOON_SPEED = liveOrbitSpeed;

            // ISS has its own speed tracker so hover/focus response is immediate,
            // not delayed by liveOrbitSpeed lerping down from ~78k.
            {
                const issMoon = MOON_DATA.find(m => m.noSpeedScaling);
                if (issMoon) {
                    const issParentFocused = (focusedPlanet && issMoon.parent === focusedPlanet.name)
                        || (focusedMoonParent && issMoon.parent === focusedMoonParent);
                    const issTarget = issMoon.id === currentFocusedId ? 10
                                    : hoveredMoonId === issMoon.id    ? 80
                                    : issParentFocused                ? 667
                                    : 2000;
                    liveISSSpeed += (issTarget - liveISSSpeed) * 0.05;
                }
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
                const dir = moon.retrograde ? -1 : 1;
                const parentFocused = (focusedPlanet && moon.parent === focusedPlanet.name)
                    || (focusedMoonParent && moon.parent === focusedMoonParent);
                const effectiveSpeed = moon.noSpeedScaling
                    ? liveISSSpeed
                    : parentFocused ? MOON_SPEED : 2000;
                const dAngle = dir * (tau / moon.period) * deltaDays * effectiveSpeed;
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
            skySphere.rotation.y    += 0.00002;
            planetMeshes.forEach(m => {
                m.rotation.y += meshRotSpeed;
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

            // ── Belt LOD: rotate 3D asteroid instances every frame ────────────
            if (abLODGroups.length > 0) {
                if (abParticles) abParticles.visible = false;
                abLODGroups.forEach(({ mesh, positions, scales, def }) => {
                    const angles = mesh.userData.abAngles;
                    positions.forEach((pos, i) => {
                        angles[i].ax += angles[i].sx;
                        angles[i].ay += angles[i].sy;
                        angles[i].az += angles[i].sz;
                        lodDummy.position.copy(pos);
                        lodDummy.rotation.set(angles[i].ax, angles[i].ay, angles[i].az);
                        lodDummy.scale.setScalar(def.abSize * scales[i]);
                        lodDummy.updateMatrix();
                        mesh.setMatrixAt(i, lodDummy.matrix);
                    });
                    mesh.instanceMatrix.needsUpdate = true;
                });
            }
            if (kbLODGroups.length > 0) {
                if (kbParticles) kbParticles.visible = false;
                kbLODGroups.forEach(({ mesh, positions, scales, def }) => {
                    const angles = mesh.userData.kbAngles;
                    positions.forEach((pos, i) => {
                        angles[i].ax += angles[i].sx;
                        angles[i].ay += angles[i].sy;
                        angles[i].az += angles[i].sz;
                        lodDummy.position.copy(pos);
                        lodDummy.rotation.set(angles[i].ax, angles[i].ay, angles[i].az);
                        lodDummy.scale.setScalar(def.kbSize * scales[i]);
                        lodDummy.updateMatrix();
                        mesh.setMatrixAt(i, lodDummy.matrix);
                    });
                    mesh.instanceMatrix.needsUpdate = true;
                });
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
            clearInterval(posInterval);
            ro.disconnect();
            renderer.domElement.removeEventListener('click',     handleClick);
            renderer.domElement.removeEventListener('mousemove', handleMouseMove);
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
                style={{ width: '100%', height: '100vh', position: 'relative', overflow: 'hidden' }}
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
