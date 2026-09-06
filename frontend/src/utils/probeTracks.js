import * as THREE from 'three';
import { PLANETS, INTERSTELLAR_ANCHOR } from '../data/solarSystemBodies';
import TRACKS from '../data/voyagerTracks.json';

// Where the Voyagers are, and where they have been.
//
// Both answers come from one baked ephemeris — the trajectory each spacecraft
// actually flew, sampled from JPL Horizons (see scripts/build-voyager-tracks.mjs).
// The marker is simply the point on the track at today's date, so the two can
// never disagree with each other.
//
// The scene draws every planet on a fixed ring: Earth sits at 96 units whether
// it is at perihelion or aphelion, and Neptune at 340 rather than the 30× Earth
// its real distance would demand. A trajectory running from Earth's ring out
// past Neptune's has to be squeezed the same way or it would leave the planets
// behind within the first astronomical unit, so radius goes through the same
// compression the rings define and only the direction is left alone. That is
// the rule the whole scene already follows.

const DAY_MS = 86400000;

// (real AU → drawn radius) read off the planets themselves, plus the choice of
// how to carry on past the last ring.
const ANCHORS = [
    ...PLANETS.map(p => [p.au, p.orbitR]),
    [INTERSTELLAR_ANCHOR.au, INTERSTELLAR_ANCHOR.orbitR],
].sort((a, b) => a[0] - b[0]);

/**
 * Drawn radius for a real heliocentric distance.
 *
 * Logarithmic between anchors, which is what makes the inner planets legible
 * without throwing the outer ones off screen, and it continues at the last
 * segment's rate beyond the final anchor rather than stopping.
 */
export function sceneRadiusForAU(au) {
    if (!(au > 0)) return 0;
    if (au <= ANCHORS[0][0]) return (au / ANCHORS[0][0]) * ANCHORS[0][1];
    for (let i = 1; i < ANCHORS.length; i++) {
        if (au <= ANCHORS[i][0]) {
            const f = Math.log(au / ANCHORS[i - 1][0]) / Math.log(ANCHORS[i][0] / ANCHORS[i - 1][0]);
            return ANCHORS[i - 1][1] + f * (ANCHORS[i][1] - ANCHORS[i - 1][1]);
        }
    }
    const n = ANCHORS.length - 1;
    const slope = (ANCHORS[n][1] - ANCHORS[n - 1][1]) / Math.log(ANCHORS[n][0] / ANCHORS[n - 1][0]);
    return ANCHORS[n][1] + slope * Math.log(au / ANCHORS[n][0]);
}

/** Astronomical axes → scene axes, the same swap computePlanetPos applies. */
function toScene(x, y, z, out = {}) {
    const r = Math.hypot(x, y, z);
    if (r === 0) { out.x = out.y = out.z = 0; return out; }
    const s = sceneRadiusForAU(r) / r;
    out.x = x * s;
    out.y = z * s;
    out.z = y * s;
    return out;
}

export function hasTrack(probeId) {
    return Object.prototype.hasOwnProperty.call(TRACKS, probeId);
}

/**
 * Heliocentric position in AU (J2000 equatorial) at a date.
 *
 * Linear between samples. Before the first the craft had not launched, so it
 * holds at the pad; after the last it carries on along the final leg, which for
 * something coasting out of the solar system is what it does anyway.
 */
export function probeVectorAU(probeId, date = new Date()) {
    const track = TRACKS[probeId];
    if (!track) return null;
    const pts = track.points;
    const days = (date.getTime() - track.launch) / DAY_MS;

    if (days <= pts[0][0]) return { x: pts[0][1], y: pts[0][2], z: pts[0][3] };

    let lo = 0, hi = pts.length - 1;
    if (days >= pts[hi][0]) { lo = hi - 1; }
    else {
        while (hi - lo > 1) {
            const mid = (lo + hi) >> 1;
            if (pts[mid][0] <= days) lo = mid; else hi = mid;
        }
        hi = lo + 1;
    }
    const a = pts[lo], b = pts[hi];
    const f = (days - a[0]) / (b[0] - a[0]);   // >1 past the end, which extrapolates
    return {
        x: a[1] + (b[1] - a[1]) * f,
        y: a[2] + (b[2] - a[2]) * f,
        z: a[3] + (b[3] - a[3]) * f,
    };
}

/** Scene position of a probe at a date. */
export function probeScenePos(probe, date = new Date()) {
    const v = probeVectorAU(probe.id, date);
    if (!v) return { x: 0, y: 0, z: 0 };
    return toScene(v.x, v.y, v.z);
}

/** Distance from the Sun in AU at a date. */
export function probeDistanceAU(probe, date = new Date()) {
    const v = probeVectorAU(probe.id, date);
    return v ? Math.hypot(v.x, v.y, v.z) : 0;
}

/**
 * The whole flown path as scene points, launch first.
 *
 * Static: this is where the spacecraft has been, and that does not change. The
 * caller draws as much of it as the simulated clock has reached — see
 * trackDrawCount — and puts the marker at the end.
 */
export function buildProbeTrack(probeId) {
    const track = TRACKS[probeId];
    if (!track) return [];
    const out = {};
    return track.points.map(([, x, y, z]) => {
        toScene(x, y, z, out);
        return new THREE.Vector3(out.x, out.y, out.z);
    });
}

/** How many baked points fall at or before `date`. */
export function trackDrawCount(probeId, date = new Date()) {
    const track = TRACKS[probeId];
    if (!track) return 0;
    const days = (date.getTime() - track.launch) / DAY_MS;
    const pts = track.points;
    let lo = 0, hi = pts.length;
    while (lo < hi) {
        const mid = (lo + hi) >> 1;
        if (pts[mid][0] <= days) lo = mid + 1; else hi = mid;
    }
    return lo;
}
