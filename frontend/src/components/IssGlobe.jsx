import { useRef, useEffect } from 'react';
import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { quality, texturePath, pixelRatioFor } from '../utils/quality';

const R = 2;                    // Earth radius in scene units
const ALT_SCALE = 1 / 6371;     // km → Earth radii, so altitude is to scale

// Equirectangular lat/lon (degrees) → position on a three.js SphereGeometry.
function toVec3(lat, lon, radius, out = new THREE.Vector3()) {
    const la = (lat * Math.PI) / 180;
    const lo = (lon * Math.PI) / 180;
    return out.set(
        radius * Math.cos(la) * Math.cos(lo),
        radius * Math.sin(la),
        -radius * Math.cos(la) * Math.sin(lo),
    );
}

// Sub-solar point for a given time — drives the terminator.
// Declination and the equation-of-time correction are the standard low-precision
// solar position formulas; well inside a pixel at this globe size.
function subsolar(date) {
    const start = Date.UTC(date.getUTCFullYear(), 0, 0);
    const dayOfYear = (date.getTime() - start) / 86400000;
    const g = (357.529 + 0.98560028 * dayOfYear) * Math.PI / 180;
    const decl = 23.44 * Math.sin((2 * Math.PI * (dayOfYear - 81)) / 365.24) * Math.PI / 180;
    const eot = 229.18 * (0.000075 + 0.001868 * Math.cos(g) - 0.032077 * Math.sin(g)
        - 0.014615 * Math.cos(2 * g) - 0.040849 * Math.sin(2 * g)); // minutes
    const utcMinutes = date.getUTCHours() * 60 + date.getUTCMinutes() + date.getUTCSeconds() / 60;
    const lon = -((utcMinutes + eot) / 4 - 180);
    return { lat: (decl * 180) / Math.PI, lon };
}

/**
 * Live 3D Earth with the ISS in orbit above it, its ground track, and a real
 * day/night terminator driven by the current sub-solar point.
 */
