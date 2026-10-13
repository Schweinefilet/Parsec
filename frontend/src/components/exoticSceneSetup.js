import * as THREE from 'three';
import { damp } from '../utils/gargantuaCamera';
import { THROAT } from '../utils/wormhole';
import { surfaceRedshift, magneticAxis, visibleFraction, KM_PER_M } from '../utils/neutronStar';
import {
    START_SEPARATION, MERGE_SEPARATION, REMNANT_MASS, petersSeparation, petersMergeTime,
    orbitalOmega, holePositions, gwFrequency, SECONDS_PER_M_SUN,
} from '../utils/binaryHole';
import {
    masses, positions, l1Point, rochePotential, rocheGradient, lobeRadius, streamPath,
    diskOuterRadius, eggletonRadius,
} from '../utils/roche';
import { STREAM_POINTS } from '../utils/exoticShaders';

// Each /exotic object's own uniforms, and what it does every frame: the
// physics clock, the moving parts, the readouts. Exotic3D.jsx owns the
// renderer, the camera and the passes; this is the part that differs.
//
// `update` gets { dt, s (settings), u (the uniforms), frame, cam } and
// returns the readouts for the page, or null. It also returns `skyTurn` when
// the scene turns its sky (the Roche system orbits; the camera does not).

const GW_SOLAR_MASSES = 65; // a GW150914-sized pair, for the readout
const PULSAR_PERIOD = 1.337; // PSR B1919+21, the first pulsar found (s)
const PULSAR_TILT = 38 * Math.PI / 180;
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
    const uniforms = {
        uSpin: { value: 0 },
        uRadius: { value: 5.8 },
        uRedshift: { value: 0.8 },
        uMagAxis: { value: new THREE.Vector3(0, 0, 1) },
        uPhase: { value: 0 },
        // The real surface is about a million kelvin: its visible light is
        // the blue-white of the blackbody's long tail. The hotspots over the
        // magnetic poles run a few times hotter still.
        uSurfTemp: { value: 1e6 },
        uHotTemp: { value: 3e6 },
        uBeams: { value: 1 },
        uGrid: { value: 0 },
    };
    let t = 0;
    let radius = 5.8;
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
        u.uRadius.value = radius;
        u.uRedshift.value = surfaceRedshift(radius);
        u.uMagAxis.value.fromArray(magneticAxis(t, PULSAR_TILT, PULSAR_PERIOD));
        u.uPhase.value = (2 * Math.PI * t) / PULSAR_PERIOD;
        u.uBeams.value = beams;
        u.uGrid.value = grid;
        u.uEscape.value = Math.max(cam.dist * 1.4, 60);
        return {
            radius, km: radius * KM_PER_M, visible: frac,
            redshift: surfaceRedshift(radius), period: PULSAR_PERIOD,
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
        uDiskTemp: { value: 6500 },
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
        uStreamWidth: { value: 0.011 },
        uDiskIn: { value: 0.018 },
        uDiskOut: { value: 0.25 },
        uDiskTemp: { value: 30000 },
        uHotSpot: { value: new THREE.Vector3() },
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
        uniforms.uHotSpot.value.set(...points[points.length - 1]);
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

export function createExoticScene(id) {
    switch (id) {
        case 'neutron-star': return neutronStar();
        case 'binary': return binary();
        case 'roche': return rocheSystem();
        default: return wormhole();
    }
}
