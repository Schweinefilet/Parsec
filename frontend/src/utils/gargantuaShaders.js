// The /gargantua renderer, as GLSL.
//
// One full-screen pass traces a light ray per pixel backward from the camera
// through Kerr spacetime (utils/kerr.js has the maths and the tests; `rayDeriv`
// below is its `rayDerivative`, line for line). Along the way the ray can:
//
//   - cross the equatorial plane, where the disk is. Each crossing adds the
//     disk's light there, weighted by how much light earlier crossings already
//     blocked. A ray that goes over the hole and is bent down onto the far side
//     of the disk is what draws the arch over the top in the film; the thin
//     ring just outside the shadow is the same disk seen after a full loop.
//   - pass through the disk's glow, a thin emitting haze either side of it.
//   - fall in (black), or get far enough away that it no longer bends: then
//     its direction picks a point on the procedural sky.
//
// Nothing here is a lensing *effect* painted on a picture. The sky and the disk
// are flat, ordinary things; every distortion on screen is the rays themselves
// bending.
//
// The disk follows DNGR's choices for the film (James et al. 2015): thin,
// in the equatorial plane, blackbody at a set temperature. What the film left
// out — Doppler shift, beaming and gravitational redshift — is `uDoppler`.
// At 1 the disk's colour is the blackbody at the shifted temperature gT and
// its brightness goes as g⁴, which is the lopsided, one-sided disk the paper
// shows and the film declined to use.
//
// Orientation: the integrator runs light *forward* from the camera in
// ingoing Kerr–Schild coordinates (that is what lets a ray cross the horizon
// cleanly), which is the time-reverse of the light that actually reaches the
// eye. Time-reversing Kerr flips its spin, so the picture drawn is that of a
// hole spinning towards −φ, and the disk is made to orbit that way too.

// Ashima Arts / Stefan Gustavson 3D simplex noise (MIT licence).
export const SIMPLEX = /* glsl */ `
vec3 mod289(vec3 x) { return x - floor(x * (1.0 / 289.0)) * 289.0; }
vec4 mod289(vec4 x) { return x - floor(x * (1.0 / 289.0)) * 289.0; }
vec4 permute(vec4 x) { return mod289(((x * 34.0) + 10.0) * x); }
vec4 taylorInvSqrt(vec4 r) { return 1.79284291400159 - 0.85373472095314 * r; }
float snoise(vec3 v) {
    const vec2 C = vec2(1.0 / 6.0, 1.0 / 3.0);
    const vec4 D = vec4(0.0, 0.5, 1.0, 2.0);
    vec3 i = floor(v + dot(v, C.yyy));
    vec3 x0 = v - i + dot(i, C.xxx);
    vec3 g = step(x0.yzx, x0.xyz);
    vec3 l = 1.0 - g;
    vec3 i1 = min(g.xyz, l.zxy);
    vec3 i2 = max(g.xyz, l.zxy);
    vec3 x1 = x0 - i1 + C.xxx;
    vec3 x2 = x0 - i2 + C.yyy;
    vec3 x3 = x0 - D.yyy;
    i = mod289(i);
    vec4 p = permute(permute(permute(
        i.z + vec4(0.0, i1.z, i2.z, 1.0))
        + i.y + vec4(0.0, i1.y, i2.y, 1.0))
        + i.x + vec4(0.0, i1.x, i2.x, 1.0));
    float n_ = 0.142857142857;
    vec3 ns = n_ * D.wyz - D.xzx;
    vec4 j = p - 49.0 * floor(p * ns.z * ns.z);
    vec4 x_ = floor(j * ns.z);
    vec4 y_ = floor(j - 7.0 * x_);
    vec4 x = x_ * ns.x + ns.yyyy;
    vec4 y = y_ * ns.x + ns.yyyy;
    vec4 h = 1.0 - abs(x) - abs(y);
    vec4 b0 = vec4(x.xy, y.xy);
    vec4 b1 = vec4(x.zw, y.zw);
    vec4 s0 = floor(b0) * 2.0 + 1.0;
    vec4 s1 = floor(b1) * 2.0 + 1.0;
    vec4 sh = -step(h, vec4(0.0));
    vec4 a0 = b0.xzyw + s0.xzyw * sh.xxyy;
    vec4 a1 = b1.xzyw + s1.xzyw * sh.zzww;
    vec3 p0 = vec3(a0.xy, h.x);
    vec3 p1 = vec3(a0.zw, h.y);
    vec3 p2 = vec3(a1.xy, h.z);
    vec3 p3 = vec3(a1.zw, h.w);
    vec4 norm = taylorInvSqrt(vec4(dot(p0, p0), dot(p1, p1), dot(p2, p2), dot(p3, p3)));
    p0 *= norm.x; p1 *= norm.y; p2 *= norm.z; p3 *= norm.w;
    vec4 m = max(0.5 - vec4(dot(x0, x0), dot(x1, x1), dot(x2, x2), dot(x3, x3)), 0.0);
    m = m * m;
    return 105.0 * dot(m * m, vec4(dot(p0, x0), dot(p1, x1), dot(p2, x2), dot(p3, x3)));
}
float fbm(vec3 p, int oct) {
    float s = 0.0, amp = 0.5;
    for (int i = 0; i < 7; i++) {
        if (i >= oct) break;
        s += amp * snoise(p);
        p = p * 2.03 + vec3(1.7, 9.2, 3.1);
        amp *= 0.5;
    }
    return s;
}
`;

