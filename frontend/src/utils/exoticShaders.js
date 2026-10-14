// The /exotic renderers, as GLSL: one full-screen fragment shader per object,
// each tracing a ray per pixel the way /gargantua does, and sharing its
// noise, blackbody lookup and procedural sky (utils/gargantuaShaders.js).
// The composite pass (exposure, film curve, grain) is Gargantua's too.
//
// Each shader has a CPU twin that the tests hold to closed-form answers:
//   wormhole      utils/wormhole.js     (Ellis metric, 2D in the ray's plane)
//   neutron star  utils/neutronStar.js  (Kerr at a = 0, stopped at the surface)
//   binary        utils/binaryHole.js   (two superposed Schwarzschild pulls)
//   Roche         utils/roche.js        (flat space, ray marched)
//   HL Tau        utils/protoplanetaryDisk.js (flat space: the dust at the
//                 midplane crossing, the gas marched)
//   WR 104        utils/pinwheel.js     (flat space, marched)
//
// None of them may call texture() (blackbody, sky) inside a long loop or a
// branch it can skip: ANGLE's D3D compiler unrolls the loop or flattens the
// branch, and the frame costs everything the branch was meant to skip.

import { SIMPLEX, COLOUR_GLSL, SKY_GLSL, KERR_GLSL } from './gargantuaShaders';
import { GAPS, PLANETS } from './protoplanetaryDisk';

/** Upper bound on every integration loop; `uMaxSteps` picks the real count. */
export const MAX_STEPS = 3000;
/** Points on the Roche stream's polyline; utils/roche.js streamPath's `count`. */
export const STREAM_POINTS = 48;
const GAP_COUNT = GAPS.length;
const PLANET_COUNT = PLANETS.length;

const HEADER = /* glsl */ `
precision highp float;
precision highp int;

in vec2 vUv;
out vec4 outColor;

#define MAX_STEPS ${MAX_STEPS}

uniform vec2 uResolution;
uniform vec3 uCamPos;
uniform vec3 uCamRight;
uniform vec3 uCamUp;
uniform vec3 uCamFwd;
uniform float uTanHalfFov;
uniform float uPixelAngle;
uniform float uTime;
uniform float uStepScale;
uniform int uMaxSteps;
uniform float uEscape;

uniform sampler2D uBlackbody;
uniform vec2 uBlackbodyRange;
uniform mat3 uSkyRot;
uniform float uStarGain;
uniform float uMilkyWay;

${SIMPLEX}

${COLOUR_GLSL}

${SKY_GLSL}

// One NaN pixel is enough to black out the whole frame: the bloom blurs it
// into every pixel round it, and then into the rest. Every shader's output
// goes through this.
vec3 sane(vec3 c) {
    return any(isnan(c)) || any(isinf(c)) ? vec3(0.0) : max(c, vec3(0.0));
}

vec3 primaryRay() {
    vec2 ndc = (gl_FragCoord.xy / uResolution) * 2.0 - 1.0;
    ndc.x *= uResolution.x / uResolution.y;
    return normalize(uCamFwd + uTanHalfFov * (ndc.x * uCamRight + ndc.y * uCamUp));
}
`;

// ── wormhole ────────────────────────────────────────────────────────────────

export const WORMHOLE_FRAG = /* glsl */ `
${HEADER}

uniform float uThroat;   // b
uniform float uCamL;     // the camera's signed ℓ; < 0 is the other universe
uniform mat3 uOtherRot;  // the other universe's sky, turned differently
uniform vec3 uGalaxyDir; // where its big galaxy sits

// utils/wormhole.js wormholeDerivative(), on the GPU. State (ℓ, φ, p_ℓ).
vec3 wormDeriv(vec3 s, float h) {
    float r2 = s.x * s.x + uThroat * uThroat;
    return vec3(s.z, h / r2, h * h * s.x / (r2 * r2));
}

// A spiral galaxy seen at a slant: an exponential disk with two log-spiral
// arms, a yellow bulge, blue arms knotted with pink star-forming regions.
vec3 galaxy(vec3 d) {
    vec3 g = normalize(uGalaxyDir);
    float cosA = dot(d, g);
    if (cosA < 0.6) return vec3(0.0);
    vec3 e1 = normalize(cross(g, vec3(0.0, 0.0, 1.0)));
    vec3 e2 = cross(e1, g);
    vec2 q = vec2(dot(d, e1), dot(d, e2)) / 0.3;
    // Tilt about e1, and turn the whole thing a little.
    q.y /= 0.55;
    q = mat2(0.86, 0.51, -0.51, 0.86) * q;
    float rho = length(q);
    float th = atan(q.y, q.x);
    float arms = 0.5 + 0.5 * cos(2.0 * (th - 2.3 * log(rho + 0.05)));
    float disk = exp(-rho / 0.42);
    float knots = pow(max(snoise(vec3(q * 9.0, 3.0)), 0.0), 3.0);
    vec3 col = vec3(0.55, 0.65, 1.0) * disk * (0.25 + 1.2 * arms * arms);
    col += vec3(1.0, 0.45, 0.7) * knots * arms * disk * 2.0;
    col += vec3(1.0, 0.85, 0.6) * exp(-rho * rho / 0.012) * 2.4;
    float dust = smoothstep(0.1, 0.6, fbm(vec3(q * 4.0, 7.0), 4)) * arms;
    return col * (1.0 - 0.5 * dust) * 0.9;
}

// The universe on the far side: different stars, a warmer Milky Way, and a
// galaxy close enough to fill a good part of the view through the throat.
vec3 otherSky(vec3 dir) {
    vec3 d = uOtherRot * dir;
    vec3 col = sky(transpose(uSkyRot) * d) * vec3(1.15, 0.92, 0.78);
    // Dense, glowing gas everywhere: rose and teal clouds over the stars.
    float n1 = fbm(d * 1.6 + 3.0, 5);
    float n2 = fbm(d * 2.7 - 8.0, 5);
    col += vec3(0.85, 0.32, 0.45) * pow(max(n1 + 0.15, 0.0), 1.6) * 0.32;
    col += vec3(0.18, 0.55, 0.75) * pow(max(n2 + 0.05, 0.0), 1.8) * 0.22;
    return col + galaxy(dir) * 2.2;
}

void main() {
    vec3 n = primaryRay();
    float b = uThroat;

    // The plane the ray stays in: the camera's outward radial and the part
    // of the ray square to it.
    vec3 eOut = normalize(uCamPos);
    float c = dot(n, eOut);
    vec3 tv = n - c * eOut;
    float st = length(tv);
    vec3 eT = st > 1e-6 ? tv / st
        : normalize(cross(eOut, abs(eOut.z) < 0.9 ? vec3(0.0, 0.0, 1.0) : vec3(1.0, 0.0, 0.0)));

    float l0 = uCamL;
    float h = sqrt(l0 * l0 + b * b) * st;
    vec3 s = vec3(l0, 0.0, c);
    float side = l0 >= 0.0 ? 1.0 : -1.0;

    for (int i = 0; i < MAX_STEPS; i++) {
        if (i >= uMaxSteps) break;
        side = s.x >= 0.0 ? 1.0 : -1.0;
        if (abs(s.x) > uEscape && side * s.z > 0.0) break;
        float dl = uStepScale * clamp(sqrt(s.x * s.x + b * b), b, 40.0 * b);
        vec3 k1 = wormDeriv(s, h);
        vec3 k2 = wormDeriv(s + 0.5 * dl * k1, h);
        vec3 k3 = wormDeriv(s + 0.5 * dl * k2, h);
        vec3 k4 = wormDeriv(s + dl * k3, h);
        s += (dl / 6.0) * (k1 + 2.0 * k2 + 2.0 * k3 + k4);
    }
    side = s.x >= 0.0 ? 1.0 : -1.0;

    // utils/wormhole.js exitDirection().
    float r = sqrt(s.x * s.x + b * b);
    float psiOut = atan(h / r, side * s.z);
    vec3 er = cos(s.y) * eOut + sin(s.y) * eT;
    vec3 ep = -sin(s.y) * eOut + cos(s.y) * eT;
    vec3 dir = normalize(cos(psiOut) * side * er + sin(psiOut) * ep);

    outColor = vec4(sane(side > 0.0 ? sky(dir) : otherSky(dir)), 1.0);
}
`;

