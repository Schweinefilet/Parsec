import * as THREE from 'three';
import { damp } from '../utils/gargantuaCamera';
import { THROAT } from '../utils/wormhole';
import { surfaceRedshift, visibleFraction, hotRegions, J0030, DEFAULT_RADIUS, KM_PER_M } from '../utils/neutronStar';
import {
    START_SEPARATION, MERGE_SEPARATION, REMNANT_MASS, petersSeparation, petersMergeTime,
    orbitalOmega, holePositions, gwFrequency, SECONDS_PER_M_SUN,
} from '../utils/binaryHole';
import {
    masses, positions, l1Point, rochePotential, rocheGradient, lobeRadius, streamPath,
    diskOuterRadius, eggletonRadius, accretorAzimuth,
} from '../utils/roche';
import { STREAM_POINTS } from '../utils/exoticShaders';
import { HL_TAU, GAPS, PLANETS, planetPosition, gasAspect } from '../utils/protoplanetaryDisk';
import {
    WR104, outflowAuPerDay, armSpacing, dustOnset, shockHalfAngle, coneTrail, starPositions,
} from '../utils/pinwheel';
import {
    RING, SHELL, HALO, ARCSEC_KAU, paletteColours,
} from '../utils/planetaryNebula';
import { blackbodyRGB } from '../utils/blackbody';

// Each /exotic object's own uniforms, and what it does every frame: the
// physics clock, the moving parts, the readouts. Exotic3D.jsx owns the
// renderer, the camera and the passes; this is the part that differs.
//
// `update` gets { dt, s (settings), u (the uniforms), frame, cam } and
// returns the readouts for the page, or null. It also returns `skyTurn` when
// the scene turns its sky (the Roche system orbits; the camera does not).

const GW_SOLAR_MASSES = 65; // a GW150914-sized pair, for the readout
// J0030 turns 205 times a second; one turn every few seconds shows it.
const SPIN_SECONDS = 4;
const ORBIT_SECONDS = 26; // one turn of the Roche binary, real seconds
const INSPIRAL_SECONDS = 38;
const MERGED_HOLD = 7;

function wormhole() {
    const otherRot = new THREE.Matrix3().setFromMatrix4(
        new THREE.Matrix4().makeRotationFromEuler(new THREE.Euler(-0.6, 1.9, 0.3, 'XYZ')),
    );
    const uniforms = {
        uThroat: { value: THROAT },
        uCamL: { value: 10 },
        uOtherRot: { value: otherRot },
        // Behind the throat as the camera first sees it.
        uGalaxyDir: { value: new THREE.Vector3(-Math.cos(0.3), -Math.sin(0.3), -0.12).normalize() },
    };
    const update = ({ u, cam }) => {
        u.uCamL.value = cam.dist;
        u.uEscape.value = Math.max(Math.abs(cam.dist) * 1.5, 60 * THROAT);
        return { l: cam.dist };
    };
    return { uniforms, update };
}

function neutronStar() {
    const spots = hotRegions();
    const uniforms = {
        uSpin: { value: 0 },
        uRadius: { value: DEFAULT_RADIUS },
        uRedshift: { value: surfaceRedshift(DEFAULT_RADIUS) },
        uPhase: { value: 0 },
        uSurfTemp: { value: J0030.surfaceTemp },
        uHotTemp: { value: J0030.spotTemp },
        uSpotA: { value: new THREE.Vector3(...spots.st) },
        uSpotB: { value: new THREE.Vector3(...spots.pst) },
        uSpotBIn: { value: new THREE.Vector3(...spots.pstInner) },
        uSpotRadii: { value: new THREE.Vector3(J0030.st.radius, J0030.pst.radius, J0030.pst.innerRadius) },
        uBeamA: { value: new THREE.Vector3() },
        uBeamB: { value: new THREE.Vector3() },
        uBeams: { value: 1 },
        uGrid: { value: 0 },
    };
    // Turn a star-frame vector by the spin phase, into the scene's frame.
    const turn = (v, ph, out) => out.set(
        Math.cos(ph) * v[0] - Math.sin(ph) * v[1],
        Math.sin(ph) * v[0] + Math.cos(ph) * v[1],
        v[2],
    );
    let t = 0;
    let radius = DEFAULT_RADIUS;
    let beams = 1;
    let grid = 0;
    let frac = visibleFraction(radius);
    const update = ({ dt, s, u, cam }) => {
        t += dt;
        const r = damp(radius, s.radius, 3, dt);
        if (Math.abs(r - radius) > 1e-4) frac = visibleFraction(r);
        radius = r;
        beams = damp(beams, s.pulsar ? 1 : 0, 3, dt);
        grid = damp(grid, s.grid ? 1 : 0, 4, dt);
        const phase = (2 * Math.PI * t) / SPIN_SECONDS;
        u.uRadius.value = radius;
        u.uRedshift.value = surfaceRedshift(radius);
        u.uPhase.value = phase;
        turn(spots.st, phase, u.uBeamA.value);
        turn(spots.pst, phase, u.uBeamB.value);
        u.uBeams.value = beams;
        u.uGrid.value = grid;
        u.uEscape.value = Math.max(cam.dist * 1.4, 60);
        return {
            radius, km: radius * KM_PER_M, visible: frac,
            redshift: surfaceRedshift(radius),
        };
    };
    return { uniforms, update };
}