// The Kerr spacetime, shared with /exotic's neutron star (which runs it at
// a = 0). Expects `uniform float uSpin`.
export const KERR_GLSL = /* glsl */ `
float blRadius(vec3 x) {
    float a = uSpin;
    float w = dot(x, x) - a * a;
    return sqrt(0.5 * (w + sqrt(w * w + 4.0 * a * a * x.z * x.z)));
}

// utils/kerr.js rayDerivative(), on the GPU.
void rayDeriv(vec3 x, vec3 p, out vec3 dx, out vec3 dp) {
    float a = uSpin;
    float a2 = a * a;
    float w = dot(x, x) - a2;
    float r2 = 0.5 * (w + sqrt(w * w + 4.0 * a2 * x.z * x.z));
    float r = sqrt(r2);
    float r3 = r2 * r;
    float S = r2 + a2;
    float Q = r2 * r2 + a2 * x.z * x.z;
    float f = 2.0 * r3 / Q;
    vec3 l = vec3((r * x.x + a * x.y) / S, (r * x.y - a * x.x) / S, x.z / r);
    float L = 1.0 + dot(l, p);

    vec3 R = vec3(r3 * x.x / Q, r3 * x.y / Q, r * x.z * (r2 + a2) / Q);
    float c = 2.0 / (Q * Q);
    vec3 df = c * (3.0 * r2 * Q * R - 4.0 * r3 * r3 * R);
    df.z -= c * r3 * 2.0 * a2 * x.z;

    float B = x.x * p.x + x.y * p.y;
    float A = r * B + a * (x.y * p.x - x.x * p.y);
    vec3 dA = vec3(R.x * B + r * p.x - a * p.y, R.y * B + r * p.y + a * p.x, R.z * B);
    vec3 dL = (dA * S - A * 2.0 * r * R) / (S * S) - p.z * x.z * R / r2;
    dL.z += p.z * r / r2;

    dx = p - f * L * l;
    dp = 0.5 * L * L * df + f * L * dL;
}

vec3 launch(vec3 x, vec3 n) {
    float a = uSpin;
    float r = blRadius(x);
    float S = r * r + a * a;
    float f = 2.0 * r * r * r / (r * r * r * r + a * a * x.z * x.z);
    vec3 l = vec3((r * x.x + a * x.y) / S, (r * x.y - a * x.x) / S, x.z / r);
    float ln = dot(l, n);
    float A = 1.0 - f * ln * ln;
    float B = -2.0 * f * ln;
    float C = -(1.0 + f);
    float k = (-B + sqrt(B * B - 4.0 * A * C)) / (2.0 * A);
    return k * n;
}
`;