const IssGlobe = ({ lat, lon, altitude, trail, follow = true, observer = null, others = [] }) => {
    const mountRef = useRef(null);
    const api = useRef({});

    // ── Scene setup (once) ────────────────────────────────────────────────
    useEffect(() => {
        const mount = mountRef.current;
        if (!mount) return;
        let mounted = true;
        let animId;

        const w = mount.clientWidth || 640;
        const h = mount.clientHeight || 480;

        const q = quality();
        const renderer = new THREE.WebGLRenderer({ antialias: q.antialias, alpha: true });
        renderer.setSize(w, h);
        renderer.setPixelRatio(pixelRatioFor(w, h));
        renderer.setClearColor(0x000000, 0);
        mount.appendChild(renderer.domElement);
        renderer.domElement.setAttribute('role', 'img');
        renderer.domElement.setAttribute('aria-label',
            'Three-dimensional globe showing the live position of the International Space Station');

        const scene = new THREE.Scene();
        const camera = new THREE.PerspectiveCamera(38, w / h, 0.05, 100);
        camera.position.set(0, 2.4, 7.4);

        const controls = new OrbitControls(camera, renderer.domElement);
        controls.enableDamping = true;
        controls.dampingFactor = 0.07;
        controls.enablePan = false;
        controls.minDistance = 3.4;
        controls.maxDistance = 14;

        let userDriving = false;
        controls.addEventListener('start', () => { userDriving = true; });

        scene.add(new THREE.AmbientLight(0xffffff, 0.22));
        const sunLight = new THREE.DirectionalLight(0xfff6e8, 2.1);
        scene.add(sunLight);

        // ── Earth with a day/night blend ──────────────────────────────────
        const geo = new THREE.SphereGeometry(R, q.skySegments + 32, q.skySegments + 32);
        const uniforms = {
            dayMap:       { value: null },
            nightMap:     { value: null },
            sunDirection: { value: new THREE.Vector3(1, 0, 0) },
            hasNight:     { value: 0 },
        };
        const earthMat = new THREE.ShaderMaterial({
            uniforms,
            vertexShader: `
                varying vec2 vUv;
                varying vec3 vNormalW;
                void main() {
                    vUv = uv;
                    vNormalW = normalize(mat3(modelMatrix) * normal);
                    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
                }
            `,
            fragmentShader: `
                uniform sampler2D dayMap;
                uniform sampler2D nightMap;
                uniform vec3 sunDirection;
                uniform float hasNight;
                varying vec2 vUv;
                varying vec3 vNormalW;
                void main() {
                    vec3 n = normalize(vNormalW);
                    float c = dot(n, sunDirection);
                    float blend = smoothstep(-0.10, 0.18, c);
                    vec3 day = texture2D(dayMap, vUv).rgb;
                    vec3 night = hasNight > 0.5
                        ? texture2D(nightMap, vUv).rgb * 1.15
                        : day * 0.06;
                    vec3 col = mix(night, day, blend);
                    // Cool rim where the limb catches light
                    float rim = pow(1.0 - abs(c), 3.0) * 0.16;
                    col += vec3(0.25, 0.45, 0.85) * rim;
                    gl_FragColor = vec4(col, 1.0);
                }
            `,
        });
        const earth = new THREE.Mesh(geo, earthMat);
        scene.add(earth);

        const loader = new THREE.TextureLoader();
        const loaded = [];
        loader.load(texturePath('earth.jpg'), (t) => {
            if (!mounted) { t.dispose(); return; }
            t.colorSpace = THREE.SRGBColorSpace;
            uniforms.dayMap.value = t;
            loaded.push(t);
        });
        loader.load(texturePath('earth_night.jpg'), (t) => {
            if (!mounted) { t.dispose(); return; }
            t.colorSpace = THREE.SRGBColorSpace;
            uniforms.nightMap.value = t;
            uniforms.hasNight.value = 1;
            loaded.push(t);
        });

        // Atmosphere shell
        const atmoGeo = new THREE.SphereGeometry(R * 1.022, q.skySegments, q.skySegments);
        const atmoMat = new THREE.MeshBasicMaterial({
            color: '#5aa8ff', transparent: true, opacity: 0.10,
            side: THREE.BackSide, depthWrite: false,
        });
        scene.add(new THREE.Mesh(atmoGeo, atmoMat));

        // ── ISS marker ────────────────────────────────────────────────────
        // A dot, not a model. At this globe size the station was a few pixels
        // across, so the modelled body and panels read as a speck with an odd
        // outline rather than as a spacecraft — and being lit by the same sun
        // as the Earth, it dimmed to nothing over the night side, which is
        // where you most want to find it. MeshBasicMaterial ignores the lights,
        // so the dot is the same green wherever the station is.
        const issGroup = new THREE.Group();
        const dotGeo = new THREE.SphereGeometry(0.032, 16, 16);
        const dotMat = new THREE.MeshBasicMaterial({ color: '#7fe3a0' });
        issGroup.add(new THREE.Mesh(dotGeo, dotMat));
        // Halo so it stays findable against the bright day side
        const haloGeo = new THREE.SphereGeometry(0.075, 16, 16);
        const haloMat = new THREE.MeshBasicMaterial({
            color: '#7fe3a0', transparent: true, opacity: 0.38,
            blending: THREE.AdditiveBlending, depthWrite: false,
        });
        issGroup.add(new THREE.Mesh(haloGeo, haloMat));
        scene.add(issGroup);

        // ── Other spacecraft ──────────────────────────────────────────────
        // Same dot, in each one's own colour, at its own altitude. Built on
        // demand and kept in a map by id, so the set can change — an element
        // fetch that failed simply never appears.
        const otherMarkers = new Map();
        const otherGeos = [];
        const otherMats = [];
        const makeMarker = (color) => {
            const group = new THREE.Group();
            const dotGeo = new THREE.SphereGeometry(0.026, 12, 12);
            const dotMat = new THREE.MeshBasicMaterial({ color });
            group.add(new THREE.Mesh(dotGeo, dotMat));
            const hGeo = new THREE.SphereGeometry(0.06, 12, 12);
            const hMat = new THREE.MeshBasicMaterial({
                color, transparent: true, opacity: 0.32,
                blending: THREE.AdditiveBlending, depthWrite: false,
            });
            group.add(new THREE.Mesh(hGeo, hMat));
            group.visible = false;
            scene.add(group);
            otherGeos.push(dotGeo, hGeo);
            otherMats.push(dotMat, hMat);
            return group;
        };

        // Line from the station down to its sub-satellite point
        const dropGeo = new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(), new THREE.Vector3()]);
        const dropMat = new THREE.LineBasicMaterial({ color: '#7fe3a0', transparent: true, opacity: 0.45 });
        scene.add(new THREE.Line(dropGeo, dropMat));

        // ── Orbital track ─────────────────────────────────────────────────
        // Drawn at the altitude each fix was taken at, so it is the path the
        // station flew rather than its shadow on the ground. It meets the dot
        // exactly, and the drop line below shows how far up that is.
        //
        // Note this is the orbit in Earth's frame, which is the frame this
        // globe is drawn in: successive passes sit west of the last one because
        // the Earth turned underneath, rather than retracing one closed ring.
        const MAX_TRAIL = 1200;
        const trackGeo = new THREE.BufferGeometry();
        trackGeo.setAttribute('position', new THREE.BufferAttribute(new Float32Array(MAX_TRAIL * 3), 3));
        trackGeo.setDrawRange(0, 0);
        const trackMat = new THREE.LineBasicMaterial({ color: '#7fe3a0', transparent: true, opacity: 0.65 });
        scene.add(new THREE.Line(trackGeo, trackMat));

        // ── Observer marker ───────────────────────────────────────────────
        const obsGeo = new THREE.SphereGeometry(0.028, 12, 12);
        const obsMat = new THREE.MeshBasicMaterial({ color: '#ffd166' });
        const obsMesh = new THREE.Mesh(obsGeo, obsMat);
        obsMesh.visible = false;
        scene.add(obsMesh);

        // Graticule every 30° for a sense of scale
        const gratMat = new THREE.LineBasicMaterial({ color: '#ffffff', transparent: true, opacity: 0.07 });
        const gratGeos = [];
        for (let latLine = -60; latLine <= 60; latLine += 30) {
            const pts = [];
            for (let i = 0; i <= 96; i++) pts.push(toVec3(latLine, (i / 96) * 360 - 180, R * 1.002));
            const g = new THREE.BufferGeometry().setFromPoints(pts);
            gratGeos.push(g);
            scene.add(new THREE.Line(g, gratMat));
        }
        for (let lonLine = -180; lonLine < 180; lonLine += 30) {
            const pts = [];
            for (let i = 0; i <= 96; i++) pts.push(toVec3((i / 96) * 180 - 90, lonLine, R * 1.002));
            const g = new THREE.BufferGeometry().setFromPoints(pts);
            gratGeos.push(g);
            scene.add(new THREE.Line(g, gratMat));
        }

        const ro = new ResizeObserver(([entry]) => {
            if (!mounted) return;
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

        // Smoothed ISS position so 5-second polls don't make it jump
        const issTarget = new THREE.Vector3(0, 0, R + 0.13);
        const issCurrent = issTarget.clone();
        const _sun = new THREE.Vector3();
        const _camWanted = new THREE.Vector3();

        api.current = {
            setIss(latDeg, lonDeg, altKm) {
                toVec3(latDeg, lonDeg, R * (1 + (altKm ?? 420) * ALT_SCALE), issTarget);
            },
            setTrail(points) {
                const arr = trackGeo.attributes.position.array;
                const n = Math.min(points.length, MAX_TRAIL);
                const off = points.length - n;
                const v = new THREE.Vector3();
                for (let i = 0; i < n; i++) {
                    const p = points[off + i];
                    // Fixes recorded before altitude was carried, or a reading
                    // the API left out, fall back to the station's usual height
                    toVec3(p.lat, p.lon, R * (1 + (p.alt || 420) * ALT_SCALE), v);
                    arr[i * 3] = v.x; arr[i * 3 + 1] = v.y; arr[i * 3 + 2] = v.z;
                }
                trackGeo.attributes.position.needsUpdate = true;
                trackGeo.setDrawRange(0, n);
            },
            setObserver(o) {
                if (!o) { obsMesh.visible = false; return; }
                toVec3(o.lat, o.lon, R * 1.01, obsMesh.position);
                obsMesh.visible = true;
            },
            setOthers(list) {
                const seen = new Set();
                for (const sat of list ?? []) {
                    if (sat.lat == null || sat.lon == null) continue;
                    seen.add(sat.id);
                    let marker = otherMarkers.get(sat.id);
                    if (!marker) { marker = makeMarker(sat.color); otherMarkers.set(sat.id, marker); }
                    toVec3(sat.lat, sat.lon, R * (1 + (sat.altitude ?? 420) * ALT_SCALE), marker.position);
                    marker.visible = true;
                }
                // Anything that dropped out of the list stops being drawn
                for (const [id, marker] of otherMarkers) if (!seen.has(id)) marker.visible = false;
            },
            setFollow(v) { api.current.follow = v; if (v) userDriving = false; },
            follow: true,
        };

        const animate = () => {
            if (!mounted) return;
            animId = requestAnimationFrame(animate);

            // Terminator follows real time
            const ss = subsolar(new Date());
            toVec3(ss.lat, ss.lon, 1, _sun);
            uniforms.sunDirection.value.copy(_sun);
            sunLight.position.copy(_sun).multiplyScalar(30);

            issCurrent.lerp(issTarget, 0.08);
            issGroup.position.copy(issCurrent);

            const dp = dropGeo.attributes.position.array;
            dp[0] = issCurrent.x; dp[1] = issCurrent.y; dp[2] = issCurrent.z;
            const surf = issCurrent.clone().setLength(R);
            dp[3] = surf.x; dp[4] = surf.y; dp[5] = surf.z;
            dropGeo.attributes.position.needsUpdate = true;

            // Drift the camera to keep the station in view until the user takes
            // over. Bias a third of the way toward the sub-solar point so the
            // shot includes the lit limb and terminator rather than staring at
            // an unlit hemisphere whenever the station is over Earth's night.
            if (api.current.follow && !userDriving) {
                const dist = camera.position.length();
                _camWanted.copy(issCurrent).normalize()
                    .addScaledVector(_sun, 0.55)
                    .normalize()
                    .multiplyScalar(dist);
                camera.position.lerp(_camWanted, 0.012);
            }

            controls.update();
            renderer.render(scene, camera);
        };
        animate();

        return () => {
            mounted = false;
            cancelAnimationFrame(animId);
            controls.dispose();
            ro.disconnect();
            [geo, atmoGeo, dotGeo, haloGeo, dropGeo, trackGeo, obsGeo, ...gratGeos, ...otherGeos]
                .forEach(g => g.dispose());
            [earthMat, atmoMat, dotMat, haloMat, dropMat, trackMat, obsMat, gratMat, ...otherMats]
                .forEach(m => m.dispose());
            loaded.forEach(t => t.dispose());
            if (mount.contains(renderer.domElement)) mount.removeChild(renderer.domElement);
            renderer.dispose();
        };
    }, []);

    // ── Push live data into the scene ─────────────────────────────────────
    useEffect(() => {
        if (lat != null && lon != null) api.current.setIss?.(lat, lon, altitude);
    }, [lat, lon, altitude]);

    useEffect(() => { api.current.setTrail?.(trail ?? []); }, [trail]);
    useEffect(() => { api.current.setOthers?.(others); }, [others]);
    useEffect(() => { api.current.setObserver?.(observer); }, [observer]);
    useEffect(() => { api.current.setFollow?.(follow); }, [follow]);

    return <div ref={mountRef} style={{ width: '100%', height: '100%' }} />;
};

export default IssGlobe;