function binary() {
    const uniforms = {
        uHole1: { value: new THREE.Vector4(5, 0, 0, 0.5) },
        uHole2: { value: new THREE.Vector4(-5, 0, 0, 0.5) },
        uDisk: { value: 1 },
        uDiskIn: { value: 2.1 * START_SEPARATION },
        uDiskOut: { value: 4.4 * START_SEPARATION },
        uDiskTemp: { value: 4200 },
    };
    const m1 = 0.5, m2 = 0.5;
    const T = petersMergeTime(START_SEPARATION, m1, m2);
    // Sim time (in M) per real second, so the inspiral takes INSPIRAL_SECONDS.
    const rate = T / INSPIRAL_SECONDS;
    let tSim = 0;
    let held = START_SEPARATION;
    let phase = 0;
    let merged = null; // seconds since the merger
    let disk = 1;
    let diskTime = 0;
    const update = ({ dt, s, u, cam }) => {
        disk = damp(disk, s.disk ? 1 : 0, 3, dt);
        u.uDisk.value = disk;
        diskTime += dt * rate;
        u.uTime.value = diskTime;
        u.uEscape.value = Math.max(cam.dist * 1.4, 90);

        if (merged != null) {
            merged += dt;
            if (merged > MERGED_HOLD) { merged = null; tSim = 0; held = START_SEPARATION; }
        }
        if (merged != null) {
            u.uHole1.value.set(0, 0, 0, REMNANT_MASS);
            u.uHole2.value.set(1e4, 0, 0, 0);
            return { merged: true, separation: 0, gw: null, toMerge: 0 };
        }

        let a;
        if (s.hold) {
            a = held;
        } else {
            tSim += dt * rate;
            a = petersSeparation(tSim, START_SEPARATION, m1, m2);
            held = a;
        }
        if (a <= MERGE_SEPARATION) {
            merged = 0;
            return { merged: true, separation: 0, gw: null, toMerge: 0 };
        }
        phase += dt * rate * orbitalOmega(a);
        const [h1, h2] = holePositions(a, phase, m1, m2);
        u.uHole1.value.set(h1.c[0], h1.c[1], h1.c[2], h1.m);
        u.uHole2.value.set(h2.c[0], h2.c[1], h2.c[2], h2.m);
        const left = petersMergeTime(a, m1, m2) - petersMergeTime(MERGE_SEPARATION, m1, m2);
        return {
            merged: false, separation: a,
            gw: gwFrequency(a, GW_SOLAR_MASSES),
            toMerge: left * SECONDS_PER_M_SUN * GW_SOLAR_MASSES,
        };
    };
    return { uniforms, update };
}

