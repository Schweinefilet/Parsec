import { useRef, useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import * as Astronomy from 'astronomy-engine';

const PLANETS = [
    { id: 'mercury', name: 'Mercury', r: 2,   orbitR: 48,  color: '#b5b5b5' },
    { id: 'venus',   name: 'Venus',   r: 3.5, orbitR: 72,  color: '#e8cda0' },
    { id: 'earth',   name: 'Earth',   r: 3.5, orbitR: 96,  color: '#4fa3e0' },
    { id: 'mars',    name: 'Mars',    r: 3,   orbitR: 128, color: '#c1440e' },
    { id: 'jupiter', name: 'Jupiter', r: 8,   orbitR: 190, color: '#c88b3a' },
    { id: 'saturn',  name: 'Saturn',  r: 7,   orbitR: 245, color: '#e4d191' },
    { id: 'uranus',  name: 'Uranus',  r: 5.5, orbitR: 295, color: '#7de8e8' },
    { id: 'neptune', name: 'Neptune', r: 5,   orbitR: 340, color: '#5b7fdb' },
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
};

function computePlanetPos(name, orbitR) {
    try {
        const vec   = Astronomy.HelioVector(name, new Date());
        const angle = Math.atan2(vec.y, vec.x);
        return {
            x: Math.cos(angle) * orbitR,
            z: Math.sin(angle) * orbitR,
            y: vec.z * 80,
        };
    } catch {
        return { x: orbitR, z: 0, y: 0 };
    }
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
        controls.minDistance   = 200;
        controls.maxDistance   = 900;

        // ── Lights ─────────────────────────────────────────────────────────────
        const mainLight = new THREE.PointLight(0xffffff, 2.5, 0, 0); // decay=0: no distance falloff
        mainLight.castShadow         = true;
        mainLight.shadow.camera.near = 1;
        mainLight.shadow.camera.far  = 2000;
        scene.add(mainLight);

        const coronaLight = new THREE.PointLight(0xfff4e0, 1.2, 600);
        scene.add(coronaLight);

        scene.add(new THREE.AmbientLight(0xffffff, 0.18));

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

        // ── Planets ────────────────────────────────────────────────────────────
        PLANETS.forEach(planet => {
            const pbr = PLANET_PBR[planet.name] ?? { roughness: 0.8, metalness: 0.05 };

            // Orbital ellipse — tilted to match real inclination and ascending node
            const oel   = ORBITAL_ELEMENTS[planet.name];
            const a     = planet.orbitR;
            const b     = a * Math.sqrt(1 - oel.e * oel.e);
            const curve = new THREE.EllipseCurve(-a * oel.e, 0, a, b, 0, 2 * Math.PI, false);
            const orbitGeo = new THREE.BufferGeometry().setFromPoints(curve.getPoints(256));
            const orbitMat = new THREE.LineBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.08 });
            const orbitLine = new THREE.Line(orbitGeo, orbitMat);

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
                color: 0xaaaaaa, size, transparent: true, opacity,
                sizeAttenuation: true, depthWrite: false,
            });
            return new THREE.Points(geo, mat);
        }

        const asteroidBelt = createBelt(142, 176, 4000, 6,  0.7, 0.35);
        const kuiperBelt   = createBelt(360, 460, 7000, 18, 0.6, 0.18);
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
                    if (activeOrbit) activeOrbit.material.opacity = 0.08;
                    if (orbit)       orbit.material.opacity       = 0.55;
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
                    activeOrbit.material.opacity = 0.08;
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
