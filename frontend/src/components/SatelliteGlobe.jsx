import { useRef, useEffect } from 'react';
import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { quality, texturePath, pixelRatioFor } from '../utils/quality';
import { debugRequested } from '../utils/debugFlag';
import { subsolar, latLonToVec3 } from '../utils/subsolar';
import {
    isTrackerArriving, markTrackerGlobeReady, handoffDistance, subscribeTracker,
} from '../utils/trackerEntry';

const R = 2;                    // Earth radius in scene units
const ALT_SCALE = 1 / 6371;     // km → Earth radii, so altitude is to scale

// Equirectangular lat/lon (degrees) → position on a three.js SphereGeometry.
// The convention itself lives in utils/subsolar.js, because the solar-system
// scene has to place points by the same rule for the tracker hand-off to land
// on the same ground; this is the local spelling that defaults `out`.
function toVec3(lat, lon, radius, out = new THREE.Vector3()) {
    return latLonToVec3(lat, lon, radius, out);
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
    onUserTakeOver,
}) => {
    const mountRef = useRef(null);
    const api = useRef({});
    // Held in a ref so the scene effect never needs it as a dependency
    const takeOverRef = useRef(onUserTakeOver);
    useEffect(() => { takeOverRef.current = onUserTakeOver; }, [onUserTakeOver]);

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
        renderer.outputColorSpace = THREE.SRGBColorSpace;
        renderer.toneMapping = THREE.LinearToneMapping;
        renderer.toneMappingExposure = 1.3;
        // Anything already in here is a canvas from a previous run of this
        // effect that was not cleaned up. Stacked above the live one it pushes
        // the globe down its card behind a band of nothing, looks exactly like
        // a sizing fault, and survives everything but a reload.
        for (const stale of mount.querySelectorAll('canvas')) stale.remove();
        mount.appendChild(renderer.domElement);
        renderer.domElement.setAttribute('role', 'img');
        renderer.domElement.setAttribute('aria-label',
            'Three-dimensional globe showing the live positions of the tracked spacecraft');

        const scene = new THREE.Scene();
        const camera = new THREE.PerspectiveCamera(38, w / h, 0.05, 100);
        camera.position.set(0, 2.4, 7.4);

        // Arriving through the hand-off from the solar system, this opens on
        // the pose that scene just pulled back to rather than its own default
        // three-quarter view: looking straight down the sun line at the
        // sub-solar point, north up, far enough out that Earth's disc spans
        // the same share of the frame. Both sides compute this from the clock
        // alone (utils/trackerEntry.js explains why that is all it takes), so
        // nothing has to be handed across but the fact that it is happening.
        //
        // Note this is the same distance the default view uses — 3.89 Earth
        // radii, which is where 7.4/2.4 came from in the first place. Only the
        // direction differs.
        let dayMapReady = false;
        let firstFrameDrawn = false;
        if (isTrackerArriving()) {
            const ss = subsolar(new Date());
            toVec3(ss.lat, ss.lon, handoffDistance(camera.fov) * R, camera.position);
            camera.up.set(0, 1, 0);
            camera.lookAt(0, 0, 0);
        }

        const controls = new OrbitControls(camera, renderer.domElement);
        controls.enableDamping = true;
        controls.dampingFactor = 0.07;
        controls.enablePan = false;
        controls.minDistance = 3.4;
        controls.maxDistance = 14;

        // Taking the camera off the spacecraft is something the button should
        // report, not just something that quietly happens: it said "Following
        // Hubble" while the camera sat wherever you had dragged it.
        //
        // Keyed on the camera actually moving during an interaction rather than
        // on the interaction starting, because OrbitControls fires 'start' on
        // any pointer down — a click on the globe that never moves would
        // otherwise switch following off.
        let userDriving = false;
        let interacting = false;
        controls.addEventListener('start', () => { interacting = true; });
        controls.addEventListener('end', () => { interacting = false; });
        controls.addEventListener('change', () => {
            if (!interacting || userDriving) return;
            userDriving = true;
            takeOverRef.current?.();
        });

        scene.add(new THREE.AmbientLight(0xffffff, 0.22));
        const sunLight = new THREE.DirectionalLight(0xfff6e8, 2.1);
        scene.add(sunLight);

        // ── Earth with a day/night blend ──────────────────────────────────
        const geo = new THREE.SphereGeometry(R, q.skySegments + 32, q.skySegments + 32);
        const uniforms = {
            dayMap:       { value: null },
            nightMap:     { value: null },
            cloudsMap:    { value: null },
            sunDirection: { value: new THREE.Vector3(1, 0, 0) },
            hasNight:     { value: 0 },
            hasClouds:    { value: 0 },
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
                uniform sampler2D cloudsMap;
                uniform vec3 sunDirection;
                uniform float hasNight;
                uniform float hasClouds;
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
                    // Same cloud layer, and the same way of mixing it in, as
                    // the solar-system scene's Earth — baked into this sphere
                    // rather than hung on a second one. It is the third of
                    // that scene's three Earth maps and was the one thing
                    // still missing here, which the tracker hand-off made
                    // visible: a dissolve between a clouded Earth and a clear
                    // one is a dissolve you can see.
                    if (hasClouds > 0.5) {
                        vec4 clouds = texture2D(cloudsMap, vUv);
                        vec3 cloudColor = mix(clouds.rgb * 0.05, clouds.rgb, blend);
                        col = mix(col, cloudColor, clouds.r * 0.85);
                    }
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
        // None of these three declare a colour space, which is deliberate and
        // is what the solar-system scene's Earth does too.
        //
        // The shader below writes gl_FragColor itself without three's
        // <colorspace_fragment> chunk, so whatever it computes goes to the
        // framebuffer as-is. Tagging the maps SRGBColorSpace — which this did
        // until the hand-off put the two Earths side by side — makes
        // texture2D() decode them to linear on the way in with nothing to
        // re-encode them on the way out, and the planet renders at about a
        // third of the brightness it should, muddy and desaturated with it.
        // Leaving them untagged passes the bytes through, which is the pair
        // of wrongs that makes a right here and, more to the point, is the
        // same pair the rest of the app already relies on.
        loader.load(texturePath('earth.jpg'), (t) => {
            if (!mounted) { t.dispose(); return; }
            uniforms.dayMap.value = t;
            loaded.push(t);
            // The frame after this is the first one with a planet in it
            // rather than a black sphere, which is the first one the tracker
            // hand-off can dissolve to. Flagged for the animate loop rather
            // than announced from here: the texture being assigned is not the
            // same instant as it having been drawn.
            dayMapReady = true;
        });
        loader.load(texturePath('earth_night.jpg'), (t) => {
            if (!mounted) { t.dispose(); return; }
            uniforms.nightMap.value = t;
            uniforms.hasNight.value = 1;
            loaded.push(t);
        });
        // Same file the solar-system scene loads for Earth, so on an arrival
        // through the hand-off this is already in cache.
        loader.load(texturePath('earth_clouds.jpg'), (t) => {
            if (!mounted) { t.dispose(); return; }
            uniforms.cloudsMap.value = t;
            uniforms.hasClouds.value = 1;
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

        // ── Staying the size of the box ───────────────────────────────────
        // One place that measures, so the drawing buffer, the canvas's own
        // box and the camera can never be sized from different numbers, and
        // so every notice below can simply say "look again" without having to
        // carry a size with it. `fit` reads the element rather than trusting
        // what it was told, which is the whole point: the times this went
        // wrong were the times something believed a stale number.
        let fitW = w, fitH = h;
        const fit = () => {
            if (!mounted) return;
            const width = mount.clientWidth, height = mount.clientHeight;
            if (!width || !height || (width === fitW && height === fitH)) return;
            fitW = width; fitH = height;
            // Re-budget on resize too: rotating a tablet changes the surface
            // area enough to matter.
            renderer.setPixelRatio(pixelRatioFor(width, height));
            renderer.setSize(width, height);

            // And then take the size back off the context rather than trusting
            // the one we just asked for. Two things go wrong otherwise, and
            // both of them draw the scene into a corner of the canvas with the
            // rest left empty — which is not a layout fault, but is
            // indistinguishable from one at a glance.
            //
            // A browser can hand back a smaller drawing buffer than the canvas
            // it is attached to, leaving three's viewport describing a
            // rectangle the buffer doesn't have. And three only issues
            // gl.viewport() when the value differs from the one it remembers
            // issuing — a record that survives the buffer underneath it being
            // swapped, so the GPU can be left on the previous frame's
            // rectangle while three is satisfied that it isn't. Setting the
            // viewport to something else and straight back guarantees the call
            // actually reaches the GPU.
            const gl = renderer.getContext();
            const ratio = renderer.getPixelRatio();
            const bw = gl.drawingBufferWidth, bh = gl.drawingBufferHeight;
            lastBW = bw; lastBH = bh;
            renderer.setViewport(0, 0, 1, 1);
            renderer.setViewport(0, 0, bw / ratio, bh / ratio);
            camera.aspect = bw / bh;
            camera.updateProjectionMatrix();
        };

        // The same fault from the other direction: the buffer changing without
        // the element having changed, which no resize of any kind announces.
        let lastBW = 0, lastBH = 0;
        const checkBuffer = () => {
            const gl = renderer.getContext();
            if (gl.drawingBufferWidth === lastBW && gl.drawingBufferHeight === lastBH) return;
            fitW = 0; fitH = 0;   // so fit() doesn't dismiss it as no change
            fit();
        };

        const ro = new ResizeObserver(fit);
        ro.observe(mount);

        // The tracker's arrival ends by putting the card back in the page's
        // column, and that shrinks the box under this globe from the whole
        // viewport to a card a third its height. It is the one size change in
        // the app that no window resize and no user action stands behind, and
        // a phone that doesn't deliver it as a resize leaves the globe drawing
        // a full-bleed frame inside the card: a band of empty black with the
        // planet sitting low and cropped under it, which nothing short of a
        // reload puts right — reported from an iPhone, every arrival, and only
        // ever on the arrival. So the phase itself is a reason to measure
        // again, over the beat the card's own transition takes.
        const refitTimers = [];
        const refitSoon = () => {
            requestAnimationFrame(fit);
            refitTimers.push(setTimeout(fit, 150), setTimeout(fit, 600));
        };
        const unsubPhase = subscribeTracker(refitSoon);

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

        let frames = 0;

        // TEMPORARY, with components/TrackerDebug.jsx. The fault this is
        // chasing is inside the canvas rather than around it, so the readout
        // needs what only the renderer knows: what the context says its buffer
        // is, what rectangle the GPU is actually drawing into, and whether the
        // loop is still running at all.
        if (debugRequested()) {
            window.__p4rsecGlobe = () => {
                const gl = renderer.getContext();
                const vp = gl.getParameter(gl.VIEWPORT);
                const sc = gl.getParameter(gl.SCISSOR_BOX);
                const size = renderer.getSize(new THREE.Vector2());
                return {
                    dbuf: `${gl.drawingBufferWidth}x${gl.drawingBufferHeight}`,
                    glvp: `${vp[0]},${vp[1]} ${vp[2]}x${vp[3]}`,
                    pr: renderer.getPixelRatio(),
                    cam: `a${camera.aspect.toFixed(2)} d${camera.position.length().toFixed(2)} t${controls.target.length().toFixed(2)}`,
                    // A scissor rect nobody set, a renderer that thinks it is
                    // a different size than its buffer, or a camera rendering
                    // a sub-rectangle of its own frame would each draw the
                    // scene into part of the canvas and leave the rest empty.
                    sc: `${gl.isEnabled(gl.SCISSOR_TEST) ? 'on' : 'off'} ${sc[0]},${sc[1]} ${sc[2]}x${sc[3]}`,
                    rsz: `${Math.round(size.x)}x${Math.round(size.y)} fov${camera.fov} vo${camera.view ? 'yes' : 'no'}`,
                    frames,
                };
            };
        }

        const animate = () => {
            if (!mounted) return;
            animId = requestAnimationFrame(animate);

            // Last word on the matter. Whatever the box does and whichever of
            // the notices above arrives, the globe is drawing at the size of
            // the element it sits in within half a second. Two layout reads a
            // second, at the top of a frame that is about to render anyway, is
            // nothing beside a page that can only be fixed by reloading it.
            if ((frames++ % 30) === 0) { fit(); checkBuffer(); }

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
            // Nothing moves for the whole arrival: the dissolve is between
            // two frames that match, and a camera already drifting off the
            // pose during it is the one thing that would give the cut away.
            // It stays held through the settle as well, so the beats read one
            // at a time — the globe shrinks into its card still showing the
            // face you flew to, and only then glides round to find the craft.
            // Letting follow start at the cut meant arriving and immediately
            // whipping most of the way round the planet, which made the
            // matched frame it arrived on look like an accident.
            const handingOff = isTrackerArriving();
            if (haveFocus && api.current.follow && !userDriving && !handingOff) {
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

            // Still called during the hand-off: with no input pending,
            // damping resolves to the pose it is already at, and skipping it
            // would only mean the controls' own spherical state was stale
            // the moment the user first touched the globe.
            controls.update();
            renderer.render(scene, camera);

            if (dayMapReady && !firstFrameDrawn) {
                firstFrameDrawn = true;
                markTrackerGlobeReady();
            }
        };
        animate();

        return () => {
            mounted = false;
            cancelAnimationFrame(animId);
            controls.dispose();
            ro.disconnect();
            unsubPhase();
            refitTimers.forEach(clearTimeout);
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