function rocheSystem() {
    const uniforms = {
        uMd: { value: 0.3 }, uMa: { value: 0.7 },
        uXd: { value: 0.7 }, uXa: { value: -0.3 },
        uXL1: { value: 0 }, uPhiL1: { value: -1.5 },
        uBound: { value: 0.3 }, uGPole: { value: 1 },
        uDonorTemp: { value: 4800 },
        uStream: { value: Array.from({ length: STREAM_POINTS }, () => new THREE.Vector3()) },
        uStreamWidth: { value: 0.014 },
        // Where the disk is cut off: the real inner edge is a hundred
        // thousand times smaller, and stands in for the point glare.
        uDiskIn: { value: 0.003 },
        uDiskOut: { value: 0.25 },
        // A cool outer disk, T ∝ r^−3/4 inward from here to the white-hot middle.
        uDiskTemp: { value: 4200 },
        uDiskHR: { value: 0.07 },
        uSpotPhi: { value: 1 },
        uIrrTemp: { value: 5400 },
    };
    let q = null;
    let info = null;
    let orbit = 0;
    let time = 0;
    const rebuild = (nq) => {
        q = nq;
        const { md, ma } = masses(q);
        const { xd, xa } = positions(q);
        const lx = l1Point(q);
        const phiL1 = rochePotential(lx, 0, 0, q);
        const back = lobeRadius([1, 0, 0], q, phiL1);
        const gp = Math.hypot(...rocheGradient(xd + back, 0, 0, q));
        const rd = diskOuterRadius(q);
        const { points } = streamPath(q, { count: STREAM_POINTS, rStop: rd });
        uniforms.uMd.value = md;
        uniforms.uMa.value = ma;
        uniforms.uXd.value = xd;
        uniforms.uXa.value = xa;
        uniforms.uXL1.value = lx;
        uniforms.uPhiL1.value = phiL1;
        uniforms.uBound.value = (xd - lx) * 1.01;
        uniforms.uGPole.value = gp;
        uniforms.uDiskOut.value = rd;
        points.forEach((p, i) => uniforms.uStream.value[i].set(p[0], p[1], p[2]));
        const end = points[points.length - 1];
        uniforms.uSpotPhi.value = accretorAzimuth(end[0], end[1], q);
        info = { q, l1: lx - xa, lobe: eggletonRadius(q), disk: rd };
    };
    const update = ({ dt, s, u }) => {
        if (s.q !== q) rebuild(s.q);
        u.uDonorTemp.value = damp(u.uDonorTemp.value, s.donorTemp, 3, dt);
        orbit += (dt * 2 * Math.PI) / ORBIT_SECONDS;
        time += dt;
        u.uTime.value = time;
        return { ...info, skyTurn: orbit };
    };
    return { uniforms, update };
}

// Years of the disk's life per real second: the inner planet laps the star
// in about nine seconds.
const HL_TAU_YEARS_PER_SECOND = 4;

function hlTau() {
    const FWHM = 2 * Math.sqrt(2 * Math.log(2));
    const uniforms = {
        uGaps: { value: GAPS.map((g) => new THREE.Vector3(g.r, g.width / FWHM, g.depth)) },
        uOuter: { value: HL_TAU.outerRadius },
        uPlanets: { value: PLANETS.map(() => new THREE.Vector4()) },
        uPlanetQ: { value: PLANETS.map((p) => p.q) },
        uPlanetOn: { value: 1 },
        uView: { value: 0 },
        uJet: { value: 1 },
        uStarTemp: { value: HL_TAU.starTemp },
    };
    let years = 0;
    let first = true;
    const update = ({ dt, s, u, cam }) => {
        years += dt * HL_TAU_YEARS_PER_SECOND;
        u.uTime.value = years;
        const view = s.view === 'visible' ? 1 : 0;
        u.uView.value = first ? view : damp(u.uView.value, view, 2.5, dt);
        u.uPlanetOn.value = damp(u.uPlanetOn.value, s.planets ? 1 : 0, 3, dt);
        u.uJet.value = damp(u.uJet.value, s.jet ? 1 : 0, 3, dt);
        first = false;
        PLANETS.forEach((p, i) => {
            const [x, y, z] = planetPosition(p, years);
            u.uPlanets.value[i].set(x, y, z, gasAspect(p.r));
        });
        return { years, au: Math.abs(cam.dist) };
    };
    return { uniforms, update };
}

// One orbit of WR 104 every this many real seconds.
const WR104_ORBIT_SECONDS = 9;
// The wind momentum ratio the shell's thickness is scaled from.
const WR104_ETA = 0.01;

