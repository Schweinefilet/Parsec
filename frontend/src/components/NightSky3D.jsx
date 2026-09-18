import { useRef, useEffect } from 'react';
import * as THREE from 'three';
import * as Astronomy from 'astronomy-engine';
import { loadSkyCatalog } from '../utils/skyCatalog';
import { quality, pixelRatioFor } from '../utils/quality';
import {
    updateSkyRotation, getSkyRotation,
    getAzimuth, getAltitude, nudgeLookDirection, setLookDirection, subscribeLook,
} from '../utils/skyRotation';
import {
    startDeviceOrientationTracking, stopDeviceOrientationTracking,
    getOrientationHeading, getOrientationAltitude, getOrientationRoll,
    setDeclinationLocation, nudgeCalibrationOffset, getOrientationDebug,
} from '../utils/deviceOrientation';
import { arVerticalFov } from '../utils/arCamera';
import { simNow } from '../utils/simTime';
import { getNightSkySettings } from '../utils/nightSkySettings';
import { SKY_BODIES } from '../utils/skyPositions';
import { PLANETS } from '../data/solarSystemBodies';
import { useReducedMotion } from '../hooks/useMediaQuery';
import { useI18n } from '../i18n';

// The night sky, from one point on the ground, looking up.
//
// Reads the same real astronomy as utils/skyPositions.js but answers a
// different question with it: not "what's up and how high",
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

// The constellation info card's star list. Ursa Major alone names fourteen
// (HYG's proper-name set, not just the Dipper) — capped so the card stays a
// card rather than growing into a panel.
const NAMED_STARS_CAP = 8;

const MAIN_LINE_OPACITY = 0.32;
const THIN_LINE_OPACITY = 0.16;
// AR-only tuning — see the per-frame block that applies these for why:
// decoding a live camera feed is real cost the scene's existing device
// tiers never budgeted for, and a real camera image carries more visual
// noise than a flat black canvas for a constellation line to read against.
const AR_MAX_STARS = 2000; // matches utils/quality.js's own TIERS.low.nightSkyStars
const AR_LINE_OPACITY_BOOST = 1.7;

/** Locale-aware "A, B and C" — falls back to a plain join if Intl.ListFormat is unavailable. */
function formatStarList(names, locale) {
    try {
        return new Intl.ListFormat(locale, { style: 'long', type: 'conjunction' }).format(names);
    } catch {
        return names.join(', ');
    }
}

// Pogson's ratio: each step of 5 magnitudes is a factor of 100 in flux, so
// one magnitude is 100^(1/5). Point *area* (not radius) should track flux,
// which is what makes Sirius (mag -1.4) read as unmistakably brighter than
// a star at the naked-eye limit rather than merely a bit bigger.
const STAR_VERTEX_SHADER = /* glsl */`
    attribute float aMag;
    attribute float aCi;
    attribute float aIndex;
    attribute float aInFigure;
    uniform mat3 uRot;
    uniform float uPixelRatio;
    uniform float uTwinkle;
    uniform float uTime;
    uniform float uMaxIndex;
    varying float vAlpha;
    varying float vCi;

    void main() {
        vec3 rotated = uRot * position;
        vec4 mvPosition = modelViewMatrix * vec4(rotated, 1.0);
        gl_Position = projectionMatrix * mvPosition;

        // The catalog is brightest-first (see build-sky-catalog.mjs), so the
        // "how much light pollution" slider is just a moving cutoff on this
        // per-vertex index — turning it down never changes *which* stars are
        // visible, only how many, dimmest first. A vertex shader can't
        // discard, so a star past the cutoff gets a zero point size instead,
        // which rasterizes nothing.
        if (aIndex >= uMaxIndex) {
            gl_PointSize = 0.0;
            vAlpha = 0.0;
            vCi = aCi;
            return;
        }

        float flux = pow(2.512, -aMag);
        float size = clamp(sqrt(flux) * 2.6, 1.4, 7.0) * uPixelRatio;
        // A traditional constellation figure's own stars — not the ~150
        // background stars this catalog happens to file under the same IAU
        // region (see the info card's own separate "stars in view" count) —
        // read as 50% brighter, the whole size scaled rather than just the
        // ceiling raised, so the boost holds at every magnitude alike.
        if (aInFigure > 0.5) size *= 1.5;

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

// AR-only halo behind the sharp core dot above, sharing its same geometry
// (position/aSize/aColor) so the two never drift apart — a second, bigger,
// softer, additively-blended point sitting behind it, the same "layered
// glow" idea SolarSystem3D.jsx's own GLOW_LAYERS uses around the Sun there
// (concentric shells, since that one is a 3D mesh; one extra point-sprite
// pass here, since these are 2D dots on a dome). Exists so a marker doesn't
// wash out against a bright real Moon or a streetlight in the camera feed —
// only shown while AR is active, toggled per-frame alongside the star/line
// tuning below.
const BODY_GLOW_VERTEX_SHADER = /* glsl */`
    attribute float aSize;
    attribute vec3 aColor;
    uniform float uSizeScale;
    varying vec3 vColor;
    varying float vAlpha;
    void main() {
        vAlpha = smoothstep(-0.02, 0.05, position.y);
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
        gl_PointSize = aSize * uSizeScale;
        vColor = aColor;
    }
`;
const BODY_GLOW_FRAGMENT_SHADER = /* glsl */`
    precision mediump float;
    varying vec3 vColor;
    varying float vAlpha;
    uniform float uGlowOpacity;
    void main() {
        vec2 d = gl_PointCoord - vec2(0.5);
        float r = length(d) * 2.0; // 0 at centre, 1 at this point's own edge
        float glow = 1.0 - smoothstep(0.0, 1.0, r);
        gl_FragColor = vec4(vColor, glow * glow * vAlpha * uGlowOpacity);
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
        // A tight band right at the horizon, not the 60% of the visible
        // ground the original 0.6 gave the glow — that read as "the ground
        // is the sky's colour", not "the ground catches a little of its
        // light". See horizonColorFor below for why the colour itself changed too.
        vec3 color = mix(uHorizonColor, vec3(0.01, 0.012, 0.016), smoothstep(0.0, 0.22, t));
        gl_FragColor = vec4(color, 1.0);
    }