// Blackbody lookup and an integer hash, shared with /exotic. Expects
// `uBlackbody` and `uBlackbodyRange`.
export const COLOUR_GLSL = /* glsl */ `
vec3 blackbody(float T) {
    float u = clamp((log(T) - uBlackbodyRange.x) / (uBlackbodyRange.y - uBlackbodyRange.x), 0.0, 1.0);
    return texture(uBlackbody, vec2(u, 0.5)).rgb;
}

// Integer hash (PCG3D, Jarzynski & Olano 2020).
uvec3 pcg3d(uvec3 v) {
    v = v * 1664525u + 1013904223u;
    v.x += v.y * v.z; v.y += v.z * v.x; v.z += v.x * v.y;
    v ^= v >> 16u;
    v.x += v.y * v.z; v.y += v.z * v.x; v.z += v.x * v.y;
    return v;
}
vec3 hash3(vec3 cell) {
    return vec3(pcg3d(uvec3(ivec3(cell) + ivec3(1 << 20)))) * (1.0 / 4294967295.0);
}
`;

// The procedural sky, shared with /exotic. Expects `uSkyRot`, `uPixelAngle`,
// `uStarGain` and `uMilkyWay`, and SIMPLEX and COLOUR_GLSL above it.
export const SKY_GLSL = /* glsl */ `
vec3 stars(vec3 d) {
    // Three layers of cells on the sphere, each holding at most one star:
    // a few bright ones, more faint ones. About 60 000 in all.
    vec3 col = vec3(0.0);
    for (int k = 0; k < 3; k++) {
        float fk = float(k);
        float sc = 36.0 * pow(2.4, fk);
        vec3 q = d * sc;
        vec3 cell = floor(q);
        vec3 h = hash3(cell + fk * 1013.0);
        if (h.x > 0.55 / (1.0 + 2.5 * fk)) continue;
        vec3 sp = cell + 0.2 + 0.6 * h.yzx;
        float ang = length(q - sp) / sc;
        float size = uPixelAngle * 0.8;
        float bright = (pow(fract(h.y * 37.31 + h.z), 14.0) * 4.0 + 0.05) / (1.0 + fk * 1.5);
        float T = mix(2800.0, 16000.0, pow(fract(h.z * 91.7), 1.6));
        col += blackbody(T) * bright * exp(-ang * ang / (size * size));
    }
    return col * uStarGain;
}

vec3 sky(vec3 dir) {
    vec3 d = uSkyRot * dir;
    vec3 col = stars(d);

    // A Milky Way band: a soft glow in a plane, mottled, cut by dust lanes.
    const vec3 pole = vec3(0.0, 0.0, 1.0);
    const vec3 core = vec3(1.0, 0.0, 0.0);
    float b = dot(d, pole);
    float band = exp(-b * b / 0.02);
    float bulge = exp(-pow(acos(clamp(dot(d, core), -1.0, 1.0)), 2.0) / 0.35);
    float mott = fbm(d * 4.0, 5) * 0.5 + 0.5;
    float dust = smoothstep(0.05, 0.45, fbm(d * 9.0 + 5.0, 5));
    vec3 glow = mix(vec3(0.42, 0.48, 0.62), vec3(1.0, 0.82, 0.6), bulge);
    float lane = 1.0 - 0.85 * dust * exp(-b * b / 0.004);
    col += glow * (band * (0.35 + 0.9 * bulge) * mott * lane) * uMilkyWay;
    // Unresolved stars in the band: high-frequency grit.
    col += vec3(0.8, 0.85, 1.0) * pow(max(snoise(d * 220.0), 0.0), 6.0) * band * 0.8 * uMilkyWay;
    // Faint nebulosity anywhere.
    float neb = pow(max(fbm(d * 1.7 + 11.0, 5), 0.0), 2.5);
    col += vec3(0.32, 0.12, 0.22) * neb * 0.35 * uMilkyWay;
    col += vec3(0.08, 0.16, 0.3) * pow(max(fbm(d * 2.3 - 4.0, 4), 0.0), 2.0) * 0.3 * uMilkyWay;
    return col;
}
`;

