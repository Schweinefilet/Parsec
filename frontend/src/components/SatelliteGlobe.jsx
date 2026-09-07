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
 * Live 3D Earth with the tracked spacecraft above it, the selected one's orbit
 * drawn behind it, and a real day/night terminator from the sub-solar point.
 *
 * `satellites` is every spacecraft to draw; `selectedId` picks the one that
 * gets the bigger marker, the orbit path, the line down to its sub-satellite
 * point, and the camera's attention. Nothing here knows which satellite that
 * is — it used to be built around the ISS, and adding a second one meant
 * bolting a second code path alongside the first.
 */
const SatelliteGlobe = ({
    satellites = [], selectedId, track = [], follow = true, observer = null,
}) => {
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
            'Three-dimensional globe showing the live positions of the tracked spacecraft');

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
        const markers = new Map();          // id → { group, dot, halo, color }
        const markerGeos = [];
        const markerMats = [];
        const makeMarker = (color) => {
            const group = new THREE.Group();
            const dotGeo = new THREE.SphereGeometry(0.03, 14, 14);
            const dotMat = new THREE.MeshBasicMaterial({ color });
            const dot = new THREE.Mesh(dotGeo, dotMat);
            group.add(dot);
            // Halo so it stays findable against the bright day side
            const haloGeo = new THREE.SphereGeometry(0.075, 14, 14);
            const haloMat = new THREE.MeshBasicMaterial({
                color, transparent: true, opacity: 0.34,
                blending: THREE.AdditiveBlending, depthWrite: false,
            });
            const halo = new THREE.Mesh(haloGeo, haloMat);
            group.add(halo);
            group.visible = false;
            scene.add(group);
            markerGeos.push(dotGeo, haloGeo);
            markerMats.push(dotMat, haloMat);
            return { group, dot, halo };
        };

        // Line from the selected spacecraft down to its sub-satellite point
        const dropGeo = new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(), new THREE.Vector3()]);
        const dropMat = new THREE.LineBasicMaterial({ color: '#ffffff', transparent: true, opacity: 0.4 });
        const dropLine = new THREE.Line(dropGeo, dropMat);
        dropLine.visible = false;
        scene.add(dropLine);

        // ── Orbital track ─────────────────────────────────────────────────
        // Drawn at the altitude of each point, so it is the path through space
        // rather than a shadow on the ground. It meets the marker exactly, and
        // the drop line shows how far up that is.
        //
        // This is the orbit in Earth's frame, which is the frame this globe is
        // drawn in: successive passes sit west of the last because the Earth
        // turned underneath, rather than retracing one closed ring.
        const MAX_TRACK = 400;
        const trackGeo = new THREE.BufferGeometry();
        trackGeo.setAttribute('position', new THREE.BufferAttribute(new Float32Array(MAX_TRACK * 3), 3));
        trackGeo.setDrawRange(0, 0);
        const trackMat = new THREE.LineBasicMaterial({
            color: '#ffffff', transparent: true, opacity: 0.55,
        });
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

        // Where the camera is being drawn toward, smoothed so a jump in the
        // selection glides rather than snaps.
        const focusTarget = new THREE.Vector3(0, 0, R + 0.13);
        const focusCurrent = focusTarget.clone();
        let haveFocus = false;
        const _sun = new THREE.Vector3();
        const _camWanted = new THREE.Vector3();
        const _p = new THREE.Vector3();

        api.current = {
            setSatellites(list, selectedId) {
                const seen = new Set();
                for (const sat of list ?? []) {
                    if (sat.lat == null || sat.lon == null) continue;
                    seen.add(sat.id);
                    let marker = markers.get(sat.id);
                    if (!marker) { marker = makeMarker(sat.color); markers.set(sat.id, marker); }
                    const chosen = sat.id === selectedId;
                    toVec3(sat.lat, sat.lon, R * (1 + (sat.altitude ?? 420) * ALT_SCALE), _p);
                    marker.group.position.copy(_p);
                    marker.group.visible = true;
                    // The selected one reads first: a larger dot and a brighter
                    // halo. The rest stay legible but recede.
                    marker.group.scale.setScalar(chosen ? 1 : 0.72);
                    marker.halo.material.opacity = chosen ? 0.4 : 0.2;
                    marker.dot.material.opacity = chosen ? 1 : 0.75;
                    marker.dot.material.transparent = !chosen;

                    if (chosen) {
                        focusTarget.copy(_p);
                        haveFocus = true;
                        // The track and the drop line belong to whoever is
                        // selected, so they take that satellite's colour.
                        trackMat.color.set(sat.color);
                        dropMat.color.set(sat.color);
                        const dp = dropGeo.attributes.position.array;
                        dp[0] = _p.x; dp[1] = _p.y; dp[2] = _p.z;
                        const surf = _p.clone().setLength(R);
                        dp[3] = surf.x; dp[4] = surf.y; dp[5] = surf.z;
                        dropGeo.attributes.position.needsUpdate = true;
                        dropLine.visible = true;
                    }
                }
                // Anything that dropped out of the list stops being drawn
                for (const [id, marker] of markers) if (!seen.has(id)) marker.group.visible = false;
                if (!seen.has(selectedId)) dropLine.visible = false;
            },
            setTrack(points) {
                const arr = trackGeo.attributes.position.array;
                const n = Math.min(points?.length ?? 0, MAX_TRACK);
                for (let i = 0; i < n; i++) {
                    toVec3(points[i].lat, points[i].lon, R * (1 + (points[i].alt ?? 420) * ALT_SCALE), _p);
                    arr[i * 3] = _p.x; arr[i * 3 + 1] = _p.y; arr[i * 3 + 2] = _p.z;
                }
                trackGeo.attributes.position.needsUpdate = true;
                trackGeo.setDrawRange(0, n);
            },
            setObserver(o) {
                if (!o) { obsMesh.visible = false; return; }
                toVec3(o.lat, o.lon, R * 1.01, obsMesh.position);
                obsMesh.visible = true;
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

            // Markers are placed the moment a fix arrives; only what the
            // camera is chasing is smoothed, so switching satellite glides
            // across rather than cutting.
            focusCurrent.lerp(focusTarget, 0.08);

            // Drift the camera to keep the selected craft in view until the
            // user takes over. Bias part of the way toward the sub-solar point
            // so the shot includes the lit limb and terminator rather than
            // staring at an unlit hemisphere whenever it is over Earth's night.
            if (haveFocus && api.current.follow && !userDriving) {
                const dist = camera.position.length();
                _camWanted.copy(focusCurrent).normalize()
                    .addScaledVector(_sun, 0.55)
                    .normalize()
                    .multiplyScalar(dist);
                // Straight back out to the distance we started the frame at.
                // Both ends of this lerp are the same length, but the line
                // between them is a chord, not an arc, so every frame of
                // following quietly lost altitude — the further the camera had
                // to swing, the more it lost, and picking a different craft is
                // the biggest swing there is. It was creeping in on the Earth
                // and stopping only when it hit minDistance.
                camera.position.lerp(_camWanted, 0.012).setLength(dist);
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
            [geo, atmoGeo, dropGeo, trackGeo, obsGeo, ...gratGeos, ...markerGeos]
                .forEach(g => g.dispose());
            [earthMat, atmoMat, dropMat, trackMat, obsMat, gratMat, ...markerMats]
                .forEach(m => m.dispose());
            loaded.forEach(t => t.dispose());
            if (mount.contains(renderer.domElement)) mount.removeChild(renderer.domElement);
            renderer.dispose();
        };
    }, []);

    // ── Push live data into the scene ─────────────────────────────────────
    useEffect(() => {
        api.current.setSatellites?.(satellites, selectedId);
    }, [satellites, selectedId]);

    useEffect(() => { api.current.setTrack?.(track); }, [track]);
    useEffect(() => { api.current.setObserver?.(observer); }, [observer]);
    useEffect(() => { api.current.setFollow?.(follow); }, [follow]);

    return <div ref={mountRef} style={{ width: '100%', height: '100%' }} />;
};

export default SatelliteGlobe;