function wr104() {
    const P = WR104.periodDays;
    const uniforms = {
        uTheta: { value: shockHalfAngle(WR104_ETA) },
        uWidth: { value: 0.07 },
        uV: { value: outflowAuPerDay() },
        uPeriod: { value: P },
        uSkew: { value: coneTrail() },
        uR0: { value: dustOnset() },
        uRMax: { value: dustOnset() + 5 * armSpacing() },
        uDays: { value: 0 },
        uStarA: { value: new THREE.Vector3() },
        uStarB: { value: new THREE.Vector3() },
        uGain: { value: 1e8 },
    };
    let days = 0;
    let theta = uniforms.uTheta.value;
    const update = ({ dt, s, u }) => {
        days = (days + (dt * P) / WR104_ORBIT_SECONDS) % P;
        // The pattern repeats every orbit, so the clock wraps: small numbers
        // for the GPU's floats. (uDays − r/v going negative is fine.)
        u.uTime.value += dt;
        u.uDays.value = days;
        theta = damp(theta, shockHalfAngle(s.eta), 3, dt);
        u.uTheta.value = theta;
        // A wider cone, a proportionally thicker shell.
        u.uWidth.value = 0.07 * Math.max(theta / shockHalfAngle(WR104_ETA), 0.5);
        const [a, b] = starPositions(days);
        u.uStarA.value.set(...a);
        u.uStarB.value.set(...b);
        return { spacing: armSpacing(), cone: (2 * theta * 180) / Math.PI, day: days, period: P };
    };
    return { uniforms, update };
}

// The Ring's halo arcs: one per companion orbit (~280 yr) at the halo's
// ~30 km/s, in kAU.
const RING_ARC_KAU = (280 * 30 * 3.15576e7) / 1.495978707e11;

function ringNebula() {
    const cols = {};
    const colour = (palette) => paletteColours(palette);
    const start = colour('eye');
    for (const id of Object.keys(start)) cols[id] = new THREE.Vector3(...start[id]);
    // The star is 2" from the shell's centre, in the plane of the sky.
    const off = RING.starOffsetArcsec * ARCSEC_KAU;
    const uniforms = {
        uAxes: { value: new THREE.Vector3(SHELL.a, SHELL.b, SHELL.c) },
        uThick: { value: SHELL.thickness },
        uHaloR: { value: new THREE.Vector2(HALO.inner, HALO.outer) },
        uHaloDens: { value: HALO.density },
        uArc: { value: RING_ARC_KAU },
        uColHe2: { value: cols.he2 },
        uColHb: { value: cols.hb },
        uColO3: { value: cols.o3 },
        uColHa: { value: cols.ha },
        uColN2: { value: cols.n2 },
        uColS2: { value: cols.s2 },
        uStar: { value: new THREE.Vector3(off * 0.8, -off * 0.6, 0) },
        uStarCol: { value: new THREE.Vector3(...blackbodyRGB(RING.starTemp)) },
        uCompanion: { value: new THREE.Vector3(RING.companionAu / 1000 * 0.7, RING.companionAu / 1000 * 0.7, 2) },
        uKnots: { value: 1 },
        uGain: { value: 0.05 },
    };
    const info = { temp: RING.starTemp, age: RING.ageYears };
    let palette = 'eye';
    let target = start;
    const update = ({ dt, s, u, cam }) => {
        u.uTime.value += dt;
        if (s.palette !== palette) {
            palette = s.palette;
            target = colour(palette);
        }
        // Ease each line's colour to the palette's.
        for (const id of Object.keys(cols)) {
            const c = cols[id];
            const g = target[id];
            c.set(damp(c.x, g[0], 3, dt), damp(c.y, g[1], 3, dt), damp(c.z, g[2], 3, dt));
        }
        u.uKnots.value = damp(u.uKnots.value, s.knots ? 1 : 0, 3, dt);
        return { ...info, kau: Math.abs(cam.dist) };
    };
    return { uniforms, update };
}

export function createExoticScene(id) {
    switch (id) {
        case 'ring': return ringNebula();
        case 'wr104': return wr104();
        case 'hl-tau': return hlTau();
        case 'neutron-star': return neutronStar();
        case 'binary': return binary();
        case 'roche': return rocheSystem();
        default: return wormhole();
    }
}
