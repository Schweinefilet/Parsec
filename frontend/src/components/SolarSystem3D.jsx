import { useRef, useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';

const PLANETS = [
    { id: 'mercury', name: 'Mercury', r: 2,   orbitR: 48,  color: '#b5b5b5' },
    { id: 'venus',   name: 'Venus',   r: 3.5, orbitR: 72,  color: '#e8cda0' },
    { id: 'earth',   name: 'Earth',   r: 3.5, orbitR: 96,  color: '#4fa3e0' },
    { id: 'mars',    name: 'Mars',    r: 3,   orbitR: 128, color: '#c1440e' },
    { id: 'jupiter', name: 'Jupiter', r: 8,   orbitR: 190, color: '#c88b3a' },
    { id: 'saturn',  name: 'Saturn',  r: 7,   orbitR: 245, color: '#e4d191' },
    { id: 'uranus',  name: 'Uranus',  r: 5.5, orbitR: 295, color: '#7de8e8' },
    { id: 'neptune', name: 'Neptune', r: 5,   orbitR: 340, color: '#5b7fdb' },
    { id: 'pluto',   name: 'Pluto',   r: 2.1, orbitR: 410, color: '#d9c3a8' },
];

const ORBITAL_ELEMENTS = {
    Mercury: { e: 0.2056, inc: 7.005, omega: 48.331,  w: 29.124  },
    Venus:   { e: 0.0068, inc: 3.395, omega: 76.680,  w: 54.884  },
    Earth:   { e: 0.0167, inc: 0.000, omega: 0.000,   w: 288.064 },
    Mars:    { e: 0.0934, inc: 1.850, omega: 49.558,  w: 286.502 },
    Jupiter: { e: 0.0489, inc: 1.304, omega: 100.464, w: 273.867 },
    Saturn:  { e: 0.0565, inc: 2.485, omega: 113.665, w: 339.391 },
    Uranus:  { e: 0.0463, inc: 0.773, omega: 74.006,  w: 98.999  },
    Neptune: { e: 0.0100, inc: 1.769, omega: 131.784, w: 276.340 },
    Pluto:   { e: 0.2488, inc: 17.16, omega: 110.299, w: 113.834 },
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

const ORBIT_EPOCH_MS = Date.UTC(2000, 0, 1, 12, 0, 0);
const ORBIT_BASE_OPACITY = 0.34;
const ORBIT_HOVER_OPACITY = 0.86;
const ORBIT_TUBE_RADIUS = 0.45;
const PLANET_EMISSIVE_INTENSITY = 0.08;
const BELT_BRIGHTNESS = 0.58;
const BELT_SIZE = 0.85;

const PLANET_ORBIT_STATE = {
    Mercury: { period: 87.97, phase: 1.5 },
    Venus:   { period: 224.7, phase: 0.8 },
    Earth:   { period: 365.25, phase: 0.0 },
    Mars:    { period: 686.97, phase: 2.2 },
    Jupiter: { period: 4332.6, phase: 0.3 },
    Saturn:  { period: 10759.2, phase: 1.2 },
    Uranus:  { period: 30688.5, phase: 0.5 },
    Neptune: { period: 60182.0, phase: 2.5 },
    Pluto:   { period: 90560.0, phase: 1.4 },
};

const MOON_ORBIT_STATE = {
    period: 27.32,
    phase: 0.5,
    orbitR: 14,
    radius: 1.1,
    color: '#c8c8c8',
};

const SATELLITES = [
    { id: 'phobos',    name: 'Phobos',    parent: 'Mars',    orbitR: 8,  radius: 0.55, color: '#9b8e83', period: 0.3189, phase: 0.2 },
    { id: 'deimos',    name: 'Deimos',    parent: 'Mars',    orbitR: 12, radius: 0.45, color: '#b7ada6', period: 1.2624, phase: 1.1 },
    { id: 'io',        name: 'Io',        parent: 'Jupiter', orbitR: 10, radius: 0.75, color: '#d8b28b', period: 1.769,  phase: 0.4 },
    { id: 'europa',    name: 'Europa',    parent: 'Jupiter', orbitR: 13, radius: 0.7,  color: '#d8e0ea', period: 3.551,  phase: 0.6 },
    { id: 'ganymede',  name: 'Ganymede',  parent: 'Jupiter', orbitR: 17, radius: 0.9,  color: '#b8c3cc', period: 7.155,  phase: 0.2 },
    { id: 'callisto',  name: 'Callisto',  parent: 'Jupiter', orbitR: 21, radius: 0.85, color: '#9a8f86', period: 16.689, phase: 2.0 },
    { id: 'titan',     name: 'Titan',     parent: 'Saturn',  orbitR: 16, radius: 0.9,  color: '#d7c18b', period: 15.95,  phase: 1.3 },
    { id: 'enceladus', name: 'Enceladus', parent: 'Saturn',  orbitR: 9,  radius: 0.5,  color: '#dfe9f2', period: 1.37,   phase: 1.5 },
    { id: 'triton',    name: 'Triton',    parent: 'Neptune', orbitR: 11, radius: 0.8,  color: '#bcc7d4', period: 5.877,  phase: 2.6 },
];

function solveKepler(meanAnomaly, eccentricity) {
    let eccentricAnomaly = meanAnomaly;
    for (let i = 0; i < 8; i++) {
        const f = eccentricAnomaly - eccentricity * Math.sin(eccentricAnomaly) - meanAnomaly;
        const fp = 1 - eccentricity * Math.cos(eccentricAnomaly);
        eccentricAnomaly -= f / fp;
    }
    return eccentricAnomaly;
}

function applyOrbitOrientation(localPosition, name) {
    const oel = ORBITAL_ELEMENTS[name];
    const inc = oel.inc * Math.PI / 180;
    const Omega = oel.omega * Math.PI / 180;
    const wRad = oel.w * Math.PI / 180;

    const qLay = new THREE.Quaternion()
        .setFromAxisAngle(new THREE.Vector3(1, 0, 0), Math.PI / 2);
    const nodeAxis = new THREE.Vector3(Math.cos(Omega), 0, Math.sin(Omega));
    const qTilt = new THREE.Quaternion()
        .setFromAxisAngle(nodeAxis, -inc);
    const qPeri = new THREE.Quaternion()
        .setFromAxisAngle(new THREE.Vector3(0, 1, 0), -wRad);

    const orientation = new THREE.Quaternion().multiplyQuaternions(
        qTilt,
        new THREE.Quaternion().multiplyQuaternions(qLay, qPeri)
    );

    return localPosition.clone().applyQuaternion(orientation);
}

function computePlanetPos(name, orbitR, date = new Date()) {
    const orbit = PLANET_ORBIT_STATE[name];
    const oel = ORBITAL_ELEMENTS[name];
    if (!orbit || !oel) {
        return { x: orbitR, y: 0, z: 0 };
    }

    const daysSinceEpoch = (date.getTime() - ORBIT_EPOCH_MS) / 86400000;
    const tau = Math.PI * 2;
    const meanAnomaly = orbit.phase + (tau * daysSinceEpoch / orbit.period);
    const normalizedMeanAnomaly = ((meanAnomaly % tau) + tau) % tau;
    const eccentricAnomaly = solveKepler(normalizedMeanAnomaly, oel.e);
    const a = orbitR;
    const b = a * Math.sqrt(1 - oel.e * oel.e);

    const local = new THREE.Vector3(
        a * (Math.cos(eccentricAnomaly) - oel.e),
        b * Math.sin(eccentricAnomaly),
        0,
    );

    return applyOrbitOrientation(local, name);
}

function buildOrbitTube(points) {
    const curve = new THREE.CatmullRomCurve3(
        points.map((point) => new THREE.Vector3(point.x, point.y, 0))
    );
    return new THREE.TubeGeometry(curve, 256, ORBIT_TUBE_RADIUS, 8, true);
}

const SolarSystem3D = () => {
    const mountRef  = useRef(null);
    const navigate  = useNavigate();
    const [hoverLabel, setHoverLabel] = useState(null);

    useEffect(() => {
        const mount = mountRef.current;
        if (!mount) return;
        let mounted = true;

        const w = mount.clientWidth  || 800;
        const h = mount.clientHeight || 480;

        // ── Scene ──────────────────────────────────────────────────────────────
        const scene = new THREE.Scene();

        // ── Camera ─────────────────────────────────────────────────────────────
        const camera = new THREE.PerspectiveCamera(45, w / h, 1, 5000);
        camera.position.set(0, 280, 480);
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
        controls.autoRotateSpeed = 0.22;
        controls.minDistance   = 140;
        controls.maxDistance   = 900;

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
        const sunGeo = new THREE.SphereGeometry(12, 32, 32);
        const sunMat = new THREE.MeshStandardMaterial({
            emissive:          '#FDB813',
            emissiveIntensity: 2.0,
            roughness:         1.0,
            metalness:         0.0,
        });
        const sunMesh = new THREE.Mesh(sunGeo, sunMat);
        sunMesh.userData = { id: 'sun', name: 'Sun' };
        scene.add(sunMesh);

        loader.load('/textures/sun.jpg', (tex) => {
            if (!mounted) { tex.dispose(); return; }
            textures.push(tex);
            sunMat.map            = tex;
            sunMat.emissiveMap    = tex;
            sunMat.emissiveIntensity = 0.6;
            sunMat.needsUpdate    = true;
        });

        const coronaGeo = new THREE.SphereGeometry(18, 32, 32);
        const coronaMat = new THREE.MeshBasicMaterial({
            color:       '#FDB813',
            transparent: true,
            opacity:     0.22,
            depthWrite:  false,
            side:        THREE.FrontSide,
        });
        scene.add(new THREE.Mesh(coronaGeo, coronaMat));

        // ── Resource tracking (for cleanup) ────────────────────────────────────
        const geos     = [sunGeo, coronaGeo];
        const mats     = [sunMat, coronaMat];

        const planetMeshes  = [sunMesh];   // raycaster targets
        const planetGroups  = [];   // for position refresh
        const satelliteGroups = []; // moons and dwarf-planet companions

        // ── Planets ────────────────────────────────────────────────────────────
        PLANETS.forEach(planet => {
            const pbr = PLANET_PBR[planet.name] ?? { roughness: 0.8, metalness: 0.05 };

            // Orbital ellipse — tilted to match real inclination and ascending node
            const oel   = ORBITAL_ELEMENTS[planet.name];
            const a     = planet.orbitR;
            const b     = a * Math.sqrt(1 - oel.e * oel.e);
            const curve = new THREE.EllipseCurve(-a * oel.e, 0, a, b, 0, 2 * Math.PI, false);
            const orbitPoints = curve.getPoints(256);
            const orbitGeo = buildOrbitTube(orbitPoints);
            const orbitMat = new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: ORBIT_BASE_OPACITY });
            const orbitLine = new THREE.Mesh(orbitGeo, orbitMat);

            const inc   = oel.inc   * Math.PI / 180;
            const Omega = oel.omega * Math.PI / 180;

            // Lay ring from XY plane into XZ plane (ecliptic plane in scene)
            // Must use +PI/2, not -PI/2 — negative flips orbit direction
            const qLay = new THREE.Quaternion()
                .setFromAxisAngle(new THREE.Vector3(1, 0, 0), Math.PI / 2);

            // Tilt around the ascending node axis by -inc
            // Negative sign tilts the ring northward (+Y = ecliptic north)
            // Node direction in scene XZ plane at angle Omega from +X
            const nodeAxis = new THREE.Vector3(Math.cos(Omega), 0, Math.sin(Omega));
            const qTilt = new THREE.Quaternion()
                .setFromAxisAngle(nodeAxis, -inc);

            const wRad = oel.w * Math.PI / 180;
            const qPeri = new THREE.Quaternion()
                .setFromAxisAngle(new THREE.Vector3(0, 1, 0), -wRad);

            // Full orientation: perihelion first, then lay, then tilt
            orbitLine.quaternion.multiplyQuaternions(
                qTilt,
                new THREE.Quaternion().multiplyQuaternions(qLay, qPeri)
            );

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
                    opacity:           0.22,
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
            planetGroups.push({ group, planet });
        });

        SATELLITES.forEach((satellite) => {
            const parentGroup = planetGroups.find(({ planet }) => planet.name === satellite.parent)?.group;
            if (!parentGroup) return;

            const orbitGeo = new THREE.BufferGeometry();
            const orbitPoints = [];
            for (let i = 0; i <= 96; i++) {
                const t = (i / 96) * Math.PI * 2;
                orbitPoints.push(new THREE.Vector3(
                    Math.cos(t) * satellite.orbitR,
                    Math.sin(t) * satellite.orbitR,
                    0,
                ));
            }
            const orbitTubeGeo = buildOrbitTube(orbitPoints);
            const orbitMat = new THREE.MeshBasicMaterial({
                color: 0xffffff,
                transparent: true,
                opacity: ORBIT_BASE_OPACITY,
            });
            const orbitLine = new THREE.Mesh(orbitTubeGeo, orbitMat);
            orbitLine.rotation.x = Math.PI / 2;

            const satelliteGroup = new THREE.Group();
            satelliteGroup.add(orbitLine);

            const satGeo = new THREE.SphereGeometry(satellite.radius, 16, 16);
            const satMat = new THREE.MeshStandardMaterial({
                color: satellite.color,
                roughness: 0.94,
                metalness: 0.02,
                emissive: new THREE.Color(satellite.color),
                emissiveIntensity: 0.04,
            });
            const satMesh = new THREE.Mesh(satGeo, satMat);
            satMesh.position.set(satellite.orbitR, 0, 0);
            satMesh.userData = { id: satellite.id, name: satellite.name, orbitLine };
            satelliteGroup.add(satMesh);

            parentGroup.add(satelliteGroup);
            planetMeshes.push(satMesh);
            geos.push(orbitTubeGeo, satGeo);
            mats.push(orbitMat, satMat);
            satelliteGroups.push({ group: satelliteGroup, period: satellite.period, phase: satellite.phase });
        });

        // ── Belt helper ────────────────────────────────────────────────────────
        function createBelt(innerR, outerR, count, thickness, size, opacity) {
            const positions = new Float32Array(count * 3);
            for (let i = 0; i < count; i++) {
                const angle = Math.random() * Math.PI * 2;
                const r     = innerR + Math.random() * (outerR - innerR);
                const y     = (Math.random() - 0.5) * thickness;
                positions[i * 3]     = Math.cos(angle) * r;
                positions[i * 3 + 1] = y;
                positions[i * 3 + 2] = Math.sin(angle) * r;
            }
            const geo = new THREE.BufferGeometry();
            geo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
            const mat = new THREE.PointsMaterial({
                color: 0xffffff, size, transparent: true, opacity,
                sizeAttenuation: true, depthWrite: false,
            });
            return new THREE.Points(geo, mat);
        }

        const asteroidBelt = createBelt(142, 176, 4000, 6,  BELT_SIZE, BELT_BRIGHTNESS);
        const kuiperBelt   = createBelt(360, 460, 7000, 18, BELT_SIZE, BELT_BRIGHTNESS);
        scene.add(asteroidBelt);
        scene.add(kuiperBelt);
        geos.push(asteroidBelt.geometry, kuiperBelt.geometry);
        mats.push(asteroidBelt.material, kuiperBelt.material);

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
            if (hits.length > 0) navigate(`/object/${hits[0].object.userData.id}`);
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
                        activeOrbit.material.opacity = ORBIT_BASE_OPACITY;
                    }
                    if (orbit) {
                        orbit.material.opacity = ORBIT_HOVER_OPACITY;
                    }
                    activeOrbit = orbit ?? null;
                }

                const worldPos = new THREE.Vector3();
                hitMesh.getWorldPosition(worldPos);
                const proj = worldPos.clone().project(camera);
                const rect = renderer.domElement.getBoundingClientRect();
                if (mounted) setHoverLabel({
                    name: hitMesh.userData.name,
                    x: (proj.x + 1) / 2 * rect.width,
                    y: -(proj.y - 1) / 2 * rect.height,
                });
                renderer.domElement.style.cursor = 'pointer';
            } else {
                if (activeOrbit) {
                    activeOrbit.material.opacity = ORBIT_BASE_OPACITY;
                    activeOrbit = null;
                }
                if (mounted) setHoverLabel(null);
                renderer.domElement.style.cursor = '';
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
        const animate = () => {
            animId = requestAnimationFrame(animate);
            const nowDays = (Date.now() - ORBIT_EPOCH_MS) / 86400000;
            const tau = Math.PI * 2;
            satelliteGroups.forEach(({ group, period, phase }) => {
                group.rotation.y = phase + (tau * nowDays / period);
            });
            sunMesh.rotation.y       += 0.0008;
            asteroidBelt.rotation.y  += 0.0001;
            kuiperBelt.rotation.y    += 0.00004;
            planetMeshes.forEach(m => { m.rotation.y += 0.002; });
            controls.update();
            renderer.render(scene, camera);
        };
        animate();

        // ── Cleanup ────────────────────────────────────────────────────────────
        return () => {
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
    }, [navigate]);

    return (
        <div style={{ position: 'relative', overflow: 'hidden' }}>
            {/* Title + date — matches Orrery.jsx overlay */}
            <div style={{ position: 'absolute', top: 14, left: 18, zIndex: 10, pointerEvents: 'none' }}>
                <p style={{ fontSize: 11, fontWeight: 700, color: 'rgba(255,255,255,0.55)', letterSpacing: '0.1em', textTransform: 'uppercase' }}>
                    Solar System
                </p>
                <p style={{ fontSize: 9, color: 'rgba(255,255,255,0.28)', marginTop: 3 }}>
                    {new Date().toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                </p>
            </div>

            {/* Canvas mount — 3D scene fills this div */}
            <div
                ref={mountRef}
                style={{ width: '100%', height: '480px', position: 'relative' }}
            >
                {/* Hover label — absolute inside the mount div */}
                {hoverLabel && (
                    <div style={{
                        position: 'absolute',
                        left: hoverLabel.x,
                        top: hoverLabel.y,
                        transform: 'translate(-50%, -160%)',
                        background: 'rgba(0,0,0,0.72)',
                        color: '#fff',
                        fontSize: 11,
                        fontWeight: 700,
                        letterSpacing: '0.06em',
                        padding: '3px 8px',
                        borderRadius: 5,
                        pointerEvents: 'none',
                        whiteSpace: 'nowrap',
                        zIndex: 20,
                    }}>
                        {hoverLabel.name}
                    </div>
                )}
            </div>
        </div>
    );
};

export default SolarSystem3D;