export const FULLSCREEN_VERT = /* glsl */ `
out vec2 vUv;
void main() {
    vUv = uv;
    gl_Position = vec4(position.xy, 0.0, 1.0);
}
`;

/** Upper bound on the integration loop; `uMaxSteps` picks the real count below it. */
export const MAX_STEPS = 3000;

export const TRACE_FRAG = /* glsl */ `
precision highp float;
precision highp int;

in vec2 vUv;
out vec4 outColor;

#define MAX_STEPS ${MAX_STEPS}

uniform vec2 uResolution;
uniform vec2 uJitter;
uniform vec3 uCamPos;
uniform vec3 uCamRight;
uniform vec3 uCamUp;
uniform vec3 uCamFwd;
uniform float uTanHalfFov;
uniform float uPixelAngle;

uniform float uSpin;
uniform float uRh;
uniform float uIsco;
uniform float uDiskOuter;
uniform float uDiskTemp;
uniform float uDoppler;
uniform float uDiskGain;
uniform float uDiskOpacity;
uniform float uHaze;
uniform float uObsFactor;
uniform float uTime;

uniform float uStepScale;
uniform int uMaxSteps;
uniform float uEscape;

uniform sampler2D uBlackbody;
uniform vec2 uBlackbodyRange; // log(min K), log(max K)
uniform mat3 uSkyRot;
uniform float uStarGain;
uniform float uMilkyWay;

${SIMPLEX}

// ── spacetime ───────────────────────────────────────────────────────────────

${KERR_GLSL}
float stepSize(float r) {
    float h = uStepScale * max(r - 0.9 * uRh, 0.06) * clamp(r / 3.0, 1.0, 6.0);
    return min(h, 0.1 * r + 1.0);
}

// ── colour ──────────────────────────────────────────────────────────────────

${COLOUR_GLSL}

// ── the disk ────────────────────────────────────────────────────────────────

// Novikov–Thorne temperature shape, 1 at its peak (r = 49/36 r_in), 0 at r_in.
float ntShape(float r) {
    float xr = r / uIsco;
    return pow(xr, -0.75) * pow(max(1.0 - inversesqrt(xr), 0.0), 0.25) / 0.48795;
}

// How bright the disk is for its temperature shape. With the physics on it
// is σT⁴-like, dark at the inner edge where the gas has not yet heated up;
// the film's disk is lit nearly evenly right up to its edge, so with the
// physics off it is much flatter.
float diskBrightness(float shape) {
    return mix(0.3 + 0.7 * shape, 0.04 + pow(shape, 3.0), uDoppler);
}

// Frequency shift g = E_seen / E_emitted for light leaving the disk material
// at x with (traced) momentum p. Circular Kepler orbit; see the header for the
// direction it turns.
float diskShift(vec3 x, vec3 p, float r) {
    float a = uSpin;
    float rr = pow(r, 1.5);
    float omega = 1.0 / (rr + a);
    float ut = (rr + a) / (pow(r, 0.75) * sqrt(max(rr - 3.0 * sqrt(r) + 2.0 * a, 1e-3)));
    float pphi = x.x * p.y - x.y * p.x;
    float g = uObsFactor / max(ut * (1.0 - omega * pphi), 1e-3);
    return mix(1.0, g, uDoppler);
}

// Gas density in the disk at radius r, angle ang (already wound back by the
// orbit), on a seed. Long arcs: the angle is sampled on a small circle and
// the radius finely, so a feature is several times longer than it is wide.
float diskTexture(float r, float ang, float seed) {
    vec3 q = vec3(cos(ang) * 2.4, sin(ang) * 2.4, r * 1.35 + seed);
    float n = fbm(q, 6);
    float fine = fbm(vec3(cos(ang) * 9.0, sin(ang) * 9.0, r * 7.0 + seed * 3.0), 3);
    float rings = 0.6 + 0.4 * sin(r * 11.0 + 4.0 * n + seed);
    float d = smoothstep(-0.45, 0.65, n + 0.25 * fine) * rings;
    return d;
}

// Two copies of the texture, half a cycle apart, each restarting from
// unwound once a cycle and faded out before it does: gas closer in orbits
// faster, so a single copy would shear into ever-finer stripes for as long
// as the page is open.
float diskDensity(vec3 x, float r) {
    const float P = 90.0;
    float phi = atan(x.y, x.x);
    float omega = 1.0 / (pow(r, 1.5) + uSpin);
    float t1 = mod(uTime, P);
    float t2 = mod(uTime + 0.5 * P, P);
    float w1 = 1.0 - abs(2.0 * t1 / P - 1.0);
    float d1 = diskTexture(r, phi + omega * t1, 0.0);
    float d2 = diskTexture(r, phi + omega * t2, 37.0);
    return mix(d2, d1, w1);
}

vec4 shadeDisk(vec3 x, vec3 p) {
    float r = blRadius(x);
    if (r < uIsco || r > uDiskOuter) return vec4(0.0);
    float edge = smoothstep(uIsco, uIsco * 1.08, r) * (1.0 - smoothstep(uDiskOuter * 0.55, uDiskOuter, r));
    float dens = diskDensity(x, r) * edge;
    float alpha = clamp(dens * uDiskOpacity, 0.0, 0.985);
    float shape = ntShape(r);
    float T = uDiskTemp * mix(1.0, shape, 0.45);
    float g = diskShift(x, p, r);
    float g2 = g * g;
    vec3 col = blackbody(T * g) * diskBrightness(shape) * g2 * g2 * uDiskGain;
    return vec4(col * (0.4 + 0.6 * dens), alpha);
}

float erfApprox(float x) {
    // Winitzki's approximation, good to about 1e-4.
    float x2 = x * x;
    const float k = 0.147;
    float e = sqrt(1.0 - exp(-x2 * (1.2732395 + k * x2) / (1.0 + k * x2)));
    return x < 0.0 ? -e : e;
}

// The glow off the disk's faces over one step, x0 → x1: thin, flaring with
// radius, unstructured. The Gaussian across the plane is integrated exactly
// along the segment rather than sampled at a point; sampled, a coarse step
// hits or misses the thin layer in bands that track the step pattern.
vec3 diskHaze(vec3 x0, vec3 x1, vec3 p) {
    vec3 x = 0.5 * (x0 + x1);
    float r = blRadius(x);
    if (r < uIsco * 0.85 || r > uDiskOuter * 1.25) return vec3(0.0);
    float H = 0.05 * r + 0.05;
    float dz = x1.z - x0.z;
    float ds = length(x1 - x0);
    float lineInt;
    if (abs(dz) > 1e-3 * H) {
        lineInt = ds / abs(dz) * H * 0.8862269 * abs(erfApprox(x1.z / H) - erfApprox(x0.z / H));
    } else {
        float z = x.z / H;
        lineInt = ds * exp(-z * z);
    }
    if (lineInt < 1e-5) return vec3(0.0);
    float radial = smoothstep(uIsco * 0.85, uIsco * 1.2, r)
        * (1.0 - smoothstep(uDiskOuter * 0.5, uDiskOuter * 1.25, r));
    float shape = ntShape(max(r, uIsco * 1.01));
    float g = diskShift(x, p, max(r, uIsco));
    float g2 = g * g;
    return blackbody(uDiskTemp * mix(1.0, shape, 0.45) * g) * diskBrightness(shape) * g2 * g2
        * lineInt * radial * uHaze * uDiskGain;
}

// ── the sky ─────────────────────────────────────────────────────────────────

${SKY_GLSL}

// ── main ────────────────────────────────────────────────────────────────────

void main() {
    vec2 ndc = ((gl_FragCoord.xy + uJitter) / uResolution) * 2.0 - 1.0;
    ndc.x *= uResolution.x / uResolution.y;
    vec3 n = normalize(uCamFwd + uTanHalfFov * (ndc.x * uCamRight + ndc.y * uCamUp));

    vec3 x = uCamPos;
    vec3 p = launch(x, n);
    vec3 col = vec3(0.0);
    float trans = 1.0;
    bool escaped = false;
    vec3 v = n;

    for (int i = 0; i < MAX_STEPS; i++) {
        if (i >= uMaxSteps) { escaped = true; break; }
        float r = blRadius(x);
        if (r < 0.98 * uRh) break;
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

        if (uHaze > 0.0) {
            col += trans * diskHaze(x, xn, 0.5 * (p + pn));
        }

        if (x.z * xn.z < 0.0) {
            float t = x.z / (x.z - xn.z);
            vec4 d = shadeDisk(mix(x, xn, t), mix(p, pn, t));
            col += trans * d.rgb * d.a;
            trans *= 1.0 - d.a;
            if (trans < 0.004) break;
        }

        x = xn;
        p = pn;
    }

    if (escaped && trans > 0.004) col += trans * sky(normalize(v));
    outColor = vec4(col, 1.0);
}
`;

