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

import { SIMPLEX, COLOUR_GLSL, SKY_GLSL, KERR_GLSL } from './gargantuaShaders';

/** Upper bound on every integration loop; `uMaxSteps` picks the real count. */
export const MAX_STEPS = 3000;
/** Points on the Roche stream's polyline; utils/roche.js streamPath's `count`. */
export const STREAM_POINTS = 48;

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

    outColor = vec4(side > 0.0 ? sky(dir) : otherSky(dir), 1.0);
}
`;

// ── neutron star ────────────────────────────────────────────────────────────

export const NEUTRON_FRAG = /* glsl */ `
${HEADER}

uniform float uSpin;      // always 0: a Kerr integrator run as Schwarzschild
uniform float uRadius;    // R in M
uniform float uRedshift;  // √(1 − 2/R)
uniform vec3 uMagAxis;    // unit, turning with the star
uniform float uPhase;     // the star's own rotation angle, for its surface
uniform float uSurfTemp;
uniform float uHotTemp;
uniform float uBeams;     // 0..1: the beams and the hotspots under them
uniform float uGrid;      // 0..1

${KERR_GLSL}

float stepSize(float r) {
    float h = uStepScale * max(r - 1.8, 0.06) * clamp(r / 3.0, 1.0, 6.0);
    return min(min(h, 0.1 * r + 1.0), max(r - uRadius, 0.02) + 0.02);
}

// Sweeping beams along the magnetic axis, both ways. Real pulsar beams are
// radio, not light; these are drawn so the sweep can be seen.
vec3 beamGlow(vec3 x0, vec3 x1) {
    vec3 x = 0.5 * (x0 + x1);
    float r = length(x);
    float c = abs(dot(x / r, uMagAxis));
    float cone = exp(-(1.0 - c) / 0.0045);
    float fall = exp(-r / 70.0) / (1.0 + 0.02 * r);
    return vec3(0.55, 0.75, 1.0) * cone * fall * length(x1 - x0) * 0.09 * uBeams;
}