// ── neutron star ────────────────────────────────────────────────────────────

export const NEUTRON_FRAG = /* glsl */ `
${HEADER}

uniform float uSpin;      // always 0: a Kerr integrator run as Schwarzschild
uniform float uRadius;    // R in M
uniform float uRedshift;  // √(1 − 2/R)
uniform float uPhase;     // the star's rotation angle about +z
uniform float uSurfTemp;  // the cool surface
uniform float uHotTemp;   // the two hot regions
// utils/neutronStar.js hotRegions(), in the star's own frame.
uniform vec3 uSpotA;      // the round spot's centre
uniform vec3 uSpotB;      // the crescent's outer circle
uniform vec3 uSpotBIn;    // the circle cut out of it
uniform vec3 uSpotRadii;  // their angular radii
uniform vec3 uBeamA;      // the spots' centres turned with the star, for the beams
uniform vec3 uBeamB;
uniform float uBeams;     // 0..1
uniform float uGrid;      // 0..1

${KERR_GLSL}

float stepSize(float r) {
    float h = uStepScale * max(r - 1.8, 0.06) * clamp(r / 3.0, 1.0, 6.0);
    return min(min(h, 0.1 * r + 1.0), max(r - uRadius, 0.02) + 0.02);
}

// One beam rising from a spot: a bright core and a fainter hollow cone round
// it, the shape radio pulse profiles suggest. Real pulsar beams are radio,
// not light; these are drawn so the sweep can be seen.
float beamProfile(vec3 xr, float r, vec3 axis) {
    float c = dot(xr, axis);
    if (c <= 0.0) return 0.0;
    float th = sqrt(max(2.0 * (1.0 - c), 0.0));
    float core = exp(-th * th / 0.0016);
    float cone = exp(-pow((th - 0.11) / 0.025, 2.0)) * 0.45;
    return core + cone;
}
vec3 beamGlow(vec3 x0, vec3 x1) {
    // Far out the integrator's steps are long next to a beam's width, so
    // sample each step several times or the beam breaks into bands.
    float len = length(x1 - x0);
    float r0 = length(x0);
    int n = int(clamp(ceil(len / (0.025 * r0 + 0.05)), 1.0, 12.0));
    float b = 0.0;
    for (int k = 0; k < 12; k++) {
        if (k >= n) break;
        vec3 x = mix(x0, x1, (float(k) + 0.5) / float(n));
        float r = length(x);
        vec3 xr = x / r;
        float lift = smoothstep(uRadius, uRadius * 1.6, r);
        float fall = exp(-r / 80.0) / (1.0 + 0.015 * r);
        b += (beamProfile(xr, r, uBeamA) + beamProfile(xr, r, uBeamB)) * lift * fall;
    }
    return vec3(0.55, 0.72, 1.0) * b * (len / float(n)) * 0.08 * uBeams;
}

// How far inside a circle of angular radius rad round c the direction q
// is, as a soft 0..1 edge w radians wide.
float cap(vec3 q, vec3 c, float rad, float w) {
    float a = acos(clamp(dot(q, c), -1.0, 1.0));
    return 1.0 - smoothstep(rad - w, rad + w, a);
}

vec3 surface(vec3 xs, vec3 v) {
    vec3 nrm = normalize(xs);
    // The surface's own coordinates, turning with the star.
    float cp = cos(-uPhase), sp = sin(-uPhase);
    vec3 q = vec3(cp * nrm.x - sp * nrm.y, sp * nrm.x + cp * nrm.y, nrm.z);
    float lat = asin(clamp(q.z, -1.0, 1.0));
    float lon = atan(q.y, q.x);

    // NICER's two hot regions. The edges are softened by about a pixel at
    // the default framing, and heat leaking out of them warms a thin halo.
    const float W = 0.006;
    float spotA = cap(q, uSpotA, uSpotRadii.x, W);
    float spotB = cap(q, uSpotB, uSpotRadii.y, W) * (1.0 - cap(q, uSpotBIn, uSpotRadii.z, W));
    float hot = max(spotA, spotB);
    float halo = exp(-max(acos(clamp(dot(q, uSpotA), -1.0, 1.0)) - uSpotRadii.x, 0.0) / 0.05)
        + 0.6 * exp(-max(acos(clamp(dot(q, uSpotB), -1.0, 1.0)) - uSpotRadii.y, 0.0) / 0.05)
            * (1.0 - cap(q, uSpotBIn, uSpotRadii.z - 0.04, 0.03));

    // The rest of the surface: smooth to a millimetre, but not one
    // temperature. Heat flows along the crust's magnetic field more easily
    // than across it, so it is mottled on the scale of the field's patches.
    float mott = fbm(q * 1.6 + 4.0, 3) * 0.75 + fbm(q * 5.0 - 2.0, 2) * 0.25;
    float T = uSurfTemp * (1.0 + 0.14 * mott);
    // Heat from the caps spreads through the crust: the hemisphere holding
    // them runs warmer than the one facing Earth.
    T *= 1.0 + 0.45 * smoothstep(0.2, -0.9, q.z);
    T = mix(T, uHotTemp, hot);
    T += uSurfTemp * 0.9 * halo * (1.0 - hot);

    // Visible light is far down the Rayleigh–Jeans tail at these
    // temperatures: the colour is the same pale blue-white everywhere and
    // only the brightness follows T, in proportion. Seen from far away the
    // whole surface is redshifted by g, which dims it by g.
    vec3 col = blackbody(T * uRedshift) * (T / uHotTemp) * uRedshift * 4.4;
    // A hydrogen atmosphere a few centimetres deep darkens the limb a little
    // (a bare blackbody would not darken it at all).
    float mu = clamp(dot(nrm, -normalize(v)), 0.0, 1.0);
    col *= 0.68 + 0.32 * mu;

    // Latitude and longitude every 30°, amber on the hemisphere facing away
    // from the camera, so seeing round the back shows as amber at the edge.
    float step30 = 3.14159265 / 6.0;
    float gl = abs(fract(lat / step30 + 0.5) - 0.5) * step30;
    float go = abs(fract(lon / step30 + 0.5) - 0.5) * step30 * cos(lat);
    float line = 1.0 - smoothstep(0.012, 0.03, min(gl, go));
    bool back = dot(nrm, normalize(uCamPos)) < 0.0;
    vec3 ink = back ? vec3(1.0, 0.62, 0.18) * 1.6 : vec3(0.02, 0.03, 0.06);
    if (back) col = mix(col, col * vec3(1.25, 0.8, 0.45), 0.6 * uGrid);
    return mix(col, ink, line * uGrid * 0.85);
}

void main() {
    vec3 n = primaryRay();
    vec3 x = uCamPos;
    vec3 p = launch(x, n);
    vec3 col = vec3(0.0);
    vec3 v = n;
    bool hit = false;
    bool escaped = false;

    for (int i = 0; i < MAX_STEPS; i++) {
        if (i >= uMaxSteps) { escaped = true; break; }
        float r = blRadius(x);
        if (r > uEscape && dot(x, p) > 0.0) { escaped = true; break; }

        float h = stepSize(r);
        vec3 k1x, k1p, k2x, k2p, k3x, k3p, k4x, k4p;
        rayDeriv(x, p, k1x, k1p);
        rayDeriv(x + 0.5 * h * k1x, p + 0.5 * h * k1p, k2x, k2p);
        rayDeriv(x + 0.5 * h * k2x, p + 0.5 * h * k2p, k3x, k3p);
        rayDeriv(x + h * k3x, p + h * k3p, k4x, k4p);
        vec3 xn = x + (h / 6.0) * (k1x + 2.0 * k2x + 2.0 * k3x + k4x);
        vec3 pn = p + (h / 6.0) * (k1p + 2.0 * k2p + 2.0 * k3p + k4p);
        v = k4x;

        if (uBeams > 0.0) col += beamGlow(x, xn);

        float rn = length(xn);
        if (rn < uRadius) {
            float t = (r - uRadius) / max(r - rn, 1e-6);
            col += surface(mix(x, xn, t), v);
            hit = true;
            break;
        }
        x = xn;
        p = pn;
    }

    if (escaped && !hit) col += sky(normalize(v));
    outColor = vec4(sane(col), 1.0);
}
`;