/**
 * HDR frame → screen: exposure, film curve, lens, grain. The bloom is already
 * in the frame (UnrealBloomPass adds it back into the target it read).
 */
export const COMPOSITE_FRAG = /* glsl */ `
precision highp float;
in vec2 vUv;
out vec4 outColor;

uniform sampler2D tScene;
uniform float uExposure;
uniform float uFade;
uniform float uTime;
uniform float uGrain;
uniform float uAberration;
uniform vec2 uAspect;

// ACES filmic, Hill's fit (RRT + ODT), linear in, linear out.
vec3 rrtOdt(vec3 v) {
    vec3 a = v * (v + 0.0245786) - 0.000090537;
    vec3 b = v * (0.983729 * v + 0.4329510) + 0.238081;
    return a / b;
}
vec3 aces(vec3 c) {
    const mat3 inM = mat3(0.59719, 0.07600, 0.02840, 0.35458, 0.90834, 0.13383, 0.04823, 0.01566, 0.83777);
    const mat3 outM = mat3(1.60475, -0.10208, -0.00327, -0.53108, 1.10813, -0.07276, -0.07367, -0.00605, 1.07602);
    return clamp(outM * rrtOdt(inM * c), 0.0, 1.0);
}
vec3 srgb(vec3 c) {
    return mix(c * 12.92, 1.055 * pow(c, vec3(1.0 / 2.4)) - 0.055, step(vec3(0.0031308), c));
}
float hash(vec2 p) {
    p = fract(p * vec2(443.897, 441.423));
    p += dot(p, p.yx + 19.19);
    return fract((p.x + p.y) * p.x);
}

void main() {
    vec2 c = vUv - 0.5;
    vec2 off = c * uAberration * dot(c, c);
    vec3 col = vec3(
        texture(tScene, vUv - off).r,
        texture(tScene, vUv).g,
        texture(tScene, vUv + off).b
    );
    col *= uExposure;
    col = aces(col);
    float vig = smoothstep(1.15, 0.25, length(c * uAspect));
    col *= mix(0.55, 1.0, vig);
    col = srgb(col);
    col += (hash(gl_FragCoord.xy + fract(uTime * 7.31) * 100.0) - 0.5) * uGrain;
    outColor = vec4(col * uFade, 1.0);
}
`;