vec3 surface(vec3 xs, vec3 v) {
    vec3 nrm = normalize(xs);
    // The surface's own coordinates, turning with the star.
    float cp = cos(-uPhase), sp = sin(-uPhase);
    vec3 q = vec3(cp * nrm.x - sp * nrm.y, sp * nrm.x + cp * nrm.y, nrm.z);
    float lat = asin(clamp(q.z, -1.0, 1.0));
    float lon = atan(q.y, q.x);

    float hot = uBeams * exp(-(1.0 - abs(dot(nrm, uMagAxis))) / 0.012);
    float T = uSurfTemp * (1.0 + 0.06 * fbm(q * 6.0, 4));
    T = mix(T, uHotTemp, hot);
    // Seen from far away the whole surface is redshifted by g.
    vec3 col = blackbody(T * uRedshift) * (0.9 + 5.0 * hot);
    float mu = clamp(dot(nrm, -normalize(v)), 0.0, 1.0);
    col *= 0.55 + 0.45 * mu;

    // Latitude and longitude every 30°, amber on the hemisphere facing away
    // from the camera, so seeing round the back shows as amber at the edge.
    float step30 = 3.14159265 / 6.0;
    float gl = abs(fract(lat / step30 + 0.5) - 0.5) * step30;
    float go = abs(fract(lon / step30 + 0.5) - 0.5) * step30 * cos(lat);
    float line = 1.0 - smoothstep(0.012, 0.03, min(gl, go));
    bool back = dot(nrm, normalize(uCamPos)) < 0.0;
    vec3 ink = back ? vec3(1.0, 0.62, 0.18) * 1.6 : vec3(0.05, 0.08, 0.14);
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
    outColor = vec4(col, 1.0);
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
    outColor = vec4(col, 1.0);
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
uniform float uDiskTemp;
uniform vec3 uHotSpot;

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

vec3 shadeDonor(vec3 p, vec3 rd) {
    vec3 g = rocheGrad(p);
    vec3 nrm = normalize(g);
    // Gravity darkening (von Zeipel, with the convective exponent): the
    // stretched tip towards L1, where gravity all but cancels, is cooler.
    float T = uDonorTemp * pow(max(length(g) / uGPole, 1e-4), 0.08);
    // The side facing the accretor is lit and heated by the disk.
    vec3 toAcc = normalize(vec3(uXa, 0.0, 0.0) - p);
    T *= 1.0 + 0.22 * max(dot(nrm, toAcc), 0.0);
    T *= 1.0 + 0.03 * fbm(nrm * 14.0 + uTime * 0.02, 4);
    float mu = max(dot(nrm, -rd), 0.0);
    float b = pow(T / uDonorTemp, 4.0);
    return blackbody(T) * b * (0.3 + 0.7 * mu) * 0.42;
}

// The disk round the accretor, in the orbital plane.
vec4 shadeDisk(vec3 p) {
    vec2 d = p.xy - vec2(uXa, 0.0);
    float r = length(d);
    if (r < uDiskIn || r > uDiskOut) return vec4(0.0);
    float edge = smoothstep(uDiskIn, uDiskIn * 1.4, r) * (1.0 - smoothstep(uDiskOut * 0.8, uDiskOut, r));
    float omega = sqrt(uMa / (r * r * r)) * 0.25;
    const float P = 60.0;
    float t1 = mod(uTime, P), t2 = mod(uTime + 0.5 * P, P);
    float w1 = 1.0 - abs(2.0 * t1 / P - 1.0);
    float ang = atan(d.y, d.x);
    float a1 = ang - omega * t1, a2 = ang - omega * t2;
    float n1 = fbm(vec3(cos(a1) * 2.4, sin(a1) * 2.4, r * 40.0), 5);
    float n2 = fbm(vec3(cos(a2) * 2.4, sin(a2) * 2.4, r * 40.0 + 17.0), 5);
    float n = mix(n2, n1, w1);
    float dens = smoothstep(-0.45, 0.6, n) * (0.88 + 0.12 * sin(r * 90.0 + 3.0 * n));
    float T = uDiskTemp * pow(r / uDiskIn, -0.75);
    // The hot spot, where the stream slams into the rim.
    float spot = exp(-dot(p - uHotSpot, p - uHotSpot) / 0.0009);
    T = mix(T, 14000.0, spot);
    vec3 col = blackbody(T) * (0.3 + 1.6 * pow(uDiskIn / r, 0.9) + 2.5 * spot);
    return vec4(col * (0.45 + 0.55 * dens), clamp((0.3 + 0.7 * dens) * edge + spot, 0.0, 0.97));
}

// The stream's glow along this ray: a soft tube round each segment of the
// path, front to back, hidden behind the donor and dimmed behind the disk.
vec3 streamGlow(vec3 ro, vec3 rd, float tDonor, float tDisk, float diskAlpha) {
    vec3 col = vec3(0.0);
    for (int i = 0; i < STREAM_POINTS - 1; i++) {
        vec3 a = uStream[i];
        vec3 b = uStream[i + 1];
        vec3 u = b - a;
        float segLen = length(u);
        if (segLen < 1e-6) continue;
        u /= segLen;
        // Closest approach between the ray and the segment's line.
        vec3 w0 = ro - a;
        float bb = dot(rd, u);
        float dd = dot(rd, w0), ee = dot(u, w0);
        float den = 1.0 - bb * bb;
        if (den < 1e-5) continue;
        float s = (ee - bb * dd) / den;   // along the segment
        float t = (bb * ee - dd) / den;   // along the ray
        if (s < 0.0 || s >= segLen || t < 0.0) continue;
        float f = float(i) / float(STREAM_POINTS - 1);
        float wdt = uStreamWidth * mix(1.0, 0.45, f);
        vec3 c = (ro + t * rd) - (a + s * u);
        float g = exp(-dot(c, c) / (wdt * wdt));
        if (g < 1e-3) continue;
        if (tDonor > 0.0 && t > tDonor) continue;
        float through = wdt * 1.77 / sqrt(max(den, 0.04));
        float vis = (tDisk > 0.0 && t > tDisk) ? 1.0 - diskAlpha : 1.0;
        col += blackbody(mix(uDonorTemp * 0.95, 12000.0, f * f)) * g * through * vis * mix(5.0, 14.0, f);
    }
    return col;
}

void main() {
    vec3 rd = primaryRay();
    vec3 ro = uCamPos;

    float tDonor = hitDonor(ro, rd);
    float tDisk = -1.0;
    vec4 disk = vec4(0.0);
    if (abs(rd.z) > 1e-5) {
        float t = -ro.z / rd.z;
        if (t > 0.0) {
            disk = shadeDisk(ro + t * rd);
            if (disk.a > 0.0) tDisk = t;
        }
    }

    vec3 col = streamGlow(ro, rd, tDonor, tDisk, disk.a);
    float trans = 1.0;
    if (tDisk > 0.0 && (tDonor < 0.0 || tDisk < tDonor)) {
        col += disk.rgb * disk.a;
        trans = 1.0 - disk.a;
    }
    if (tDonor > 0.0) {
        col += trans * shadeDonor(ro + tDonor * rd, rd);
    } else {
        col += trans * sky(rd);
    }
    outColor = vec4(col, 1.0);
}
`;

export const EXOTIC_FRAGS = {
    wormhole: WORMHOLE_FRAG,
    'neutron-star': NEUTRON_FRAG,
    binary: BINARY_FRAG,
    roche: ROCHE_FRAG,
};