// ── binary black hole ───────────────────────────────────────────────────────

export const BINARY_FRAG = /* glsl */ `
${HEADER}

uniform vec4 uHole1;      // xyz, mass
uniform vec4 uHole2;      // mass 0 after the merger
uniform float uDisk;      // 0..1, the circumbinary disk
uniform float uDiskIn;
uniform float uDiskOut;
uniform float uDiskTemp;

// utils/binaryHole.js binaryAcceleration(), on the GPU.
vec3 pullFrom(vec4 hole, vec3 x, vec3 v) {
    if (hole.w <= 0.0) return vec3(0.0);
    vec3 d = x - hole.xyz;
    float r2 = dot(d, d);
    vec3 hv = cross(d, v);
    return (-3.0 * hole.w * dot(hv, hv) / (r2 * r2 * sqrt(r2))) * d;
}
vec3 pull(vec3 x, vec3 v) {
    return pullFrom(uHole1, x, v) + pullFrom(uHole2, x, v);
}

// Gas circling the pair, well outside it, where the two pulls blur into one.
vec4 shadeDisk(vec3 x) {
    float r = length(x.xy);
    if (r < uDiskIn || r > uDiskOut) return vec4(0.0);
    float edge = smoothstep(uDiskIn, uDiskIn * 1.15, r) * (1.0 - smoothstep(uDiskOut * 0.7, uDiskOut, r));
    float m = uHole1.w + uHole2.w;
    float omega = sqrt(m / (r * r * r));
    // As /gargantua: two copies of the texture half a cycle apart, so the
    // shear never winds it into stripes.
    const float P = 500.0;
    float t1 = mod(uTime, P), t2 = mod(uTime + 0.5 * P, P);
    float w1 = 1.0 - abs(2.0 * t1 / P - 1.0);
    float ang = atan(x.y, x.x);
    float a1 = ang - omega * t1, a2 = ang - omega * t2;
    float d1 = fbm(vec3(cos(a1) * 2.2, sin(a1) * 2.2, r * 0.35), 5);
    float d2 = fbm(vec3(cos(a2) * 2.2, sin(a2) * 2.2, r * 0.35 + 31.0), 5);
    float dens = smoothstep(-0.4, 0.6, mix(d2, d1, w1)) * (0.7 + 0.3 * sin(r * 1.7));
    float T = uDiskTemp * pow(r / uDiskIn, -0.75);
    vec3 col = blackbody(T) * pow(uDiskIn / r, 2.0) * 1.6;
    return vec4(col * (0.4 + 0.6 * dens), clamp(dens * edge * 1.1, 0.0, 0.95) * uDisk);
}

void main() {
    vec3 n = primaryRay();
    vec3 x = uCamPos;
    vec3 v = n;
    vec3 col = vec3(0.0);
    float trans = 1.0;
    bool escaped = false;
    float mMin = uHole2.w > 0.0 ? min(uHole1.w, uHole2.w) : uHole1.w;

    for (int i = 0; i < MAX_STEPS; i++) {
        if (i >= uMaxSteps) { escaped = true; break; }
        float d1 = length(x - uHole1.xyz);
        float d2 = uHole2.w > 0.0 ? length(x - uHole2.xyz) : 1e9;
        if (d1 < 2.0 * uHole1.w || d2 < 2.0 * uHole2.w) break;
        if (length(x) > uEscape && dot(x, v) > 0.0) { escaped = true; break; }

        float near = min(d1 / uHole1.w, uHole2.w > 0.0 ? d2 / uHole2.w : 1e9);
        float h = uStepScale * clamp(near - 1.0, 0.08, 30.0) * mMin;
        h = min(h, 0.1 * length(x) + 1.0);

        vec3 a1 = pull(x, v);
        vec3 x2 = x + 0.5 * h * v, v2 = v + 0.5 * h * a1;
        vec3 a2 = pull(x2, v2);
        vec3 x3 = x + 0.5 * h * v2, v3 = v + 0.5 * h * a2;
        vec3 a3 = pull(x3, v3);
        vec3 x4 = x + h * v3, v4 = v + h * a3;
        vec3 a4 = pull(x4, v4);
        vec3 xn = x + (h / 6.0) * (v + 2.0 * v2 + 2.0 * v3 + v4);
        vec3 vn = v + (h / 6.0) * (a1 + 2.0 * a2 + 2.0 * a3 + a4);

        if (uDisk > 0.0 && x.z * xn.z < 0.0) {
            float t = x.z / (x.z - xn.z);
            vec4 d = shadeDisk(mix(x, xn, t));
            col += trans * d.rgb * d.a;
            trans *= 1.0 - d.a;
            if (trans < 0.004) break;
        }
        x = xn;
        v = vn;
    }

    if (escaped && trans > 0.004) col += trans * sky(normalize(v));
    outColor = vec4(sane(col), 1.0);
}
`;

// ── Roche lobe overflow ─────────────────────────────────────────────────────

