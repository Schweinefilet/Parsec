import { useRef, useEffect } from 'react';
import * as THREE from 'three';
import * as Astronomy from 'astronomy-engine';
import { loadSkyCatalog } from '../utils/skyCatalog';
import { quality, pixelRatioFor } from '../utils/quality';
import {
    updateSkyRotation, getSkyRotation,
    getAzimuth, getAltitude, nudgeLookDirection, subscribeLook,
} from '../utils/skyRotation';
import { simNow } from '../utils/simTime';
import { SKY_BODIES } from '../utils/skyPositions';
import { PLANETS } from '../data/solarSystemBodies';
import { useReducedMotion } from '../hooks/useMediaQuery';
import { useI18n } from '../i18n';

// The night sky, from one point on the ground, looking up.
//
// Reads the same real astronomy as utils/skyPositions.js (the /tonight page)
// but answers a different question with it: not "what's up and how high",
// an explorable dome you look around inside rather than a flat readout. See
// utils/skyRotation.js for the coordinate pipeline — the short version is
// that every star is a fixed EQJ (J2000) direction, and the whole dome turns
// each frame via one 3x3 matrix built from the observer's location and the
// simulated time (utils/simTime.js — the same clock TimeControl scrubs on
// the solar-system page; scrub there, and the sky here turns to match).
//
// The camera never moves — it sits at the scene origin for the component's
// entire life, and only its *rotation* changes, driven by drag / scroll /
// arrow keys via utils/skyRotation.js's azimuth+altitude singleton. That
// singleton, not React state, is what the render loop reads every frame —
// same reasoning as simTime.js and driftControl.js: the scene is built once
// in an effect with an empty dependency list, and nothing here may cause
// that effect to re-run.
//
// Phase 2 additions over the first cut: the Sun, Moon and planets share this
// dome (small colour-coded points, not the star field's shader); DOM labels
// name the constellation figures, translated, positioned the same way
// SolarSystem3D.jsx's planet/moon labels are; and a small readout names
// whichever constellation is dead ahead, via astronomy-engine's own
// Astronomy.Constellation() — the official IAU boundary lookup, at no extra
// data cost.

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

