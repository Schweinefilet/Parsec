import { useRef, useEffect, useLayoutEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { STLLoader } from 'three/examples/jsm/loaders/STLLoader.js';
import {
    PLANETS, PLANET_PBR, AXIAL_TILT_DEG, PLANET_TEXTURES, MOON_TEXTURES,
    MOON_DATA, SMALL_BODIES, PROBES,
} from '../data/solarSystemBodies';
import {
    DEG2RAD, ORBIT_EPOCH_MS, ORBIT_BASE_OPACITY, ORBIT_HOVER_OPACITY, ORBIT_HOVER_TINT,
    PLANET_EMISSIVE_INTENSITY, computePlanetPos, buildOrbitPoints, buildOrbitTube,
    keplerianScenePos, buildKeplerOrbitPoints, eclipticQuaternion,
} from '../utils/orbits';
import { probeScenePos, buildProbeTrack, trackDrawCount } from '../utils/probeTracks';
import { proceduralSurface } from '../utils/proceduralTextures';
import { createSunLensflare, sunFlareScale, setSunFlareScale } from '../utils/lensFlareTextures';
import { simNow, isLive } from '../utils/simTime';
import { setCameraSnapshot } from '../utils/shareView';
import {
    scaleProgress, sizeProgress, radialFactor, sizeFactor, AU_UNITS,
    isScaleSettling, subscribeScale, getScaleStage, SCALE_DISTANCES, SCALE_SIZES,
} from '../utils/scaleMode';
import { bodyRadiusKm, moonOrbitKm } from '../utils/trueSize';
import { quality, texturePath, pixelRatioFor, skyAllowed } from '../utils/quality';
import {
    assetStarted, assetFinished, assetsSceneReady, __resetAssets,
} from '../utils/assetLoading';
import {
    targetOrbitSpeed, stepOrbitSpeed, targetIssSpeed,
    advanceMoonAngle, moonOffset, DEFAULT_ORBIT_SPEED,
} from '../utils/orbitalMotion';
import { getVizMode, vizWeight, isVizSettling, VIZ_OFF, VIZ_GRID, VIZ_FIELD } from '../utils/vizMode';
import { getTrailsOn, subscribeTrails } from '../utils/trailMode';
import { driftRates, pitchPendulum } from '../utils/driftControl';
import {
    ARMED, APPROACHING, CURTAIN, ARRIVAL_ALTITUDE,
    getSkyEntryPhase, getSkyEntryObserver, setSkyEntryPhase, resetSkyEntry,
} from '../utils/skyEntry';
import {
    ARMED as TRK_ARMED, APPROACHING as TRK_APPROACHING, HANDOFF as TRK_HANDOFF,
    getTrackerPhase, setTrackerPhase, setTrackerSnapshot, resetTrackerEntry,
    handoffDistance,
} from '../utils/trackerEntry';
import { subsolar, latLonToVec3 } from '../utils/subsolar';
import { GRAVITY_BODIES, WEIGHT_CONFIG } from '../utils/gravityModel';
import { makeGravityGrid } from '../utils/gravityGrid';
import { makeGravityLines } from '../utils/gravityLines';
import { GRAVITY_FIELD_DEFAULTS } from '../utils/gravityField';
import { useI18n } from '../i18n';

let _exitState = { active: false, cameraPos: null, targetPos: null };

/**
 * Whether this viewport has room for the wide Sun-in-frame fly-in (see the
 * focus block's own `sunFramed`). Read fresh at each focus rather than held in
 * a ref, so resizing the window between two clicks is simply noticed.
 *
 * The width and height halves are the same breakpoints CategoryBrowser's own
 * `compactFocus` is built from (hooks/useMediaQuery.js) — a phone, or a
 * landscape phone too short for the focused layout, is not a PC. The aspect
 * clause is this framing's own: the Sun sits about 0.70 of the way to the
 * frame's left edge at 16:9, and a squarer window runs out of horizontal room
 * before it runs out of vertical.
 */
const WIDE_FRAMING_QUERY =
    '(min-width: 768px) and (min-height: 521px) and (min-aspect-ratio: 5/4)';
const wideFraming = () => typeof window !== 'undefined'
    && (window.matchMedia?.(WIDE_FRAMING_QUERY).matches ?? false);

const SolarSystem3D = ({
    focusedId, focusOffsetY = 0, height = 'var(--app-vh, 100vh)', initialCamera = null,
    autoRotate = true,
}) => {
    const { t, bodyName } = useI18n();
    const mountRef  = useRef(null);
    const navigate  = useNavigate();
    // The scene is built once inside an effect with an empty dependency list —
    // it must never be torn down and rebuilt for a language change — so the one
    // string it writes imperatively comes through a ref rather than a closure
    // over the first render's translator.
    const canvasLabelRef = useRef('');
    canvasLabelRef.current = t('scene.canvas');
    // Which labels exist, not where they are. The roster changes only when the
    // focus does; the positions are written straight to the DOM by the render
    // loop (see "Object labels" below), so a frame costs no React work.
    const [labelRoster, setLabelRoster] = useState([]);
    // Only the caption needs this in React; the scene reads the layout itself.
    // The stage, not the animation: subscribeScale fires when a transition
    // *starts*, at which point the progress still reads the layout being left.
    // Asking the progress meant the caption latched on and never came back.
    const [scaleStage, setScaleStageUI] = useState(getScaleStage);
    useEffect(() => subscribeScale(() => setScaleStageUI(getScaleStage())), []);
    const [moonLabelsReady, setMoonLabelsReady] = useState(false);
    const labelElsRef = useRef(new Map());
    // Filled by the scene effect with { enter(id), leave() } so the floating
    // labels — which sit beside their body, not over the canvas — can drive the
    // same hover state a raycast would: light the orbit ring, hold the drift,
    // slow a hovered moon.
    const sceneHoverRef = useRef(null);

    const focusedIdRef = useRef(focusedId);
    useLayoutEffect(() => {
        focusedIdRef.current = focusedId;
    }, [focusedId]);

    // Fraction of the viewport height to lift the focused body by, so a panel
    // covering the lower screen (mobile sheet) never sits on top of it.
    // The scene drifts by itself unless told not to. Held in a ref because the
    // render loop reads it every frame and the scene effect must not re-run.
    const autoRotateRef = useRef(autoRotate);
    useLayoutEffect(() => { autoRotateRef.current = autoRotate; }, [autoRotate]);

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
        // A link can carry a camera. Applied before OrbitControls is built, so
        // the controls adopt it as their starting point rather than easing away
        // from the default the moment they initialise.
        if (initialCamera) {
            const { theta, phi, distance } = initialCamera;
            camera.position.setFromSphericalCoords(
                distance, THREE.MathUtils.degToRad(phi), THREE.MathUtils.degToRad(theta));
        }
        camera.lookAt(0, 0, 0);

        // ── Renderer ───────────────────────────────────────────────────────────
        const q = quality();
        const renderer = new THREE.WebGLRenderer({ antialias: q.antialias, alpha: true, premultipliedAlpha: false });
        renderer.setSize(w, h);
        renderer.setPixelRatio(pixelRatioFor(w, h));
        renderer.setClearColor(0x000000, 0);
        // Three only pins the WebGL context's drawing-buffer/unpack color space
        // when outputColorSpace is *assigned* — the constructor writes the field
        // directly and skips that step — so a renderer that never sets this
        // (this one, until now) leaves the browser's own default in place, and
        // Chrome and Safari do not reliably agree on it, particularly on a
        // wide-gamut (P3) display: identical shader output can composite a
        // noticeably different brightness in one than the other. Assigning the
        // otherwise-already-default value is what actually pins it.
        renderer.outputColorSpace = THREE.SRGBColorSpace;
        // A flat +30% exposure. LinearToneMapping is just "multiply the linear
        // scene colour by toneMappingExposure, then encode" — no filmic curve
        // to fight with — so it reads as a uniform brightness lift rather than
        // crushing contrast. Applies everywhere a material goes through three's
        // own shader chunks (every body, every ring, the sky, the glow layers);
        // Earth's day/night shader is raw GLSL with no `#include
        // <tonemapping_fragment>` and does not brighten with it.
        renderer.toneMapping = THREE.LinearToneMapping;
        renderer.toneMappingExposure = 1.3;
        // Shadow maps are the single most expensive thing here on a mobile GPU.
        // The analytic ring and moon shadows are shader maths and stay on.
        renderer.shadowMap.enabled = q.shadows;
        renderer.shadowMap.type    = THREE.PCFSoftShadowMap;
        mount.appendChild(renderer.domElement);
        renderer.domElement.setAttribute('role', 'img');
        renderer.domElement.setAttribute('aria-label', canvasLabelRef.current);

        // Mobile GPUs reclaim contexts under memory pressure. Without these the
        // canvas silently freezes on whatever frame it died on, with no way back
        // short of a manual reload.
        const onContextLost = (e) => {
            e.preventDefault();               // required for restore to ever fire
            cancelAnimationFrame(animId);
            console.warn('[P4RSEC] WebGL context lost — pausing render loop');
        };
        const onContextRestored = () => {
            console.warn('[P4RSEC] WebGL context restored');
            if (mounted) animate();
        };
        renderer.domElement.addEventListener('webglcontextlost', onContextLost);
        renderer.domElement.addEventListener('webglcontextrestored', onContextRestored);

        // ── OrbitControls ──────────────────────────────────────────────────────
        const controls = new OrbitControls(camera, renderer.domElement);
        controls.enableDamping = true;
        controls.enablePan     = false;
        // The idle drift is applied by hand each frame (yaw + pitch + roll,
        // see the "Idle camera drift" block below), not by OrbitControls'
        // one-axis autoRotate.
        controls.autoRotate = false;
        controls.minDistance   = 30;
        controls.maxDistance   = 1200;

        let isInteracting = false;
        controls.addEventListener('start', () => { isInteracting = true; });
        controls.addEventListener('end', () => { isInteracting = false; });

        // ── Exit-animation state (declared early so restore can pre-set them) ──
        let prevFocusedId          = null;
        let prevFocusedPlanetName  = null;
        // One continuous eased motion back to the sun, not two stitched
        // stages (a pull-back handing off to a separate fly-to-sun) — that
        // seam was the "split" reported. exitPhase is just on/off now;
        // exitProgress (0..1) drives both the camera and the target easing
        // together, the same shape utils/skyEntry.js's own approach uses.
        let exitPhase      = 0; // 0=normal  1=exiting
        let exitProgress   = 0;
        // How long the flight home takes. It was 1.6s, which read as a snap:
        // this motion is a recentring of the whole scene, not a nudge, and it
        // covers everything from a moon's own diameter to the width of the
        // Kuiper belt. 2.8s lets the eye follow the planet you left going
        // small rather than having it yanked away. The fly-in is deliberately
        // quicker (see focusFlySeconds) — going somewhere should feel eager,
        // coming back should feel like an exhale.
        const EXIT_SECONDS = 2.8;
        let exitStartDistance = 0;
        const exitStartCamPos = new THREE.Vector3();
        const exitStartTarget = new THREE.Vector3();
        const _exitDir        = new THREE.Vector3();
        const EXIT_ORIGIN     = new THREE.Vector3(0, 0, 0);
        // True while the pointer (or keyboard focus) is on a body — the drift
        // eases down to a crawl so the thing can be looked at.
        let hoverSlow = false;
        // How much of the idle motion is running, 1 down to 0. One factor for
        // all three axes: "held still" has to mean still. Gating only the yaw
        // spin once left the view rocking up and down on its own with the
        // button saying it had stopped.
        let driftEase = 1;
        // Eased hover slow-down (1 normally, DRIFT_HOVER_SLOW over a body).
        let driftScale = 1;
        const DRIFT_HOVER_SLOW = 0.12;
        // Which way the idle pitch pendulum is currently swinging (see
        // utils/driftControl.js's pitchPendulum, which owns the rule). Not
        // persisted: which half of a slow sway the scene happens to be in is
        // not a preference.
        let driftPitchDir = 1;
        // Scratch for the drift maths (see the "Idle camera drift" block).
        const _dOff = new THREE.Vector3();
        const _dUp = new THREE.Vector3();
        const _dBack = new THREE.Vector3();
        const _dRight = new THREE.Vector3();
        const _dLevelUp = new THREE.Vector3();
        const _dCross = new THREE.Vector3();
        const _dQ = new THREE.Quaternion();
        const _dTmpQ = new THREE.Quaternion();

        // ── Focus zoom-in animation state ──────────────────────────────────────
        let focusAnimating   = false;
        let focusProgress    = 0;
        // How long the current flight takes, in seconds — set when the flight
        // starts (see FOCUS_FLY_SECONDS below) and held fixed for its
        // duration, so toggling the scale stage mid-flight can't change the
        // pace out from under it.
        let focusFlySeconds  = 1.2;
        const focusStartCamPos  = new THREE.Vector3();
        const focusEndCamPos    = new THREE.Vector3();
        const _focusLookTarget  = new THREE.Vector3();
        const _camUpVec         = new THREE.Vector3();
        // The live, eased value behind focusOffsetRef — see where it is
        // applied for why the ref itself is not read directly.
        let vOffsetEased        = 0;
        // The camera's facing at each end of the flight — see the per-frame
        // update below for why this replaced lerping a look-at point through
        // raw 3D space.
        const focusStartQuat    = new THREE.Quaternion();
        const focusEndQuat      = new THREE.Quaternion();
        const _focusLookMat     = new THREE.Matrix4();
        const _focusGazeDir     = new THREE.Vector3();
        // Scratch for the fly-in's log-space distance easing — see its own
        // comment below for why a straight position lerp isn't enough once
        // true sizes are in play.
        const _focusStartOffset = new THREE.Vector3();
        const _focusEndOffset   = new THREE.Vector3();
        const _focusDir         = new THREE.Vector3();
        // Scratch for reading the camera's own bearing when a new focus
        // starts — see its own comment below for why that replaced the old
        // position-difference trick.
        const _focusApproachDir = new THREE.Vector3();

        // ── Sky-entry cinematic (/sky's approach) ─────────────────────────────
        // utils/skyEntry.js holds the cross-route phase; the actual camera work
        // has to live here, the one place with Earth's live matrixWorld. Armed
        // by AppShell.jsx before it navigates to /object/earth
        // (or immediately, if already there) — see the trigger check beside
        // "Detect focus changes" below for where phase 'armed' gets picked up.
        //
        // One continuous animation, not two stitched stages: closing in on
        // the observer's spot and swinging the view to face outward run off
        // a single progress value, rather than a full dive finishing before
        // a separate turn starts. A staged version of this shipped first and
        // read as two stitched clips with a seam between them. The turn is
        // eased across its own later-starting slice of that progress (see
        // SKY_TURN_START), which is a lag, not a seam — both are still
        // moving, and both still land together.
        let skyApproachAnimating = false;
        let skyApproachProgress  = 0;
        // How the dive is paced. The descent and the turn run off one
        // progress value but not one clock: sharing the curve outright (what
        // shipped first) swung the view off the planet while the camera was
        // still a long way out, so the surface never got close enough to read
        // as a descent and the shot spent its last second aimed at empty
        // space with Earth behind the camera. Holding the turn back until the
        // descent is under way keeps the ground in frame for the fall, and
        // starting the curtain before the motion ends means the frame empties
        // behind the fade instead of in front of it.
        const SKY_DIVE_SECONDS = 2.2;
        const SKY_TURN_START   = 0.38;
        // Fires where the view has just come up level with the horizon and
        // the ground still fills the bottom of the frame. The fade takes
        // roughly another fifth of the dive to reach opaque, which is
        // exactly the stretch where the ground drops away and the frame
        // would otherwise empty out in plain sight.
        const SKY_CURTAIN_AT   = 0.64;
        const SKY_ARRIVAL_SIN  = Math.sin(ARRIVAL_ALTITUDE * DEG2RAD);
        const SKY_ARRIVAL_COS  = Math.cos(ARRIVAL_ALTITUDE * DEG2RAD);
        const skyEaseInOut = (x) => (x < 0.5
            ? 4 * x * x * x
            : 1 - Math.pow(-2 * x + 2, 3) / 2);
        // True for the gap between the approach finishing and the route
        // actually changing (the curtain's fade-in + hold, SkyEntryCurtain.jsx's
        // FADE_MS + HOLD_MS). Once skyApproachAnimating drops there is nothing
        // left overriding the camera, so the very next frame OrbitControls'
        // own update() reclaims it — its minDistance is still the ordinary
        // "planet in frame" one, so it snaps the camera straight back out to
        // a wide Earth view for that whole gap before the curtain is opaque
        // enough to hide it. Holding position/quaternion fixed here is what
        // stops that.
        let skyHolding = false;
        const skyStartCamPos = new THREE.Vector3();
        const skyStartQuat   = new THREE.Quaternion();
        const skyEndQuat     = new THREE.Quaternion();
        const skyGroundPos   = new THREE.Vector3();
        const skyNormal      = new THREE.Vector3();
        const skyNorth       = new THREE.Vector3();
        const skyFarPoint    = new THREE.Vector3();
        const skyCamPoint    = new THREE.Vector3();
        const skyLookMat     = new THREE.Matrix4();
        const skyEarthQuat   = new THREE.Quaternion();
        const skyHoldCamPos  = new THREE.Vector3();
        const skyHoldQuat    = new THREE.Quaternion();
        const skyHoldTarget  = new THREE.Vector3();

        // ── Tracker hand-off (/satellites' arrival) ───────────────────────────
        // utils/trackerEntry.js holds the cross-route phase and the reasoning
        // for the whole sequence; this is the camera half. Armed by whichever
        // control asked for the tracker, which then navigates to /object/earth.
        //
        // The ordinary focus fly-in *is* the move. Rather than flying to Earth
        // and then correcting to the pose the tracker needs, the fly-in is
        // told where to land — the landing spot and the orientation to arrive
        // on are overridden where the focus block computes them, and Earth is
        // turned to face its own Sun across the same eased progress. So the
        // camera makes one continuous flight from wherever it was to a frame
        // the tracker's globe can be dissolved into, with no second beat and
        // nothing to hold on.
        //
        // The one case that cannot ride the fly-in is arming while already
        // focused on Earth, where there is no focus change to override. That
        // gets TRK_REFRAME_SECONDS of the same motion on its own.
        const TRK_REFRAME_SECONDS = 1.6;
        let trkFlyIn = false;      // the focus fly-in is carrying the hand-off
        let trkReframing = false;  // the already-on-Earth case, moving under its own power
        let trkHolding = false;    // same job as skyHolding — see its comment
        let trkProgress = 0;
        let trkStartDist = 0;
        const trkStartDir    = new THREE.Vector3();
        const trkStartUp     = new THREE.Vector3();
        const trkStartEarthQ = new THREE.Quaternion();
        const trkTargetEarthQ = new THREE.Quaternion();
        const trkEarthPos    = new THREE.Vector3();
        const trkLocalSun    = new THREE.Vector3();
        const trkWorldSun    = new THREE.Vector3();
        const trkCamPoint    = new THREE.Vector3();
        const trkUp          = new THREE.Vector3();
        const trkDir         = new THREE.Vector3();
        const trkDirUp       = new THREE.Vector3();
        const trkLookMat     = new THREE.Matrix4();
        const trkHoldCamPos  = new THREE.Vector3();
        const trkHoldQuat    = new THREE.Quaternion();
        const trkArcFull     = new THREE.Quaternion();
        const trkArcPart     = new THREE.Quaternion();
        const TRK_IDENTITY   = new THREE.Quaternion();
        const TRK_NORTH      = new THREE.Vector3(0, 1, 0);

        // Where the hand-off is aiming, in world space, for Earth drawn at
        // radius R right now. Both ends of the cut centre the real sub-solar
        // point; turning Earth so that point faces this scene's own Sun and
        // then placing the camera down the sun line is what makes the ground
        // at frame centre and the lighting match together rather than one at
        // the other's expense. Writes trkTargetEarthQ, trkCamPoint and trkUp.
        const trkSolvePose = (earthWorldPos, R) => {
            const ss = subsolar(new Date());
            latLonToVec3(ss.lat, ss.lon, 1, trkLocalSun);
            trkWorldSun.copy(earthWorldPos).negate().normalize();
            trkTargetEarthQ.setFromUnitVectors(trkLocalSun, trkWorldSun);
            trkCamPoint.copy(earthWorldPos)
                .addScaledVector(trkWorldSun, handoffDistance(camera.fov) * R);
            trkUp.copy(TRK_NORTH).applyQuaternion(trkTargetEarthQ);
        };

        // Pin the frame the cut is made on, capture it, and hand over. The
        // render here is deliberate and read back in the same synchronous
        // block: without preserveDrawingBuffer (which would cost every frame
        // of the app's life for one frame's use) the buffer is only reliably
        // readable until the task that drew it yields.
        const trkCapture = () => {
            trkHolding = true;
            trkHoldCamPos.copy(camera.position);
            trkHoldQuat.copy(camera.quaternion);
            let url = null;
            try {
                renderer.render(scene, camera);
                url = renderer.domElement.toDataURL('image/jpeg', 0.92);
            } catch {
                // A tainted or oversized canvas: the cut falls back to a
                // plain fade, which is a worse cut but not a broken one.
                url = null;
            }
            setTrackerSnapshot(url);
            setTrackerPhase(TRK_HANDOFF);
        };

        // ── Chase-camera state ────────────────────────────────────────────────
        // OrbitControls pins the camera in world space, so when the focused
        // body travels through time — a slider scrub, or the timeline's "back
        // to now" wind-back gliding the planets home — the camera would sit
        // still and watch the body slide out of frame. Each frame we shift the
        // camera by however far the body moved. Guarded by id so the jump when
        // focus first attaches isn't chased, and capped so a layout switch
        // (compressed ⇄ true distances) doesn't fling the camera across the
        // scene.
        let   focusFollowId     = null;
        const focusFollowPrev   = new THREE.Vector3();
        const _followDelta      = new THREE.Vector3();
        const FOCUS_FOLLOW_MAX_STEP = 150; // scene units per frame
        // Camera position captured at click time — guarantees start pos regardless of rAF timing
        let pendingFocusCamPos = null;

        // If React Router remounted this component while a planet was focused
        // (path="*" usually prevents this but isn't guaranteed), restore the camera
        // position so the exit animation plays from the correct starting point.
        if (!focusedId && _exitState.active) {
            camera.position.copy(_exitState.cameraPos);
            controls.target.copy(_exitState.targetPos);
            exitStartCamPos.copy(_exitState.cameraPos);
            exitStartTarget.copy(_exitState.targetPos);
            exitStartDistance = exitStartCamPos.distanceTo(exitStartTarget);
            camera.up.set(0, 1, 0); // see the other exit trigger's own comment on why
            exitPhase      = 1;
            exitProgress   = 0;
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

        // ── Orbit paths ───────────────────────────────────────────────────────
        // Drawn as pixel-width lines rather than tubes. A tube has a radius in
        // scene units, so how thick it looks depends on how far away the camera
        // is — fine at one camera distance, and at the six-times-further one
        // true distances asks for, a 0.28-unit tube renders about a tenth of a
        // pixel wide and disappears. The Voyager tracks stayed visible through
        // all of it precisely because they were plain lines.
        //
        // Line2 fixes that — its width is in pixels, so a ring holds its
        // weight at any camera distance — but it draws each segment as a
        // screen-space quad, and a thin translucent one is either hard-edged
        // or, with alphaToCoverage on, dithered into beads at 27% opacity.
        // Neither reads as cleanly as a tube, which is ordinary geometry the
        // renderer anti-aliases for free.
        //
        // So the tubes stay, and the width problem is solved by rebuilding
        // them: a ring's tube radius is set from how far the camera is, so
        // its width on screen stays put whatever the zoom or the layout. The
        // distance is quantised to octaves, which puts about nine rebuilds
        // across the whole range from a planet's surface to the Kuiper belt
        // rather than one per frame of a scroll — the apparent width wanders
        // between 0.71x and 1.41x of target in exchange, which is invisible.
        //
        // Scaling was the tempting shortcut and it does not work: scaling a
        // tube fattens the tube along with the path. That was the 2.0.0 bug,
        // where each ring scaled by its own radial factor and left Mercury's
        // at 0.217 units against Pluto's 2.59.
        //
        // The planets lead the hierarchy: their rings are the spine of the
        // picture, and the dwarf planets, asteroids and comets crossing them
        // are context. Everything used to be drawn at nearly the same weight,
        // which made the inner system a thicket.
        const TUBE_REF_DIST = 600;       // roughly the distance the scene opens at
        const PLANET_TUBE = 0.42;        // tube radius at TUBE_REF_DIST
        const MINOR_TUBE = 0.18;
        const MINOR_OPACITY = 0.45;      // of the planets' opacity

        /** Tube radius multiplier for a camera distance, quantised to octaves. */
        const tubeWeight = (dist) =>
            2 ** Math.round(Math.log2(Math.max(dist, 1) / TUBE_REF_DIST));

        const orbitLines = [];
        // Every orbit path that orbitAtRest()/orbitHovered() can touch —
        // planets' and small bodies' rings (both built by makeOrbitPath
        // below, and already in orbitLines) plus the Voyagers' flight
        // tracks (a plain THREE.Line, built separately, never added to
        // orbitLines — that array exists for the distance-based tube
        // rebuild, an unrelated concern). Read once a frame to ease
        // material.opacity/color toward whatever target those two
        // functions last set, rather than snapping to it — see their own
        // comment for why a snap reads as disorienting the moment
        // something is focused and every ring in the scene vanishes at once.
        const fadingOrbits = [];
        const ORBIT_FADE_RATE = 0.075; // ~90% of the way there in ~1.2s at 60fps (half the rate, ~2x the time)

        // Orbit trails (toggle): each planet's orbitLine.userData carries
        // { trailGeo, trailColor, orbitPointsBaseline } — see the "Orbit
        // trail" block below for how each is built, and updatePlanetPositions
        // for how they're refreshed. TRAIL_REACH static orbitPoints samples
        // behind the planet's live position, plus that live position itself
        // as the final vertex — see the trail's own update function for why
        // the live position isn't just "one more static sample".
        //
        // 5.5.2 drew these with three's Line2 to give them real width, and
        // 5.5.3 put them back to a hairline on request. The length that came
        // with it stays: 38 samples is ~15% of the 256-sample ellipse, against
        // the 24 (~9%) they shipped with. The sample stride Line2 needed is
        // gone with it — it existed only because overlapping fat-line quads
        // blend twice and bead, which a one-pixel line cannot do, and one
        // sample per point is the smoother curve.
        const TRAIL_REACH = 38;
        const TRAIL_OPACITY = 0.55;
        // Moon trails: the same idea one level down, drawn only for the moons
        // of whichever planet is focused. Built from moonOffset() sampled
        // backwards from the moon's live angle rather than from a baseline
        // point list the way a planet's is — a moon's path here *is* that
        // parametric circle, so there is nothing to search for a nearest
        // sample of, and the arc is exact at any true-size factor for free.
        //
        // A moon sweeps its whole orbit in seconds at MOON_SPEED, so this is
        // a span of the orbit rather than a count of samples: a fixed sample
        // count would draw a wildly different arc for Phobos (7.7h) than for
        // Iapetus (79d). Just over a quarter-turn reads as motion without
        // closing into something that looks like a ring.
        const MOON_TRAIL_REACH = 40;
        const MOON_TRAIL_SPAN = Math.PI * 0.55;
        const MOON_TRAIL_OPACITY = 0.6;
        // moon.name → { line, geo, mat, color }
        const moonTrails = new Map();
        // How much of the ring's normal resting opacity survives while
        // trails are on — a faint guide rather than a competing bright
        // line, so the colour-tinted trail is what actually reads. Not
        // applied on hover, which still shows the full bright highlight.
        const TRAIL_RING_DIM = 0.35;
        // How to rebuild each ring, kept beside the mesh rather than in its
        // userData: every caller assigns userData wholesale for the hover
        // state, and a spec stored there is silently wiped by the next line.
        // That is not a hypothetical — it is how the rings stopped rebuilding
        // the first time, and nothing about it is visible at the assignment.
        const ringSpecs = new WeakMap();
        const makeOrbitPath = (points, { tube, segments, color, opacity }) => {
            const geometry = buildOrbitTube(points, tube, segments);
            const material = new THREE.MeshBasicMaterial({
                color, transparent: true, opacity, depthWrite: false,
            });
            const mesh = new THREE.Mesh(geometry, material);
            ringSpecs.set(mesh, { points, tube, segments, scaledAt: 1, scaled: points });
            orbitLines.push(mesh);
            return mesh;
        };

        // Rebuilding sixteen tubes at once costs about 15 ms — one dropped
        // frame here, and several times that on a phone, four times over the
        // course of a long zoom. So they are queued and drained a few per
        // frame instead: the same work, spread thin enough to disappear. A
        // ring keeps its old width for the few frames before its turn comes,
        // which at these widths is not a thing you can see.
        const RINGS_PER_FRAME = 2;
        let ringQueue = [];
        const _tubeScratch = new THREE.Vector3();

        /** Queue every ring for a rebuild at a layout and a camera weight. */
        const queueRings = (t, weight) => {
            ringQueue = [];
            const add = (ring, factor) => { if (ring) ringQueue.push([ring, factor, weight]); };
            planetGroups.forEach(({ planet, orbitLine }) => add(orbitLine, planetFactor(planet, t)));
            smallBodyGroups.forEach(({ body, orbitLine }) =>
                add(orbitLine, 1 + (AU_UNITS / body.scale - 1) * t));
        };

        const drainRingQueue = () => {
            for (let i = 0; i < RINGS_PER_FRAME && ringQueue.length; i++) {
                const [ring, factor, weight] = ringQueue.shift();
                const spec = ringSpecs.get(ring);
                if (!spec) continue;
                // Only the camera moves most of the time, so the radial remap
                // is cached and an octave change costs the tube alone.
                if (spec.scaledAt !== factor) {
                    spec.scaled = spec.points.map(
                        pt => _tubeScratch.copy(pt).multiplyScalar(factor).clone());
                    spec.scaledAt = factor;
                }
                const next = buildOrbitTube(spec.scaled, spec.tube * weight, spec.segments);
                ring.geometry.dispose();
                ring.geometry = next;
                ring.visible = true;
            }
        };

        // ── How an orbit path reads at rest and under the pointer ─────────────
        // Every path in the scene goes through these two, so the planets'
        // rings, the small bodies' ellipses and the Voyagers' flight tracks
        // cannot drift apart: white and faint until you point at something,
        // then brighter and carrying that body's own colour.
        //
        // The colour each one moves to is decided when it is built and kept in
        // userData, because how far it goes differs by kind — a planet ring
        // takes a half-strength tint, which reads as "this ring is Saturn's"
        // without turning the ring into a second yellow object next to Saturn,
        // while a Voyager track goes the whole way to the craft's own colour,
        // since there is no body beside it to compete with.
        const ORBIT_WHITE = new THREE.Color(0xffffff);
        const orbitTint = (hex, amount = ORBIT_HOVER_TINT) =>
            new THREE.Color(0xffffff).lerp(new THREE.Color(hex), amount);

        // Both functions used to write straight to orbit.material — instant,
        // which read as fine for a single hovered ring but disorienting the
        // moment something is focused and every ring in the scene (sixteen
        // or more) vanishes on the same frame. They now only set a target;
        // the per-frame step below (see fadingOrbits) eases material toward
        // it, so a single hover and "everything just got focused" both read
        // as a deliberate fade rather than a snap, at the same shared rate.
        const orbitAtRest = (orbit) => {
            if (!orbit) return;
            const focused = focusedIdRef.current;
            // Focusing clears the paths out of the way, with one exception: a
            // probe's track is the thing worth looking at when you are looking
            // at the probe. Voyager 1 focused is otherwise a dot in an empty
            // field, with the fifty years that got it there switched off.
            const mine = !!focused && orbit.userData.ownerId === focused;
            const keep = mine && orbit.userData.keepOnFocus;
            if (focused && !keep) {
                orbit.userData.targetOpacity = 0;
                orbit.userData.targetColor.copy(orbit.userData.baseColor ?? ORBIT_WHITE);
            } else {
                // Dimmed at rest (not on hover — that's still the full
                // bright highlight) while trails are on, so the plain white
                // ring reads as a faint guide and the colour-tinted trail is
                // what actually draws the eye, rather than the two
                // competing at similar brightness.
                const dimForTrails = getTrailsOn() && orbit.userData.trailGeo;
                orbit.userData.targetOpacity = keep
                    ? (orbit.userData.hoverOpacity ?? ORBIT_HOVER_OPACITY)
                    : dimForTrails
                        ? (orbit.userData.baseOpacity ?? ORBIT_BASE_OPACITY) * TRAIL_RING_DIM
                        : (orbit.userData.baseOpacity ?? ORBIT_BASE_OPACITY);
                orbit.userData.targetColor.copy(
                    keep ? (orbit.userData.hoverColor ?? ORBIT_WHITE)
                         : (orbit.userData.baseColor ?? ORBIT_WHITE));
            }
            // Trail visibility is the opposite of the ring's: the
            // specifically-focused planet's own trail hides (it's what
            // you're looking straight at — its own recent path underfoot
            // isn't the point), while every *other* planet's trail stays
            // visible, unlike the ring, which hides for all of them the
            // moment anything is focused.
            if (orbit.userData.trailLine) {
                orbit.userData.trailLine.userData.targetOpacity =
                    (getTrailsOn() && !mine) ? TRAIL_OPACITY : 0;
            }
        };
        const orbitHovered = (orbit) => {
            if (!orbit || focusedIdRef.current) return;
            orbit.userData.targetOpacity = orbit.userData.hoverOpacity ?? ORBIT_HOVER_OPACITY;
            if (orbit.userData.hoverColor) orbit.userData.targetColor.copy(orbit.userData.hoverColor);
        };

        // ── Shared loader + texture list (declared early for sun texture) ──────
        // One manager behind every texture, so the loading screen is reporting
        // what the scene is actually fetching rather than a list kept in step
        // by hand. The STL asteroid models are deliberately not on it: they are
        // fetched when the browser is idle, long after the scene is usable, and
        // holding the screen up for them would be reporting a wait that is not
        // happening.
        __resetAssets();
        const loadingManager = new THREE.LoadingManager();
        // itemStart, not onStart. onStart fires once for the first item of a
        // batch and never again, so hooking it reported "0 of 1" for a scene
        // fetching fourteen textures. itemStart is the per-item call the
        // manager makes on every request.
        const managerItemStart = loadingManager.itemStart.bind(loadingManager);
        loadingManager.itemStart = (url) => { assetStarted(url); managerItemStart(url); };
        loadingManager.onProgress = (url) => assetFinished(url);
        loadingManager.onError = (url) => assetFinished(url, true);
        let texturesDrained = false;
        loadingManager.onLoad = () => { texturesDrained = true; };
        const loader   = new THREE.TextureLoader(loadingManager);
        const textures = [];

        // A texture only reaches the GPU the first time something using it is
        // actually drawn, and the upload — plus building its mipmaps — is a
        // stall. Left alone, that stall lands whenever a body first rotates
        // into view, so a phone hitches every few seconds for as long as it
        // takes the camera to sweep past all thirty-odd of them, and then runs
        // perfectly once they are all resident. That is the "laggy for a
        // minute, then fine" this fixes.
        //
        // So they are pushed to the GPU deliberately, a couple per frame, in
        // the order they were created. Everything is resident within a second
        // or two, thinly enough spread not to drop a frame, and nothing is left
        // to surprise the renderer later. `textures` already collects every one
        // of them for disposal, which makes it the list to walk.
        let uploadedUpTo = 0;
        const uploadSomeTextures = () => {
            for (let n = 0; n < 2 && uploadedUpTo < textures.length; n++) {
                const tex = textures[uploadedUpTo++];
                if (tex) renderer.initTexture(tex);
            }
        };

        // Painting those surfaces is the other half of the same problem, and it
        // was the half still running in one straight line. Thirty-odd moons and
        // small bodies each paint a canvas, and a second one for relief where
        // the tier allows it, which is a couple of seconds of solid main thread
        // before the first frame goes out at all.
        //
        // That block is what the loading screen has been working around since
        // 5.10.2. A compositor animation only runs on the compositor once the
        // main thread has committed it there, and nothing commits during a block
        // that begins before the first frame: the wordmark's scramble was never
        // promoted, so on a phone it stood still or came apart, and every theory
        // about why was tested from a laptop where the block is short enough not
        // to matter.
        //
        // So the painting is queued and drained a body per frame, alongside the
        // uploads. It is the same total work — the point is that the thread now
        // reaches a commit between each piece of it. A body waiting its turn is
        // a sphere in its own flat colour, which is already what it falls back
        // to when a texture request fails, and all of this is happening
        // underneath the loading screen in any case.
        const paintQueue = [];
        const paintSomeSurfaces = () => {
            // One, not two: each of these is tens of milliseconds on a phone,
            // and a frame that paints two of them has nothing left to give.
            const paint = paintQueue.shift();
            if (paint) paint();
        };

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
        const SUN_RADIUS = 12;
        const sunGeo = new THREE.SphereGeometry(SUN_RADIUS, 64, 64);
        // MeshBasicMaterial — self-luminous, not affected by scene lights
        const sunMat = new THREE.MeshBasicMaterial({ color: '#FFF4A0' });
        const sunMesh = new THREE.Mesh(sunGeo, sunMat);
        sunMesh.userData = { id: 'sun', name: 'Sun' };
        // Everything that makes up the Sun's disc hangs off one group so true
        // sizes can shrink the lot together — the sphere here, the glow shells
        // below. Its hitbox deliberately stays outside, for the same reason
        // the planets' do.
        const sunScale = new THREE.Group();
        sunScale.add(sunMesh);
        scene.add(sunScale);

        loader.load(texturePath('sun.jpg'), (tex) => {
            if (!mounted) { tex.dispose(); return; }
            // An ordinary sRGB photo, same as every other body's map — see the
            // sky sphere below for why this needs tagging explicitly.
            tex.colorSpace = THREE.SRGBColorSpace;
            textures.push(tex);
            sunMat.map   = tex;
            sunMat.color.set(0xffffff);
            sunMat.needsUpdate = true;
        });

        // ── Resource tracking (for cleanup) ────────────────────────────────────
        const geos     = [sunGeo];
        const mats     = [sunMat];

        // ── Milky Way skysphere ────────────────────────────────────────────────
        // Two gates decide whether there is one. The tier says phones never get
        // it (q.skyTexture === null): a full-screen backdrop is the worst case
        // for a mobile GPU's fill rate, and it is the one thing you are always
        // looking past. skyAllowed() then drops it for any touch device held
        // upright — a portrait tablet included — and hands it back when the
        // same device is turned sideways.
        //
        // Built on first use rather than up front, so a tablet that starts in
        // portrait never spends the download or the texture memory at all.
        // Radius the geometry is actually built at. True distances puts Voyager
        // 1/2 out around 165-170 AU — 16,000+ scene units at AU_UNITS=96 — so a
        // sphere sized for the compressed layout leaves the camera outside it,
        // BackSide-culled into a plain black void, the moment either probe is
        // focused with true distances on. SKY_TRUE_RADIUS is where it's scaled
        // out to instead (see the per-frame sync below); the geometry itself
        // stays at the smaller radius since a mesh scale is free and a second
        // sphere this size isn't.
        const SKY_RADIUS = 8000;
        const SKY_TRUE_RADIUS = 24000;
        let skySphere = null;
        const buildSky = () => {
            if (skySphere || !q.skyTexture || !mounted) return;
            const skyGeo = new THREE.SphereGeometry(SKY_RADIUS, q.skySegments, q.skySegments);
            const skyTex = loader.load('/textures/' + q.skyTexture);
            // The Milky Way plate is an ordinary sRGB photo. Without this flag
            // three treats its bytes as linear and re-encodes them on output —
            // the image comes out too bright — and, worse, it leaves WebGL's
            // UNPACK_COLORSPACE_CONVERSION at the browser default, so Safari on
            // a P3 Mac stretches it into the display gamut and Chrome does not:
            // the same texture looks blown-out in one browser and faint in the
            // other. Tagging it sRGB fixes the decode and pins both browsers to
            // the same result.
            skyTex.colorSpace = THREE.SRGBColorSpace;
            textures.push(skyTex);
            // The 50% dim is baked into the material color rather than done via
            // `transparent`/`opacity`, which would leave this sphere the only
            // translucent thing in the scene — its pixels would land in the
            // render target at ~50% alpha and get composited onto the page's
            // black background by the browser itself (renderer is `alpha: true,
            // premultipliedAlpha: false`). That non-premultiplied composite step
            // is an underspecified corner of the canvas/WebGL spec: Chrome and
            // Safari don't agree on whether it blends in linear light or on the
            // encoded sRGB bytes, and the two give visibly different brightness
            // for anything but alpha 0/1. Tinting the color and keeping the
            // material opaque does the blend inside three's own color-managed
            // pipeline instead, so there's nothing left for the browser to
            // disagree about.
            const skyMat = new THREE.MeshBasicMaterial({
                map:   skyTex,
                color: 0x808080,
                side:  THREE.BackSide,
            });
            geos.push(skyGeo);
            mats.push(skyMat);
            skySphere = new THREE.Mesh(skyGeo, skyMat);
            scene.add(skySphere);
        };
        const syncSky = () => {
            if (!q.skyTexture) return;
            if (!skyAllowed()) { if (skySphere) skySphere.visible = false; return; }
            buildSky();
            if (skySphere) skySphere.visible = true;
        };
        const orientationMQ = window.matchMedia?.('(orientation: portrait)') ?? null;
        orientationMQ?.addEventListener('change', syncSky);
        syncSky();

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
            sunScale.add(new THREE.Mesh(geo, mat));
            geos.push(geo);
            mats.push(mat);
        });

        // The Sun's own click target. At true sizes it is 0.45 units across
        // against an orbit of 96, so without this there is nothing left to
        // aim at — sizeHitboxes() below holds it at a constant angular size
        // the same way it does every planet's.
        const sunHitGeo  = new THREE.SphereGeometry(SUN_RADIUS, 8, 8);
        const sunHitMat  = new THREE.MeshBasicMaterial({ transparent: true, opacity: 0, depthWrite: false });
        const sunHitMesh = new THREE.Mesh(sunHitGeo, sunHitMat);
        sunHitMesh.userData = sunMesh.userData;   // shared reference — same id and name
        scene.add(sunHitMesh);
        geos.push(sunHitGeo);
        mats.push(sunHitMat);

        // Camera glare. Lensflare hides itself when its anchor's depth loses
        // to what is already in the depth buffer — that is how a planet
        // crossing in front of the Sun snuffs the flare out. It is also why
        // the anchor can't sit at the Sun's centre: the Sun's own facing
        // hemisphere is nearer than its centre, so it would occlude the
        // flare from every angle and nothing would ever show. The anchor
        // instead rides just off the Sun's surface on the camera's side
        // (moved in the render loop) — still on the camera-to-centre line,
        // so it projects to the same pixel, just no longer behind the Sun's
        // own skin.
        const sunFlare = q.lensFlare ? createSunLensflare() : null;
        const flareAnchor = new THREE.Object3D();
        if (sunFlare) {
            flareAnchor.add(sunFlare);
            scene.add(flareAnchor);
        }

        const planetMeshes    = [sunMesh, sunHitMesh];  // raycaster targets
        const planetGroups    = [];         // for position refresh
        const planetMeshRefs  = new Map();  // name → group, for moon positioning
        const planetHitboxRefs  = new Map(); // planet.name → hitbox mesh
        const smallBodyHitRefs  = new Map(); // body.id → hitbox mesh
        const smallBodyHitRadii = new Map(); // body.id → hitbox geometry radius
        const smallBodyMeshRefs = new Map(); // body.id → visual mesh (for true sizes)
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
            const orbitPoints = buildOrbitPoints(planet.name, planet.orbitR);
            const orbitLine = makeOrbitPath(orbitPoints, {
                tube: PLANET_TUBE, segments: 256,
                color: 0xffffff, opacity: ORBIT_BASE_OPACITY,
            });
            orbitLine.userData = {
                baseOpacity: ORBIT_BASE_OPACITY, hoverOpacity: ORBIT_HOVER_OPACITY,
                baseColor: ORBIT_WHITE, hoverColor: orbitTint(planet.color),
                targetOpacity: ORBIT_BASE_OPACITY, targetColor: ORBIT_WHITE.clone(),
            };
            fadingOrbits.push(orbitLine);
            const orbitGeo = orbitLine.geometry;
            const orbitMat = orbitLine.material;

            scene.add(orbitLine);
            geos.push(orbitGeo);
            mats.push(orbitMat);

            // ── Orbit trail (toggle) ─────────────────────────────────────────
            // A short arc of the same baseline orbitPoints, immediately behind
            // the planet's live position, tinted the same half-strength colour
            // as the hovered orbit ring (orbitLine.userData.hoverColor, reused
            // directly rather than a second orbitTint() call). Rebuilt from
            // orbitPoints — a fixed 256-point sample of the whole ellipse,
            // already scaled to the compressed-layout baseline — rather than
            // from a recorded position history, so the trail is instantly the
            // right shape the moment the toggle turns on instead of growing in
            // from nothing over real time. The taper is colour only, not
            // width: plain WebGL lines are always 1px, and this codebase has
            // now tried fat lines three times — the gravity-field overlay
            // (4.3.0, reverted in 4.3.1), the orbit rings (which are tubes
            // for it), and these trails (5.5.2, reverted in 5.5.3) — so a
            // fading hairline against the black background is where this
            // lands for good.
            const trailPositions = new Float32Array((TRAIL_REACH + 1) * 3);
            const trailColors = new Float32Array((TRAIL_REACH + 1) * 3);
            const trailGeo = new THREE.BufferGeometry();
            trailGeo.setAttribute('position', new THREE.BufferAttribute(trailPositions, 3).setUsage(THREE.DynamicDrawUsage));
            trailGeo.setAttribute('color', new THREE.BufferAttribute(trailColors, 3).setUsage(THREE.DynamicDrawUsage));
            const trailMat = new THREE.LineBasicMaterial({
                vertexColors: true, transparent: true, opacity: 0, depthWrite: false,
            });
            const trailLine = new THREE.Line(trailGeo, trailMat);
            // Same reason the belts and the probe tracks skip culling: the
            // geometry is rewritten from the render loop, so the bounding
            // sphere three computed on first sight — from a buffer that was
            // still all zeros — would have an outer planet's trail culled
            // whenever the origin left the frame.
            trailLine.frustumCulled = false;
            // The trail's own colour ramp is already baked per vertex; the
            // fade-on-toggle below only ever eases material.opacity, so its
            // colour target is plain white — anything else would retint an
            // already-tinted trail.
            trailLine.userData = { targetOpacity: 0, targetColor: new THREE.Color(0xffffff) };
            fadingOrbits.push(trailLine);
            scene.add(trailLine);
            geos.push(trailGeo);
            mats.push(trailMat);
            // Stashed on the *ring's* userData, not a parallel array keyed by
            // index — planetGroups and any such array are only ever built in
            // the same PLANETS.forEach pass, but keying through orbitLine
            // (already carried per-planet on each planetGroups entry) means
            // there's no index-alignment to keep correct by hand at all.
            orbitLine.userData.trailGeo = trailGeo;
            orbitLine.userData.trailColor = orbitLine.userData.hoverColor;
            orbitLine.userData.orbitPointsBaseline = orbitPoints;
            orbitLine.userData.trailLine = trailLine;
            // Not read by orbitAtRest's own mine/keep check (which is
            // {ownerId, keepOnFocus} together, the probes' own exception) —
            // read directly, on its own, by the trail-visibility rule below:
            // the focused planet's trail hides while every other planet's
            // stays visible, the opposite of "everything hides on any focus"
            // the ring itself follows.
            orbitLine.userData.ownerId = planet.id;
            // Both this ring's own dimming and the trail's own visibility
            // are otherwise only ever set from inside orbitAtRest, called
            // on a hover, a focus change, or the trails toggle — never once
            // at plain startup. That was invisible while trails defaulted
            // off (an un-dimmed ring and an invisible, target-opacity-0
            // trail both look identical to "trails not built yet"), but
            // trails now default on, so a fresh load needs this call to
            // establish the correct starting state instead of waiting for
            // the first hover/focus/toggle to happen to fix it.
            orbitAtRest(orbitLine);

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

            // Group: sphere + optional rings move together on position update.
            // `bodyScale` sits between the two so true sizes can resize the
            // body and its rings as one piece — the hitbox hangs off `group`
            // instead, because a planet that has shrunk to a speck still has
            // to be clickable.
            const group = new THREE.Group();
            const bodyScale = new THREE.Group();
            group.add(bodyScale);
            bodyScale.add(mesh);

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
                        tex.colorSpace = THREE.SRGBColorSpace;
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
                bodyScale.add(sRing);
                geos.push(sRingGeo);
                mats.push(sRingMat);

                loader.load(
                    texturePath('saturn_ring.png'),
                    (tex) => {
                        if (!mounted) { tex.dispose(); return; }
                        tex.colorSpace = THREE.SRGBColorSpace;
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
                bodyScale.add(jRing);
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
                    bodyScale.add(uRingMesh);
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
                    bodyScale.add(nRingMesh);
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
            planetGroups.push({ group, bodyScale, planet, orbitLine });
        });

        // ── Belt orientation ───────────────────────────────────────────────────
        // Derive the ecliptic plane normal from two Mars HelioVector samples
        // 90 days apart. The cross product of the two unit-direction vectors
        // gives the exact orbital plane normal in scene-space, so both belts
        // align with the same plane the planet orbit rings live in.
        const beltQuat = eclipticQuaternion();

        // ── Gravity overlays (warped grid / field lines) ───────────────────────
        // Both read one array — `_gravBodies` — rebuilt in place each frame from
        // the live scene (collectGravityBodies below). Neither recomputes an
        // orbit. The grid is entirely shader work; the field lines are a CPU
        // trace, retraced only when the planets have moved enough to matter.
        const GRAV_GRID_EXTENT      = 480;    // half-width of the sheet, compressed layout
        const GRAV_GRID_EXTENT_TRUE = 4200;   // …eased toward this at true distances (holds Pluto)
        const GRAV_FIELD_BOUNDS      = 520;   // streamlines terminate past this radius
        const GRAV_FIELD_BOUNDS_TRUE = 5200;
        const GRAV_RETRACE_MOVE = 2.5;        // scene units a body must shift to force a retrace
        // Never retrace more often than every N frames. Bumped automatically
        // when a retrace runs long (a slow CPU under a fast sim-time rate), so
        // the trace can never eat more than roughly a third of the frame.
        let gravRetraceFrames = q.tier === 'low' ? 2 : 1;

        const gravGrid  = makeGravityGrid({
            // Finer well geometry than the old whole-sheet needed (the windowed
            // mask, 4.4.0, means far fewer fragments to shade). `cells` is only
            // a touch above the old 96 — a first denser pass at 168 was too
            // busy — but it now holds that world-size out to true distances
            // (see update()).
            segments: q.tier === 'low' ? 128 : 256,
            halfExtent: GRAV_GRID_EXTENT,
            halfExtentTrue: GRAV_GRID_EXTENT_TRUE,
            cells: 90,
            orientation: beltQuat,
        });
        const gravLines = makeGravityLines();
        scene.add(gravGrid.mesh, gravLines.object);

        // Opt-in retrace/frame logging: `localStorage['p4rsec.gravperf'] = '1'`.
        const gravPerfLog = (() => {
            try { return window.localStorage.getItem('p4rsec.gravperf') === '1'; }
            catch { return false; }
        })();

        const _gravBodies = GRAVITY_BODIES.map(b => ({
            id: b.id,
            color: b.color,   // the body's own tint, for its field lines
            // The phone tier thins the streamlines hard: the trace is on the
            // CPU, the screen is small, and the full count is ~390 lines.
            weights: q.tier === 'low'
                ? { ...b.weights, lineCount: Math.max(4, Math.round(b.weights.lineCount * 0.34)) }
                : b.weights,
            pos: new THREE.Vector3(),
            expansion: 1,        // radial spread in the current layout; drives the outer-planet distance term
            wellScale: 1,        // Sun-only grid-well depth multiplier — grows with the layout
            wellScaleRadius: 1,  // …and its gentler radius multiplier
        }));
        const _gravPlanetById = new Map(planetGroups.map(g => [g.planet.id, g]));
        const collectGravityBodies = (scaleT) => {
            for (const gb of _gravBodies) {
                if (gb.id === 'sun') {
                    gb.pos.set(0, 0, 0);
                    gb.expansion = 1;
                    gb.wellScale = 1 + (WEIGHT_CONFIG.sunWellTrueScale - 1) * scaleT;
                    gb.wellScaleRadius = 1 + (WEIGHT_CONFIG.sunWellTrueScaleRadius - 1) * scaleT;
                    continue;
                }
                const pg = _gravPlanetById.get(gb.id);
                if (!pg) continue;
                gb.pos.copy(pg.group.position);
                gb.expansion = radialFactor(pg.planet.orbitR, pg.planet.au, scaleT);
            }
            return _gravBodies;
        };

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
            // lod/, not the full-resolution files beside them. The belt puts
            // 2,400 of these on screen at once, a pixel or two across, and at
            // full resolution that was 16.7 million triangles a frame — 97.5%
            // of everything the scene drew, and enough to hold a desktop at
            // exactly half its refresh rate for as long as the page was open.
            // The decimated set is 919,520. The originals stay where they are
            // because three of them are also named bodies you can fly to.
            const loadSTL = (key) => new Promise((resolve, reject) => {
                loader.load(`/models/asteroids/lod/${key}.stl`,
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
                    abMesh.userData.belt = 'asteroid';
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
                    kbMesh.userData.belt = 'kuiper';
                    beltLODInstances.push(kbMesh);
                });
                // These meshes arrive whenever their STLs finish downloading,
                // which may be long after a layout change has come and gone.
                // Forcing the next frame to re-apply the layout places them,
                // rather than leaving them at compressed radii while the
                // particle clouds they replace are already hidden.
                lastScaleT = -1;
            }).catch(err => console.warn('Belt LOD STL load failed:', err));
        }

        // ── Small bodies: dwarf planets, asteroids, comet ─────────────────────
        const smallBodyGroups = [];
        let halleyGroupRef = null; // for per-frame coma orientation

        SMALL_BODIES.forEach(body => {
            // True-distance-aware from the start, the same factor the
            // per-frame update below (smallBodyGroups.forEach) applies —
            // matters because the per-frame update runs *after* this in the
            // same file, and so after the block that reads a freshly-focused
            // body's position to aim a fly-in at it. A direct link straight
            // onto a small body's page used to focus on wherever this
            // creation-time position was; left compressed, that is nowhere
            // close to the true-distance position every later frame settles
            // on, and the fly-in landed at a point already tens of units from
            // where the body actually was by the time it got there — which
            // is a focus on nothing, not a small one. Planets sidestep this
            // because their own creation-time placement gets a forced
            // same-frame correction (lastScaleT starts at -1 specifically to
            // trigger one); this gives small bodies the same true-distance
            // starting position outright instead of relying on catching up.
            const f0   = 1 + (AU_UNITS / body.scale - 1) * scaleProgress();
            const rawP = keplerianScenePos(body.el, body.scale * f0);
            const pv   = new THREE.Vector3(rawP.x, rawP.y, rawP.z).applyQuaternion(beltQuat);
            const p    = { x: pv.x, y: pv.y, z: pv.z };

            // Orbit ring — true keplerian ellipse, thinner tube than planets
            const orbitPts = buildKeplerOrbitPoints(body.el, body.scale, body.isComet ? 512 : 360)
                .map(pt => pt.applyQuaternion(beltQuat));

            const orbitLine = makeOrbitPath(orbitPts, {
                tube: MINOR_TUBE, segments: body.isComet ? 384 : 256,
                color: 0xffffff, opacity: ORBIT_BASE_OPACITY * MINOR_OPACITY,
            });
            orbitLine.userData = {
                baseOpacity: ORBIT_BASE_OPACITY * MINOR_OPACITY,
                hoverOpacity: ORBIT_HOVER_OPACITY,
                baseColor: ORBIT_WHITE, hoverColor: orbitTint(body.color),
                targetOpacity: ORBIT_BASE_OPACITY * MINOR_OPACITY, targetColor: ORBIT_WHITE.clone(),
            };
            fadingOrbits.push(orbitLine);
            const orbitGeo = orbitLine.geometry;
            const orbitMat = orbitLine.material;
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

            // Painted surface. A body that is about to have its sphere replaced
            // by STL geometry is skipped — that geometry carries no UVs, so a
            // map can't apply to it and its shape does the work instead. Vesta
            // only qualifies where its 1.9 MB model is actually loaded; on the
            // phone tier it stays a sphere, and a sphere with no map is a flat
            // disc of colour.
            const keepsSphere = body.id !== 'halley' && !(body.id === 'vesta' && q.heavyModels);
            if (keepsSphere) {
                const icy = ['haumea', 'makemake', 'eris'].includes(body.id);
                // Queued rather than painted here — see paintSomeSurfaces. The
                // needsUpdate is new with the queue: the material has already
                // been compiled by the time this runs, so a map handed to it
                // now needs the program rebuilt, exactly as the painted
                // fallback on the planets has always had to do.
                paintQueue.push(() => {
                    if (!mounted) return;
                    const surf = proceduralSurface(body.id, body.color, icy ? 'icy' : 'rocky');
                    textures.push(surf.map);
                    mat.map = surf.map;
                    mat.color.set(0xffffff);
                    if (surf.bumpMap) {
                        textures.push(surf.bumpMap);
                        mat.bumpMap = surf.bumpMap;
                        mat.bumpScale = surf.bumpScale;
                    }
                    mat.needsUpdate = true;
                });
            }

            // STL model for Vesta — 1.9 MB, and a couple of pixels across from
            // the home view, so the phone tier keeps the painted sphere.
            if (body.id === 'vesta' && q.heavyModels) {
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
            // a similar peanut shape to Halley's imaged nucleus. Small enough to
            // ship to every tier, but it waits its turn like the others rather
            // than competing with the textures that make up the first frame.
            if (body.id === 'halley') {
                whenIdle(() => { if (!mounted) return; new STLLoader().load(
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
                ); });
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
            smallBodyMeshRefs.set(body.id, mesh);

            smallBodyGroups.push({ group, body, orbitLine });
        });


        // ── Interstellar probes ───────────────────────────────────────────────
        // Voyager 1 and 2, at their real positions. They are metres across and
        // over a hundred AU out, so there is nothing to model — what matters is
        // where they are and which way they went. Each gets a small emissive
        // marker with an additive halo (so it stays visible at that distance)
        // and a faint line back to the Sun showing the direction of travel.
        const probeGroups = [];
        PROBES.forEach(probe => {
            const group = new THREE.Group();

            const coreGeo = new THREE.SphereGeometry(1.0, 12, 12);
            const coreMat = new THREE.MeshBasicMaterial({ color: probe.color });
            const core = new THREE.Mesh(coreGeo, coreMat);
            // orbitLine is filled in below, once the track exists — the hover
            // handler reads it off whatever it hits, so a probe joins the same
            // machinery the planets use rather than needing its own.
            core.userData = { id: probe.id, name: probe.name, orbitLine: null };
            group.add(core);
            geos.push(coreGeo); mats.push(coreMat);

            const haloGeo = new THREE.SphereGeometry(3.0, 12, 12);
            const haloMat = new THREE.MeshBasicMaterial({
                color: probe.color, transparent: true, opacity: 0.28,
                blending: THREE.AdditiveBlending, depthWrite: false,
            });
            group.add(new THREE.Mesh(haloGeo, haloMat));
            geos.push(haloGeo); mats.push(haloMat);

            // Position it now, not on the first animate frame. Focus detection
            // runs before the per-frame probe update, so a group still sitting at
            // the origin would send the camera flying to the Sun instead.
            const here = probeScenePos(probe, new Date());
            group.position.set(here.x, here.y, here.z);
            scene.add(group);

            // The path it actually flew, from the baked Horizons ephemeris. It
            // starts where Earth was on launch day in 1977 and stays there:
            // this used to be a straight line redrawn from wherever Earth is
            // today, which made the spacecraft look as though it had set off
            // from a different place every few weeks.
            //
            // Every bend in it is a real gravity assist — Jupiter and Saturn
            // for both craft, then Uranus and Neptune for Voyager 2, which is
            // why only its track stays down near the plane of the planets as
            // far as Neptune while Voyager 1 climbs away after Saturn.
            //
            // The geometry is built once and never rewritten. Only how much of
            // it is drawn moves with the clock, plus the last vertex, which is
            // pinned to the marker so the line always ends exactly at the craft.
            const trackPts = buildProbeTrack(probe.id);
            const trackGeo = new THREE.BufferGeometry();
            const trackArr = new Float32Array((trackPts.length + 1) * 3);
            trackPts.forEach((v, i) => {
                trackArr[i * 3] = v.x; trackArr[i * 3 + 1] = v.y; trackArr[i * 3 + 2] = v.z;
            });
            trackGeo.setAttribute('position', new THREE.BufferAttribute(trackArr, 3));
            trackGeo.setDrawRange(0, 0);
            // Drawn like every other orbit path: white and faint until you
            // point at the craft, then bright and in its own colour. It used to
            // sit permanently coloured at its own opacity, which made it the
            // one path in the scene that did not answer to the pointer.
            const trackMat = new THREE.LineBasicMaterial({
                color: 0xffffff, transparent: true,
                opacity: ORBIT_BASE_OPACITY * MINOR_OPACITY, depthWrite: false,
            });
            const track = new THREE.Line(trackGeo, trackMat);
            track.userData = {
                baseOpacity: ORBIT_BASE_OPACITY * MINOR_OPACITY,
                hoverOpacity: ORBIT_HOVER_OPACITY,
                baseColor: ORBIT_WHITE,
                // All the way to the craft's colour, not the half-tint a planet
                // ring takes — out here there is no body beside it to compete.
                hoverColor: orbitTint(probe.color, 1),
                // Which probe this belongs to, so focusing that probe keeps it.
                ownerId: probe.id,
                keepOnFocus: true,
                targetOpacity: ORBIT_BASE_OPACITY * MINOR_OPACITY, targetColor: ORBIT_WHITE.clone(),
            };
            // The path runs far outside anything else in the scene, so leave it
            // out of frustum culling rather than have three.js compute a bound
            // that spans the whole solar system for it.
            track.frustumCulled = false;
            scene.add(track);
            fadingOrbits.push(track);
            geos.push(trackGeo); mats.push(trackMat);

            // Generous hitbox — the marker itself is a few pixels from anywhere
            // you would realistically be looking at it from
            const hitGeo = new THREE.SphereGeometry(16, 8, 8);
            const hitMat = new THREE.MeshBasicMaterial({ transparent: true, opacity: 0, depthWrite: false });
            const hitMesh = new THREE.Mesh(hitGeo, hitMat);
            hitMesh.userData = { id: probe.id, name: probe.name, orbitLine: track };
            core.userData.orbitLine = track;
            group.add(hitMesh);
            geos.push(hitGeo); mats.push(hitMat);

            planetMeshes.push(core, hitMesh);
            probeGroups.push({ group, track, probe, trackCount: trackPts.length, hit: hitMesh });
        });

        // ── Moon meshes (MOON_DATA) ────────────────────────────────────────────
        let issOrbitMat  = null; // fades in/out with Earth focus
        let issOrbitLine = null; // its geometry is a fixed moon.orbitR circle — see the true-sizes scaling below
        let issMoonData  = null; // the MOON_DATA entry itself, for moonOrbitFactor()
        let issRingMesh  = null; // billboard selection ring at ISS position
        let issRingMat   = null;
        // Assigned when the ISS mesh is built. The phone tier holds it back and
        // the animate loop calls it if you actually fly there — see below.
        let loadIssModel = null;

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

            // ── Moon trail ────────────────────────────────────────────────
            // World-space like the moon mesh itself (both are added to the
            // scene and positioned absolutely, rather than parented to the
            // planet), so the trail is written as parent position + offset
            // every frame exactly the way the moon's own position is.
            const mTrailPos = new Float32Array((MOON_TRAIL_REACH + 1) * 3);
            const mTrailCol = new Float32Array((MOON_TRAIL_REACH + 1) * 3);
            const mTrailGeo = new THREE.BufferGeometry();
            mTrailGeo.setAttribute('position', new THREE.BufferAttribute(mTrailPos, 3).setUsage(THREE.DynamicDrawUsage));
            mTrailGeo.setAttribute('color', new THREE.BufferAttribute(mTrailCol, 3).setUsage(THREE.DynamicDrawUsage));
            const mTrailMat = new THREE.LineBasicMaterial({
                vertexColors: true, transparent: true, opacity: 0, depthWrite: false,
            });
            const mTrailLine = new THREE.Line(mTrailGeo, mTrailMat);
            // Same reason as the planet trails: the buffer is rewritten from
            // the render loop, so the bounding sphere three computes on first
            // sight — from an all-zero buffer at the origin — would cull the
            // trail the moment the Sun left the frame, which focusing a
            // planet is precisely the case that does that.
            mTrailLine.frustumCulled = false;
            mTrailLine.visible = false;
            scene.add(mTrailLine);
            geos.push(mTrailGeo);
            mats.push(mTrailMat);
            moonTrails.set(moon.name, {
                line: mTrailLine, geo: mTrailGeo, mat: mTrailMat,
                color: new THREE.Color(moon.color),
            });

            if (moon.id && MOON_TEXTURES[moon.id]) {
                loader.load(texturePath(MOON_TEXTURES[moon.id]), (tex) => {
                    if (!mounted) { tex.dispose(); return; }
                    tex.colorSpace = THREE.SRGBColorSpace;
                    textures.push(tex);
                    moonMat.map = tex;
                    moonMat.color.set(0xffffff);
                    moonMat.emissiveIntensity = 0;
                    moonMat.needsUpdate = true;
                });
            } else if (moon.id !== 'iss') {
                // Painted surface (ISS is excluded — its sphere becomes the STL model).
                // Icy moons keep a faint self-glow so they stay readable against space.
                // Queued rather than painted here — see paintSomeSurfaces. The
                // moons are the bulk of that queue: thirty of them, and they
                // were the bulk of the block.
                const icy = ['europa', 'enceladus', 'triton', 'titan'].includes(moon.id);
                paintQueue.push(() => {
                    if (!mounted) return;
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
                    // smoother finish to catch the light. Part of the painted
                    // surface, so it arrives with it rather than before it.
                    moonMat.emissiveIntensity = icy ? 0.10 : 0.03;
                    if (icy) moonMat.roughness = 0.72;
                    moonMat.needsUpdate = true;
                });
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
                // Replace sphere with STL model. At 2.8 MB this is the largest
                // single file the site has, and from the home view the station
                // is one pixel beside Earth — so the phone tier does not fetch
                // it up front. A sphere is the wrong shape for the ISS, though,
                // so unlike Vesta it is not dropped outright: flying to the
                // station loads it then.
                let issModelRequested = false;
                loadIssModel = () => {
                    if (issModelRequested || !mounted) return;
                    issModelRequested = true;
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
                };
                if (q.heavyModels) whenIdle(() => loadIssModel());

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
                issOrbitLine = new THREE.LineLoop(orbitLineGeo, issOrbitMat);
                issMoonData = moon;
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

        // Planet positions come from an ephemeris call per planet, which is far
        // too costly to run every frame at real time — a minute's refresh is
        // imperceptible when a year takes a year. Once the clock is scrubbing,
        // though, the planets are the whole point, so the animate loop takes
        // over (see updatePlanetPositions below).
        // Every position in the scene is a direction times a radius, so moving
        // between the compressed layout and true distances is a matter of which
        // radius — no geometry is rebuilt for it, and a body, its orbit ring and
        // its share of a belt all travel together because they share the factor.
        const planetFactor = (planet, t) => radialFactor(planet.orbitR, planet.au, t);

        // Nearest static orbitPoints sample to the planet's just-computed
        // live position, then TRAIL_REACH samples immediately before it
        // (wrapping past index 0 if needed) scaled up to the same factor,
        // plus the live position itself as the final vertex — a static
        // sample can be a hair off the real position at this factor, and the
        // trail's head should touch the body exactly, not almost. Skipped
        // entirely, cheaply, whenever the toggle is off.
        const updateTrail = (orbitLine, worldPos, factor) => {
            const { trailGeo, trailColor, orbitPointsBaseline: pts } = orbitLine.userData;
            const n = pts.length;
            let bestI = 0, bestD = Infinity;
            for (let i = 0; i < n; i++) {
                const s = pts[i];
                const dx = s.x * factor - worldPos.x;
                const dy = s.y * factor - worldPos.y;
                const dz = s.z * factor - worldPos.z;
                const d = dx * dx + dy * dy + dz * dz;
                if (d < bestD) { bestD = d; bestI = i; }
            }
            const posAttr = trailGeo.attributes.position;
            const colorAttr = trailGeo.attributes.color;
            for (let k = 0; k < TRAIL_REACH; k++) {
                const idx = ((bestI - (TRAIL_REACH - k)) % n + n) % n;
                const s = pts[idx];
                posAttr.setXYZ(k, s.x * factor, s.y * factor, s.z * factor);
                // Quadratic, not linear: a gentle taper-off near the tail
                // rather than an even ramp, closer to how a real comet tail
                // or motion trail reads.
                const fade = k / TRAIL_REACH;
                const eased = fade * fade;
                colorAttr.setXYZ(k, trailColor.r * eased, trailColor.g * eased, trailColor.b * eased);
            }
            posAttr.setXYZ(TRAIL_REACH, worldPos.x, worldPos.y, worldPos.z);
            colorAttr.setXYZ(TRAIL_REACH, trailColor.r, trailColor.g, trailColor.b);
            posAttr.needsUpdate = true;
            colorAttr.needsUpdate = true;
        };

        const updatePlanetPositions = (date, t = scaleProgress()) => {
            const trailsOn = getTrailsOn();
            planetGroups.forEach(({ group, planet, orbitLine }) => {
                const f = planetFactor(planet, t);
                const p = computePlanetPos(planet.name, planet.orbitR * f, date);
                group.position.set(p.x, p.y, p.z);
                if (trailsOn) updateTrail(orbitLine, p, f);
            });
        };
        const posInterval = setInterval(() => {
            if (mounted && isLive()) updatePlanetPositions(new Date());
        }, 60000);
        const unsubTrails = subscribeTrails(() => {
            // Routed through orbitAtRest, the same function focus changes
            // already call, rather than a blanket on/off here — the correct
            // opacity for a given planet's trail depends on whether *that*
            // planet is the focused one too (see orbitAtRest's own trail
            // rule), not just on the toggle.
            planetGroups.forEach(({ orbitLine }) => orbitAtRest(orbitLine));
            // updateTrail only ever runs from inside updatePlanetPositions,
            // which otherwise only fires on the minute interval (while live)
            // or while actively scrubbing — so turning the toggle on while
            // paused on a still frame would leave every trail geometry at
            // its untouched, all-zero initial buffer until one of those
            // happened to fire next. Force one immediate pass right on the flip.
            if (getTrailsOn()) updatePlanetPositions(new Date(simNow()));
        });

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
                    orbitAtRest(activeOrbit);
                    orbitHovered(orbit);
                    activeOrbit = orbit ?? null;
                }

                renderer.domElement.style.cursor = hitMesh.userData.id ? 'pointer' : '';
                // Track moon hover for orbital speed slow-down
                hoveredMoonId = (focusedIdRef.current && MOON_DATA.some(m => m.id === hitMesh.userData.id))
                    ? hitMesh.userData.id : null;
                // Ease the drift down only in home view (focused mode has none)
                if (!focusedIdRef.current) hoverSlow = true;
            } else {
                if (activeOrbit) {
                    orbitAtRest(activeOrbit);
                    activeOrbit = null;
                }
                renderer.domElement.style.cursor = '';
                hoveredMoonId = null;
                hoverSlow = false;
            }
        };

        renderer.domElement.addEventListener('click',     handleClick);
        renderer.domElement.addEventListener('mousemove', handleMouseMove);

        // ── Label hover bridge ─────────────────────────────────────────────────
        // A floating label is a DOM button 12px off to the side of its body, so
        // hovering it never crosses the canvas and the raycast above never runs.
        // These do by name what handleMouseMove does by ray: hover the body's
        // orbit ring, mark a hovered moon, and hold the idle drift still. The
        // label's own mouseleave (or the next mousemove over the canvas) undoes
        // it the same way the empty-hit branch does.
        const meshForId = (bid) => planetMeshes.find(m => m.userData.id === bid);
        sceneHoverRef.current = {
            enter(bid) {
                const orbit = meshForId(bid)?.userData.orbitLine ?? null;
                if (orbit !== activeOrbit) {
                    orbitAtRest(activeOrbit);
                    orbitHovered(orbit);
                    activeOrbit = orbit;
                }
                hoveredMoonId = (focusedIdRef.current && MOON_DATA.some(m => m.id === bid))
                    ? bid : null;
                if (!focusedIdRef.current) hoverSlow = true;
            },
            leave() {
                if (activeOrbit) {
                    orbitAtRest(activeOrbit);
                    activeOrbit = null;
                }
                hoveredMoonId = null;
                hoverSlow = false;
            },
        };

        // ── ResizeObserver ─────────────────────────────────────────────────────
        // Canvas size in CSS pixels, kept current here so the label pass never
        // has to call getBoundingClientRect() — a read that forces a synchronous
        // layout, and one the loop used to do on every single frame.
        let viewW = w;
        let viewH = h;
        const ro = new ResizeObserver(([entry]) => {
            const { width, height } = entry.contentRect;
            if (!width || !height) return;
            // A change of a pixel or two is not worth a reallocation. Mobile
            // Safari collapses and expands its URL bar as you scroll, and the
            // viewport height animates the whole way, so this fires repeatedly
            // for a change nobody can see — and setSize() reallocates the
            // drawing buffer and its depth attachment every time, which on a
            // phone GPU stalls the pipeline. Labels still track the exact size.
            const resized = Math.abs(width - viewW) > 2 || Math.abs(height - viewH) > 2;
            viewW = width;
            viewH = height;
            if (!resized) return;
            // Re-budget on resize too: rotating a tablet changes the surface
            // area enough to matter.
            renderer.setPixelRatio(pixelRatioFor(width, height));
            renderer.setSize(width, height);
            camera.aspect = width / height;
            camera.updateProjectionMatrix();
        });
        ro.observe(mount);

        // ── Object labels ──────────────────────────────────────────────────────
        // The labels are plain DOM nodes that the render loop positions with a
        // composited transform. They used to be React state rebuilt on every
        // frame: ~18 elements reconciled and re-laid-out at 60 Hz, each pass
        // preceded by a getBoundingClientRect() that forced a synchronous
        // layout. On a desktop that is merely wasteful. On a phone it left the
        // main thread no gap between frames, which is what turned a first load
        // into a multi-minute wait — every texture decode, every model parse
        // and every requestIdleCallback was queued behind the label pass.
        //
        // React now hears only about the roster, which changes when the focus
        // does. A frame writes transforms and nothing else.
        const LABEL_BANDS = {
            planet:       { base: 20, range: 8 },
            'small-body': { base: 12, range: 4 },
            moon:         { base:  4, range: 4 },
        };
        const LABEL_UNBUILT = Symbol('unbuilt');
        let labelTargets  = [];               // { key, name, kind, object3d }
        let labelBuiltFor = LABEL_UNBUILT;    // focus id the roster was built for
        const labelZ      = new Map();        // key → z-index last written

        const buildLabelTargets = (focused) => {
            const out = [];
            if (!focused) {
                // Home view — label every planet
                planetGroups.forEach(({ group, planet }) => out.push(
                    { key: `planet:${planet.name}`, id: planet.id, name: planet.name, kind: 'planet', object3d: group }));
                // Small bodies and probes: dimmer, same size as moon labels
                smallBodyGroups.forEach(({ group, body }) => out.push(
                    { key: `small:${body.name}`, id: body.id, name: body.name, kind: 'small-body', object3d: group }));
                probeGroups.forEach(({ group, probe }) => out.push(
                    { key: `small:${probe.name}`, id: probe.id, name: probe.name, kind: 'small-body', object3d: group }));
                return out;
            }
            // Focused on a planet — show its moons only
            const focusedPlanet = planetGroups.find(({ planet }) => planet.id === focused);
            if (focusedPlanet) {
                MOON_DATA.forEach(moon => {
                    if (moon.parent !== focusedPlanet.planet.name) return;
                    const mesh = moonMeshRefs.get(moon.name);
                    if (mesh) out.push(
                        { key: `moon:${moon.name}`, id: moon.id, name: moon.name, kind: 'moon', object3d: mesh });
                });
                return out;
            }
            // Focused on a moon — label the moon itself
            const focusedMoon = MOON_DATA.find(m => m.id === focused);
            const moonMesh = focusedMoon ? moonMeshRefs.get(focusedMoon.name) : null;
            if (moonMesh) out.push(
                { key: `moon:${focusedMoon.name}`, id: focusedMoon.id, name: focusedMoon.name, kind: 'moon', object3d: moonMesh });
            return out;
        };

        // ── Hitboxes ───────────────────────────────────────────────────────
        // A hitbox is a fixed number of scene units, which means how easy
        // something is to click depends entirely on how far away the camera
        // is. That was tolerable while the camera lived at one distance; with
        // true distances it sits six times further out and everything but the
        // Sun and Jupiter became impossible to hit. These are re-sized to hold
        // a roughly constant angular size instead, so a planet is the same
        // target whatever layout you are in and however far you have zoomed.
        const HIT_TARGET_PX = 15;
        const HIT_MAX_GROWTH = 25;
        const _hitPos = new THREE.Vector3();
        const sizeHitboxes = () => {
            // Focus mode deliberately shrinks them to the visible body, so that
            // clicking a planet you are already looking at picks its moons.
            if (focusedIdRef.current) return;
            const perUnit = (2 * Math.tan((camera.fov * Math.PI) / 360)) / Math.max(1, viewH);
            const fit = (mesh, group, baseR) => {
                if (!mesh || !baseR) return;
                group.getWorldPosition(_hitPos);
                const wanted = HIT_TARGET_PX * perUnit * camera.position.distanceTo(_hitPos);
                mesh.scale.setScalar(Math.min(HIT_MAX_GROWTH, Math.max(1, wanted / baseR)));
            };
            planetGroups.forEach(({ group, planet }) => {
                const hb = planetHitboxRefs.get(planet.name);
                fit(hb, group, hb?.geometry?.parameters?.radius);
            });
            smallBodyGroups.forEach(({ group, body }) => {
                fit(smallBodyHitRefs.get(body.id), group, smallBodyHitRadii.get(body.id));
            });
            // The probes were left out of this and kept the fixed 16-unit
            // sphere they were built with. That is generous in the compressed
            // layout, where they sit a few hundred units out; at true
            // distances Voyager 1 is past 12,000 units and 16 of them is about
            // a pixel, so the only way to hit it was to find that pixel.
            probeGroups.forEach(({ group, hit }) => {
                fit(hit, group, hit?.geometry?.parameters?.radius);
            });
            fit(sunHitMesh, sunHitMesh, SUN_RADIUS);
        };

        // ── True sizes ─────────────────────────────────────────────────────────
        // Stage 2 of the scale control puts the whole scene on one scale, and
        // that is a brutal thing to do to a body: Earth goes from 1.31 units
        // across to four thousandths of one, against an orbit of ninety-six.
        //
        // Applied as a scale on the group holding each body — not by rebuilding
        // geometry — so it can ease rather than snap, and so a body's rings and
        // atmosphere come with it while its hitbox, which hangs off the parent,
        // does not. Moons take two factors: one for the moon, and one for how
        // far out it orbits, because a true-size Earth with the Moon still at
        // its drawn distance would be a speck with a speck three hundred times
        // its own width away.
        // Every body the scene draws at a chosen size, by id. The probes are
        // deliberately absent: a spacecraft's true size is a rounding error
        // even against Phobos, and those markers are wayfinding — the same job
        // the labels do — rather than anything claiming to be to scale.
        const DRAWN_RADIUS = new Map([
            ['sun', SUN_RADIUS],
            ...PLANETS.map(p => [p.id, p.r]),
            ...SMALL_BODIES.map(b => [b.id, b.r]),
            ...MOON_DATA.map(m => [m.id, m.radius]),
        ]);

        /** Multiplier from a body's drawn radius to what it is drawn at now. */
        const bodyScaleFactor = (id, t) => sizeFactor(DRAWN_RADIUS.get(id), bodyRadiusKm(id), t);
        /** The radius a body is actually drawn at now, in scene units. */
        const scaledRadius = (id, t) => (DRAWN_RADIUS.get(id) ?? 0) * bodyScaleFactor(id, t);
        // Halley is the one body the camera must not frame off its own
        // surface. Its coma and tails are built at the scene's drawn scale
        // and true sizes never touches them — only the nucleus shrinks, from
        // 0.11 units to about three millionths of one — so a framing derived
        // from the nucleus lands the camera four ten-thousandths of a unit
        // out, deep inside a seventeen-unit ion tail, staring at a speck with
        // the thing worth looking at stretching away behind the lens. Every
        // framing number for this comet therefore stays on its drawn radius
        // at every stage: the distance flown to, the floor under it, the near
        // plane and how close a reader may zoom. The nucleus still shrinks
        // honestly, which is the point of stage 2 — it is just no longer what
        // decides where you stand to look at it.
        const framingScaleFactor = (id, t) => (id === 'halley' ? 1 : bodyScaleFactor(id, t));
        /** The radius the camera frames a body against — see framingScaleFactor. */
        const framingRadius = (id, t) => (DRAWN_RADIUS.get(id) ?? 0) * framingScaleFactor(id, t);
        const moonOrbitFactor = (moon, t) => sizeFactor(moon.orbitR, moonOrbitKm(moon.id), t);

        // Where the focused body is right now, for the camera correction that
        // follows it through a change of size stage. The body's own position,
        // not controls.target — on a fresh mount arriving straight into a
        // focus, the target has not caught up to it yet.
        const _sizePivot = new THREE.Vector3();
        const focusedWorldPos = (id, out) => {
            const moonName = MOON_DATA.find(m => m.id === id)?.name;
            const mesh = (moonName && moonMeshRefs.get(moonName))
                ?? planetMeshes.find(m => m.userData.id === id);
            if (!mesh) return null;
            mesh.getWorldPosition(out);
            return out;
        };

        const applyTrueSizes = (t) => {
            planetGroups.forEach(({ bodyScale, planet }) => {
                bodyScale.scale.setScalar(bodyScaleFactor(planet.id, t));
            });
            sunScale.scale.setScalar(bodyScaleFactor('sun', t));
            SMALL_BODIES.forEach(body => {
                const mesh = smallBodyMeshRefs.get(body.id);
                if (mesh) mesh.scale.setScalar(bodyScaleFactor(body.id, t));
            });
            MOON_DATA.forEach(moon => {
                const mesh = moonMeshRefs.get(moon.name);
                if (mesh) mesh.scale.setScalar(bodyScaleFactor(moon.id, t));
            });
        };
        applyTrueSizes(sizeProgress());

        // Every body correctly *positioned* for the current scale before the
        // render loop's first frame, the same way the call just above
        // bootstraps every body's SIZE. Planets get this again on frame 1
        // regardless of this call — lastScaleT starts at -1 below
        // specifically to force it — but that correction runs inside
        // animate(), after this synchronous setup and, critically, before
        // the block further down that reads a freshly-focused body's
        // position to aim a fly-in at it. Small bodies are already correct
        // at creation (see the true-distance factor where SMALL_BODIES is
        // built, above) for the same reason. Moons have neither: they have
        // no creation-time position at all — nothing sets one — and their
        // own per-frame correction, a few hundred lines further down this
        // file, runs *after* that fly-in setup rather than before it. A
        // direct link straight onto a moon's page used to aim its fly-in at
        // the scene origin, where every mesh starts, rather than anywhere
        // near the moon itself. Correcting planets again here first is what
        // makes the moon offset below land somewhere real: moon position is
        // parent position plus an offset, and the parent has not had its own
        // frame-1 correction yet at this point in a fresh load.
        updatePlanetPositions(new Date(simNow()));
        MOON_DATA.forEach(moon => {
            const parentGroup = planetMeshRefs.get(moon.parent);
            const moonMesh = moonMeshRefs.get(moon.name);
            if (!parentGroup || !moonMesh) return;
            const off = moonOffset(moon, moon.phase0, moonOrbitFactor(moon, sizeProgress()));
            moonMesh.position.set(
                parentGroup.position.x + off.x,
                parentGroup.position.y + off.y,
                parentGroup.position.z + off.z,
            );
            const hitMesh = moonHitRefs.get(moon.name);
            if (hitMesh) hitMesh.position.copy(moonMesh.position);
        });

        const _labelProj = new THREE.Vector3();
        // Where labels have already landed this pass. Two bodies can be a pixel
        // apart on screen — a conjunction, or the whole inner system once
        // distances are true — and stacked text reads as breakage rather than
        // as the point. The roster is ordered planets, then small bodies, then
        // probes, so dropping the later one keeps the more important name.
        const labelSpots = [];
        const LABEL_CLEAR_X = 46;
        const LABEL_CLEAR_Y = 13;
        const positionLabels = () => {
            const els = labelElsRef.current;
            if (els.size === 0) return;
            // Nothing but the planet during the tracker pull-back. The cut is
            // to a globe that carries no names, so a label still standing
            // here is a caption that vanishes halfway through the dissolve.
            if (trkFlyIn || trkReframing || trkHolding) {
                for (const el of els.values()) {
                    if (el.style.visibility !== 'hidden') el.style.visibility = 'hidden';
                }
                return;
            }
            labelSpots.length = 0;
            for (const t of labelTargets) {
                const el = els.get(t.key);
                if (!el) continue;   // roster changed; its node lands next commit
                t.object3d.getWorldPosition(_labelProj);
                _labelProj.project(camera);
                // Anything off screen is simply not drawn
                if (_labelProj.z > 1 || Math.abs(_labelProj.x) > 1.05 || Math.abs(_labelProj.y) > 1.05) {
                    if (el.style.visibility !== 'hidden') el.style.visibility = 'hidden';
                    continue;
                }
                const x = (_labelProj.x + 1) / 2 * viewW;
                const y = -(_labelProj.y - 1) / 2 * viewH;
                // Only in the home view. Focused on a planet the labels are
                // its moons, which are close together by nature and are the
                // thing being looked at — dropping Deimos because it is near
                // Phobos would be throwing away the answer.
                let crowded = false;
                if (!focusedIdRef.current) for (const spot of labelSpots) {
                    if (Math.abs(spot.x - x) < LABEL_CLEAR_X && Math.abs(spot.y - y) < LABEL_CLEAR_Y) {
                        crowded = true;
                        break;
                    }
                }
                if (crowded) {
                    if (el.style.visibility !== 'hidden') el.style.visibility = 'hidden';
                    continue;
                }
                labelSpots.push({ x, y });
                // A transform rather than left/top: moving a label this way is
                // composited and costs no layout.
                el.style.transform = `translate3d(${x + 12}px, ${y}px, 0) translateY(-50%)`;
                if (el.style.visibility !== 'visible') el.style.visibility = 'visible';
                // Within a band, closer objects (lower depth) stack higher.
                const band = LABEL_BANDS[t.kind];
                const z = band.base + Math.round((1 - _labelProj.z) * band.range * 0.5);
                if (labelZ.get(t.key) !== z) { labelZ.set(t.key, z); el.style.zIndex = String(z); }
            }
        };

        // ── Animation loop ─────────────────────────────────────────────────────
        let animId;
        let frameCount = 0;
        // Wall-clock between frames, for anything whose speed should be a rate
        // rather than a per-frame step. Clamped: a backgrounded tab comes back
        // with a delta of minutes, and every eased value would jump.
        let lastFrameMs = performance.now();
        let sceneReadySent = false;
        const _shareSpherical = new THREE.Spherical();
        // Reference for lifting the probe-focus camera off the Sun line.
        const PROBE_LIFT_AXIS = new THREE.Vector3(0, 1, 0);
        // -1 so the first frame always applies the layout, whichever it is
        let lastScaleT = -1;
        let lastSizeT  = sizeProgress();
        // The size factor the focused body was last framed at, and the framing
        // distance it was given in drawn-size units — see the camera correction
        // beside applyTrueSizes() in the loop.
        let lastFocusSizeF  = 1;
        let focusDistDrawn  = 0;
        let sizeSettlePending = false;
        // What the rings were last built for.
        let ringsScaleT = 0;
        let ringsWeight = 1;
        let ringsHidden = false;
        // The belts as first laid out, so every remap starts from the original
        // radii rather than compounding rounding through the previous one.
        const abBase = abParticles?.geometry.attributes.position.array.slice() ?? null;
        const kbBase = kbParticles?.geometry.attributes.position.array.slice() ?? null;

        /**
         * A belt maps a band of AU onto a band of scene units affinely, so
         * moving it to true distances is per-particle: read the radius it was
         * placed at, recover the AU it stood for, and put it where that AU is.
         */
        const beltAU = (r, inner, outer, auInner, auOuter) =>
            auInner + ((r - inner) / (outer - inner)) * (auOuter - auInner);

        const beltFactorAt = (r, inner, outer, auInner, auOuter, t) => {
            if (!(r > 0)) return 1;
            const trueR = beltAU(r, inner, outer, auInner, auOuter) * AU_UNITS;
            return (r + (trueR - r) * t) / r;
        };

        const remapBelt = (points, base, inner, outer, auInner, auOuter, t) => {
            if (!points || !base) return;
            const arr = points.geometry.attributes.position.array;
            for (let i = 0; i < base.length; i += 3) {
                const x = base[i], y = base[i + 1], z = base[i + 2];
                const f = beltFactorAt(Math.hypot(x, y, z), inner, outer, auInner, auOuter, t);
                arr[i] = x * f; arr[i + 1] = y * f; arr[i + 2] = z * f;
            }
            points.geometry.attributes.position.needsUpdate = true;
            points.geometry.computeBoundingSphere();
        };

        // What the LOD rocks are standing at, read by the belt spin
        const beltLayout = { t: 0 };

        /** Instanced belt rocks: orbits move, rocks keep the size they were. */
        const placeBeltInstances = (t = beltLayout.t) => {
            beltLayout.t = t;
            const place = (groups, anglesKey, sizeKey, inner, outer, auInner, auOuter) => {
                groups.forEach(({ mesh, positions, scales, def }) => {
                    const angles = mesh.userData[anglesKey];
                    for (let i = 0; i < positions.length; i++) {
                        const p = positions[i];
                        const f = beltFactorAt(p.length(), inner, outer, auInner, auOuter, t);
                        lodDummy.position.copy(p).multiplyScalar(f);
                        if (angles) lodDummy.rotation.set(angles[i].ax, angles[i].ay, angles[i].az);
                        // Not scaled by f: a Kuiper boulder drawn nine times
                        // larger would be wider than Neptune.
                        lodDummy.scale.setScalar(def[sizeKey] * scales[i]);
                        lodDummy.updateMatrix();
                        mesh.setMatrixAt(i, lodDummy.matrix);
                    }
                    mesh.instanceMatrix.needsUpdate = true;
                });
            };
            place(abLODGroups, 'abAngles', 'abSize', AB_INNER, AB_OUTER, 2.2, 3.2);
            place(kbLODGroups, 'kbAngles', 'kbSize', KB_INNER, KB_OUTER, 30, 50);
        };

        const rebuildProbeTrack = (track, probe, t) => {
            const pts = buildProbeTrack(probe.id, t);
            const arr = track.geometry.attributes.position.array;
            for (let i = 0; i < pts.length; i++) {
                arr[i * 3] = pts[i].x; arr[i * 3 + 1] = pts[i].y; arr[i * 3 + 2] = pts[i].z;
            }
            track.geometry.attributes.position.needsUpdate = true;
        };
        let prevNowDays = null;
        let scrubBase = null;   // live→scrub handover, see the moon block
        let wasScrubbing = false;   // to catch the frame the clock rejoins now
        // Gravity-overlay loop state: the field-line retrace gate and the
        // fly-in fade. gravRetrace* are kept for the perf readout.
        let gravTraceAt = null;        // Vector3[] of body positions at the last retrace
        let gravTraceFrame = -999;
        let gravTraceScaleT = -1;
        let gravFocusFade = 1;         // 1 in the system view, eased to 0 inside a body
        let gravRetraceMs = 0;
        let gravRetraceStats = null;
        let meshRotSpeed = 0.002;
        let liveOrbitSpeed = 2000;
        let liveISSSpeed   = 2000; // tracked independently so hover response is immediate
        // Target axial-tilt z-rotation per planet — lerped smoothly each frame
        const tiltTargets = new Map(); // mesh uuid → target rotation.z (radians)

        const animate = () => {
            animId = requestAnimationFrame(animate);
            frameCount++;

            const nowMs = performance.now();
            // 100ms ceiling: past that it is a stall or a backgrounded tab, and
            // catching up in one step looks worse than losing the time.
            const deltaSec = Math.min(0.1, Math.max(0, (nowMs - lastFrameMs) / 1000));
            lastFrameMs = nowMs;
            // The same delta as a multiple of a 60fps frame, for the per-frame
            // steps below that were written against that assumption.
            const frameScale = deltaSec * 60;
            // Every eased value in this loop was written as "move this fraction
            // of the remaining distance each frame", which is only a fixed
            // speed if frames are a fixed length. Over n frames that covers
            // 1-(1-f)^n, so this is that identity solved for however much of a
            // 60fps frame actually elapsed. On a 240Hz display the untouched
            // version ran every animation four times too fast.
            const ease = (perFrame) => 1 - Math.pow(1 - perFrame, frameScale);
            // Two frames after the last texture lands, not the moment it lands:
            // arriving and being on screen are different things here, since the
            // upload to the GPU is spread a couple per frame. Dismissing on
            // arrival shows the black canvas the screen was covering.
            //
            // The paint queue counts too. `texturesDrained` is the loading
            // manager's word on the network, and the painted surfaces never
            // touch it — so without this the screen would lift off a scene of
            // flat-coloured moons still waiting their turn.
            if (!sceneReadySent && texturesDrained && paintQueue.length === 0 && frameCount > 2) {
                sceneReadySent = true;
                assetsSceneReady();
            }
            const simMs   = simNow();
            const simTime = new Date(simMs);
            // "Scrubbing" is any state where the simulated clock has parted from
            // the real one — including a plain jump to another date at live rate,
            // which is what the slider does.
            const scrubbing = !isLive();
            // Planets then have to follow the clock. That is nine ephemeris calls,
            // so it is throttled: every other frame is well past the point where
            // the motion looks continuous. The frame the clock rejoins the
            // present — the end of a "Back to now" wind-back, or an instant
            // reset under reduced motion — gets one guaranteed update, or the
            // planets would sit at the date the scrub left them until the 60s
            // interval next fired.
            if (scrubbing && frameCount % 2 === 0) updatePlanetPositions(simTime);
            else if (wasScrubbing && !scrubbing) updatePlanetPositions(simTime);
            wasScrubbing = scrubbing;
            const nowDays = (simMs - ORBIT_EPOCH_MS) / 86400000;
            const currentFocusedId = focusedIdRef.current;

            // ── Compressed layout ⇄ true distances ─────────────────────────
            // Read once per frame and shared by everything radial below.
            const scaleT = scaleProgress();
            if (scaleT !== lastScaleT) {
                lastScaleT = scaleT;
                updatePlanetPositions(simTime, scaleT);

                // Belts. A single factor cannot do this: the belts were laid
                // out affinely — 2.2–3.2 AU onto 134–158 units — so scaling
                // about the origin would put the asteroid belt at 2.48–2.92 AU
                // and call it to scale. Each particle is remapped through its
                // own radius instead, which is a couple of thousand multiplies
                // on the frames the layout is actually moving.
                remapBelt(abParticles, abBase, AB_INNER, AB_OUTER, 2.2, 3.2, scaleT);
                remapBelt(kbParticles, kbBase, KB_INNER, KB_OUTER, 30, 50, scaleT);
                // The LOD rocks are instanced meshes, so scaling the object
                // would enlarge the rocks along with their orbits — a Kuiper
                // boulder bigger than Neptune. Move the instances instead.
                placeBeltInstances(scaleT);

                // Out here the compression was never uniform, so the tracks are
                // rewritten rather than scaled — 45 points, once per change.
                probeGroups.forEach(({ track, probe }) => rebuildProbeTrack(track, probe, scaleT));


            }

            const sizeT = sizeProgress();
            if (sizeT !== lastSizeT) {
                lastSizeT = sizeT;
                applyTrueSizes(sizeT);
                // Switching stage while focused has to bring the camera in
                // with the body, or changing to true sizes leaves you parked
                // three units off something four thousandths of a unit across,
                // watching it disappear. Scaling the camera's offset from the
                // body by the same ratio the body changed by keeps whatever
                // framing the reader had, including one they zoomed themselves
                // — and the fly-in's destination has to come too, since that
                // was fixed at the size the body was when it set off.
                const focusId = focusedIdRef.current;
                if (focusId && lastFocusSizeF > 0) {
                    const f = framingScaleFactor(focusId, sizeT);
                    const pivot = focusedWorldPos(focusId, _sizePivot);
                    if (f > 0 && f !== lastFocusSizeF && pivot) {
                        const ratio = f / lastFocusSizeF;
                        camera.position.sub(pivot).multiplyScalar(ratio).add(pivot);
                        focusEndCamPos.sub(pivot).multiplyScalar(ratio).add(pivot);
                        lastFocusSizeF = f;
                        // Same floor as the initial fly-in, and the same
                        // fix: against the body's own true radius, not
                        // against camera.near, which is not this body's near
                        // plane at the instant this runs either — see the
                        // comment on `dist` above for why that reads stale.
                        const floorDist = framingRadius(focusId, sizeT) * 2.5;
                        const nearPos = camera.position.distanceTo(pivot);
                        if (nearPos < floorDist && nearPos > 1e-9) {
                            const push = floorDist / nearPos;
                            camera.position.sub(pivot).multiplyScalar(push).add(pivot);
                            focusEndCamPos.sub(pivot).multiplyScalar(push).add(pivot);
                        }
                    }
                }
                sizeSettlePending = true;
            }

            // The ratchet above only smooths what it actually sees, and it can
            // see very little: a fresh load arriving straight into a focused
            // body spends most of the transition with the main thread decoding
            // textures, and the whole 2.2 seconds can pass in four frames. So
            // the framing is settled here from the stored distance instead of
            // accumulated — this is the part that is allowed to be authoritative.
            if (sizeSettlePending && !isScaleSettling()) {
                const focusId = focusedIdRef.current;
                const pivot = focusId ? focusedWorldPos(focusId, _sizePivot) : null;
                if (!focusId) {
                    sizeSettlePending = false;   // nothing focused, nothing to re-frame
                } else if (pivot && focusDistDrawn > 0) {
                    // Floored the same way the initial fly-in's `dist` is —
                    // this is the pass the comment above calls authoritative,
                    // so if it re-asserts the unfloored distance it would
                    // undo that floor the moment the size transition settles.
                    // Against the body's own true radius, not camera.near —
                    // see the comment on the initial `dist` for why that
                    // reads stale at the one place it actually mattered.
                    const want = Math.max(
                        focusDistDrawn * framingScaleFactor(focusId, sizeT),
                        framingRadius(focusId, sizeT) * 2.5);
                    // Mid fly-in it is the destination that needs correcting,
                    // not where the camera has got to — and the flag is held
                    // until that flight lands, because a load that arrives
                    // straight into a focus sets its course before the stage
                    // has finished moving under it.
                    const from = focusAnimating ? focusEndCamPos : camera.position;
                    const cur  = from.distanceTo(pivot);
                    if (want > 0 && cur > 1e-9) {
                        const ratio = want / cur;
                        focusEndCamPos.sub(pivot).multiplyScalar(ratio).add(pivot);
                        if (!focusAnimating) {
                            camera.position.sub(pivot).multiplyScalar(ratio).add(pivot);
                        }
                    }
                    lastFocusSizeF = framingScaleFactor(focusId, sizeT);
                    if (!focusAnimating) sizeSettlePending = false;
                }
            }

            // True distances put Pluto at 3,790 units where the compressed
            // layout had it at 410, so the camera has to be allowed out that
            // far and the far plane has to follow. Keyed on the layout rather
            // than on the transition: these have to be right on a fresh mount
            // with true distances already on — navigating to /compare and back
            // does exactly that — and maxDistance has to lead the pull-out
            // below, or controls.update clamps the camera every frame and it
            // never gets far enough to see what moved.
            controls.maxDistance = 1200 + (6000 - 1200) * scaleT;
            // 50,000 rather than a smaller value tied tightly to SKY_TRUE_RADIUS:
            // the far plane has to clear not just the sphere but the camera's own
            // distance from its centre, and a camera parked out near Voyager with
            // room left to zoom further out again needs more headroom than the
            // sphere's radius alone would suggest.
            const wantFar = 10000 + (50000 - 10000) * scaleT;
            if (Math.abs(camera.far - wantFar) > 50) {
                camera.far = wantFar;
                camera.updateProjectionMatrix();
            }
            if (skySphere) {
                const skyScale = 1 + (SKY_TRUE_RADIUS / SKY_RADIUS - 1) * scaleT;
                if (Math.abs(skySphere.scale.x - skyScale) > 0.001) skySphere.scale.setScalar(skyScale);
            }


            // Rings. Hidden while the layout is in motion — a tube has to be
            // rebuilt to change width, and rebuilding sixteen of them on every
            // frame of the transition is not worth it — then rebuilt for
            // wherever the camera has ended up. Kept out of the layout-change
            // check above because the camera moves on its own too, and because
            // easing can land two equal values in a row before it stops.
            if (isScaleSettling()) {
                if (!ringsHidden) {
                    orbitLines.forEach(r => { r.visible = false; });
                    ringsHidden = true;
                }
            } else {
                const wantWeight = tubeWeight(camera.position.length());
                if (ringsHidden || ringsScaleT !== scaleT || ringsWeight !== wantWeight) {
                    queueRings(scaleT, wantWeight);
                    ringsScaleT = scaleT;
                    ringsWeight = wantWeight;
                    ringsHidden = false;
                }
                drainRingQueue();
            }

            // Ease every orbit path's opacity/colour toward whatever
            // orbitAtRest()/orbitHovered() last targeted, rather than the
            // snap those two functions used to apply directly — most
            // visible the moment something is focused, when every ring in
            // the scene (planets, small bodies, probe tracks) targets 0 on
            // the same frame; a snap there read as the whole scene flickering
            // out rather than a deliberate "getting these out of your way".
            // Skipped once a path is close enough to its target that another
            // step would be imperceptible, the same threshold-then-stop
            // shape as the axial-tilt lerp above.
            for (const orbit of fadingOrbits) {
                const mat = orbit.material;
                const { targetOpacity, targetColor } = orbit.userData;
                const opacityDiff = targetOpacity - mat.opacity;
                if (Math.abs(opacityDiff) < 0.001) mat.opacity = targetOpacity;
                else mat.opacity += opacityDiff * ease(ORBIT_FADE_RATE);

                if (Math.abs(targetColor.r - mat.color.r) < 0.001
                    && Math.abs(targetColor.g - mat.color.g) < 0.001
                    && Math.abs(targetColor.b - mat.color.b) < 0.001) {
                    mat.color.copy(targetColor);
                } else {
                    mat.color.lerp(targetColor, ease(ORBIT_FADE_RATE));
                }
            }

            // While the layout is moving, ease the camera to a distance that
            // frames it. Watching Neptune leave is the whole point, and you
            // cannot watch it from inside Earth's orbit.
            if (isScaleSettling()) {
                const want = 580 + (3400 - 580) * scaleT;
                const d = camera.position.length();
                camera.position.setLength(d + (want - d) * ease(0.06));
            }

            // ── Detect focus changes ───────────────────────────────────────────
            if (currentFocusedId !== prevFocusedId) {
                // Where the ISS model was held back to keep the first load small,
                // this is the moment it is worth fetching: you are on your way.
                if (currentFocusedId === 'iss') loadIssModel?.();
                // Restore previous focused planet's orbit + tilt + hitbox scale
                if (prevFocusedId) {
                    const prevMesh = planetMeshes.find(m => m.userData.id === prevFocusedId);
                    if (prevMesh && prevMesh.userData.name !== 'Saturn') {
                        tiltTargets.set(prevMesh.uuid, 0); // lerp tilt back to upright
                    }
                    // Restore ALL orbit rings when exiting any focused state
                    planetMeshes.forEach(m => {
                        orbitAtRest(m.userData.orbitLine);
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
                    // Hide ALL orbit paths in the scene when anything is focused.
                    // orbitAtRest reads the focus itself, so this also clears any
                    // hover tint left on a ring the pointer was over.
                    planetMeshes.forEach(m => orbitAtRest(m.userData.orbitLine));
                    // Shrink all hitboxes to 1× visual radius when anything is
                    // focused — the visual radius as currently drawn, so at
                    // true sizes they close in with the bodies instead of
                    // leaving a planet-sized target around a speck.
                    {
                        const hitT = sizeProgress();
                        PLANETS.forEach(p => {
                            const hb = planetHitboxRefs.get(p.name);
                            const hr = hb?.geometry?.parameters?.radius ?? 1;
                            if (hb) hb.scale.setScalar(p.r * bodyScaleFactor(p.id, hitT) / hr);
                        });
                        SMALL_BODIES.forEach(b => {
                            const hb = smallBodyHitRefs.get(b.id);
                            const hr = smallBodyHitRadii.get(b.id) ?? 1;
                            if (hb) hb.scale.setScalar(b.r * bodyScaleFactor(b.id, hitT) / hr);
                        });
                        MOON_DATA.forEach(moon => {
                            const hm = moonHitRefs.get(moon.name);
                            const hr = moonHitRadii.get(moon.name) ?? 1;
                            const mr = (moon.hitRadius ?? moon.radius) * bodyScaleFactor(moon.id, hitT);
                            if (hm) hm.scale.setScalar(mr * 2 / hr);
                        });
                        sunHitMesh.scale.setScalar(bodyScaleFactor('sun', hitT));
                    }
                    // Compute smooth focus animation — starts from current camera,
                    // ends at 30° elevation above the planet at the correct zoom distance
                    if (newMesh) {
                        const planetPos = new THREE.Vector3();
                        newMesh.getWorldPosition(planetPos);
                        // Radius from the data tables — geometry.parameters is undefined
                        // for meshes whose sphere was swapped for an STL model (Vesta).
                        const focusDef = PLANETS.find(b => b.id === currentFocusedId)
                            ?? SMALL_BODIES.find(b => b.id === currentFocusedId)
                            ?? MOON_DATA.find(b => b.id === currentFocusedId)
                            ?? PROBES.find(b => b.id === currentFocusedId);
                        const radius = focusDef?.r ?? focusDef?.radius
                            ?? newMesh.geometry?.parameters?.radius ?? 3.5;
                        const isTinyBody = SMALL_BODIES.some(b => b.id === currentFocusedId)
                            || MOON_DATA.some(b => b.id === currentFocusedId);
                        // Planets and the Sun sit a little further back than they
                        // used to: at 3.5 radii Jupiter filled about three fifths
                        // of the frame and read as being right on top of you.
                        // Moons and small bodies are unchanged — their framing was
                        // tuned separately and the flat offset pushes tiny things
                        // much too far.
                        const baseDist = newMesh.userData.id === 'sun' ? 62
                                     : newMesh.userData.id === 'iss' ? 0.3
                                     // Halley is framed by its tails, not its
                                     // nucleus: the ion tail is 17 units long
                                     // and the camera looks at the nucleus,
                                     // so the tail has to fit in *half* the
                                     // frame. At 45° vertical on a landscape
                                     // window the horizontal half-extent is
                                     // about 0.66 of the distance, so 34 puts
                                     // the far tip of the ion tail comfortably
                                     // inside the right-hand edge.
                                     : newMesh.userData.id === 'halley' ? 34
                                     : focusDef?.focusDist
                                     ?? (isTinyBody ? Math.max(radius * 5.5, 0.5)
                                                    : radius * 4.5 + 3);
                        // A portrait viewport has a far narrower horizontal field of
                        // view, so a distance framed for landscape pushes the body off
                        // both edges. Back off in proportion, with a ceiling so phones
                        // don't end up looking at a distant speck.
                        // Every distance above was tuned against the drawn
                        // radii, so true sizes just take the whole framing down
                        // by the same factor the body went down by — the body
                        // fills exactly the fraction of the frame it always did,
                        // from proportionally closer in.
                        lastFocusSizeF = framingScaleFactor(currentFocusedId, sizeProgress());
                        // Kept unscaled as well, so a later change of stage can
                        // work out the framing from scratch rather than having
                        // to have watched every frame of the change.
                        focusDistDrawn = baseDist * (camera.aspect < 1
                            ? Math.min(2.0, Math.pow(1 / camera.aspect, 0.8))
                            : 1);
                        // Floored against the body's own true radius, not
                        // against camera.near — camera.near is a stale read
                        // here. This block runs once, the moment a new focus
                        // is detected, and camera.near only shrinks to match
                        // the target *after* this point, in the per-frame
                        // "if (targetMesh)" block below (which reads the same
                        // scaledRadius() this does). Flooring against the near
                        // plane's pre-shrink value — still 1, the unfocused
                        // default, the first time anything is focused —
                        // landed every true-size body at a fixed ~2.2 units
                        // regardless of how small it actually was, which is
                        // much further out than true sizes calls for: the
                        // unfloored distance already reproduces the exact
                        // apparent size a compressed-mode focus has (that is
                        // the whole point of scaling it by lastFocusSizeF),
                        // so a good close-up was sitting right there,
                        // unreachable, on the other side of an unrelated
                        // number. `framedRadius * 2.5` mirrors
                        // controls.minDistance below: the scripted fly-in
                        // should never land closer than a reader's own manual
                        // zoom is allowed to. For every body actually in the
                        // catalog the unfloored distance already clears this
                        // by a comfortable margin — it is a floor for a
                        // malformed radius, not a normal landing spot.
                        // The radius everything below is measured against.
                        // For every body but one this is the true radius at
                        // the current stage; Halley is framed off its drawn
                        // nucleus instead, for the reason framingScaleFactor
                        // gives.
                        const framedRadius = radius * lastFocusSizeF;
                        const dist = Math.max(focusDistDrawn * lastFocusSizeF, framedRadius * 2.5);
                        // Set right here rather than left for the per-frame
                        // "if (targetMesh)" block further down to pick up on
                        // its next tick. That block reads the same
                        // scaledRadius() and would converge on the same near
                        // plane one frame later regardless — this only closes
                        // the gap outright, so the very first frame of a
                        // fresh focus is never judged against the previous
                        // (likely far too large) near plane.
                        camera.near = Math.max(Math.min(0.01, framedRadius * 0.02), framedRadius * 0.1);
                        camera.updateProjectionMatrix();
                        // Normally the user's azimuth is kept, which is right
                        // for a planet: whichever side you approached from is
                        // the side you meant. Read off the camera's own current
                        // orientation for that, rather than the old trick of
                        // subtracting the new target's position from the old
                        // camera position. That trick is fine when the two are
                        // close together, but a fresh focus from the wide home
                        // view starts the camera near the origin while a
                        // true-distance planet can be thousands of units out —
                        // the difference is then dominated by the target's own
                        // position, and the "azimuth" it produces is really
                        // just the bearing back toward the Sun. The camera
                        // would arrive close to the planet from that
                        // accidental direction first (this fly-in's own
                        // distance closes in log space, so a lot of that
                        // happens early), then visibly swing round to the true
                        // one as the direction lerp further down caught up —
                        // reading as "centres on the Sun, then the planet."
                        // The camera's own facing has no such degenerate case:
                        // it is a well-formed bearing at any scale.
                        const camForward = camera.getWorldDirection(_focusApproachDir);
                        const az   = Math.atan2(-camForward.x, -camForward.z);
                        const TILT = 30 * Math.PI / 180; // 30° above equatorial = looking 30° down
                        const startCamPos = pendingFocusCamPos ?? camera.position;
                        pendingFocusCamPos = null;
                        focusStartCamPos.copy(startCamPos);
                        // Not the camera's actual current facing — where the
                        // slerp below starts is "looking at the body from
                        // here," the same way focusEndQuat is "looking at it
                        // from the landing spot." The camera's real pre-click
                        // orientation can be pointed anywhere (idle at the
                        // home view, it is generally facing the system's
                        // centre — the Sun), and slerping FROM that would
                        // mean the whole flight rotates through however much
                        // of the sky separates it from the target, spending
                        // real time on whatever lay in between. Deriving both
                        // ends from the same "look at the target" keeps the
                        // body roughly in view for the entire flight, and the
                        // two ends still meaningfully differ — and so still
                        // rotate smoothly rather than cutting — whenever the
                        // parallax between the two camera positions is large
                        // enough to matter, which is exactly the planet-to-
                        // planet case this was built for.
                        _focusLookMat.lookAt(focusStartCamPos, planetPos, camera.up);
                        focusStartQuat.setFromRotationMatrix(_focusLookMat);

                        // A probe is tens of AU out with nothing around it, so
                        // keeping the user's azimuth lands the camera beside it
                        // looking further out, at empty sky. Sit beyond it on
                        // the far side from the Sun instead, so the system it
                        // left is in the shot behind it with its own track
                        // running back into it. Every other body gets exactly
                        // the same problem once true sizes shrinks it to a
                        // speck at the far end of a true-distance orbit, so
                        // they all earn the same fix: the Sun rides in the
                        // frame the way it does for the Voyagers, on the body
                        // it actually belongs to — not just planets, so a
                        // focused moon, dwarf planet, asteroid or comet reads
                        // the same way. The Sun itself is excluded (nothing to
                        // frame it against) and so is anything already
                        // sun-relative for another reason (a probe).
                        const isProbe = PROBES.some(b => b.id === currentFocusedId);
                        // True *distances* earns this as much as true sizes
                        // does — that is the stage where a body is already a
                        // long way down its own radial line with nothing else
                        // in the shot — but only where there is frame to spend
                        // on it. `wide` is the gate: the Sun rides far enough
                        // off axis here (see SUN_TILT_WIDE) that a phone's
                        // portrait frame would simply crop it off, which is
                        // worse than not reaching for it. Below that, true
                        // sizes keeps the original, tighter framing it has
                        // always had, and true distances stays on the ordinary
                        // over-the-shoulder angle.
                        const wide = wideFraming();
                        const stage = getScaleStage();
                        // Halley wants the opposite of the Sun-in-frame angle.
                        // Its tails stream anti-sunward, which is the exact
                        // direction that framing approaches from — so it put
                        // the camera on the tail's own axis and the seventeen
                        // units of ion tail came at the lens end-on, reading
                        // as a smear across the corner of the frame rather
                        // than as a trail. This comet is framed broadside
                        // instead: off to the side of the Sun-comet line, so
                        // the tails lie across the frame at their full length
                        // with the nucleus at one end. That is the one view
                        // that says "comet", and it is worth giving up the
                        // Sun in shot for.
                        const cometFramed = currentFocusedId === 'halley';
                        const sunFramed = !cometFramed && (isProbe || (currentFocusedId !== 'sun'
                            && (stage === SCALE_SIZES || (wide && stage === SCALE_DISTANCES))));
                        if (sunFramed || cometFramed) {
                            // Along the body's actual position vector, not its
                            // compass bearing: the scene is equatorial and the
                            // planets sit near the ecliptic, so 23.4° of where
                            // they are lives in Y. Matching only the bearing
                            // left the Sun far enough off axis to fall out of
                            // frame, which is the whole thing this is for.
                            const outward = planetPos.clone().normalize();
                            // An orthonormal pair perpendicular to `outward` —
                            // `side` roughly horizontal (screen left/right),
                            // `up2` roughly vertical (screen up/down), in that
                            // order so the cross product's handedness is
                            // established once and reused below rather than
                            // re-derived and risking a sign flip.
                            const side = new THREE.Vector3()
                                .crossVectors(outward, PROBE_LIFT_AXIS);
                            if (side.lengthSq() < 1e-8) side.set(1, 0, 0);
                            side.normalize();
                            const up2 = new THREE.Vector3()
                                .crossVectors(side, outward).normalize();
                            // Offsetting straight along `up2` alone (this
                            // scene's old behaviour) put the Sun dead centre
                            // above the body every time — screen "12 o'clock",
                            // reading as the body eclipsing the Sun rather
                            // than the two sharing the frame. Blending in
                            // `side` moves that to "10 o'clock" (up and to the
                            // left) instead, and consistently so: `side` and
                            // `up2` are the same two directions for every
                            // body, only `outward` (and so the exact 3-D
                            // vectors they resolve to) changes with position —
                            // the ratio between them, and so where in frame
                            // the Sun lands, does not. The sign that actually
                            // lands on-screen *left* rather than right was
                            // checked against a real render, not assumed from
                            // the cross products' handedness.
                            // Two framings, same construction. The original
                            // pair (12°/35°) is a cautious one: 12° off axis
                            // because 30 put the Sun outside the 22.5°
                            // half-angle of this 45° field and dropped it off
                            // the top, and 35° round from vertical because
                            // straight up read as the body eclipsing the Sun.
                            // On a wide screen there is far more room than
                            // that, and most of it is sideways — the
                            // horizontal half-angle at 16:9 is 36°, not 22.5°
                            // — so the wide pair spends it: further out, and
                            // much further round toward the left, which is the
                            // framing this was matched to. At 28°/61° the Sun
                            // lands about 0.62 of the way up the frame and
                            // 0.70 of the way to the left edge on 16:9, which
                            // is why `wide` also requires a 5:4-or-better
                            // aspect: below that the horizontal room runs out
                            // before the vertical does.
                            if (cometFramed) {
                                // Straight out along `side` is dead broadside:
                                // the tails then run across the screen's
                                // horizontal, which is the axis with the most
                                // room on any landscape frame. `LIFT` tips the
                                // camera a little out of that plane so the
                                // dust tail's curve is visible as a curve
                                // rather than collapsing into the ion tail's
                                // line.
                                const LIFT = 15 * Math.PI / 180;
                                focusEndCamPos.copy(planetPos).addScaledVector(
                                    side.clone().multiplyScalar(Math.cos(LIFT))
                                        .addScaledVector(up2, Math.sin(LIFT)),
                                    dist);
                            } else {
                                const sunTilt = (wide ? 28 : 12) * Math.PI / 180;
                                const ROLL = (wide ? 61 : 35) * Math.PI / 180; // how far around from straight up, toward the left
                                const perp = up2.multiplyScalar(Math.cos(ROLL))
                                    .addScaledVector(side, Math.sin(ROLL));
                                focusEndCamPos.copy(planetPos).addScaledVector(
                                    outward.multiplyScalar(Math.cos(sunTilt))
                                        .addScaledVector(perp, Math.sin(sunTilt)),
                                    dist);
                            }
                        } else {
                            focusEndCamPos.set(
                                planetPos.x + dist * Math.cos(TILT) * Math.sin(az),
                                planetPos.y + dist * Math.sin(TILT),
                                planetPos.z + dist * Math.cos(TILT) * Math.cos(az)
                            );
                        }
                        // Flying to Earth to hand off to the tracker: land on
                        // the pose the globe opens at instead of the ordinary
                        // framing, so the flight the visitor sees is the whole
                        // transition rather than its first half. Earth's own
                        // turn to match runs off this same flight's progress,
                        // in the per-frame block below.
                        let trkUpOverride = null;
                        if (currentFocusedId === 'earth' && earthMesh
                                && getTrackerPhase() === TRK_ARMED) {
                            trkSolvePose(planetPos, framedRadius);
                            focusEndCamPos.copy(trkCamPoint);
                            trkUpOverride = trkUp;
                            trkFlyIn = true;
                            earthMesh.getWorldQuaternion(trkStartEarthQ);
                            setTrackerPhase(TRK_APPROACHING);
                        }
                        // The orientation to land on — looking from
                        // focusEndCamPos at the body — captured once here as a
                        // quaternion rather than as a point to aim at. See the
                        // per-frame update for why.
                        _focusLookMat.lookAt(focusEndCamPos, planetPos, trkUpOverride ?? camera.up);
                        focusEndQuat.setFromRotationMatrix(_focusLookMat);
                        focusProgress  = 0;
                        focusAnimating = true;
                        // A new flight frames its own body from centre; the
                        // offset then eases back in if and when a panel asks
                        // for it.
                        vOffsetEased = 0;
                        // True sizes turns this flight into a far bigger zoom
                        // than the same fly-in has ever had to cover — Earth's
                        // is on the order of 20,000x — and doing that in the
                        // same 1.2s it takes to cross a planet's own diameter
                        // reads as a flinch no matter how the easing curve is
                        // shaped. Slower here specifically, not generally.
                        focusFlySeconds = getScaleStage() === SCALE_SIZES ? 2.4 : 1.2;
                    }
                }
                // Trigger cinematic zoom-out when going focused → home
                if (prevFocusedId && !currentFocusedId) {
                    exitStartCamPos.copy(camera.position);
                    exitStartTarget.copy(controls.target);
                    exitStartDistance = exitStartCamPos.distanceTo(exitStartTarget);
                    // Idle drift's own roll-to-level correction (below) is
                    // suspended for as long as anything is focused, so
                    // camera.up sits frozen at whatever residual roll it had
                    // the instant this scene was last idling — often small,
                    // but evaluated fresh once idle drift resumes, against
                    // this exit's own new viewing angle rather than the one
                    // it was measured against. That mismatch is what read as
                    // a sudden roll correction right as the exit finished.
                    // Levelling it here, before the exit even starts, means
                    // there is nothing stale left to catch up on by the time
                    // idle drift picks back up.
                    camera.up.set(0, 1, 0);
                    exitPhase    = 1;
                    exitProgress = 0;
                }
                // Refocusing away from Earth mid-sequence (another body clicked,
                // or "back to home") abandons the sky-entry approach rather than
                // letting it fight the fresh focus animation for the camera.
                if (currentFocusedId !== 'earth' && getSkyEntryPhase() !== 'idle'
                        && getSkyEntryPhase() !== CURTAIN) {
                    resetSkyEntry();
                    skyApproachAnimating = false;
                }
                // Same for the tracker hand-off. Restores the camera roll it
                // had started leaning into, which the ordinary focus
                // machinery has no idea was touched.
                if (currentFocusedId !== 'earth' && !trkHolding
                        && (trkFlyIn || trkReframing)) {
                    trkFlyIn = trkReframing = false;
                    camera.up.set(0, 1, 0);
                    resetTrackerEntry();
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
            liveOrbitSpeed = stepOrbitSpeed(liveOrbitSpeed, speedTarget, { planetFocusChanged, frameScale });
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

            // Two ways of moving a moon, for two different jobs.
            //
            // Live, the angle is integrated frame to frame and multiplied by a
            // large factor, because a Galilean moon moving at its real rate is
            // motionless to the eye. That is a deliberate stylisation.
            //
            // Scrubbing, the angle is computed absolutely from the simulated
            // date at the moon's true period, so the system is correct for the
            // date on screen and running time backwards puts every moon exactly
            // where it was. `scrubBase` carries the live angles across the
            // switch so the two modes join without a jump.
            const deltaDays = prevNowDays != null
                ? Math.max(-0.005, Math.min(nowDays - prevNowDays, 0.005))
                : 0;
            prevNowDays = nowDays;

            if (scrubbing && !scrubBase) {
                scrubBase = { days: nowDays, angles: new Map(moonAngles) };
            } else if (!scrubbing && scrubBase) {
                // Settle every moon onto the angle the live date implies before
                // the integrator takes back over. A wind-back has already
                // walked nowDays home so this is a no-op; an instant reset
                // (reduced motion) skipped that, and without this the moons
                // would resume from wherever the scrub left them.
                MOON_DATA.forEach(moon => {
                    const base = scrubBase.angles.get(moon.name) ?? moon.phase0;
                    const dir = moon.retrograde ? -1 : 1;
                    const turns = (nowDays - scrubBase.days) / moon.period;
                    const a = base + dir * Math.PI * 2 * turns;
                    moonAngles.set(moon.name, Number.isFinite(a) ? a : moon.phase0);
                });
                scrubBase = null;
            }

            const moonTrailsOn = getTrailsOn();
            MOON_DATA.forEach(moon => {
                const parentGroup = planetMeshRefs.get(moon.parent);
                const moonMesh    = moonMeshRefs.get(moon.name);
                if (!parentGroup || !moonMesh) return;
                // Keep planet-shadow uniform in sync with the planet's current world position
                const shadowVec = moonMesh.material?.userData?.planetShadowPos;
                if (shadowVec) parentGroup.getWorldPosition(shadowVec);
                const parentFocused = (focusedPlanet && moon.parent === focusedPlanet.name)
                    || (focusedMoonParent && moon.parent === focusedMoonParent);
                let angle;
                if (scrubbing) {
                    const base = scrubBase.angles.get(moon.name) ?? moon.phase0;
                    const dir = moon.retrograde ? -1 : 1;
                    const turns = (nowDays - scrubBase.days) / moon.period;
                    angle = base + dir * Math.PI * 2 * turns;
                    if (!Number.isFinite(angle)) angle = moon.phase0;
                } else {
                    const effectiveSpeed = moon.noSpeedScaling
                        ? liveISSSpeed
                        : parentFocused ? MOON_SPEED : DEFAULT_ORBIT_SPEED;
                    angle = advanceMoonAngle(
                        moon, moonAngles.get(moon.name) ?? moon.phase0, deltaDays, effectiveSpeed,
                    );
                }
                moonAngles.set(moon.name, angle);
                const off = moonOffset(moon, angle, moonOrbitFactor(moon, sizeT));
                const mx = parentGroup.position.x + off.x;
                const my = parentGroup.position.y + off.y;
                const mz = parentGroup.position.z + off.z;
                moonMesh.position.set(mx, my, mz);
                const hitMesh = moonHitRefs.get(moon.name);
                if (hitMesh) hitMesh.position.set(mx, my, mz);

                // ── Moon trail ────────────────────────────────────────────
                // Only the focused planet's own moons draw one. Everything
                // else in the system keeps its planet-level trail and would
                // just be noise at this scale — and a moon's trail is only
                // legible at all once you are close enough for its orbit to
                // be more than a few pixels across, which is exactly the
                // state focusing its planet puts you in.
                const trail = moonTrails.get(moon.name);
                if (trail) {
                    // The moon you are actually looking at hides its own,
                    // the same way the focused planet hides its planet-level
                    // trail: at that range the arc sweeps the whole frame and
                    // is about where the body has been, which is not the
                    // question you asked by flying to it.
                    const want = (moonTrailsOn && parentFocused
                        && moon.id !== currentFocusedId) ? MOON_TRAIL_OPACITY : 0;
                    trail.mat.opacity += (want - trail.mat.opacity) * ease(0.08);
                    // Below this the line is invisible anyway, and skipping
                    // the rewrite is what keeps the other ~20 moons in the
                    // system free rather than merely cheap.
                    const lit = trail.mat.opacity > 0.004;
                    trail.line.visible = lit;
                    if (lit) {
                        const rf = moonOrbitFactor(moon, sizeT);
                        const r = moon.orbitR * (Number.isFinite(rf) ? rf : 1);
                        // moonOffset() inlined: it returns a fresh object,
                        // and this is 40 samples per moon per frame rather
                        // than the one the position above needs.
                        const incRad = (moon.inc * Math.PI) / 180;
                        const iSin = Math.sin(incRad), iCos = Math.cos(incRad);
                        const dir = moon.retrograde ? -1 : 1;
                        const posA = trail.geo.attributes.position;
                        const colA = trail.geo.attributes.color;
                        const c = trail.color;
                        for (let k = 0; k < MOON_TRAIL_REACH; k++) {
                            const a = angle - dir * MOON_TRAIL_SPAN * (1 - k / MOON_TRAIL_REACH);
                            const ca = Math.cos(a) * r, sa = Math.sin(a) * r;
                            posA.setXYZ(k,
                                parentGroup.position.x + ca,
                                parentGroup.position.y + sa * iSin,
                                parentGroup.position.z + sa * iCos);
                            // Quadratic taper, matching the planet trails.
                            const fade = k / MOON_TRAIL_REACH;
                            const eased = fade * fade;
                            colA.setXYZ(k, c.r * eased, c.g * eased, c.b * eased);
                        }
                        // The head is the moon's actual drawn position, not
                        // a 41st sample — same reason the planet trails do
                        // it: the trail should touch the body, not almost.
                        posA.setXYZ(MOON_TRAIL_REACH, mx, my, mz);
                        colA.setXYZ(MOON_TRAIL_REACH, c.r, c.g, c.b);
                        posA.needsUpdate = true;
                        colA.needsUpdate = true;
                    }
                }
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
                issOrbitMat.opacity += (tgt - issOrbitMat.opacity) * ease(0.08);
                // Its geometry is a fixed moon.orbitR circle, built once at
                // creation — never rebuilt for true sizes the way a body's
                // own drawn radius is. Scaling the line object itself by the
                // same factor its own orbital *position* already uses keeps
                // the ring honestly sized instead of a fixed compressed-mode
                // circle that's comically huge once everything else has
                // shrunk to true proportions.
                if (issOrbitLine && issMoonData) {
                    issOrbitLine.scale.setScalar(moonOrbitFactor(issMoonData, sizeT));
                }
            }
            if (issRingMesh && issRingMat) {
                const issMesh = moonMeshRefs.get('ISS');
                if (issMesh) {
                    issRingMesh.position.copy(issMesh.position);
                    issRingMesh.quaternion.copy(camera.quaternion);
                }
                // Same fixed-geometry issue as the orbit line above, but more
                // visible: a flat RingGeometry(0.152, 0.216) built once, never
                // rescaled — at true sizes it dwarfed Earth, the Moon and the
                // ISS model it's meant to merely highlight. Scaled by the same
                // factor the ISS mesh's own drawn radius already uses, so the
                // selection ring stays sized *relative to what it's selecting*.
                issRingMesh.scale.setScalar(bodyScaleFactor('iss', sizeT));
                const tgt = issFocused ? 0 : issHovered ? 0.92 : earthFocused ? 0.42 : 0;
                issRingMat.opacity += (tgt - issRingMat.opacity) * ease(0.1);
            }

            // ── Small body positions (updated every frame; orbits are slow) ───
            smallBodyGroups.forEach(({ group, body }) => {
                // body.scale is already scene units per AU for this body, so
                // true distances are simply AU_UNITS instead.
                const f = 1 + (AU_UNITS / body.scale - 1) * scaleT;
                const rawP = keplerianScenePos(body.el, body.scale * f, simTime);
                const pv   = new THREE.Vector3(rawP.x, rawP.y, rawP.z).applyQuaternion(beltQuat);
                group.position.set(pv.x, pv.y, pv.z);
            });

            // ── Probe positions ──────────────────────────────────────────────
            probeGroups.forEach(({ group, track, probe, trackCount }) => {
                const pp = probeScenePos(probe, simTime, scaleT);
                group.position.set(pp.x, pp.y, pp.z);
                // Scale with camera distance so the marker stays legible up
                // close, but cap it: pure constant-angular-size means the world
                // size grows without limit, and from the default view — over a
                // thousand units away — the halo came out rivalling the Sun.
                // The cap is well under Neptune's radius, so it reads as a
                // marker rather than a body.
                const d = camera.position.distanceTo(group.position);
                group.scale.setScalar(Math.min(1.2, Math.max(0.06, d * 0.0085)));
                // Show the path as far as the clock has got, and land the last
                // vertex on the craft. The rest of the geometry never moves —
                // scrubbing a decade only changes how much of it is drawn.
                const flown = Math.min(trackCount, trackDrawCount(probe.id, simTime));
                const arr = track.geometry.attributes.position.array;
                arr[flown * 3] = pp.x; arr[flown * 3 + 1] = pp.y; arr[flown * 3 + 2] = pp.z;
                track.geometry.attributes.position.needsUpdate = true;
                track.geometry.setDrawRange(0, flown > 0 ? flown + 1 : 0);
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
            meshRotSpeed += (targetRotSpeed - meshRotSpeed) * ease(0.03);
            sunMesh.rotation.y      += 0.0008 * frameScale;
            if (skySphere) skySphere.rotation.y += 0.00002 * frameScale;
            // Keep the lens-flare's anchor just clear of the Sun's surface on
            // the camera's side — see where it's created for why — and size
            // the flare against however big the Sun currently looks, so
            // zooming out shrinks the glare with the disc instead of leaving
            // it pasted over the scene at a fixed size (utils/lensFlareTextures.js
            // has the reasoning and the clamps).
            if (sunFlare) {
                const sunWorldRadius = SUN_RADIUS * sunScale.scale.x;
                flareAnchor.position.copy(camera.position)
                    .sub(sunMesh.position)
                    .setLength(sunWorldRadius * 1.04)
                    .add(sunMesh.position);
                setSunFlareScale(sunFlare, sunFlareScale(
                    sunWorldRadius,
                    camera.position.distanceTo(sunMesh.position),
                ));
            }
            planetMeshes.forEach(m => {
                // Halley holds still while focused. Its nucleus is an irregular
                // lump and the tails are fixed anti-sunward, so spinning it just
                // makes the shape wobble under a static tail.
                //
                // Earth holds still during the sky-entry approach for a
                // different reason: the ground point the camera is flying to
                // is read off Earth's live matrixWorld every frame (below), and
                // a still target is what makes a plain lerp toward it smooth —
                // otherwise the approach would be chasing a slowly spinning target.
                // Earth also holds still for the tracker hand-off, and for a
                // stronger reason than the sky dive's: that approach only
                // needed a still target to fly at, while this one is turning
                // Earth to a specific orientation the far side is matching.
                // Both writes below set the euler, which rebuilds the
                // quaternion the hand-off block assigns later in the frame,
                // so the pin has to cover the tilt as well as the spin.
                const earthPinned = m.userData.id === 'earth'
                    && (skyApproachAnimating || trkFlyIn || trkReframing || trkHolding);
                if (!(m.userData.id === 'halley' && currentFocusedId === 'halley')
                        && !earthPinned) {
                    m.rotation.y += meshRotSpeed * frameScale;
                }
                // Smoothly lerp axial tilt instead of snapping (avoids surface-texture jump)
                const targetZ = earthPinned ? undefined : tiltTargets.get(m.uuid);
                if (targetZ !== undefined) {
                    const diff = targetZ - m.rotation.z;
                    if (Math.abs(diff) < 0.0002) {
                        m.rotation.z = targetZ;
                        tiltTargets.delete(m.uuid);
                    } else {
                        m.rotation.z += diff * ease(0.04);
                    }
                }
            });
            moonMeshRefs.forEach(m => { m.rotation.y += meshRotSpeed * frameScale; });

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

            if (!targetMesh) focusFollowId = null;

            if (targetMesh) {
                exitPhase = 0;
                targetMesh.getWorldPosition(targetPos);

                // Chase camera: ride along with the body as it moves through
                // time, so a scrub or the "back to now" wind-back keeps it
                // framed instead of leaving the camera stranded where it was.
                // Shift the camera — and, mid fly-in, the animation's start/end
                // anchors — by the body's per-frame world delta.
                if (focusFollowId === currentFocusedId) {
                    _followDelta.subVectors(targetPos, focusFollowPrev);
                    const step2 = _followDelta.lengthSq();
                    if (step2 > 1e-10 && step2 < FOCUS_FOLLOW_MAX_STEP * FOCUS_FOLLOW_MAX_STEP) {
                        if (focusAnimating) {
                            focusStartCamPos.add(_followDelta);
                            focusEndCamPos.add(_followDelta);
                            // Orientations aren't touched here: both quats
                            // are pure rotations, and a chase-follow shift is
                            // a pure translation shared by the camera and the
                            // body it is flying to, so the direction between
                            // them — what a rotation actually encodes — is
                            // unchanged by it.
                        } else {
                            camera.position.add(_followDelta);
                            controls.target.add(_followDelta);
                        }
                    }
                }
                focusFollowPrev.copy(targetPos);
                focusFollowId = currentFocusedId;

                // Aim below the body by a fraction of the visible height — the
                // body then sits that much higher in frame.
                //
                // Eased, not read straight off the ref. On a phone this offset
                // is driven by the detail sheet opening, and it used to change
                // in one frame: the fly-in landed the body dead centre, the
                // sheet's own slide-up began, and the body jumped to its new
                // spot in a single frame while the panel was still moving.
                // Two motions, one of them instant, reading as a lurch. The
                // panel takes about a second; matching that here means the
                // body rises *with* it and the pair read as one movement.
                // Reset per focus (see the flight's own setup) so a fresh
                // fly-in always starts from centred rather than from whatever
                // the last body's sheet had left behind.
                vOffsetEased += (focusOffsetRef.current - vOffsetEased) * ease(0.055);
                if (vOffsetEased > 1e-4) {
                    const d = camera.position.distanceTo(targetPos);
                    const viewH = 2 * d * Math.tan((camera.fov * Math.PI / 180) / 2);
                    _camUpVec.set(0, 1, 0).applyQuaternion(camera.quaternion);
                    targetPos.addScaledVector(_camUpVec, -vOffsetEased * viewH);
                }

                const bodyDef = PLANETS.find(b => b.id === currentFocusedId)
                    ?? SMALL_BODIES.find(b => b.id === currentFocusedId)
                    ?? MOON_DATA.find(b => b.id === currentFocusedId)
                    ?? PROBES.find(b => b.id === currentFocusedId);
                // The body's radius as currently drawn, so focusing still frames
                // it at true sizes — where the unscaled 1.31 would park the
                // camera three units off a four-thousandths-of-a-unit Earth.
                const planetRadius = Math.max(1e-4,
                    framingRadius(currentFocusedId, sizeT)
                        || (bodyDef?.r ?? bodyDef?.radius ?? 3.5));
                controls.minDistance = planetRadius * 2.5;
                // Near plane must stay smaller than the closest moon can get to the camera.
                // e.g. Saturn r=3.56 → cam at 14.46, Mimas orbitR=13 → gap=1.46.
                // Using 0.1× radius keeps near well below that gap for all planet/moon combos.
                // The floor drops with true sizes for the same reason the rest
                // of this does — at 0.01 it would clip a true-size Earth away.
                camera.near = Math.max(Math.min(0.01, planetRadius * 0.02), planetRadius * 0.1);
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
                    controls.target.lerp(targetPos, ease(0.08));
                }

            } else if (exitPhase === 1) {
                camera.near = 1;
                camera.updateProjectionMatrix();
                if (isInteracting) {
                    // Grabbed control mid-exit — hand off immediately rather
                    // than fighting the drag, the same rule focus-in and the
                    // sky-entry approach both already use.
                    exitPhase = 0;
                } else {
                    // EXIT_SECONDS, cubic ease-in-out. Pulling back from the planet
                    // and recentring on the sun happen together, across one
                    // shared progress value, rather than a fixed-speed
                    // pull-back stage (target frozen on the planet) handing
                    // off to a separately-eased fly-to-sun stage (target
                    // sliding, distance re-eased from scratch) — that
                    // handoff was the seam being reported.
                    //
                    // The direction the camera backs away along is
                    // recomputed fresh from wherever the camera and target
                    // already are, every frame, rather than fixed once at
                    // the start: the target is sliding toward the sun
                    // underneath it, and a direction fixed at t=0 stays
                    // pinned to the abandoned planet's own radial line the
                    // whole way out — since that line already passes
                    // through the sun, the planet and the sun would arrive
                    // in a dead line behind one another. Re-deriving it from
                    // the live camera position each frame is what the old
                    // fly-to-sun stage did too (see its own git history);
                    // only the distance below is a clean, fixed-duration
                    // ease rather than an asymptotic one, so the whole
                    // motion — direction, distance and target together —
                    // reads as one continuous swing.
                    exitProgress = Math.min(1, exitProgress + deltaSec / EXIT_SECONDS);
                    const t = exitProgress < 0.5
                        ? 4 * exitProgress * exitProgress * exitProgress
                        : 1 - Math.pow(-2 * exitProgress + 2, 3) / 2;
                    controls.target.lerpVectors(exitStartTarget, EXIT_ORIGIN, t);
                    _exitDir.subVectors(camera.position, controls.target).normalize();
                    const nextDistance = THREE.MathUtils.lerp(exitStartDistance, 556, t);
                    // Tracks the eased distance itself, capped at the home
                    // view's usual 30, rather than jumping straight to 30 up
                    // front: a fixed minDistance higher than where the ease
                    // curve actually is yet is what controls.update() (right
                    // below) clamps camera.position out to, snapping the
                    // camera to that floor for as long as the cubic
                    // ease-in's slow start keeps nextDistance under it — the
                    // "seamless start" this was reported against.
                    controls.minDistance = Math.min(30, nextDistance);
                    camera.position.copy(controls.target).addScaledVector(_exitDir, nextDistance);
                    if (exitProgress >= 1) exitPhase = 0;
                }

            } else {
                // Normal home state — let the user zoom freely; the drift below
                // does the rest.
                const defaultTarget = new THREE.Vector3(0, 0, 0);
                controls.target.lerp(defaultTarget, ease(0.08));
            }

            // Whether idle drift is even allowed to show right now — home
            // view only, not mid-focus, mid-exit, or while the reader is
            // driving. Computed here, ahead of the easing below, rather than
            // inside the drift block that reads it: driftEase used to ease
            // toward the toggle's target unconditionally, every frame,
            // including the many seconds a focus+exit round trip can take —
            // so by the time canDrift went true again on returning home, the
            // ramp had usually already finished in the background, and
            // drift resumed at full strength in a single frame instead of
            // fading back in the way toggling it on mid-idle actually looks.
            const canDrift = !targetMesh && exitPhase === 0 && !focusAnimating
                && !isInteracting;

            // Eased rather than cut, so stopping looks like the scene coming
            // to rest. Snapped to zero at the tail, because a lerp only ever
            // approaches it and "almost still" is not what the button says.
            if (canDrift) {
                driftEase = THREE.MathUtils.lerp(driftEase, autoRotateRef.current ? 1 : 0, ease(0.05));
                if (!autoRotateRef.current && driftEase < 0.002) driftEase = 0;
                driftScale = THREE.MathUtils.lerp(driftScale, hoverSlow ? DRIFT_HOVER_SLOW : 1, ease(0.05));
            }

            // With no argument OrbitControls assumes 1/60s has passed. Handing
            // it the real delta makes any user-drag damping a rate rather than
            // a per-frame step — it ran 2.4x fast on a 144Hz laptop otherwise.
            controls.update(deltaSec);

            // ── Idle camera drift ──────────────────────────────────────────────
            // Applied by hand *after* controls.update, as two small rotations
            // of the camera about the target, each about one of the camera's
            // own axes: yaw about up, pitch about right. Yaw has no limit — it
            // is a turntable and goes round forever. Pitch does have one now,
            // and that is the fix for a reported bug rather than a taste
            // change: see PITCH_LIMIT below. controls.update reads the drifted
            // position back as its own orbit, so a later drag still works.
            // Home view only, not while the reader is driving.
            {
                const dr = driftRates();
                const ds = canDrift ? driftEase * driftScale : 0;
                const radius = camera.position.distanceTo(controls.target);

                _dBack.copy(camera.position).sub(controls.target);
                if (_dBack.lengthSq() < 1e-6) _dBack.set(0, 0, 1);
                _dBack.normalize();
                _dRight.crossVectors(camera.up, _dBack);
                if (_dRight.lengthSq() < 1e-6) _dRight.set(1, 0, 0);
                _dRight.normalize();
                _dUp.crossVectors(_dBack, _dRight).normalize();

                _dQ.identity();
                let moved = false;

                if (ds > 0.001) {
                    if (dr.pitch) {
                        // Pitch used to somersault over the poles, on the
                        // reasoning that up and right are re-derived every
                        // frame so nothing breaks. Nothing breaks in the
                        // rotation; what breaks is the roll-to-level
                        // correction below, which is what a camera carried
                        // over a pole lands in front of — upside down
                        // relative to world up, so a ~180° error for a
                        // corrector built for small ones. It drove at that
                        // error and spun the whole scene, and since the yaw
                        // axis has also flipped by then, the tumble fed
                        // itself rather than settling. That is the "left idle
                        // long enough and the screen pans uncontrollably"
                        // report, and the arithmetic matches it: the default
                        // 0.143 covers the 90° from the ecliptic to the pole
                        // in about 3m40s.
                        //
                        // So pitch is a pendulum now. It slows to nothing as
                        // it approaches PITCH_LIMIT and turns around there,
                        // which is both the fix and, at these rates, a nicer
                        // motion than a somersault was — the reversal happens
                        // at the one point the rate is already zero, so there
                        // is no visible corner to it. Yaw keeps running
                        // through it, so the view still explores the whole
                        // system rather than rocking along one line.
                        //
                        // Rotating _dBack about _dRight by +a moves _dBack.y
                        // by -_dUp.y per radian (the derivative of that
                        // rotation, since _dUp = _dBack × _dRight), which is
                        // what pitchPendulum needs to know which way this
                        // frame would take the camera.
                        const swing = pitchPendulum(
                            THREE.MathUtils.clamp(_dBack.y, -1, 1),
                            -_dUp.y,
                            dr.pitch,
                            driftPitchDir,
                        );
                        driftPitchDir = swing.dir;
                        if (swing.rate) {
                            _dQ.premultiply(_dTmpQ.setFromAxisAngle(_dRight, swing.rate * ds * deltaSec));
                            moved = true;
                        }
                    }
                    if (dr.yaw) {
                        _dQ.premultiply(_dTmpQ.setFromAxisAngle(_dUp, dr.yaw * ds * deltaSec));
                        moved = true;
                    }
                }

                // Roll → level. "Level" is world-up with the view component
                // removed; undefined looking straight up or down, so it simply
                // waits there — which the pitch band above now keeps it well
                // clear of anyway. Unconditional since 5.5.0: there is no
                // longer a roll slider that could be driving it instead.
                if (canDrift) {
                    _dLevelUp.set(0, 1, 0).projectOnPlane(_dBack);
                    if (_dLevelUp.lengthSq() > 1e-5) {
                        _dLevelUp.normalize();
                        const err = _dUp.angleTo(_dLevelUp);
                        if (err > 2e-3) {
                            const sign = _dCross.crossVectors(_dUp, _dLevelUp).dot(_dBack) < 0 ? -1 : 1;
                            _dQ.premultiply(_dTmpQ.setFromAxisAngle(_dBack, sign * err * 0.1));
                            moved = true;
                        }
                    }
                }

                if (moved) {
                    _dOff.copy(camera.position).sub(controls.target)
                        .applyQuaternion(_dQ).setLength(radius);
                    camera.position.copy(controls.target).add(_dOff);
                    camera.up.applyQuaternion(_dQ).normalize();
                    camera.lookAt(controls.target);
                    // The floating labels project against this next; without the
                    // refresh they trail a frame behind the tumbled camera.
                    camera.updateMatrixWorld();
                }
            }

            // Override camera position + lookAt AFTER controls.update()
            if (focusAnimating && targetMesh && !isInteracting) {
                // 1.2 seconds ordinarily (used to be 72 frames, which is 1.2s
                // at 60Hz, 0.6s at 120 and 0.3s on a 240Hz display, where
                // flying to a planet stopped reading as travel at all) — longer
                // at true sizes, set where the flight started (focusFlySeconds).
                focusProgress = Math.min(1, focusProgress + deltaSec / focusFlySeconds);
                // Cubic ease-in-out: slow start → accelerates → gentle brake
                const t = focusProgress < 0.5
                    ? 4 * focusProgress * focusProgress * focusProgress
                    : 1 - Math.pow(-2 * focusProgress + 2, 3) / 2;
                // Distance from the target eases in log space rather than a
                // straight position lerp. A plain lerp decelerates smoothly in
                // absolute units, which was fine while every landing distance
                // sat within an order of magnitude of the start — but true
                // sizes can land the camera thousands of times closer than
                // where it set off, and on a linear path nearly all of that
                // *relative* closing — the only part the eye actually tracks —
                // still happens in the last handful of frames, however gently
                // the raw distance itself tapers to zero. Closing by the same
                // ratio on every step of eased progress instead means the
                // final stretch reads as a landing rather than a lurch.
                _focusStartOffset.subVectors(focusStartCamPos, targetPos);
                _focusEndOffset.subVectors(focusEndCamPos, targetPos);
                const startDist = _focusStartOffset.length();
                const endDist   = _focusEndOffset.length();
                if (startDist > 1e-6 && endDist > 1e-6) {
                    const dist = startDist * Math.pow(endDist / startDist, t);
                    _focusDir.copy(_focusStartOffset).divideScalar(startDist)
                        .lerp(_focusEndOffset.divideScalar(endDist), t)
                        .normalize();
                    camera.position.copy(targetPos).addScaledVector(_focusDir, dist);
                } else {
                    camera.position.lerpVectors(focusStartCamPos, focusEndCamPos, t);
                }
                // Gradually rotate toward the planet instead of snapping the
                // look direction — by slerping the camera's *orientation*
                // between focusStartQuat and focusEndQuat (both "looking at
                // the body," just from the start and end camera positions —
                // see where focusStartQuat is set for why), not by lerping a
                // look-at point through raw 3D space. That was the earlier
                // approach, and it had a real bug: the camera's resting
                // look-target when unfocused eases toward the origin (see
                // "defaultTarget" below), so a fresh focus from the wide home
                // view started the lerp at the Sun's own position, and for a
                // good stretch of the flight the camera aimed at a point on
                // the straight line between the Sun and the new body — which
                // for the first chunk of that line *is* the Sun. Every fresh
                // focus visibly centred on the Sun before swinging round to
                // the actual target.
                camera.quaternion.slerpQuaternions(focusStartQuat, focusEndQuat, t);
                // controls.target still needs a value — anything reading it
                // this frame, and OrbitControls itself if the user grabs
                // control mid-flight — so it is derived from the same
                // orientation: the point straight ahead, as far out as the
                // body currently is. That converges on the body exactly at
                // t=1, since by then the camera already sits at
                // focusEndCamPos facing exactly it.
                camera.getWorldDirection(_focusGazeDir);
                _focusLookTarget.copy(camera.position)
                    .addScaledVector(_focusGazeDir, camera.position.distanceTo(targetPos));
                controls.target.copy(_focusLookTarget);
                if (focusProgress >= 1) {
                    focusAnimating = false;
                    controls.target.copy(targetPos);
                    setMoonLabelsReady(true);
                }
            }

            // ── Sky-entry: pick up the armed flag once Earth's own focus settles ──
            // One check covers both routes in: the frame the ordinary fly-in
            // above finishes (focusAnimating just went false) and arming while
            // already sitting on Earth unanimated (focusAnimating was already
            // false, so this fires the very frame armSkyEntry() ran).
            if (currentFocusedId === 'earth' && earthMesh && !focusAnimating
                    && getSkyEntryPhase() === ARMED) {
                setSkyEntryPhase(APPROACHING);
                skyApproachAnimating = true;
                skyApproachProgress  = 0;
                skyStartCamPos.copy(camera.position);
                skyStartQuat.copy(camera.quaternion);
            }

            // ── Sky-entry: approach the observer's spot and turn outward ──────
            // One continuous eased motion — the camera closes in on the
            // ground point and swings to face outward at the same time,
            // rather than a full approach finishing before a separate turn
            // starts. The ground point, its outward normal and a local
            // "north" tangent are read off earthMesh.matrixWorld fresh every
            // frame rather than cached at the start — Earth's own spin is
            // frozen for the duration (see the self-rotation block above),
            // so in practice this is a still target, but nothing here
            // depends on having caught it at exactly the right frame to be
            // one.
            if ((skyApproachAnimating || skyHolding) && earthMesh) {
                if (skyHolding) {
                    // Nothing left to compute — just keep re-asserting the
                    // exact frame the approach (or an abort, below) ended on,
                    // so OrbitControls' own update() — which just ran, above,
                    // with its ordinary "planet in frame" minDistance — never
                    // gets the last word and snaps the camera back out to a
                    // wide Earth view for the curtain's fade-in to cover.
                    camera.position.copy(skyHoldCamPos);
                    camera.quaternion.copy(skyHoldQuat);
                    controls.target.copy(skyHoldTarget);
                } else if (isInteracting) {
                    // Grabbed control mid-flight — drop the polish, keep the
                    // destination: still land on /sky, just without the rest
                    // of the choreography fighting the user for the camera.
                    // Hold from exactly here rather than releasing straight
                    // to OrbitControls, for the same reason a completed
                    // approach holds instead of releasing.
                    skyApproachAnimating = false;
                    skyHolding = true;
                    skyHoldCamPos.copy(camera.position);
                    skyHoldQuat.copy(camera.quaternion);
                    skyHoldTarget.copy(controls.target);
                    setSkyEntryPhase(CURTAIN);
                } else {
                    const obs = getSkyEntryObserver();
                    const lat = (obs?.lat ?? 0) * DEG2RAD;
                    const lon = (obs?.lon ?? 0) * DEG2RAD;
                    // Earth's radius as drawn right now — the dive lands on the
                    // surface at true sizes too, just a great deal closer in.
                    const R = scaledRadius('earth', sizeProgress())
                        || (PLANETS.find(p => p.id === 'earth')?.r ?? 1.31);

                    // Local (unrotated) unit-sphere point and its "north"
                    // tangent — same lat/lon convention as SatelliteGlobe.jsx's
                    // toVec3 — carried into this scene by the mesh's own world
                    // quaternion, so the approach lands on the same ground
                    // SatelliteGlobe would draw for the same coordinates.
                    skyGroundPos.set(
                        Math.cos(lat) * Math.cos(lon), Math.sin(lat), -Math.cos(lat) * Math.sin(lon));
                    skyNorth.set(
                        -Math.sin(lat) * Math.cos(lon), Math.cos(lat), Math.sin(lat) * Math.sin(lon));
                    earthMesh.updateMatrixWorld();
                    earthMesh.getWorldQuaternion(skyEarthQuat);
                    skyNorth.applyQuaternion(skyEarthQuat).normalize();
                    skyNormal.copy(skyGroundPos).applyQuaternion(skyEarthQuat).normalize();
                    skyGroundPos.multiplyScalar(R).applyMatrix4(earthMesh.matrixWorld);

                    // Cubic ease-in-out on both, but the turn runs on its own
                    // later-starting span — see SKY_TURN_START above for why.
                    skyApproachProgress = Math.min(1,
                        skyApproachProgress + deltaSec / SKY_DIVE_SECONDS);
                    const t  = skyEaseInOut(skyApproachProgress);
                    const tr = skyEaseInOut(Math.max(0,
                        (skyApproachProgress - SKY_TURN_START) / (1 - SKY_TURN_START)));

                    // The camera's near plane is 1 scene unit against Earth's
                    // 1.31 radius, so there is a floor on how close this can
                    // finish: any lower and the ground directly under the
                    // camera is clipped away rather than filling the frame.
                    const hover = R * 0.85;
                    skyCamPoint.copy(skyGroundPos).addScaledVector(skyNormal, hover);
                    // Finish on the look direction /sky itself opens at — due
                    // north, ARRIVAL_ALTITUDE above the horizon — rather than
                    // straight up the normal, so the curtain covers a cut
                    // between two frames that already match.
                    skyFarPoint.copy(skyCamPoint)
                        .addScaledVector(skyNormal, 40 * SKY_ARRIVAL_SIN)
                        .addScaledVector(skyNorth,  40 * SKY_ARRIVAL_COS);
                    skyLookMat.lookAt(skyCamPoint, skyFarPoint, skyNormal);
                    skyEndQuat.setFromRotationMatrix(skyLookMat);
                    camera.position.lerpVectors(skyStartCamPos, skyCamPoint, t);
                    camera.quaternion.slerpQuaternions(skyStartQuat, skyEndQuat, tr);
                    controls.target.copy(skyGroundPos);
                    if (skyApproachProgress >= SKY_CURTAIN_AT) setSkyEntryPhase(CURTAIN);
                    if (skyApproachProgress >= 1) {
                        skyApproachAnimating = false;
                        skyHolding = true;
                        skyHoldCamPos.copy(camera.position);
                        skyHoldQuat.copy(camera.quaternion);
                        skyHoldTarget.copy(skyGroundPos);
                        setSkyEntryPhase(CURTAIN);
                    }
                }
            }

            // ── Tracker hand-off ──────────────────────────────────────────────
            // Arming while already parked on Earth: there was no focus change
            // for the block above to override, so the same motion runs on its
            // own clock from wherever the camera is sitting.
            if (currentFocusedId === 'earth' && earthMesh && !focusAnimating
                    && !trkFlyIn && !trkReframing && !trkHolding
                    && getTrackerPhase() === TRK_ARMED) {
                setTrackerPhase(TRK_APPROACHING);
                trkReframing = true;
                trkProgress = 0;
                earthMesh.getWorldPosition(trkEarthPos);
                trkStartDir.subVectors(camera.position, trkEarthPos);
                trkStartDist = trkStartDir.length() || 1e-6;
                trkStartDir.normalize();
                trkStartUp.copy(camera.up).normalize();
                earthMesh.getWorldQuaternion(trkStartEarthQ);
            }

            if ((trkFlyIn || trkReframing || trkHolding) && earthMesh) {
                earthMesh.updateMatrixWorld();
                earthMesh.getWorldPosition(trkEarthPos);

                if (trkHolding) {
                    // Re-assert the final frame every frame until the route
                    // actually changes, for exactly the reason skyHolding
                    // does — controls.update() has already run this frame
                    // with its ordinary minDistance and would otherwise
                    // reclaim the camera the instant the motion stopped.
                    // Earth is pinned too: its own spin would carry the
                    // continents off the pose the far side is matching.
                    camera.position.copy(trkHoldCamPos);
                    camera.quaternion.copy(trkHoldQuat);
                    camera.up.copy(trkUp);
                    controls.target.copy(trkEarthPos);
                    earthMesh.quaternion.copy(trkTargetEarthQ);
                } else if (isInteracting) {
                    // Grabbed the camera mid-flight: drop the choreography,
                    // keep the destination. Snapshotting from an arbitrary
                    // pose would hand the tracker a still that matches
                    // nothing, so this hands over no snapshot at all and
                    // TrackerHandoff.jsx falls back to a plain fade.
                    trkFlyIn = trkReframing = false;
                    setTrackerSnapshot(null);
                    setTrackerPhase(TRK_HANDOFF);
                } else if (trkFlyIn) {
                    // Riding the focus fly-in. It owns the camera; all this
                    // adds is Earth's turn, eased off the same progress with
                    // the same curve, so the planet finishes rotating exactly
                    // as the camera finishes arriving.
                    const t = focusProgress < 0.5
                        ? 4 * focusProgress * focusProgress * focusProgress
                        : 1 - Math.pow(-2 * focusProgress + 2, 3) / 2;
                    earthMesh.quaternion.slerpQuaternions(trkStartEarthQ, trkTargetEarthQ, t);
                    if (!focusAnimating) {
                        // The flight has landed on the pose. Nothing to hold
                        // for — the cross-fade's own fade-in is the pause.
                        trkFlyIn = false;
                        camera.up.copy(trkUp);
                        trkCapture();
                    }
                } else {
                    // The already-on-Earth case, under its own power.
                    const R = scaledRadius('earth', sizeProgress())
                        || (PLANETS.find(pl => pl.id === 'earth')?.r ?? 1.31);
                    trkSolvePose(trkEarthPos, R);

                    trkProgress = Math.min(1, trkProgress + deltaSec / TRK_REFRAME_SECONDS);
                    const t = skyEaseInOut(trkProgress);

                    // Distance eases in log space, the same way the ordinary
                    // focus fly-in does and for the same reason: at true
                    // sizes the two ends of this can differ by a large
                    // factor, and a linear ramp across that spends its first
                    // frames covering most of the ground.
                    const endDist = trkCamPoint.distanceTo(trkEarthPos);
                    const dist = trkStartDist * Math.pow(endDist / trkStartDist, t);
                    // Swept as a rotation, not as lerp-then-normalise. Being
                    // already focused on Earth means being on the framing the
                    // focus block picked, which puts the Sun at ten o'clock
                    // and the camera very nearly over the night side — so the
                    // two ends of this are close to antiparallel, a straight
                    // lerp between them passes through the zero vector around
                    // halfway, and normalising that sends the camera
                    // somewhere arbitrary. It did: the planet left the frame
                    // entirely for the middle third of the move.
                    // setFromUnitVectors picks a sane axis even at exactly
                    // 180°, so the camera takes a clean arc round the planet.
                    trkArcFull.setFromUnitVectors(trkStartDir, trkWorldSun);
                    trkArcPart.copy(TRK_IDENTITY).slerp(trkArcFull, t);
                    trkDir.copy(trkStartDir).applyQuaternion(trkArcPart).normalize();
                    camera.position.copy(trkEarthPos).addScaledVector(trkDir, dist);

                    // Aimed from where the camera actually is this frame,
                    // rather than slerped between the look-at quaternions of
                    // the two ends. Those two agree only at the ends: halfway
                    // round an arc this wide the interpolated orientation is
                    // no longer pointing at the thing both ends are pointing
                    // at, and the planet slides off toward the edge of the
                    // frame and back. Re-aiming each frame keeps it dead
                    // centre for the whole swing, and sweeping the up vector
                    // on the same arc is what still delivers the roll.
                    trkArcFull.setFromUnitVectors(trkStartUp, trkUp);
                    trkArcPart.copy(TRK_IDENTITY).slerp(trkArcFull, t);
                    trkDirUp.copy(trkStartUp).applyQuaternion(trkArcPart).normalize();
                    trkLookMat.lookAt(camera.position, trkEarthPos, trkDirUp);
                    camera.quaternion.setFromRotationMatrix(trkLookMat);
                    camera.up.copy(trkDirUp);
                    controls.target.copy(trkEarthPos);
                    earthMesh.quaternion.slerpQuaternions(trkStartEarthQ, trkTargetEarthQ, t);

                    if (trkProgress >= 1) {
                        trkReframing = false;
                        trkCapture();
                    }
                }

                // The ISS orbit ring fades up on Earth focus, and a white
                // circle round the planet is the one thing in this frame the
                // globe has no answer for.
                if (issOrbitMat) issOrbitMat.opacity *= Math.max(0, 1 - deltaSec * 6);
            }

            // Cheap, but there is no need to re-measure forty hitboxes every
            // frame — nothing moves far enough in a sixth of a second to matter.
            if (frameCount % 10 === 0) sizeHitboxes();

            // ── Object labels ──────────────────────────────────────────────────
            // Rebuild the roster only when the focus changes; otherwise just
            // move the nodes that already exist. See buildLabelTargets above.
            if (mounted) {
                if (labelBuiltFor !== currentFocusedId) {
                    labelBuiltFor = currentFocusedId;
                    labelTargets  = buildLabelTargets(currentFocusedId);
                    labelZ.clear();
                    setLabelRoster(labelTargets.map(({ key, id, name, kind }) => ({ key, id, name, kind })));
                }
                // The labels project against camera.matrixWorldInverse. After
                // controls.update() moved the camera this frame, that matrix is
                // still last frame's — renderer.render() is what refreshes it,
                // and that runs after this. So a drag or a zoom left every label
                // trailing one frame behind its body until the motion stopped.
                // Refresh it here (the drift block does the same when it moves
                // the camera itself).
                camera.updateMatrixWorld();
                positionLabels();
            }

            // ── Belt LOD ──────────────────────────────────────────────────────
            // Tumbling the instances means rebuilding ~3,200 matrices on the CPU
            // every frame, for rocks a couple of pixels across. Only the top tier
            // pays for it, and even there only every third frame — the motion is
            // far too slow to tell apart.
            if (abLODGroups.length > 0 && abParticles) abParticles.visible = false;
            if (kbLODGroups.length > 0 && kbParticles) kbParticles.visible = false;

            if (q.beltLODRotate && frameCount % 3 === 0) {
                const spin = (groups, anglesKey, sizeKey, inner, outer, auInner, auOuter) => {
                    groups.forEach(({ mesh, positions, scales, def }) => {
                        const angles = mesh.userData[anglesKey];
                        for (let i = 0; i < positions.length; i++) {
                            const a = angles[i];
                            // times three because this runs every third frame,
                            // times the frame length because a frame is not one.
                            const spinStep = 3 * frameScale;
                            a.ax += a.sx * spinStep;
                            a.ay += a.sy * spinStep;
                            a.az += a.sz * spinStep;
                            // Through the layout the rocks are standing at —
                            // rebuilding from the unscaled position would snap
                            // the belt back inside Jupiter every third frame.
                            const p = positions[i];
                            const f = beltFactorAt(p.length(), inner, outer, auInner, auOuter, beltLayout.t);
                            lodDummy.position.copy(p).multiplyScalar(f);
                            lodDummy.rotation.set(a.ax, a.ay, a.az);
                            lodDummy.scale.setScalar(def[sizeKey] * scales[i]);
                            lodDummy.updateMatrix();
                            mesh.setMatrixAt(i, lodDummy.matrix);
                        }
                        mesh.instanceMatrix.needsUpdate = true;
                    });
                };
                spin(abLODGroups, 'abAngles', 'abSize', AB_INNER, AB_OUTER, 2.2, 3.2);
                spin(kbLODGroups, 'kbAngles', 'kbSize', KB_INNER, KB_OUTER, 30, 50);
            }

            // Paint first, upload second, and never the same surface on the
            // same frame: a canvas painted here is picked up by the upload
            // drain a frame or two later, so the two costs stay apart.
            paintSomeSurfaces();
            uploadSomeTextures();

            if (sRingRefs.mat?.userData?.shader) {
                sRingRefs.group.getWorldPosition(
                    sRingRefs.mat.userData.shader.uniforms.uSaturnPos.value
                );
                // The shadow test compares this against oc/d2, which are
                // measured off vRingWorldPos — the ring's actual world-space
                // extent, already shrunk by true sizes since the ring hangs
                // off bodyScale. uSaturnRadius has to shrink with it or the
                // radius stays at its full drawn size (3.56) while the ring
                // it is supposedly the silhouette of is a hundredth of a unit
                // across — every point within that now-enormous stale radius
                // reads as shadowed, which in practice is the whole half of
                // the ring facing away from the Sun rather than the narrow
                // strip actually behind the planet.
                sRingRefs.mat.userData.shader.uniforms.uSaturnRadius.value =
                    scaledRadius('saturn', sizeT);
            }

            // Publish where the camera is, so a share link can carry it. Every
            // twentieth frame: it is read only when someone presses a button,
            // and a spherical conversion per frame is a waste of a phone.
            if (frameCount % 20 === 0) {
                _shareSpherical.setFromVector3(camera.position);
                setCameraSnapshot({
                    theta: THREE.MathUtils.radToDeg(_shareSpherical.theta),
                    phi: THREE.MathUtils.radToDeg(_shareSpherical.phi),
                    distance: _shareSpherical.radius,
                });
            }

            // ── Gravity overlays ──────────────────────────────────────────────
            {
                const gGridW  = vizWeight(VIZ_GRID);
                const gFieldW = vizWeight(VIZ_FIELD);
                // Fade the whole thing out once you have flown into a body — a
                // system-wide sheet is noise from inside one planet's space.
                gravFocusFade = THREE.MathUtils.lerp(
                    gravFocusFade, currentFocusedId ? 0 : 1, ease(0.08));

                const gridOn  = gGridW  * gravFocusFade > 0.002;
                const fieldOn = gFieldW * gravFocusFade > 0.002;
                gravGrid.mesh.visible    = gridOn;
                gravLines.object.visible = fieldOn;

                if ((gridOn || fieldOn)
                    && (getVizMode() !== VIZ_OFF || isVizSettling())) {
                    const gBodies = collectGravityBodies(scaleT);

                    if (gridOn) {
                        gravGrid.setOpacity(gGridW * gravFocusFade * 0.9);
                        gravGrid.update(gBodies, scaleT);   // every frame — pure shader
                    }

                    if (fieldOn) {
                        // 0.62, not 0.85: additive blending piles up where the
                        // ~390 hairlines converge, and the sinks were blowing out.
                        gravLines.setOpacity(gFieldW * gravFocusFade * 0.62);
                        // Retrace only when a body has actually moved. The gate
                        // is displacement, not wall-clock: sped-up sim time
                        // moves the planets a lot per frame and the lines keep
                        // up; at live rate nothing moves and it never retraces
                        // after the first. Capped to once per GRAV_RETRACE_FRAMES.
                        let moved = Infinity;
                        if (gravTraceAt) {
                            moved = 0;
                            for (let i = 0; i < gBodies.length; i++) {
                                const d = gBodies[i].pos.distanceTo(gravTraceAt[i]);
                                if (d > moved) moved = d;
                            }
                        }
                        if ((moved >= GRAV_RETRACE_MOVE || scaleT !== gravTraceScaleT)
                            && frameCount - gravTraceFrame >= gravRetraceFrames) {
                            const _t0 = performance.now();
                            const bounds = GRAV_FIELD_BOUNDS
                                + (GRAV_FIELD_BOUNDS_TRUE - GRAV_FIELD_BOUNDS) * scaleT;
                            gravRetraceStats = gravLines.retrace(
                                gBodies, { ...GRAVITY_FIELD_DEFAULTS, bounds });
                            gravRetraceMs = performance.now() - _t0;
                            gravTraceAt = gBodies.map(b => b.pos.clone());
                            gravTraceFrame = frameCount;
                            gravTraceScaleT = scaleT;
                            // Back off if the trace ran long relative to the
                            // frame — a weak CPU being scrubbed fast. Recovers
                            // one frame at a time once it is cheap again.
                            const budget = Math.max(8, deltaSec * 1000) / 3;
                            gravRetraceFrames = gravRetraceMs > budget
                                ? Math.min(6, gravRetraceFrames + 1)
                                : Math.max(q.tier === 'low' ? 2 : 1, gravRetraceFrames - 1);
                            if (gravPerfLog) {
                                console.log(
                                    `[gravity] retrace ${gravRetraceMs.toFixed(2)}ms`
                                    + ` · ${gravRetraceStats.lines} lines`
                                    + ` · ${gravRetraceStats.segments} segments`
                                    + ` · ${gravRetraceStats.steps} RK4 steps`
                                    + ` · every ${gravRetraceFrames}f`);
                            }
                        }
                    }
                }
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
            // An in-flight dive/turn has nowhere to finish if this scene is
            // going away outside of its own curtain-triggered navigate() —
            // e.g. the reader hit back mid-flight. Once phase reaches
            // 'curtain' the sequence is SkyEntryCurtain's to finish (that
            // navigate() is what unmounts this scene in the first place), so
            // leave it alone.
            if (getSkyEntryPhase() === ARMED || getSkyEntryPhase() === APPROACHING) {
                resetSkyEntry();
            }
            // Same rule for the tracker: once it reaches 'handoff' the
            // sequence belongs to TrackerHandoff.jsx, whose navigate() is
            // what unmounts this scene. Before that, an unmount means the
            // visitor left some other way and there is nothing to arrive at.
            if (getTrackerPhase() === TRK_ARMED || getTrackerPhase() === TRK_APPROACHING) {
                resetTrackerEntry();
            }
            // Nothing to share once this scene is gone
            setCameraSnapshot(null);
            cancelAnimationFrame(animId);
            idleTimers.forEach(cancel => cancel());
            clearInterval(posInterval);
            unsubTrails();
            ro.disconnect();
            orientationMQ?.removeEventListener('change', syncSky);
            renderer.domElement.removeEventListener('click',     handleClick);
            renderer.domElement.removeEventListener('mousemove', handleMouseMove);
            sceneHoverRef.current = null;
            renderer.domElement.removeEventListener('webglcontextlost',     onContextLost);
            renderer.domElement.removeEventListener('webglcontextrestored', onContextRestored);
            if (mount.contains(renderer.domElement)) mount.removeChild(renderer.domElement);
            controls.dispose();
            sunFlare?.dispose();
            geos.forEach(g => g.dispose());
            mats.forEach(m => m.dispose());
            textures.forEach(t => t.dispose());
            beltLODInstances.forEach(m => { m.geometry.dispose(); scene.remove(m); });
            orbitLines.forEach(l => { l.geometry.dispose(); l.material.dispose(); });
            scene.remove(gravGrid.mesh, gravLines.object);
            gravGrid.dispose();
            gravLines.dispose();
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
                {/* What the view is and is not honest about. In the compressed
                    layout that is an apology; in true distances it is a
                    distinction, because the distances become real and the
                    bodies stay drawn far too large to be seen otherwise. */}
                {/* Gone while a body is focused. It is a caveat about the
                    overview's layout — how far apart the orbits are drawn —
                    and once the camera is sitting on one planet there is no
                    layout left for it to be about. */}
                <div className="scene-note" data-hidden={!!focusedId || undefined}>
                    {t(scaleStage === SCALE_SIZES ? 'scene.allToScale'
                        : scaleStage === SCALE_DISTANCES ? 'scene.distancesToScale'
                            : 'scene.notToScale')}
                </div>

                {/* Floating object labels — each one a button that flies to its
                    body, so the name is a target in its own right (the dot it
                    sits beside is a few pixels wide in the compressed view) and
                    a keyboard can tab through the bodies the same way.

                    Place, z-order and visibility belong to the render loop, so
                    they are deliberately absent from the style below: React
                    diffs only what it set itself, and leaving those three out
                    means a re-render here can never undo the loop's writes.
                    Planet labels stack 20–28, small bodies 12–16, moons 4–8.

                    pointerEvents:none on the button keeps a drag that starts on
                    a label orbiting the scene rather than being swallowed; the
                    text span opts back in, so the glyphs themselves are the
                    click target. Neither affects keyboard focus. */}
                {labelRoster.map(({ key, id, name, kind }) => {
                    const isMoon      = kind === 'moon';
                    const isSmallBody = kind === 'small-body';
                    return (
                    <button
                        key={key}
                        type="button"
                        ref={(el) => {
                            if (el) labelElsRef.current.set(key, el);
                            else labelElsRef.current.delete(key);
                        }}
                        onClick={() => id && navigate(`/object/${id}`)}
                        // Match the hover the canvas gives the body itself —
                        // orbit ring lit, drift held, moon slowed — and give a
                        // keyboard the same feedback as it tabs through.
                        onMouseEnter={() => id && sceneHoverRef.current?.enter(id)}
                        onMouseLeave={() => sceneHoverRef.current?.leave()}
                        onFocus={() => id && sceneHoverRef.current?.enter(id)}
                        onBlur={() => sceneHoverRef.current?.leave()}
                        aria-label={t('scene.flyTo', { name: bodyName(name) })}
                        className="focus-ring"
                        style={{
                            position: 'absolute',
                            top: 0,
                            left: 0,
                            // Hidden until the loop has projected it somewhere
                            visibility: 'hidden',
                            pointerEvents: 'none',
                            willChange: 'transform',
                            opacity: isMoon ? (moonLabelsReady ? 1 : 0) : isSmallBody ? 0.72 : 1,
                            transition: isMoon ? 'opacity 0.5s ease' : 'none',
                            background: 'none', border: 'none', padding: 0, margin: 0,
                        }}
                    >
                        <span style={{
                            display: 'block',
                            pointerEvents: 'auto',
                            cursor: 'pointer',
                            color: 'rgba(255,255,255,0.92)',
                            fontSize: isMoon || isSmallBody ? 8 : 11,
                            fontWeight: 700,
                            letterSpacing: '0.07em',
                            lineHeight: 1.3,
                            textShadow: '0 1px 4px rgba(0,0,0,0.9)',
                            whiteSpace: 'nowrap',
                        }}>
                            {bodyName(name)}
                        </span>
                    </button>
                    );
                })}
            </div>
        </div>
    );
};

export default SolarSystem3D;