export const ROCHE_FRAG = /* glsl */ `
${HEADER}

#define STREAM_POINTS ${STREAM_POINTS}

uniform float uMd;        // donor mass, total 1
uniform float uMa;        // accretor mass
uniform float uXd;        // donor x
uniform float uXa;        // accretor x
uniform float uXL1;
uniform float uPhiL1;     // the donor's surface: the potential at L1
uniform float uBound;     // donor bounding-sphere radius
uniform float uGPole;     // surface gravity at the donor's back, for darkening
uniform float uDonorTemp;
uniform vec3 uStream[STREAM_POINTS];
uniform float uStreamWidth;
uniform float uDiskIn;
uniform float uDiskOut;
uniform float uDiskTemp;  // at the rim
uniform float uDiskHR;    // H/r at the rim
uniform float uSpotPhi;   // the stream's impact, as an azimuth round the accretor
uniform float uIrrTemp;   // irradiation temperature reaching L1's distance

// utils/roche.js rochePotential(), on the GPU.
float roche(vec3 x) {
    float rd = length(x - vec3(uXd, 0.0, 0.0));
    float ra = length(x - vec3(uXa, 0.0, 0.0));
    return -uMd / rd - uMa / ra - 0.5 * dot(x.xy, x.xy);
}
vec3 rocheGrad(vec3 x) {
    vec3 dd = x - vec3(uXd, 0.0, 0.0);
    vec3 da = x - vec3(uXa, 0.0, 0.0);
    float rd = length(dd), ra = length(da);
    return uMd * dd / (rd * rd * rd) + uMa * da / (ra * ra * ra) - vec3(x.xy, 0.0);
}

// Distance along the ray to the donor's surface, or -1.
float hitDonor(vec3 ro, vec3 rd) {
    vec3 oc = ro - vec3(uXd, 0.0, 0.0);
    float bq = dot(oc, rd);
    float cq = dot(oc, oc) - uBound * uBound;
    float disc = bq * bq - cq;
    if (disc < 0.0) return -1.0;
    float sq = sqrt(disc);
    float t0 = max(-bq - sq, 0.0), t1 = -bq + sq;
    if (t1 < 0.0) return -1.0;
    const int N = 64;
    float dt = (t1 - t0) / float(N);
    float prev = t0;
    for (int i = 1; i <= N; i++) {
        float t = t0 + dt * float(i);
        vec3 p = ro + t * rd;
        if (p.x > uXL1 && roche(p) < uPhiL1) {
            float lo = prev, hi = t;
            for (int k = 0; k < 12; k++) {
                float mid = 0.5 * (lo + hi);
                vec3 q = ro + mid * rd;
                if (q.x > uXL1 && roche(q) < uPhiL1) hi = mid; else lo = mid;
            }
            return hi;
        }
        prev = t;
    }
    return -1.0;
}

// Cellular noise: distances to the nearest and second-nearest feature points.
vec2 worley(vec3 p) {
    vec3 c = floor(p);
    float f1 = 9.0, f2 = 9.0;
    for (int i = -1; i <= 1; i++)
    for (int j = -1; j <= 1; j++)
    for (int k = -1; k <= 1; k++) {
        vec3 cell = c + vec3(float(i), float(j), float(k));
        vec3 d = cell + hash3(cell) - p;
        float dd = dot(d, d);
        if (dd < f1) { f2 = f1; f1 = dd; } else if (dd < f2) { f2 = dd; }
    }
    return sqrt(vec2(f1, f2));
}

// utils/roche.js inDiskShadow(), softened: 1 in full view of the inner disk.
float diskShadow(vec3 p) {
    float elev = abs(p.z) / max(length(p.xy - vec2(uXa, 0.0)), 1e-4);
    return smoothstep(uDiskHR * 0.5, uDiskHR * 1.8, elev);
}

vec3 shadeDonor(vec3 p, vec3 rd) {
    vec3 g = rocheGrad(p);
    float gl = length(g);
    // At the L1 point itself gravity vanishes and so does the normal: this
    // is the pixel whose NaN used to black out the whole frame.
    vec3 nrm = gl > 1e-6 ? g / gl : vec3(-1.0, 0.0, 0.0);
    // The star turns with the orbit, so its surface is fixed in this frame.
    vec3 sd = normalize(p - vec3(uXd, 0.0, 0.0));

    // Below about 7000 K a star's outer layers churn (convective); above it
    // they are still (radiative). That decides most of what follows.
    float conv = 1.0 - smoothstep(6500.0, 8500.0, uDonorTemp);

    // Gravity darkening: the stretched tip towards L1, where gravity all
    // but cancels, is cooler. T goes as g^0.25 for a radiative star (von
    // Zeipel 1924), only g^0.08 for a convective one (Lucy 1967).
    float T = uDonorTemp * pow(max(gl / uGPole, 0.03), mix(0.25, 0.08, conv));

    // Convection, on a cool donor. A star this swollen has low gravity and
    // so a few huge cells (on the red giant pi1 Gruis each spans a quarter
    // of the star: Paladini et al. 2018), with finer granulation inside
    // them. Bright rising centres, dark sinking lanes; they churn slowly.
    float tt = uTime * 0.02;
    // Warped, so the cells come out irregular rather than a tiled pattern.
    vec3 warp = vec3(fbm(sd * 2.5 + 1.0, 3), fbm(sd * 2.5 + 7.0, 3), fbm(sd * 2.5 - 5.0, 3));
    vec2 w1 = worley(sd * 3.6 + 0.55 * warp + vec3(0.0, 0.0, tt));
    vec2 w2 = worley(sd * 14.0 + 0.8 * warp + vec3(tt * 2.1, 5.3, -tt));
    float big = smoothstep(0.0, 0.6, w1.y - w1.x);
    float fine = smoothstep(0.0, 0.4, w2.y - w2.x);
    T *= 1.0 + conv * (0.06 * big + 0.03 * fine - 0.07) + 0.01 * snoise(sd * 40.0);

    // Starspots, on a cool donor with a deep convective envelope; the tidal
    // lock spins it fast enough for a strong dynamo.
    float spotty = 1.0 - smoothstep(5000.0, 6800.0, uDonorTemp);
    float spots = smoothstep(0.42, 0.62, fbm(sd * 2.0 + 9.0, 4));
    T *= 1.0 - 0.16 * spots * spotty;

    // Irradiation: the inner disk's glare heats the face turned to it,
    // except along the equator, which the disk's own rim shades.
    vec3 toA = vec3(uXa, 0.0, 0.0) - p;
    float dA = length(toA);
    float cosI = max(dot(nrm, toA / dA), 0.0);
    float irr = cosI * diskShadow(p) * pow((uXL1 - uXa) / dA, 2.0);
    T = pow(pow(T, 4.0) + pow(uIrrTemp, 4.0) * irr, 0.25);

    // Limb darkening (quadratic law): strong for a cool star, milder hot.
    float mu = clamp(dot(nrm, -rd), 0.0, 1.0);
    float u1 = mix(0.74, 0.38, clamp((uDonorTemp - 3500.0) / 8500.0, 0.0, 1.0));
    float limb = 1.0 - u1 * (1.0 - mu) - 0.16 * (1.0 - mu) * (1.0 - mu);
    // Visible-band brightness rises faster than T, slower than T^4.
    float b = pow(T / uDonorTemp, 2.5);
    return blackbody(T) * b * max(limb, 0.0) * 0.62;
}

// ── the disk, as a volume ───────────────────────────────────────────────────

// utils/roche.js diskScaleHeight(), with the azimuth past the impact.
float diskH(float r, float dphi) {
    float h = uDiskHR * uDiskOut * pow(r / uDiskOut, 1.125);
    float rim = smoothstep(0.55 * uDiskOut, 0.95 * uDiskOut, r);
    // Rising over a short arc before the impact, trailing off long after.
    float sgn = dphi > 3.14159265 ? dphi - 6.2831853 : dphi;
    float bulge = sgn < 0.0 ? exp(-sgn * sgn / 0.09) : exp(-sgn / 1.2);
    return h * (1.0 + 0.6 * bulge * rim);
}

// Emitted colour (rgb) and extinction (a), per unit length at p.
vec4 diskSample(vec3 p) {
    vec2 d = p.xy - vec2(uXa, 0.0);
    float r = length(d);
    if (r > uDiskOut * 1.1 || r < uDiskIn) return vec4(0.0);
    float phi = atan(d.y, d.x);
    float dphi = mod(phi - uSpotPhi + 6.2831853, 6.2831853);
    float H = diskH(r, dphi);
    // Steeper than a Gaussian: an opaque disk ends in a fairly sharp
    // photosphere, not a haze that grazing rays pile up through.
    float zz = p.z * p.z / (H * H);
    float vert = exp(-0.5 * zz * (1.0 + 0.25 * zz));
    if (vert < 1e-3) return vec4(0.0);
    float x = r / uDiskOut;
    float zh = p.z / H;

    // Turbulence sheared by the Keplerian flow: two copies of the texture
    // half a cycle apart, as on /gargantua, so it never winds to stripes.
    float omega = sqrt(uMa / (r * r * r)) * 0.25;
    const float P = 60.0;
    float t1 = mod(uTime, P), t2 = mod(uTime + 0.5 * P, P);
    float w1 = 1.0 - abs(2.0 * t1 / P - 1.0);
    float a1 = phi - omega * t1, a2 = phi - omega * t2;
    float lr = log(r);
    float n1 = fbm(vec3(cos(a1) * 3.0, sin(a1) * 3.0, lr * 3.5 + zh * 0.35), 4);
    float n2 = fbm(vec3(cos(a2) * 3.0, sin(a2) * 3.0, lr * 3.5 + 17.0 + zh * 0.35), 4);
    float turb = smoothstep(-0.55, 0.65, mix(n2, n1, w1));

    // Two tidal spiral arms: the donor's pull raises them in the outer disk,
    // and they stand still in the binary's frame (Steeghs et al. 1997).
    float arm = 0.5 + 0.5 * cos(2.0 * (phi - log(x) / tan(0.38)) + 0.6);
    float spiral = pow(arm, 4.0) * smoothstep(0.35, 0.75, x) * (1.0 - smoothstep(0.92, 1.08, x));

    // Column optical depth rises inward (surface density ~ r^-3/4), spread
    // over the local thickness so a thin inner disk is as opaque as a thick
    // rim.
    float edge = 1.0 - smoothstep(0.88, 1.1, x);
    float tauV = 3.0 * pow(x, -0.75) * (0.3 + 0.7 * turb) * (1.0 + 1.4 * spiral) * edge;
    float ext = tauV * vert / (2.5066 * H);

    // Viscous heating, T ~ r^-3/4, plus the spirals' shocks.
    float T = uDiskTemp * pow(x, -0.75) * (1.0 + 0.3 * spiral);

    // The bright spot: the stream slamming into the rim, the hot gas smeared
    // downstream along it, puffed up above the plane with the bulge.
    float sd = mod(phi - uSpotPhi + 3.14159265, 6.2831853) - 3.14159265;
    float along = sd > 0.0 ? sd / 0.6 : -sd / 0.2;
    float spot = exp(-along * along) * exp(-pow((x - 0.95) / 0.06, 2.0));
    T = mix(T, 15000.0, spot);
    ext *= 1.0 + 2.0 * spot;

    // Brightness grows with T, steeply enough that the inner disk glares.
    // The disk is opaque, so what shows is its photosphere's temperature:
    // the turbulence and the arms have to come through as brightness.
    float bright = pow(T / uDiskTemp, 1.3) * 0.2 * (1.0 + 2.0 * spot)
        * (0.7 + 0.6 * turb) * (1.0 + 0.9 * spiral);
    vec3 S = blackbody(min(T, 99000.0)) * min(bright, 12.0);
    return vec4(S, ext);
}

// The stream along this ray: a soft tube round the path, its density set by
// the ray's closest approach to the whole polyline (so the joins are
// seamless), hidden behind the donor. The rgb is its light; the alpha is how
// much of what lies behind it the gas blocks.
vec4 streamGlow(vec3 ro, vec3 rd, float tDonor) {
    float best = 1e9, bestF = 0.0, bestDen = 1.0, bestT = -1.0;
    vec3 bestC = vec3(0.0), bestU = vec3(1.0, 0.0, 0.0);
    for (int i = 0; i < STREAM_POINTS - 1; i++) {
        vec3 a = uStream[i];
        vec3 u = uStream[i + 1] - a;
        float segLen = length(u);
        if (segLen < 1e-6) continue;
        u /= segLen;
        // Closest approach between the ray and the segment.
        vec3 w0 = ro - a;
        float bb = dot(rd, u);
        float dd = dot(rd, w0), ee = dot(u, w0);
        float den = max(1.0 - bb * bb, 1e-5);
        float s = clamp((ee - bb * dd) / den, 0.0, segLen);
        vec3 q = a + s * u;
        float t = max(dot(q - ro, rd), 0.0);
        vec3 c = (ro + t * rd) - q;
        float d2 = dot(c, c);
        if (d2 < best) {
            best = d2;
            bestF = (float(i) + s / segLen) / float(STREAM_POINTS - 1);
            bestDen = den;
            bestT = t;
            bestC = c;
            bestU = u;
        }
    }
    if (bestT <= 0.0 || (tDonor > 0.0 && bestT > tDonor)) return vec4(0.0);
    float f = bestF;
    // Wide where it leaves L1 (a cone of the sound speed over the orbital
    // rate), then narrowing as it falls and speeds up.
    float wdt = uStreamWidth * mix(2.4, 0.7, pow(f, 0.45));
    float g = exp(-best / (wdt * wdt));
    if (g < 1e-3) return vec4(0.0);
    // Clumps that flow down the stream towards the disk.
    vec3 side = normalize(cross(bestU, vec3(0.0, 0.0, 1.0)));
    float clump = 0.75 + 0.35 * snoise(vec3(f * 9.0 - uTime * 0.5, dot(bestC, side) / wdt * 0.5, bestC.z / wdt * 0.5));
    float through = wdt * 1.77 / sqrt(max(bestDen, 0.04));
    float dens = g * through * max(clump, 0.05) / uStreamWidth;
    // Cool gas from the shaded L1, heated as it falls and lit by the disk.
    float T = mix(uDonorTemp * 0.9, 9500.0, f * f);
    vec3 col = blackbody(T) * dens * mix(0.3, 1.4, f * f) * 0.3;
    return vec4(col, 1.0 - exp(-dens * 0.6));
}

void main() {
    vec3 rd = primaryRay();
    vec3 ro = uCamPos;

    float tDonor = hitDonor(ro, rd);
    float tEnd = tDonor > 0.0 ? tDonor : 1e9;

    // Where the ray is within reach of the disk's gas: a slab round the
    // orbital plane ...
    float zMax = 5.0 * uDiskHR * uDiskOut;
    float t0 = 0.0, t1 = -1.0;
    if (abs(rd.z) > 1e-6) {
        float ta = (-zMax - ro.z) / rd.z, tb = (zMax - ro.z) / rd.z;
        t0 = max(min(ta, tb), 0.0);
        t1 = max(ta, tb);
    } else if (abs(ro.z) < zMax) {
        t1 = 1e9;
    }
    // ... cut by a cylinder round the accretor.
    vec2 oc = ro.xy - vec2(uXa, 0.0);
    float A = dot(rd.xy, rd.xy);
    float B = dot(oc, rd.xy);
    float C = dot(oc, oc) - pow(uDiskOut * 1.1, 2.0);
    float disc = B * B - A * C;
    if (disc > 0.0 && A > 1e-9) {
        float sq = sqrt(disc);
        t0 = max(t0, (-B - sq) / A);
        t1 = min(t1, (-B + sq) / A);
    } else if (C > 0.0) {
        t1 = -1.0;
    }
    t1 = min(t1, tEnd);

    // The innermost disk, far too small and hot to resolve at this scale,
    // glares as a point; how much of it the disk itself hides is read off
    // the march as it passes.
    float tc = max(-dot(ro - vec3(uXa, 0.0, 0.0), rd), 0.0);
    vec3 cp = ro + tc * rd - vec3(uXa, 0.0, 0.0);
    float glare = tc > tEnd ? 0.0 : -1.0;

    vec3 col = vec3(0.0);
    float trans = 1.0;
    if (t1 > t0) {
        // Steps sized to the local thickness, so the thin inner disk is not
        // stepped over; jittered per pixel against banding.
        // A fresh offset every pixel and every frame: what is left of the
        // steps is fine noise that the film grain swallows.
        float jit = hash3(vec3(gl_FragCoord.xy, floor(fract(uTime * 0.37) * 4096.0))).x;
        float t = t0;
        for (int i = 0; i < 360; i++) {
            if (t >= t1 || trans < 0.01) break;
            vec3 p = ro + t * rd;
            vec2 dp = p.xy - vec2(uXa, 0.0);
            float r = max(length(dp), uDiskIn);
            float H = diskH(r, mod(atan(dp.y, dp.x) - uSpotPhi + 6.2831853, 6.2831853));
            float above = abs(p.z) - 3.5 * H;
            float dt = above > 0.0
                ? max(above / max(abs(rd.z), 0.05), 0.4 * H)
                : 0.45 * H / max(abs(rd.z), 0.12);
            float h = min(clamp(dt, 0.0004, 0.006), t1 - t);
            vec4 smp = diskSample(ro + (t + jit * h) * rd);
            if (glare < 0.0 && t + h > tc) glare = trans;
            if (smp.a > 0.0) {
                float a = 1.0 - exp(-smp.a * h);
                col += trans * smp.rgb * a;
                trans *= 1.0 - a;
            }
            t += h;
        }
    }
    if (glare < 0.0) glare = trans;
    float d2 = dot(cp, cp);
    col += glare * vec3(0.85, 0.92, 1.0) * 0.00002 / (d2 + 0.000004);

    // The stream lies outside the disk; only its end overlaps the rim.
    vec4 stream = streamGlow(ro, rd, tDonor);
    col = stream.rgb + (1.0 - stream.a) * col;
    trans *= 1.0 - stream.a;

    if (tDonor > 0.0) {
        col += trans * shadeDonor(ro + tDonor * rd, rd);
    } else {
        col += trans * sky(rd);
    }
    outColor = vec4(sane(col), 1.0);
}
`;