// The Sun, Moon and planets: a handful of points, recomputed directly in
// scene space every update (not through uRot — there are nine of them, so
// there is no batching win to chase, and each already needs its own
// Astronomy.Horizon() call). Plain colour, no twinkle, no magnitude-driven
// sizing — see BODY_SIZE below for why.
const BODY_VERTEX_SHADER = /* glsl */`
    attribute float aSize;
    attribute vec3 aColor;
    varying vec3 vColor;
    varying float vAlpha;
    void main() {
        vAlpha = smoothstep(-0.02, 0.05, position.y);
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
        gl_PointSize = aSize;
        vColor = aColor;
    }
`;
const BODY_FRAGMENT_SHADER = /* glsl */`
    precision mediump float;
    varying vec3 vColor;
    varying float vAlpha;
    void main() {
        vec2 d = gl_PointCoord - vec2(0.5);
        float r = length(d);
        if (r > 0.5) discard;
        float edge = 1.0 - smoothstep(0.35, 0.5, r);
        gl_FragColor = vec4(vColor, edge * vAlpha);
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

const DOME_RADIUS = 1; // stars/lines/ground/bodies all live on this unit sphere

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

/** Altitude/azimuth (degrees) -> this scene's basis, the same formula
 * skyRotation.js's own header derives and skyRotation.test.js pins. */
function sceneFromAltAz(altDeg, azDeg, out) {
    const alt = (altDeg * Math.PI) / 180;
    const az = (azDeg * Math.PI) / 180;
    const cosAlt = Math.cos(alt);
    return out.set(cosAlt * Math.sin(az), Math.sin(alt), -cosAlt * Math.cos(az));
}

// Fixed, not magnitude-driven: an accurate per-frame brightness would need an
// Astronomy.Illumination() call per body — real orbital-mechanics work, and
// nine of them a frame is a cost worth avoiding for a number that only ever
// changes over days. The relative order below (Venus and Jupiter biggest,
// the ice giants smallest) is the part that actually reads as "real".
const BODY_SIZE = {
    sun: 15, luna: 13, venus: 9, jupiter: 8, mars: 6.5, mercury: 6,
    saturn: 6, uranus: 4.5, neptune: 4,
};
const BODY_COLOR = {
    sun: '#fff4c2', luna: '#d8d8e0',
    ...Object.fromEntries(PLANETS.map(p => [p.id, p.color])),
};
// Sun first (Astronomy.Equator supports 'Sun' as a body name directly).
const SKY_TRACKED = [{ body: 'Sun', id: 'sun', name: 'Sun' }, ...SKY_BODIES];

// A constellation label's anchor: the mean of its main figure's points,
// renormalised onto the unit sphere. Not exact (the mean of points on a
// sphere is not itself on the sphere, and is not any particular "centre"),
// but it lands inside the figure it names, which is the whole job.
function constellationAnchor(mainStrips, out) {
    let x = 0, y = 0, z = 0, n = 0;
    const v = new THREE.Vector3();
    for (const strip of mainStrips) {
        for (const [ra, dec] of strip) {
            eqjFromRaDec(ra, dec, v);
            x += v.x; y += v.y; z += v.z; n++;
        }
    }
    if (n === 0) return out.set(0, 0, 0);
    return out.set(x / n, y / n, z / n).normalize();
}

const LABEL_STYLE = {
    position: 'absolute', top: 0, left: 0,
    color: 'rgba(255,255,255,0.8)', fontSize: 10, fontWeight: 700,
    letterSpacing: '0.07em', lineHeight: 1.3, whiteSpace: 'nowrap',
    textShadow: '0 1px 4px rgba(0,0,0,0.9)', willChange: 'transform',
    visibility: 'hidden', pointerEvents: 'none',
};
const BODY_LABEL_STYLE = {
    ...LABEL_STYLE, color: 'rgba(255,255,255,0.92)', fontSize: 11,
};

const NightSky3D = ({ location, height = 'var(--app-vh, 100vh)' }) => {
    const mountRef = useRef(null);
    const locationRef = useRef(location);
    const reducedMotionRef = useRef(false);
    const reducedMotion = useReducedMotion();
    const { locale, constellationName } = useI18n();
    const i18nRef = useRef({ locale, constellationName });
    const relabelRef = useRef(() => {});

    useEffect(() => { locationRef.current = location; }, [location]);
    useEffect(() => { reducedMotionRef.current = reducedMotion; }, [reducedMotion]);
    useEffect(() => {
        i18nRef.current = { locale, constellationName };
        relabelRef.current();
    }, [locale, constellationName]);

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

        // ── Label layer ──────────────────────────────────────────────────────
        // Plain DOM nodes, positioned imperatively every frame — same reasoning
        // as SolarSystem3D.jsx's planet/moon labels: React re-rendering ~90 text
        // nodes a frame is real cost for zero benefit, since nothing about a
        // label but its transform and visibility ever changes on its own.
        const labelLayer = document.createElement('div');
        labelLayer.style.cssText = 'position:absolute;inset:0;overflow:hidden;pointer-events:none;z-index:3';
        mount.appendChild(labelLayer);

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

        // ── Sun/Moon/planets ─────────────────────────────────────────────────
        const bodyCount = SKY_TRACKED.length;
        const bodyPositions = new Float32Array(bodyCount * 3);
        const bodySizes = new Float32Array(bodyCount).fill(6);
        const bodyColors = new Float32Array(bodyCount * 3);
        const _bodyColor = new THREE.Color();
        SKY_TRACKED.forEach((b, i) => {
            bodySizes[i] = BODY_SIZE[b.id] ?? 6;
            _bodyColor.set(BODY_COLOR[b.id] ?? '#ffffff');
            bodyColors[i * 3] = _bodyColor.r; bodyColors[i * 3 + 1] = _bodyColor.g; bodyColors[i * 3 + 2] = _bodyColor.b;
        });
        const bodyGeo = new THREE.BufferGeometry();
        const bodyPosAttr = new THREE.BufferAttribute(bodyPositions, 3);
        bodyPosAttr.setUsage(THREE.DynamicDrawUsage);
        bodyGeo.setAttribute('position', bodyPosAttr);
        bodyGeo.setAttribute('aSize', new THREE.BufferAttribute(bodySizes, 1));
        bodyGeo.setAttribute('aColor', new THREE.BufferAttribute(bodyColors, 3));
        const bodyMat = new THREE.ShaderMaterial({
            vertexShader: BODY_VERTEX_SHADER,
            fragmentShader: BODY_FRAGMENT_SHADER,
            transparent: true,
            depthWrite: false,
        });
        const bodyPoints = new THREE.Points(bodyGeo, bodyMat);
        // Positions start at the origin (an all-zero Float32Array) and are
        // then mutated in place every frame — geometry.boundingSphere is
        // computed once, lazily, from whatever the buffer held at that
        // first draw, and nothing here ever asks three to recompute it, so
        // it stays a zero-radius sphere sitting exactly on the camera
        // forever. THREE's default frustum cull test against that sphere
        // culls the whole object on every frame, silently, regardless of
        // what the shader would have drawn — nine points, not worth
        // recomputing a bounding sphere for every frame just to keep a
        // check that can never usefully reject them anyway.
        bodyPoints.frustumCulled = false;
        scene.add(bodyPoints);

        // One label per tracked body, always present — nine is few enough that
        // decluttering isn't worth it, unlike the constellation figures below.
        const bodyLabelEls = SKY_TRACKED.map((b) => {
            const el = document.createElement('div');
            Object.assign(el.style, BODY_LABEL_STYLE);
            el.textContent = b.name;
            labelLayer.appendChild(el);
            return el;
        });

        // ── Stars + constellation lines + labels: built once the catalog resolves ──
        const geos = [groundGeo, bodyGeo];
        const mats = [groundMat, bodyMat];
        let starPoints = null;
        let starMat = null;
        // { el, anchor: Vector3, iau, native } — anchor stays fixed (EQJ);
        // only its projection and the label text (on a locale change) update.
        let constellationLabels = [];
        // astronomy-engine's own Astronomy.Constellation() spells Triangulum
        // Australe's code "TrA"; Stellarium's line data (this catalog's own
        // source of IAU codes) spells it "Tra". Confirmed by calling both
        // directly rather than assumed — nothing else in the 88 disagreed.
        // Resolved case-insensitively against whatever codes the catalog
        // actually shipped, so the crosshair readout doesn't quietly fall
        // back to the untranslated Latin name for the one code that differs.
        let iauByLower = null;

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

        const relabel = () => {
            const { constellationName: name } = i18nRef.current;
            for (const l of constellationLabels) l.el.textContent = name(l.iau, l.native);
        };
        relabelRef.current = relabel;

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

            iauByLower = new Map(constellations.map(([iau]) => [iau.toLowerCase(), iau]));

            // Constellation name labels — one DOM node each, positioned every
            // frame below, decluttered the same way SolarSystem3D.jsx avoids
            // stacking planet labels: skip one whose spot is already taken.
            const { constellationName: name0 } = i18nRef.current;
            constellationLabels = constellations.map(([iau, , native, main]) => {
                const anchor = constellationAnchor(main, new THREE.Vector3());
                const el = document.createElement('div');
                Object.assign(el.style, LABEL_STYLE);
                el.textContent = name0(iau, native);
                labelLayer.appendChild(el);
                return { el, anchor, iau, native };
            });
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

        // ── "What am I looking at" ───────────────────────────────────────────
        // Astronomy.Constellation() is the official IAU boundary lookup — the
        // same one drawing the figures came from, at no extra data cost — fed
        // the camera's own look direction converted back to J2000 RA/Dec via
        // the inverse (== transpose, since it's a pure rotation) of the same
        // matrix the stars use.
        const crosshairEl = document.createElement('div');
        crosshairEl.style.cssText = [
            'position:absolute', 'top:16px', 'left:50%', 'transform:translateX(-50%)',
            'font-size:11px', 'font-weight:700', 'letter-spacing:0.1em', 'text-transform:uppercase',
            'color:rgba(255,255,255,0.55)', 'text-shadow:0 1px 4px rgba(0,0,0,0.9)',
            'pointer-events:none', 'z-index:4',
        ].join(';');
        labelLayer.appendChild(crosshairEl);
        let lastConLabel = null;
        const _lookDir = new THREE.Vector3();
        const _invRot = new THREE.Matrix3();
        const updateCrosshair = () => {
            _lookDir.set(0, 0, -1).applyEuler(camera.rotation);
            _invRot.copy(getSkyRotation()).transpose(); // scene -> EQJ (a rotation's inverse is its transpose)
            _lookDir.applyMatrix3(_invRot);
            const ra = ((Math.atan2(_lookDir.y, _lookDir.x) * 180) / Math.PI + 360) % 360;
            const dec = (Math.asin(Math.max(-1, Math.min(1, _lookDir.z))) * 180) / Math.PI;
            let label;
            try {
                const info = Astronomy.Constellation(ra / 15, dec);
                const iau = iauByLower?.get(info.symbol.toLowerCase()) ?? info.symbol;
                label = i18nRef.current.constellationName(iau, info.name);
            } catch {
                label = null;
            }
            if (label !== lastConLabel) {
                lastConLabel = label;
                crosshairEl.textContent = label ?? '';
            }
        };

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

        // ── Label projection ─────────────────────────────────────────────────
        const _proj = new THREE.Vector3();
        const _labelSpots = [];
        const LABEL_CLEAR = 34;
        // `besidePoint`: body labels sit next to an actual drawn marker (the
        // Sun/Moon/planet dot), so centring the text on it would hide the dot
        // behind its own name — offset right and centre only vertically, the
        // same convention SolarSystem3D.jsx uses for its planet/moon labels.
        // Constellation labels have no marker to clear and stay centred on
        // their anchor.
        const placeLabel = (el, worldPos, alreadyRotated, besidePoint = false) => {
            if (alreadyRotated) _proj.copy(worldPos);
            else _proj.copy(worldPos).applyMatrix3(getSkyRotation());
            // Same horizon fade the stars/lines/bodies use in their own
            // shaders (rotated.y == sin(altitude)) — checked here too, or a
            // body or figure below the horizon (invisible, correctly, behind
            // the ground) can still leave its *label* floating on screen
            // with nothing under it, whenever the projected point still
            // happens to land in frame.
            if (_proj.y < -0.02) {
                if (el.style.visibility !== 'hidden') el.style.visibility = 'hidden';
                return false;
            }
            _proj.project(camera);
            if (_proj.z > 1 || Math.abs(_proj.x) > 1.05 || Math.abs(_proj.y) > 1.05 || _proj.z < -1) {
                if (el.style.visibility !== 'hidden') el.style.visibility = 'hidden';
                return false;
            }
            const viewW = renderer.domElement.clientWidth;
            const viewH = renderer.domElement.clientHeight;
            const x = ((_proj.x + 1) / 2) * viewW;
            const y = (-(_proj.y - 1) / 2) * viewH;
            for (const spot of _labelSpots) {
                if (Math.abs(spot.x - x) < LABEL_CLEAR && Math.abs(spot.y - y) < LABEL_CLEAR) {
                    if (el.style.visibility !== 'hidden') el.style.visibility = 'hidden';
                    return false;
                }
            }
            _labelSpots.push({ x, y });
            el.style.transform = besidePoint
                ? `translate3d(${x + 10}px, ${y}px, 0) translateY(-50%)`
                : `translate3d(${x}px, ${y}px, 0) translate(-50%, -50%)`;
            if (el.style.visibility !== 'visible') el.style.visibility = 'visible';
            return true;
        };

        // ── Render loop ───────────────────────────────────────────────────────
        let animId;
        let frame = 0;
        const clock = new THREE.Clock();
        const _bodyPos = new THREE.Vector3();
        const animate = () => {
            animId = requestAnimationFrame(animate);
            frame++;
            // One crowding pass a frame, shared by bodies and constellations
            // (bodies placed first, below, so a body label wins any conflict
            // with a constellation name over the same spot).
            _labelSpots.length = 0;
            const loc = locationRef.current;
            if (loc) {
                const observer = new Astronomy.Observer(loc.lat, loc.lon, 0);
                // simNow() returns a raw epoch-ms number by design (a render
                // loop should not allocate every frame if it can avoid it) —
                // astronomy-engine needs an actual Date, so this allocates
                // one, the same as SolarSystem3D.jsx's own render loop does.
                const now = new Date(simNow());
                updateSkyRotation(now, observer);

                // Cheap (one Equator + one Horizon call), and only used for a
                // colour ramp that changes over minutes, but there's no reason
                // not to keep it exactly current.
                const sunEq = Astronomy.Equator('Sun', now, observer, true, true);
                const sunHz = Astronomy.Horizon(now, observer, sunEq.ra, sunEq.dec, null);
                horizonColorFor(sunHz.altitude, _lerpColor);
                groundMat.uniforms.uHorizonColor.value.copy(_lerpColor);

                // Every third frame: nine Equator+Horizon calls is real
                // ephemeris work, and nothing up there moves fast enough for
                // 20 Hz to read as anything but smooth.
                if (frame % 3 === 0) {
                    SKY_TRACKED.forEach((b, i) => {
                        const eq = Astronomy.Equator(b.body, now, observer, true, true);
                        const hz = Astronomy.Horizon(now, observer, eq.ra, eq.dec, null);
                        sceneFromAltAz(hz.altitude, hz.azimuth, _bodyPos);
                        bodyPositions[i * 3] = _bodyPos.x;
                        bodyPositions[i * 3 + 1] = _bodyPos.y;
                        bodyPositions[i * 3 + 2] = _bodyPos.z;
                    });
                    bodyPosAttr.needsUpdate = true;
                }
                SKY_TRACKED.forEach((b, i) => {
                    _bodyPos.set(bodyPositions[i * 3], bodyPositions[i * 3 + 1], bodyPositions[i * 3 + 2]);
                    placeLabel(bodyLabelEls[i], _bodyPos, true, true);
                });
            }
            if (starMat) starMat.uniforms.uTime.value = clock.getElapsedTime();

            for (const l of constellationLabels) placeLabel(l.el, l.anchor, false);
            updateCrosshair();

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
            if (mount.contains(labelLayer)) mount.removeChild(labelLayer);
            // geos/mats already carries the ground, the bodies, the stars (once
            // loaded) and both line meshes (pushed inside makeLineMesh) — one
            // list, so nothing added after the catalog resolves is missed here.
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