`;

const DOME_RADIUS = 1; // stars/lines/ground/bodies all live on this unit sphere

const NIGHT       = new THREE.Color('#050608');
const DUSK        = new THREE.Color('#241d3d');
// Named for what they colour, not for the sky phase that drives them — this
// used to be SUNSET (#e8823c) and DAY_SKY (#3d6ea6), the sky's own colours
// at those altitudes, borrowed wholesale for the ground below it. By day
// that made the ground a mirror of the blue sky, which is exactly what
// looked wrong: the sky above the horizon is blue, but the ground under it
// never is. GROUND_GLOW is a warm, desaturated echo of a real sunset/sunrise
// glow on the horizon (which does look natural); DAY_GROUND is a neutral
// dark warm-gray for full daylight, chosen specifically to not be blue.
const GROUND_GLOW = new THREE.Color('#6b4326');
const DAY_GROUND  = new THREE.Color('#15130f');
const _lerpColor = new THREE.Color();

/**
 * A continuous ground-horizon tint from the Sun's altitude, ramped through
 * the same boundaries utils/skyPositions.js's twilightPhase() uses (civil/
 * nautical/astronomical twilight), so this scene's horizon and any other
 * reading of that function always agree about where night begins.
 */
function horizonColorFor(sunAltDeg, out) {
    if (sunAltDeg <= -18) return out.copy(NIGHT);
    if (sunAltDeg <= -6) return out.copy(NIGHT).lerp(DUSK, (sunAltDeg + 18) / 12);
    if (sunAltDeg <= -0.833) return out.copy(DUSK).lerp(GROUND_GLOW, (sunAltDeg + 6) / 5.167);
    if (sunAltDeg <= 10) return out.copy(GROUND_GLOW).lerp(DAY_GROUND, (sunAltDeg + 0.833) / 10.833);
    return out.copy(DAY_GROUND);
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

const NightSky3D = ({
    location, height = 'var(--app-vh, 100vh)', targetConstellation = null,
    arMode = false, cameraStream = null,
}) => {
    const mountRef = useRef(null);
    const groundRef = useRef(null);
    const locationRef = useRef(location);
    const targetConstellationRef = useRef(targetConstellation);
    // Read by the fixed-at-mount onPointerMove/onKeyDown closures below, so
    // a drag or arrow key branches to nudging the AR calibration offset
    // instead of the view directly once AR mode is live — those handlers
    // are built once in the effect with an empty dependency list and never
    // rebuilt, so a plain prop read wouldn't see this change at all.
    const arModeRef = useRef(arMode);
    // The live camera <video>, so the render loop can match the rendered
    // field of view to the real one (see the frame loop's own AR block).
    // Owned by the AR effect below; null whenever AR is off.
    const arVideoRef = useRef(null);
    const reducedMotionRef = useRef(false);
    const reducedMotion = useReducedMotion();
    const { locale, constellationName, t } = useI18n();
    const i18nRef = useRef({ locale, constellationName, t });
    const relabelRef = useRef(() => {});

    useEffect(() => { locationRef.current = location; }, [location]);
    useEffect(() => { targetConstellationRef.current = targetConstellation; }, [targetConstellation]);
    useEffect(() => { arModeRef.current = arMode; }, [arMode]);
    useEffect(() => { reducedMotionRef.current = reducedMotion; }, [reducedMotion]);
    useEffect(() => {
        i18nRef.current = { locale, constellationName, t };
        relabelRef.current();
    }, [locale, constellationName, t]);

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
        renderer.toneMapping = THREE.LinearToneMapping;
        renderer.toneMappingExposure = 1.3;
        mount.appendChild(renderer.domElement);
        // Absolute + an explicit z-index even outside AR mode: CSS paints
        // unpositioned in-flow content *before* positioned descendants in the
        // same stacking context regardless of DOM order, so the AR <video>
        // element added below the canvas (see the arMode effect further down)
        // would otherwise paint on top of it rather than behind it. Harmless
        // outside AR mode — an absolutely positioned first child with no
        // offsets keeps its ordinary static position.
        renderer.domElement.style.position = 'absolute';
        renderer.domElement.style.zIndex = '1';
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

        // ── Orientation HUD ─────────────────────────────────────────────────
        // A plain DOM overlay, not React state — azimuth/altitude change on
        // every pointer-move of a drag, and this scene's whole discipline is
        // that anything moving that often stays out of React (see the file
        // header). No roll readout: this scene never introduces roll (see
        // skyRotation.js's own header: "no roll, ever"), so a static "0°"
        // line was reporting a number that could never do anything else —
        // not information, just a row.
        //
        // Rotating dial, fixed needle — the 5.0.9 swap to a fixed dial with
        // a rotating needle turned out to be chasing the wrong thing: what
        // actually read as "the compass moving" was .sky-compass-stats
        // reflowing width every time the heading/altitude digit count
        // changed (9° -> 10°, or crossing into a 3-digit heading), which
        // shifts the whole flex column above it, dial included, since
        // nothing pins the dial's own width against the readout's. Fixed
        // below by giving the readout's own value cells a reserved width
        // instead, so the column never has a reason to move regardless of
        // which way the dial itself turns.
        //
        // Each cardinal letter is two nested spans: the outer one is what
        // .sky-compass-ring's own rotation carries around the dial (pure
        // position, set once in CSS below), the inner .sky-compass-letter is
        // counter-rotated by the same azimuth every frame in updateCompass()
        // so the *glyph* stays upright throughout — otherwise "N" ends up
        // sideways or upside-down exactly when it's most useful, at 90°/180°
        // of heading.
        const compassEl = document.createElement('div');
        compassEl.className = 'sky-compass';
        compassEl.innerHTML = [
            '<div class="sky-compass-dial">',
            '<div class="sky-compass-ring">',
            '<span class="sky-compass-n"><span class="sky-compass-letter">N</span></span>',
            '<span class="sky-compass-e"><span class="sky-compass-letter">E</span></span>',
            '<span class="sky-compass-s"><span class="sky-compass-letter">S</span></span>',
            '<span class="sky-compass-w"><span class="sky-compass-letter">W</span></span>',
            '</div>',
            '<div class="sky-compass-needle"></div>',
            '</div>',
            '<div class="sky-compass-stats">',
            '<div class="row"><span data-lbl="heading"></span><b data-val="heading"></b></div>',
            '<div class="row"><span data-lbl="altitude"></span><b data-val="altitude"></b></div>',
            '</div>',
        ].join('');
        mount.appendChild(compassEl);
        const compassRingEl = compassEl.querySelector('.sky-compass-ring');
        const compassLetterEls = compassEl.querySelectorAll('.sky-compass-letter');
        const compassHeadingEl = compassEl.querySelector('[data-val="heading"]');
        const compassAltitudeEl = compassEl.querySelector('[data-val="altitude"]');
        // Set directly from i18nRef here rather than left to relabel() below:
        // relabel() only runs from the *other* effect's [locale, ...] change,
        // which — on the very first mount — fires before this effect has had
        // a chance to point relabelRef.current at the real relabel(), and
        // would otherwise leave these blank until a language switch.
        compassEl.querySelector('[data-lbl="heading"]').textContent = i18nRef.current.t('nightSky.compassHeading');
        compassEl.querySelector('[data-lbl="altitude"]').textContent = i18nRef.current.t('nightSky.compassAltitude');

        // ── AR diagnostic readout (?debug=ar) ────────────────────────────────
        // Every stage of the heading pipeline side by side, so a real-device
        // offset can be attributed to one of them instead of guessed at. The
        // row that actually settles it is `delta`: centre the real Moon in the
        // camera view, and if the final true heading already disagrees with the
        // Moon's true azimuth, the error arrived before the renderer ever saw
        // it (sensor/compass), whereas a delta near zero with the drawn Moon
        // still visibly offset puts it after (projection, fov, scene mapping).
        //
        // Deliberately untranslated: these are developer labels, and routing
        // them through t() would drag a debugging tool into the i18n parity
        // tests for no reader's benefit. Plain DOM updated per frame, for the
        // same reason the compass above is — see the file header.
        const debugAr = new URLSearchParams(window.location.search).get('debug') === 'ar';
        const DEBUG_ROWS = [
            ['webkit', 'what iOS reported, raw'],
            ['acc', 'iOS stated accuracy in degrees; -1 means no valid reading'],
            ['raw', 'bearing derived from the rotation alone'],
            ['offset', 'alpha anchor reconciling the two'],
            ['mag', 'resulting magnetic heading'],
            ['decl', 'declination added for true north'],
            ['cal', 'manual calibration offset'],
            ['TRUE', 'final heading handed to the scene'],
            ['moon', "the Moon's true azimuth / altitude"],
            ['delta', 'TRUE heading minus Moon azimuth'],
            ['loc', 'observer lat / lon in use'],
            ['fov', 'rendered vertical field of view'],
        ];
        let debugEl = null;
        const debugValEls = {};
        if (debugAr) {
            debugEl = document.createElement('div');
            debugEl.style.cssText = [
                // Pushed clear of the header and the back button, which
                // otherwise overlap exactly the first few rows — and those are
                // the ones worth reading.
                'position:absolute', 'top:124px', 'left:8px', 'z-index:6',
                'font:11px/1.45 ui-monospace,SFMono-Regular,Menlo,monospace',
                'color:#b6f0c0', 'background:rgba(0,0,0,0.72)',
                'padding:6px 8px', 'border-radius:6px', 'pointer-events:none',
                'white-space:pre', 'max-width:60vw',
            ].join(';');
            debugEl.innerHTML = DEBUG_ROWS
                .map(([k, title]) => `<div title="${title}">${k.padEnd(7)}<b data-d="${k}"></b></div>`)
                .join('');
            mount.appendChild(debugEl);
            for (const [k] of DEBUG_ROWS) debugValEls[k] = debugEl.querySelector(`[data-d="${k}"]`);
        }

        // ── Constellation info card ──────────────────────────────────────────
        // Shown on click (see "Constellation hover + click" below) — content
        // is set imperatively for the same reason the labels are: it has to
        // survive a locale change without the mount effect re-running.
        const infoCardEl = document.createElement('div');
        infoCardEl.className = 'sky-info-card';
        infoCardEl.style.display = 'none';
        infoCardEl.innerHTML = [
            '<button class="sky-info-close" type="button"></button>',
            '<div class="sky-info-name"></div>',
            '<div class="sky-info-code"></div>',
            '<div class="sky-info-stat sky-info-stars"></div>',
            '<div class="sky-info-stat sky-info-named-stars"></div>',
        ].join('');
        labelLayer.appendChild(infoCardEl);
        const infoCloseBtn = infoCardEl.querySelector('.sky-info-close');
        const infoNameEl = infoCardEl.querySelector('.sky-info-name');
        const infoCodeEl = infoCardEl.querySelector('.sky-info-code');
        const infoStarsEl = infoCardEl.querySelector('.sky-info-stars');
        const infoNamedStarsEl = infoCardEl.querySelector('.sky-info-named-stars');
        infoCloseBtn.setAttribute('aria-label', i18nRef.current.t('nightSky.constellationInfoClose'));
        infoCloseBtn.textContent = '×';
        let openIau = null;
        const hideInfoCard = () => {
            openIau = null;
            infoCardEl.style.display = 'none';
        };
        infoCloseBtn.addEventListener('click', hideInfoCard);

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
        groundRef.current = ground;

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

        // The AR-only halo (see BODY_GLOW_VERTEX_SHADER's own header) —
        // shares bodyGeo/bodyPosAttr with bodyPoints above rather than a
        // second copy, so the two positions can never drift apart; an
        // explicit renderOrder rather than relying on insertion order
        // (both are depthWrite:false, so draw order is what actually
        // decides "glow behind the core dot", not depth testing) keeps it
        // painted first regardless of where either ends up in the scene
        // graph later. Hidden by default — only visible while arMode is
        // true, toggled per-frame alongside the star/line AR tuning below.
        const bodyGlowMat = new THREE.ShaderMaterial({
            vertexShader: BODY_GLOW_VERTEX_SHADER,
            fragmentShader: BODY_GLOW_FRAGMENT_SHADER,
            uniforms: {
                uSizeScale: { value: 3.4 },
                uGlowOpacity: { value: 0.55 },
            },
            transparent: true,
            depthWrite: false,
            blending: THREE.AdditiveBlending,
        });
        const bodyGlowPoints = new THREE.Points(bodyGeo, bodyGlowMat);
        bodyGlowPoints.frustumCulled = false;
        bodyGlowPoints.renderOrder = -1;
        bodyGlowPoints.visible = false;
        scene.add(bodyGlowPoints);

        // One label per tracked body, always present — nine is few enough that
        // decluttering isn't worth it, unlike the constellation figures below.
        const bodyLabelEls = SKY_TRACKED.map((b) => {
            const el = document.createElement('div');
            Object.assign(el.style, BODY_LABEL_STYLE);
            el.textContent = b.name;
            labelLayer.appendChild(el);
            return el;
        });

        // ── Constellation hover highlight ────────────────────────────────────
        // One reusable LineSegments, empty until the first hover — rewritten
        // (not recreated) each time the hovered constellation changes, the
        // same "cheap enough on-change, not worth it every frame" reasoning
        // SolarSystem3D.jsx uses for its own forty-hitbox resize. Shown
        // regardless of the lines toggle in NightSkyPanel — a deliberate
        // hover you're mid-click on should answer, even with ambient lines off.
        const highlightGeo = new THREE.BufferGeometry();
        highlightGeo.setAttribute('position', new THREE.BufferAttribute(new Float32Array(0), 3));
        const highlightMat = new THREE.ShaderMaterial({
            vertexShader: LINE_VERTEX_SHADER,
            fragmentShader: LINE_FRAGMENT_SHADER,
            uniforms: {
                uRot: { value: getSkyRotation() },
                uColor: { value: new THREE.Color('#ffd166') },
                uOpacity: { value: 0.9 },
            },
            transparent: true,
            depthWrite: false,
        });
        const highlightMesh = new THREE.LineSegments(highlightGeo, highlightMat);
        highlightMesh.visible = false;
        // Starts with an empty position buffer, then gets real segments
        // written into it on the first hover (setHoveredConstellation
        // rewrites the attribute in place, same as mainLinesMesh/thinLinesMesh
        // never do). The frustum check auto-computes a bounding sphere the
        // first time it runs — against that still-empty buffer, since this
        // mesh is added to the scene before any hover has happened — and
        // nothing afterward ever recomputes it, so every real hover from then
        // on gets silently culled against a stale, degenerate sphere. Skip
        // the cull test instead of chasing a recompute after every rewrite:
        // this geometry is a handful of segments, the whole point of it
        // being cheap.
        highlightMesh.frustumCulled = false;
        scene.add(highlightMesh);

        // ── Constellation hover + click ───────────────────────────────────────
        // The cursor's own screen-space ray, converted back to a J2000 RA/Dec
        // and handed to Astronomy.Constellation() — the same conversion
        // updateCrosshair() below already does for the camera's forward
        // direction, applied here to an arbitrary pointer position instead.
        // That makes every constellation's *true* IAU boundary the hit area,
        // not just its drawn stick figure or an approximate radius around its
        // label — more forgiving to hit, and no new geometry to test against.
        const raycaster = new THREE.Raycaster();
        const _mouseNDC = new THREE.Vector2();
        const _hoverDir = new THREE.Vector3();

        // ── Stars + constellation lines + labels: built once the catalog resolves ──
        const geos = [groundGeo, bodyGeo, highlightGeo];
        const mats = [groundMat, bodyMat, bodyGlowMat, highlightMat];
        let starPoints = null;
        let starMat = null;
        let starCount = 0;
        let mainLinesMesh = null;
        let thinLinesMesh = null;
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
        // IAU -> { main, thin, native }, for the hover highlight and the info
        // card — the same per-constellation records the line meshes and
        // labels below are built from, just kept addressable afterward too.
        let segmentsByIau = null;
        // The full, unfiltered catalog (not `shown`, which is sliced by the
        // density setting and quality tier) — a constellation's star count
        // and brightest name should not change because the display density
        // slider moved.
        let loadedStars = null;
        let hoveredIau = null;

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
            const { constellationName: name, t: tt } = i18nRef.current;
            for (const l of constellationLabels) l.el.textContent = name(l.iau, l.native);
            compassEl.querySelector('[data-lbl="heading"]').textContent = tt('nightSky.compassHeading');
            compassEl.querySelector('[data-lbl="altitude"]').textContent = tt('nightSky.compassAltitude');
            infoCloseBtn.setAttribute('aria-label', tt('nightSky.constellationInfoClose'));
            infoCloseBtn.textContent = '×';
            if (openIau) showConstellationInfo(openIau, { pan: false });
        };
        relabelRef.current = relabel;

        loadSkyCatalog().then(({ stars, constellations }) => {
            if (!mounted) return;

            // Which cataloged stars are actual figure vertices — the stars a
            // reader means by "the stars of Ursa Major", not the ~150 other
            // background stars this catalog happens to file under the same
            // IAU region (see showConstellationInfo's own separate "stars in
            // view" count, which does mean that). The line data only ships
            // [ra, dec] endpoints, not HIP ids (see build-sky-catalog.mjs),
            // but those are rounded from the exact same source float as each
            // star's own catalog row, so a plain key match here is exact,
            // not an epsilon-fuzzed nearest-point search. Built regardless of
            // q.nightSkyLines/the lines toggle — a star being a figure star
            // isn't conditional on whether its lines happen to be drawn.
            const figureKeys = new Set();
            for (const [, , , main, thin] of constellations) {
                for (const strip of [...main, ...thin]) {
                    for (const [ra, dec] of strip) figureKeys.add(`${ra},${dec}`);
                }
            }

            // Brightest-first (see build-sky-catalog.mjs), so the tier count is
            // a plain slice — no runtime sort.
            const shown = stars.slice(0, q.nightSkyStars);
            starCount = shown.length;
            const positions = new Float32Array(shown.length * 3);
            const mags = new Float32Array(shown.length);
            const cis = new Float32Array(shown.length);
            const indices = new Float32Array(shown.length);
            const inFigure = new Float32Array(shown.length);
            const v = new THREE.Vector3();
            shown.forEach((s, i) => {
                eqjFromRaDec(s[0], s[1], v);
                positions[i * 3] = v.x; positions[i * 3 + 1] = v.y; positions[i * 3 + 2] = v.z;
                mags[i] = s[2];
                cis[i] = s[8] ?? 0.6; // the Sun's own B-V, a reasonable default for unknowns
                indices[i] = i;
                inFigure[i] = figureKeys.has(`${s[0]},${s[1]}`) ? 1 : 0;
            });

            const starGeo = new THREE.BufferGeometry();
            starGeo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
            starGeo.setAttribute('aMag', new THREE.BufferAttribute(mags, 1));
            starGeo.setAttribute('aCi', new THREE.BufferAttribute(cis, 1));
            starGeo.setAttribute('aIndex', new THREE.BufferAttribute(indices, 1));
            starGeo.setAttribute('aInFigure', new THREE.BufferAttribute(inFigure, 1));
            starMat = new THREE.ShaderMaterial({
                vertexShader: STAR_VERTEX_SHADER,
                fragmentShader: STAR_FRAGMENT_SHADER,
                uniforms: {
                    uRot: { value: getSkyRotation() },
                    uPixelRatio: { value: renderer.getPixelRatio() },
                    uTwinkle: { value: (q.nightSkyTwinkle && !reducedMotionRef.current) ? 1 : 0 },
                    uTime: { value: 0 },
                    uOpacity: { value: 1 },
                    uMaxIndex: { value: starCount * getNightSkySettings().density },
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
                mainLinesMesh = makeLineMesh(concat(mainSegs), MAIN_LINE_OPACITY);
                thinLinesMesh = makeLineMesh(concat(thinSegs), THIN_LINE_OPACITY);
                mainLinesMesh.visible = getNightSkySettings().linesVisible;
                thinLinesMesh.visible = getNightSkySettings().linesVisible;
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

            loadedStars = stars;
            segmentsByIau = new Map(
                constellations.map(([iau, , native, main, thin]) => [iau, { main, thin, native }]),
            );
        });

        // ── Look-around controls ─────────────────────────────────────────────
        // Drag-the-world convention (matches most panorama/street-view style
        // viewers): dragging right reveals what was to your left, i.e. turns
        // the view left, not right.
        let dragging = false;
        let dragDistPx = 0;
        let lastX = 0, lastY = 0;
        // The pointer this drag belongs to — not just a boolean. A fast spin
        // on a touchscreen is exactly when a second, incidental touch shows
        // up (a palm edge, a second finger brushing the glass): without this,
        // that second pointer's own 'pointerdown' silently reset lastX/lastY
        // to *its* position while `dragging` stayed true, so the first
        // finger's very next move was measured against the wrong origin —
        // one huge, wrong delta, which read as the whole sky lurching.
        // Reported from an iPhone 15 (Chrome/iOS, so WebKit underneath, more
        // touch-event quirks than desktop) — ignoring any pointerId but the
        // one that started the drag fixes it regardless of how the second
        // touch arrived.
        let activePointerId = null;
        // A smooth pan to a clicked constellation's anchor — see "Constellation
        // hover + click" below. Grabbing the sky mid-flight cancels it rather
        // than fighting it; a new pointerdown is a clearer "I want control
        // back" signal than any timeout could be.
        const panAnim = { active: false, startAz: 0, deltaAz: 0, startAlt: 0, endAlt: 0, t: 0 };
        // A constellation arrived at via ?con=<iau> (the search bar) rather
        // than a click — opened once the catalog resolves and segmentsByIau
        // exists, and again for a later search pick that lands here without
        // remounting (this route matches on path alone, so a fresh
        // navigate() with a different ?con just updates the prop). Guarded
        // by value, not a one-shot flag, so it re-fires only on an actual
        // change of target.
        let openedForConstellation = null;
        const onPointerDown = (e) => {
            // AR mode is sensor-driven only now — no drag-to-nudge, calibration
            // or otherwise. It used to nudge a manual calibration offset (the
            // same correction "Look north" resets), but that gave a phone
            // held up to the sky a second, touch-based way to move the view
            // fighting the sensor's own, which read as the scene fighting
            // itself rather than as two deliberate controls.
            if (arModeRef.current) return;
            if (activePointerId !== null) return; // already tracking a different touch/pointer
            activePointerId = e.pointerId;
            dragging = true;
            dragDistPx = 0;
            panAnim.active = false;
            lastX = e.clientX; lastY = e.clientY;
            renderer.domElement.setPointerCapture(e.pointerId);
        };
        const onPointerMove = (e) => {
            if (!dragging || e.pointerId !== activePointerId) return;
            const dx = e.clientX - lastX;
            const dy = e.clientY - lastY;
            lastX = e.clientX; lastY = e.clientY;
            if (!Number.isFinite(dx) || !Number.isFinite(dy)) return;
            dragDistPx += Math.abs(dx) + Math.abs(dy);
            const scale = camera.fov / Math.max(1, renderer.domElement.clientWidth);
            nudgeLookDirection(-dx * scale, dy * scale);
        };
        const onPointerUp = (e) => {
            if (e.pointerId !== activePointerId) return;
            dragging = false;
            activePointerId = null;
            if (renderer.domElement.hasPointerCapture?.(e.pointerId)) {
                renderer.domElement.releasePointerCapture(e.pointerId);
            }
        };
        const onWheel = (e) => {
            // Not in AR: the field of view is not a preference there, it is a
            // measurement of the lens the sky is being drawn over (see the
            // frame loop's own AR block), and zooming one layer and not the
            // other pulls the overlay off the world.
            if (arModeRef.current) return;
            e.preventDefault();
            camera.fov = Math.max(FOV_MIN, Math.min(FOV_MAX, camera.fov + e.deltaY * 0.03));
            camera.updateProjectionMatrix();
        };
        const NUDGE_DEG = 3;
        const onKeyDown = (e) => {
            const nudge = arModeRef.current ? nudgeCalibrationOffset : nudgeLookDirection;
            switch (e.key) {
                case 'ArrowLeft':  nudge(-NUDGE_DEG, 0); break;
                case 'ArrowRight': nudge(NUDGE_DEG, 0); break;
                case 'ArrowUp':    nudge(0, NUDGE_DEG); break;
                case 'ArrowDown':  nudge(0, -NUDGE_DEG); break;
                case 'Escape':     hideInfoCard(); return;
                default: return;
            }
            e.preventDefault();
        };

        // The cursor's screen position -> the IAU code of the constellation
        // it falls inside, or null below the horizon (the ground, not the
        // sky — scene.y is the zenith component, see skyRotation.js's header).
        const _invRotHover = new THREE.Matrix3();
        const constellationAtPointer = (clientX, clientY) => {
            if (!segmentsByIau) return null;
            const rect = renderer.domElement.getBoundingClientRect();
            _mouseNDC.x = ((clientX - rect.left) / rect.width) * 2 - 1;
            _mouseNDC.y = -((clientY - rect.top) / rect.height) * 2 + 1;
            raycaster.setFromCamera(_mouseNDC, camera);
            _hoverDir.copy(raycaster.ray.direction);
            if (_hoverDir.y < 0) return null;
            _invRotHover.copy(getSkyRotation()).transpose();
            _hoverDir.applyMatrix3(_invRotHover);
            const ra = ((Math.atan2(_hoverDir.y, _hoverDir.x) * 180) / Math.PI + 360) % 360;
            const dec = (Math.asin(Math.max(-1, Math.min(1, _hoverDir.z))) * 180) / Math.PI;
            try {
                const info = Astronomy.Constellation(ra / 15, dec);
                return iauByLower?.get(info.symbol.toLowerCase()) ?? info.symbol;
            } catch {
                return null;
            }
        };
        const setHoveredConstellation = (iau) => {
            if (iau === hoveredIau) return;
            hoveredIau = iau;
            const entry = iau ? segmentsByIau.get(iau) : null;
            if (entry) {
                const segs = stripsToSegments(entry.main);
                highlightGeo.setAttribute('position', new THREE.BufferAttribute(segs, 3));
                highlightMesh.visible = true;
            } else {
                highlightMesh.visible = false;
            }
            renderer.domElement.style.cursor = (iau && !dragging) ? 'pointer' : '';
        };
        let lastHoverT = 0;
        const onSkyMouseMove = (e) => {
            if (dragging) { setHoveredConstellation(null); return; }
            const now = performance.now();
            if (now - lastHoverT < 60) return; // Astronomy.Constellation() a frame is unnecessary; a few times a second reads identically smooth
            lastHoverT = now;
            setHoveredConstellation(constellationAtPointer(e.clientX, e.clientY));
        };

        // Shortest signed delta so a pan from 350° to 10° turns +20°, through
        // north, rather than -340° the long way round.
        const startPanTo = (az, alt) => {
            const curAz = ((getAzimuth() % 360) + 360) % 360;
            panAnim.startAz = curAz;
            panAnim.deltaAz = ((((az - curAz) % 360) + 540) % 360) - 180;
            panAnim.startAlt = getAltitude();
            panAnim.endAlt = alt;
            panAnim.t = 0;
            panAnim.active = true;
        };
        const showConstellationInfo = (iau, { pan = true } = {}) => {
            const entry = segmentsByIau?.get(iau);
            if (!entry) return;
            openIau = iau;
            if (pan) {
                const anchor = constellationAnchor(entry.main, new THREE.Vector3());
                const sceneDir = anchor.applyMatrix3(getSkyRotation());
                const alt = (Math.asin(Math.max(-1, Math.min(1, sceneDir.y))) * 180) / Math.PI;
                const az = ((Math.atan2(sceneDir.x, -sceneDir.z) * 180) / Math.PI + 360) % 360;
                startPanTo(az, Math.max(-5, Math.min(80, alt)));
            }
            const { constellationName: name, t: tt } = i18nRef.current;
            infoNameEl.textContent = name(iau, entry.native);
            infoCodeEl.textContent = iau;
            const inCon = (loadedStars ?? []).filter(s => s[4] === iau);
            infoStarsEl.textContent = inCon.length
                ? tt('nightSky.constellationStars', { count: inCon.length })
                : '';
            // Most of a constellation's catalog stars have no proper name —
            // HIP numbers aren't "telling you about" anything. Brightest
            // first, capped so Ursa Major's fourteen named stars don't
            // overflow a 260px card the way a plain comma join would.
            const named = inCon
                .filter(s => s[5])
                .sort((a, b) => a[2] - b[2])
                .slice(0, NAMED_STARS_CAP)
                .map(s => s[5]);
            infoNamedStarsEl.textContent = named.length
                ? tt('nightSky.constellationNamedStars', { names: formatStarList(named, i18nRef.current.locale) })
                : '';
            infoCardEl.style.display = 'block';
        };
        const onSkyClick = (e) => {
            if (dragDistPx > 6) return; // a drag that ended over a constellation is not a click
            const iau = constellationAtPointer(e.clientX, e.clientY);
            if (iau) showConstellationInfo(iau);
        };

        renderer.domElement.addEventListener('pointerdown', onPointerDown);
        renderer.domElement.addEventListener('pointermove', onPointerMove);
        renderer.domElement.addEventListener('pointerup', onPointerUp);
        renderer.domElement.addEventListener('pointercancel', onPointerUp);
        renderer.domElement.addEventListener('wheel', onWheel, { passive: false });
        renderer.domElement.addEventListener('mousemove', onSkyMouseMove);
        renderer.domElement.addEventListener('click', onSkyClick);
        renderer.domElement.tabIndex = 0;
        renderer.domElement.addEventListener('keydown', onKeyDown);

        // ── AR: the rendered lens has to match the real one ──────────────────
        // See utils/arCamera.js for why a field-of-view mismatch misplaces
        // things at the edge of the screen while the centre looks perfect.
        // Recomputed per frame rather than once on metadata: the viewport
        // changes (rotation, the browser's own chrome sliding away) and the
        // video's reported size can arrive late. The guard keeps it to a
        // couple of arctangents and no projection-matrix rebuild in the
        // overwhelmingly common case where nothing moved.
        let fovBeforeAr = FOV_DEFAULT;
        let lastArFov = 0;
        const matchCameraToLens = () => {
            const video = arVideoRef.current;
            if (!video) return;
            const fov = arVerticalFov({
                videoWidth: video.videoWidth,
                videoHeight: video.videoHeight,
                viewWidth: renderer.domElement.clientWidth,
                viewHeight: renderer.domElement.clientHeight,
            });
            if (fov === null || Math.abs(fov - lastArFov) < 0.01) return;
            if (lastArFov === 0) fovBeforeAr = camera.fov;
            lastArFov = fov;
            camera.fov = fov;
            camera.updateProjectionMatrix();
        };

        // Applies the singleton's azimuth/altitude to the camera immediately
        // (drag, wheel and arrow keys all funnel through skyRotation.js, not
        // through this component's own state) and again every frame, since
        // the render loop is the source of truth for what's actually drawn.
        // The Z term is AR's own: a phone is not held perfectly upright, and
        // without it the sky only lines up with the camera image while it is.
        // 'YXZ' applies Z first, in the camera's own frame, so it is a spin
        // about the axis the camera is already looking along — exactly what
        // getOrientationRoll() measures. The dragged dome keeps its
        // never-any-roll invariant (see utils/skyRotation.js's header) by
        // passing 0 here, as it always did.
        const applyLook = () => {
            const altitude = getAltitude();
            camera.rotation.set(
                (altitude * Math.PI) / 180,
                (-getAzimuth() * Math.PI) / 180,
                arModeRef.current ? (getOrientationRoll() * Math.PI) / 180 : 0,
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
        let lastElapsed = 0;
        const clock = new THREE.Clock();
        const _bodyPos = new THREE.Vector3();
        let lastHeadingText = '';
        let lastAltitudeText = '';
        const updateCompass = () => {
            const az = ((getAzimuth() % 360) + 360) % 360;
            const alt = getAltitude();
            compassRingEl.style.transform = `rotate(${-az}deg)`;
            // Counter-rotate each letter by the same amount the ring just
            // turned, so N/E/S/W swing to the correct point on the dial
            // (that part is the parent ring's rotation, inherited normally)
            // without the glyphs themselves tipping over along with it.
            const letterRotation = `rotate(${az}deg)`;
            compassLetterEls.forEach(el => { el.style.transform = letterRotation; });
            const headingText = `${Math.round(az)}°`;
            if (headingText !== lastHeadingText) {
                lastHeadingText = headingText;
                compassHeadingEl.textContent = headingText;
            }
            const altitudeText = `${alt >= 0 ? '+' : ''}${Math.round(alt)}°`;
            if (altitudeText !== lastAltitudeText) {
                lastAltitudeText = altitudeText;
                compassAltitudeEl.textContent = altitudeText;
            }
        };
        let moonAz = null;
        let moonAlt = null;
        const signedDelta = (d) => ((((d % 360) + 540) % 360) - 180);
        const fmtDeg = (v, digits = 1) => (Number.isFinite(v) ? `${v.toFixed(digits)}°` : '—');
        const updateDebug = () => {
            if (!debugEl) return;
            const d = getOrientationDebug();
            const trueHeading = getOrientationHeading();
            const loc = locationRef.current;
            debugValEls.webkit.textContent = d.webkitHeading === null
                ? '— not iOS' : fmtDeg(d.webkitHeading);
            debugValEls.acc.textContent = d.compassAccuracy < 0
                ? `${fmtDeg(d.compassAccuracy)} invalid` : fmtDeg(d.compassAccuracy);
            debugValEls.raw.textContent = fmtDeg(d.rawHeading);
            debugValEls.offset.textContent = fmtDeg(d.alphaOffset);
            debugValEls.mag.textContent = fmtDeg(d.heading);
            debugValEls.decl.textContent = fmtDeg(d.declination, 2);
            debugValEls.cal.textContent = fmtDeg(d.calibrationAz);
            debugValEls.TRUE.textContent = fmtDeg(trueHeading);
            debugValEls.moon.textContent = moonAz === null
                ? '—' : `${fmtDeg(moonAz)} / ${fmtDeg(moonAlt)}`;
            // Signed and to two places: this is the number the whole readout
            // exists for, and a degree either way is the size of the effect
            // being chased.
            const delta = moonAz === null ? null : signedDelta(trueHeading - moonAz);
            debugValEls.delta.textContent = delta === null
                ? '—' : `${delta >= 0 ? '+' : ''}${delta.toFixed(2)}°`;
            debugValEls.loc.textContent = loc
                ? `${loc.lat.toFixed(2)}, ${loc.lon.toFixed(2)}` : '—';
            debugValEls.fov.textContent = fmtDeg(camera.fov);
        };
        const animate = () => {
            animId = requestAnimationFrame(animate);
            frame++;
            const elapsed = clock.getElapsedTime();
            // Clamped the same way SolarSystem3D.jsx's own deltaSec is — a
            // backgrounded tab's first frame back would otherwise report
            // several seconds and fling the pan animation to its end in one jump.
            const deltaSec = Math.min(0.1, Math.max(0, elapsed - lastElapsed));
            lastElapsed = elapsed;
            if (panAnim.active) {
                panAnim.t = Math.min(1, panAnim.t + deltaSec / 0.8);
                const pt = panAnim.t;
                const eased = pt < 0.5 ? 4 * pt * pt * pt : 1 - Math.pow(-2 * pt + 2, 3) / 2;
                setLookDirection(
                    panAnim.startAz + panAnim.deltaAz * eased,
                    panAnim.startAlt + (panAnim.endAlt - panAnim.startAlt) * eased,
                );
                if (panAnim.t >= 1) panAnim.active = false;
            }
            // AR: apply the sensor heading once per rendered frame, reading
            // whatever deviceOrientation.js's own EMA currently holds, rather
            // than reacting to each raw sensor event as it arrives (the
            // arMode effect used to subscribe and call setLookDirection
            // straight from that callback). Sensor events don't arrive in
            // step with rendered frames — they can fire several times
            // between two rAF ticks, or not at all for a stretch under load
            // — so applying every single one was, at best, wasted work the
            // display could never show, and, whenever they arrived in an
            // uneven clump, however many happened to land inside one visual
            // frame. Reading the smoothed value fresh each tick keeps this
            // in step with the same clock everything else in the scene
            // already reads from. The wider range is the actual point of the
            // call: the default clamp (skyRotation.js's own ALT_MIN, -10°)
            // exists so dragging the virtual dome can't run past its
            // rendered ground hemisphere into empty space — with a real
            // camera feed as the ground instead, there's no reason to stop
            // the view early, and doing so anyway was an old bug: the sensor
            // keeps reading further down while the render freezes at -10°,
            // so tilting back up has to "catch up" across whatever gap
            // opened up, reading as the view dragging into place instead of
            // tracking the phone directly.
            if (arModeRef.current) {
                // The full hemisphere, not skyRotation.js's default -10 floor:
                // that floor exists so dragging the virtual dome can't run past
                // its rendered ground into empty space, and with a real camera
                // feed as the ground there is nothing to stop early for. The
                // sensor genuinely reads down to -90 (your own feet) and no
                // further — the camera axis cannot point past straight down —
                // so this is the true range, not a made-up wide one.
                setLookDirection(getOrientationHeading(), getOrientationAltitude(), -90, 90);
                // Directly, not only via the subscription: roll moves
                // independently of heading and altitude, so a phone tilting in
                // place changes nothing setLookDirection would notify about.
                applyLook();
                matchCameraToLens();
            } else if (lastArFov !== 0) {
                // Leaving AR hands the lens back, exactly once: whatever the
                // user had zoomed the dome to before the camera feed took the
                // field of view over. Keyed on lastArFov rather than on the
                // current fov, which would fight the wheel every frame.
                camera.fov = fovBeforeAr;
                camera.updateProjectionMatrix();
                lastArFov = 0;
            }
            const wantCon = targetConstellationRef.current;
            if (wantCon && wantCon !== openedForConstellation && segmentsByIau?.has(wantCon)) {
                openedForConstellation = wantCon;
                showConstellationInfo(wantCon);
            } else if (!wantCon) {
                openedForConstellation = null;
            }
            updateCompass();
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
                        // Kept, not just converted: the diagnostic readout
                        // compares the Moon's true azimuth against the heading
                        // the sensor pipeline produced, and this is already the
                        // authoritative answer for where it really is.
                        if (debugAr && b.id === 'luna') { moonAz = hz.azimuth; moonAlt = hz.altitude; }
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
            const settings = getNightSkySettings();
            const inAr = arModeRef.current;
            if (starMat) {
                starMat.uniforms.uTime.value = clock.getElapsedTime();
                // Clamped to the low tier's own star budget (2000 —
                // utils/quality.js's TIERS.low.nightSkyStars, not imported
                // here since this is specifically an AR-only cost on top of
                // whatever tier a device actually qualifies for, not a
                // change to that tier system itself) while AR is active:
                // decoding a live camera feed is real GPU/CPU cost this
                // scene's existing tier budgets never accounted for.
                const maxIndex = starCount * settings.density;
                starMat.uniforms.uMaxIndex.value = inAr ? Math.min(maxIndex, AR_MAX_STARS) : maxIndex;
                starMat.uniforms.uTwinkle.value =
                    (q.nightSkyTwinkle && settings.twinkle && !reducedMotionRef.current) ? 1 : 0;
            }
            if (mainLinesMesh) {
                mainLinesMesh.visible = settings.linesVisible;
                thinLinesMesh.visible = settings.linesVisible;
                // A real camera feed — even a dark sky — carries more visual
                // texture/noise than a flat black canvas, so the same line
                // opacity that reads clearly in the virtual view risks
                // washing out against it. A flat multiplier rather than new
                // absolute values, so the main/thin relationship (and any
                // future retuning of the base opacities) carries through
                // unchanged.
                const lineBoost = inAr ? AR_LINE_OPACITY_BOOST : 1;
                mainLinesMesh.material.uniforms.uOpacity.value = MAIN_LINE_OPACITY * lineBoost;
                thinLinesMesh.material.uniforms.uOpacity.value = THIN_LINE_OPACITY * lineBoost;
            }
            bodyGlowPoints.visible = inAr;

            for (const l of constellationLabels) placeLabel(l.el, l.anchor, false);
            updateCrosshair();

            // Last, so every number it shows is this frame's: the fov after
            // matchCameraToLens, the Moon after the ephemeris pass.
            updateDebug();

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
            renderer.domElement.removeEventListener('mousemove', onSkyMouseMove);
            renderer.domElement.removeEventListener('click', onSkyClick);
            renderer.domElement.removeEventListener('keydown', onKeyDown);
            infoCloseBtn.removeEventListener('click', hideInfoCard);
            if (mount.contains(compassEl)) mount.removeChild(compassEl);
            if (debugEl && mount.contains(debugEl)) mount.removeChild(debugEl);
            if (mount.contains(renderer.domElement)) mount.removeChild(renderer.domElement);
            if (mount.contains(labelLayer)) mount.removeChild(labelLayer);
            // geos/mats already carries the ground, the bodies, the stars (once
            // loaded) and both line meshes (pushed inside makeLineMesh) — one
            // list, so nothing added after the catalog resolves is missed here.
            geos.forEach(g => g.dispose());
            mats.forEach(m => m.dispose());
            renderer.dispose();
            groundRef.current = null;
        };
    }, []);

    // ── AR mode: live camera feed behind the (already-transparent) canvas ──
    // A sibling effect, not a branch inside the one above — that one is built
    // once with an empty dependency list and must never re-run (see the file
    // header). Toggling AR only ever needs to add/remove a <video> element
    // and flip the ground hemisphere's visibility (the real ground is on
    // camera now; the synthetic one would either be redundant or paint over
    // it), neither of which touches the scene graph's own construction.
    useEffect(() => {
        const mount = mountRef.current;
        const ground = groundRef.current;
        const canvas = mount?.querySelector('canvas');
        if (!mount || !ground || !arMode || !cameraStream) return;

        ground.visible = false;
        // Dragging no longer directly aims the view once the compass is
        // driving it — an accessibility-honesty detail, not cosmetic.
        canvas?.setAttribute(
            'aria-label',
            'The night sky, augmented over your camera. Point your phone to look around.',
        );

        // The observer's own lat/lon, for magnetic-declination correction —
        // read once here rather than added to this effect's own dependency
        // list, since AR doesn't need to tear down and rebuild the camera
        // feed over a location change that, in practice, never happens
        // mid-session (see utils/deviceOrientation.js's own header for why
        // this uses the *real* current date rather than the app's
        // scrubbable simulated clock).
        const loc = locationRef.current;
        if (loc) setDeclinationLocation(loc.lat, loc.lon);

        // The camera itself isn't applied here — see the main animate loop's
        // own "AR: apply the sensor heading" block for why that moved out of
        // this subscription and onto the render loop instead. Tracking still
        // starts here: this is what actually turns the browser's sensor
        // listeners on, independent of who reads the result.
        startDeviceOrientationTracking();

        const video = document.createElement('video');
        video.muted = true;
        video.playsInline = true;
        video.autoplay = true;
        video.style.cssText = 'position:absolute;inset:0;width:100%;height:100%;'
            + 'object-fit:cover;z-index:0;';
        video.srcObject = cameraStream;
        // First child, ahead of the canvas in DOM order — belt and suspenders
        // alongside the canvas's own explicit z-index (set once, always, in
        // the main effect above) for which layer is furthest back.
        mount.insertBefore(video, mount.firstChild);
        // Published for the render loop's own matchCameraToLens() — the
        // rendered field of view is read off the real frame's dimensions, not
        // assumed (see utils/arCamera.js).
        arVideoRef.current = video;
        // Safari can reject a play() raced against layout on the very first
        // frame; the video still plays once layout settles, so this is safe
        // to ignore rather than surface as an error.
        video.play().catch(() => {});

        return () => {
            stopDeviceOrientationTracking();
            arVideoRef.current = null;
            video.pause();
            video.srcObject = null;
            if (mount.contains(video)) mount.removeChild(video);
            ground.visible = true;
            canvas?.setAttribute(
                'aria-label',
                'The night sky, looking up from your location. Drag to look around.',
            );
        };
    }, [arMode, cameraStream]);

    return (
        <div
            ref={mountRef}
            style={{ position: 'relative', width: '100%', height, outline: 'none' }}
        />
    );
};

export default NightSky3D;