// ── protoplanetary disk (HL Tau) ────────────────────────────────────────────

export const PROTODISK_FRAG = /* glsl */ `
${HEADER}

#define N_GAPS ${GAP_COUNT}
#define N_PLANETS ${PLANET_COUNT}

uniform vec3 uGaps[N_GAPS];       // radius, Gaussian sigma, depth
uniform float uOuter;             // where the millimetre dust ends
uniform vec4 uPlanets[N_PLANETS]; // position, h/r at the planet
uniform float uPlanetQ[N_PLANETS];
uniform float uPlanetOn;          // 0..1
uniform float uView;              // 0 = ALMA's millimetre glow, 1 = starlight
uniform float uJet;               // 0..1
uniform float uStarTemp;

// utils/protoplanetaryDisk.js gapFactor(), dustOpticalDepth(), dustTemperature().
float gapFactor(float r) {
    float f = 1.0;
    for (int i = 0; i < N_GAPS; i++) {
        float d = (r - uGaps[i].x) / uGaps[i].y;
        f *= 1.0 - (1.0 - uGaps[i].z) * exp(-0.5 * d * d);
    }
    return f;
}
float dustTau(float r) {
    float rr = max(r, 0.5);
    return 2.5 * (20.0 / rr) * exp(-pow(rr / uOuter, 6.0)) * gapFactor(rr);
}
float dustTemp(float r) {
    return 30.0 * pow(max(r, 0.5) / 50.0, -0.5);
}
float gasAspect(float r) {
    return 0.05 * pow(max(r, 0.5) / 10.0, 0.25);
}

// utils/protoplanetaryDisk.js wakePhase().
float wakePhase(float r, float rp, float hp) {
    float x = r / rp;
    const float c1 = 1.0 / 1.25;
    const float c2 = 1.0 / (1.0 - 1.5 + 0.25);
    float f = pow(x, 1.25) * (c1 - c2 * pow(x, -1.5)) - (c1 - c2);
    return -sign(r - rp) * f / hp;
}

// How much the planets' spiral wakes pile up the gas at p: a crest a scale
// height wide along each wake, stronger for a heavier planet, fading away
// from it.
float wakes(vec3 p, float r) {
    if (uPlanetOn <= 0.0) return 1.0;
    float phi = atan(p.y, p.x);
    float w = 0.0;
    for (int i = 0; i < N_PLANETS; i++) {
        vec3 pp = uPlanets[i].xyz;
        float rp = length(pp.xy);
        if (abs(r - rp) > 2.5 * rp) continue;
        float hp = uPlanets[i].w;
        float phiP = atan(pp.y, pp.x);
        float dphi = phi - phiP - wakePhase(r, rp, hp);
        dphi = mod(dphi + 3.14159265, 6.2831853) - 3.14159265;
        float across = dphi * r / (hp * r * 1.2);
        float reach = exp(-abs(r - rp) / (0.9 * rp));
        w += uPlanetQ[i] * 2500.0 * exp(-across * across) * reach;
    }
    return 1.0 + w * uPlanetOn;
}

// The ALMA image's false colour: dark red through orange to near white.
vec3 almaColour(float I) {
    float x = 1.0 - exp(-1.3 * I);
    vec3 c = mix(vec3(0.1, 0.008, 0.0), vec3(0.95, 0.3, 0.035), smoothstep(0.0, 0.5, x));
    c = mix(c, vec3(1.0, 0.9, 0.68), smoothstep(0.5, 1.0, x));
    return c * (0.2 + 1.7 * x);
}

// Extinction per AU in the midplane at 10 AU. The column (density times
// thickness) falls as 1/r, so in a flaring disk the midplane density falls
// as r^−9/4.
const float GAS_RHO = 3.0;
float gasMid(float r) {
    return GAS_RHO * pow(10.0 / max(r, 1.0), 2.25);
}

// The gas and small dust: a flared layer, thin near the star and thicker
// relative to its radius further out. Its density, per unit length.
float gasDensity(vec3 p, float r) {
    float H = gasAspect(r) * r;
    float vert = exp(-0.5 * p.z * p.z / (H * H));
    float taper = exp(-pow(r / (uOuter * 1.35), 4.0)) * smoothstep(0.3, 2.0, r);
    // Most samples on a slanted ray are well clear of the gas: stop there.
    // (Not too soon: the lit skin is four scale heights up.)
    if (vert * taper < 1e-7) return 0.0;
    // Gas gaps are shallower than the dust's: the planets hold back pebbles
    // more than they hold back gas.
    float gaps = pow(gapFactor(r), 0.6);
    float mott = 0.85 + 0.3 * snoise(vec3(p.xy * 0.06, p.z * 0.1));
    return gasMid(r) * vert * taper * gaps * mott * wakes(p, r);
}

// Starlight reaching p, and how much of it the gas between p and the star
// takes out. Along the straight line out from the star at a fixed angle
// θ = z/r the density integrates to K(r)·exp(−θ²/2h²), K being gasMid's
// integral from the inner edge; so the disk is opaque to its star below a
// surface about four scale heights up, and only the skin above it is lit.
// Scattered-light images are shown multiplied by r² so the outer disk
// isn't lost to the inverse square (SPHERE's are); so is this, except near
// the star. (The colour is the star's, applied once outside the march: a
// texture lookup inside a long loop makes ANGLE's D3D compiler unroll it.)
float starlightAt(vec3 p, float r) {
    float d2 = dot(p, p) + 0.25;
    float th = p.z / max(r, 0.5);
    float h = gasAspect(r);
    float K = GAS_RHO * 8.0 * (pow(20.0, 1.25) - pow(10.0 / max(r, 0.6), 1.25));
    float tauStar = max(K, 0.0) * exp(-0.5 * th * th / (h * h));
    return exp(-tauStar) * (1.0 + 40.0 / (d2 + 4.0));
}

// Henyey–Greenstein phase function: small grains throw most light forwards.
float phaseHG(float c, float g) {
    float g2 = g * g;
    return (1.0 - g2) / (12.566 * pow(1.0 + g2 - 2.0 * g * c, 1.5));
}

// HL Tau's jet: a narrow outflow along the poles, glowing red in H-α and
// [S II], knotted where faster gas runs into slower.
float jetDensity(vec3 p) {
    float z = abs(p.z);
    float rad = 0.8 + 0.06 * z;
    float q = length(p.xy) / rad;
    float knots = 0.55 + 0.45 * sin(z * 0.11 - uTime * 0.35) + 0.3 * snoise(vec3(p.xy * 0.2, z * 0.05 - uTime * 0.04));
    return exp(-q * q) * smoothstep(3.0, 12.0, z) * exp(-z / 260.0) * max(knots, 0.05);
}

void main() {
    vec3 rd = primaryRay();
    vec3 ro = uCamPos;
    float jit = hash3(vec3(gl_FragCoord.xy, floor(fract(uTime * 0.37) * 4096.0))).x;

    // ── millimetre: the dust at the midplane, where the ray crosses it ─────
    vec3 mm = vec3(0.0);
    float tCross = -1.0;
    float muCross = max(abs(rd.z), 0.04);
    float transMid = 1.0; // what the midplane dust lets through, in starlight
    if (abs(rd.z) > 1e-6) {
        float t = -ro.z / rd.z;
        if (t > 0.0) {
            vec3 p = ro + t * rd;
            float r = length(p.xy);
            if (r < uOuter * 1.4) {
                tCross = t;
                float tau = dustTau(r);
                float I = dustTemp(r) / dustTemp(20.0) * (1.0 - exp(-tau / muCross));
                // A little of the azimuthal grain the real image has.
                I *= 0.92 + 0.16 * fbm(vec3(p.xy * 0.15, 3.0), 3);
                mm = almaColour(I * 1.25);
                // Big grains are black in visible light: opaque where thick.
                transMid = exp(-6.0 * tau / muCross);
            }
        }
    }
    // The planets' own disks are warm, and ALMA has seen one (PDS 70c):
    // a faint compact source in the gap.
    vec3 mmPlanets = vec3(0.0);
    vec3 visPlanets = vec3(0.0);
    for (int i = 0; i < N_PLANETS; i++) {
        vec3 c = uPlanets[i].xyz - ro;
        float tc = dot(c, rd);
        if (tc <= 0.0) continue;
        float d2 = dot(c, c) - tc * tc;
        // Hidden behind the midplane dust, from the far side.
        float behind = (tCross > 0.0 && tCross < tc) ? transMid : 1.0;
        mmPlanets += almaColour(0.5) * exp(-d2 / 0.5) * 0.9;
        visPlanets += behind * (vec3(1.0, 0.55, 0.25) * exp(-d2 / 0.02) * 6.0
            + vec3(1.0, 0.45, 0.2) * exp(-d2 / 0.6) * 0.25);
    }
    mm += mmPlanets * uPlanetOn;

    // ── starlight: scattered by the flared gas, the jet glowing ────────────
    vec3 vis = vec3(0.0);
    float trans = 1.0;
    if (uView > 0.001) {
        // The box the gas and the jet's base fit in.
        float zMax = 60.0;
        float rMax = uOuter * 1.6;
        float t0 = 0.0, t1 = 1e9;
        if (abs(rd.z) > 1e-6) {
            float ta = (-zMax - ro.z) / rd.z, tb = (zMax - ro.z) / rd.z;
            t0 = max(min(ta, tb), 0.0);
            t1 = max(ta, tb);
        } else if (abs(ro.z) > zMax) {
            t1 = -1.0;
        }
        float A = dot(rd.xy, rd.xy), B = dot(ro.xy, rd.xy), C = dot(ro.xy, ro.xy) - rMax * rMax;
        float disc = B * B - A * C;
        if (disc > 0.0 && A > 1e-9) {
            float sq = sqrt(disc);
            t0 = max(t0, (-B - sq) / A);
            t1 = min(t1, (-B + sq) / A);
        } else if (C > 0.0) {
            t1 = -1.0;
        }

        float tStar = dot(-ro, rd);
        float starTrans = tStar > 0.0 ? 1.0 : 0.0;
        bool crossed = false;
        // Small grains scatter blue a little better than red.
        vec3 starCol = blackbody(uStarTemp) * vec3(0.86, 0.95, 1.1);
        if (t1 > t0) {
            // Sphere-traced through the empty space above and below the gas
            // (outside a wedge |z| < 0.42 r, which holds four scale heights
            // out to the edge), and in steps of a fraction of the local scale
            // height inside it. uMaxSteps caps the count.
            float dtMax = (t1 - t0) / 20.0;
            float t = t0;
            float dt = 0.0;
            float firstJit = jit + 0.05;
            for (int i = 0; i < 1000; i++) {
                if (i >= uMaxSteps || trans < 0.004 || t >= t1) break;
                vec3 p = ro + t * rd;
                float r = length(p.xy);
                float clear = abs(p.z) - 0.42 * r;
                if (clear > 0.5) {
                    dt = clear / (abs(rd.z) + 0.42) + 0.2;
                    if (tStar > 0.0 && t <= tStar && t + dt > tStar) starTrans = trans;
                    if (!crossed && tCross > 0.0 && t + dt > tCross) { crossed = true; trans *= transMid; }
                    t += dt;
                    continue;
                }
                float H = gasAspect(r) * max(r, 1.0);
                // The first step into the gas is jittered per pixel, against banding.
                dt = clamp(0.25 * H / max(abs(rd.z), 0.3), 0.1, dtMax) * firstJit;
                firstJit = 1.0;
                p = ro + (t + 0.5 * dt) * rd;
                r = length(p.xy);
                float rho = gasDensity(p, r);
                if (rho > 1e-6) {
                    vec3 light = starCol * (starlightAt(p, r) * phaseHG(dot(normalize(p), -rd), 0.55));
                    float a = 1.0 - exp(-rho * dt);
                    vis += trans * light * 3000.0 * a;
                    trans *= 1.0 - a;
                }
                if (!crossed && tCross > 0.0 && t + dt > tCross) {
                    crossed = true;
                    trans *= transMid;
                }
                if (tStar > 0.0 && t <= tStar && t + dt > tStar) starTrans = trans;
                t += dt;
            }
        }
        if (!crossed && tCross > 0.0 && tCross < t0) trans *= transMid;

        // The jet: marched on its own along where the ray passes the axis.
        if (uJet > 0.001) {
            float Aj = dot(rd.xy, rd.xy), Bj = dot(ro.xy, rd.xy);
            float Cj = dot(ro.xy, ro.xy) - 24.0 * 24.0;
            float dj = Bj * Bj - Aj * Cj;
            float ja = 0.0, jb = -1.0;
            if (Aj > 1e-9 && dj > 0.0) {
                float sq = sqrt(dj);
                ja = max((-Bj - sq) / Aj, 0.0);
                jb = (-Bj + sq) / Aj;
            } else if (Cj < 0.0) {
                ja = 0.0;
                jb = 900.0;
            }
            jb = min(jb, ja + 900.0);
            if (jb > ja) {
                const int NJ = 40;
                float hj = (jb - ja) / float(NJ);
                float jetAcc = 0.0;
                for (int k = 0; k < NJ; k++) {
                    vec3 p = ro + (ja + (float(k) + jit) * hj) * rd;
                    jetAcc += jetDensity(p);
                }
                // Behind the disk from the far side: the midplane takes it.
                vis += vec3(1.0, 0.22, 0.3) * jetAcc * hj * 0.004 * uJet;
            }
        }

        // The star itself, far too small to resolve: a glare, dimmed by
        // whatever gas lies in front of it.
        vec3 cs = -ro;
        float tc = dot(cs, rd);
        float d2 = dot(cs, cs) - tc * tc;
        if (tCross > 0.0 && tCross < tc) starTrans *= transMid;
        vis += starTrans * blackbody(uStarTemp) * (0.0005 / (d2 + 0.0002) + 0.06 * exp(-d2 / 4.0));
        vis += visPlanets * uPlanetOn;
        vis += trans * sky(rd);
    }

    vec3 col = mix(mm, vis, uView);
    outColor = vec4(sane(col), 1.0);
}
`;

// ── WR 104's pinwheel ───────────────────────────────────────────────────────

export const PINWHEEL_FRAG = /* glsl */ `
${HEADER}

uniform float uTheta;   // the cone's half-angle
uniform float uWidth;   // the dust shell's angular thickness
uniform float uV;       // AU per day
uniform float uPeriod;  // days
uniform float uSkew;    // how far the cone trails the orbit
uniform float uR0;      // where dust forms
uniform float uRMax;
uniform float uDays;    // time, wrapped to a period
uniform vec3 uStarA;    // the Wolf–Rayet star
uniform vec3 uStarB;    // the O/B star
uniform float uGain;

// utils/pinwheel.js coneAxis(): in the orbital plane, trailing the orbit a
// little because the stars move while the wind crosses the gap.
vec3 coneAxis(float tau) {
    float a = 6.2831853 * tau / uPeriod - uSkew;
    return vec3(cos(a), sin(a), 0.0);
}

// utils/pinwheel.js dustDensity(), clumped, and how far (in angle) x is
// from the dust shell, for the sphere tracing.
float dust(vec3 x, float r, out float gap) {
    float tau = uDays - r / uV;
    vec3 ax = coneAxis(tau);
    float c = clamp(dot(x, ax) / r, -1.0, 1.0);
    float psi = acos(c);
    float d = (psi - uTheta) / uWidth;
    gap = abs(psi - uTheta) - 3.0 * uWidth;
    if (gap > 0.0 || r < uR0 * 0.9) return 0.0;
    // Where round the cone this parcel left from: with its departure time,
    // fixed for the parcel, so the clumps fly out with the dust.
    vec3 e2 = vec3(-ax.y, ax.x, 0.0);
    float beta = atan(x.z, dot(x, e2));
    float clump = fbm(vec3(tau / uPeriod * 11.0, cos(beta) * 2.2, sin(beta) * 2.2), 3);
    clump = 0.25 + 1.5 * smoothstep(-0.35, 0.55, clump);
    float onset = smoothstep(uR0 * 0.9, uR0 * 1.5, r);
    return exp(-d * d) * onset * clump / (r * r);
}

// The 2.2 µm glow of dust at r: utils/pinwheel.js dustTemperature() into
// kBandPlanck().
float kBand(float r) {
    float T = 1500.0 * pow(max(r, 1.0) / uR0, -0.4);
    return 1.0 / (exp(6540.0 / T) - 1.0);
}

// Infrared false colour, as the Keck images are shown: black through red
// and orange to white.
vec3 heat(float x) {
    x = clamp(x, 0.0, 1.2);
    vec3 c = mix(vec3(0.0), vec3(0.55, 0.05, 0.02), smoothstep(0.0, 0.3, x));
    c = mix(c, vec3(1.0, 0.42, 0.06), smoothstep(0.25, 0.6, x));
    c = mix(c, vec3(1.0, 0.86, 0.5), smoothstep(0.55, 0.9, x));
    return mix(c, vec3(1.0, 0.97, 0.92), smoothstep(0.9, 1.2, x));
}

void main() {
    vec3 rd = primaryRay();
    vec3 ro = uCamPos;
    float jit = hash3(vec3(gl_FragCoord.xy, floor(fract(uTime * 0.37) * 4096.0))).x;

    float I = 0.0;
    float bq = dot(ro, rd);
    float cq = dot(ro, ro) - uRMax * uRMax;
    float disc = bq * bq - cq;
    if (disc > 0.0) {
        float sq = sqrt(disc);
        float t0 = max(-bq - sq, 0.0), t1 = -bq + sq;
        // How fast the spiral's angle changes along r: the sphere tracing's
        // speed limit.
        float turn = 6.2831853 / (uV * uPeriod);
        float t = t0;
        float first = jit;
        for (int i = 0; i < MAX_STEPS; i++) {
            if (i >= uMaxSteps || t >= t1) break;
            vec3 x = ro + t * rd;
            float r = max(length(x), 1e-3);
            float gap;
            float rho = dust(x, r, gap);
            float dt = clamp(uStepScale * r, 0.25, 30.0);
            if (gap > 0.0) {
                dt = max(dt, 0.7 * gap / (turn + 1.0 / r));
            } else if (r < uR0 * 0.9) {
                dt = max(dt, uR0 * 0.9 - r);
            } else {
                // In the shell: step on, and take the sample half a step on,
                // jittered the first time.
                dt *= first;
                first = 1.0;
                vec3 xm = ro + (t + 0.5 * dt) * rd;
                float rm = length(xm);
                float g2;
                I += dust(xm, rm, g2) * kBand(rm) * dt;
            }
            t += dt;
        }
    }

    // A log stretch, as infrared images of it are shown: the dust a turn
    // out is a hundred times fainter than the dust at the onset.
    float x = log(1.0 + I * uGain) / log(1.0 + uGain * 6e-5);
    vec3 col = heat(x) * 1.4;

    // The two stars, far too close together and too small to resolve
    // except from close in.
    for (int k = 0; k < 2; k++) {
        vec3 sp = k == 0 ? uStarA : uStarB;
        vec3 cs = sp - ro;
        float tc = dot(cs, rd);
        if (tc <= 0.0) continue;
        float d2 = (dot(cs, cs) - tc * tc) / (tc * tc);
        float px = uPixelAngle * uPixelAngle;
        vec3 sc = k == 0 ? vec3(0.75, 0.85, 1.0) : vec3(0.85, 0.9, 1.0);
        col += sc * (1.6 * exp(-d2 / (px * 2.5)) + 0.1 * exp(-d2 / (px * 60.0)));
    }
    col += sky(rd) * 0.5;
    outColor = vec4(sane(col), 1.0);
}
`;

export const EXOTIC_FRAGS = {
    wormhole: WORMHOLE_FRAG,
    'neutron-star': NEUTRON_FRAG,
    binary: BINARY_FRAG,
    roche: ROCHE_FRAG,
    'hl-tau': PROTODISK_FRAG,
    wr104: PINWHEEL_FRAG,
};
