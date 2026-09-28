// The Sun's two shaders: the disc itself, and the corona around it.
//
// Both replace things that were drawn with stock materials — the disc was a
// MeshBasicMaterial with sun.jpg on it, and the glow was five additive sphere
// shells of fixed opacity stacked around it. That read as a lit ball inside
// some concentric haze: flat to the very edge, and perfectly still. A star
// is neither. Its disc darkens and reddens toward the limb (you are looking
// through a longer, cooler slant of photosphere there — the single strongest
// visual tell that something is a star), its surface churns, and its corona
// is ragged, streaming outward rather than a smooth gradient.
//
// Everything is procedural noise evaluated in the fragment shader: no new
// textures to download or upload, so the cost is fill rate and nothing else.
// The corona's noise detail is a tier setting (quality.js `coronaOctaves`) —
// it is the larger of the two surfaces, and on the Sun's own focus view it
// covers most of the screen.

import * as THREE from 'three';

// Ashima Arts / Stefan Gustavson 3D simplex noise (MIT). The standard
// webgl-noise implementation, trimmed to the one function used here.
const SIMPLEX_3D = /* glsl */ `
vec3 sn_mod289(vec3 x) { return x - floor(x * (1.0 / 289.0)) * 289.0; }
vec4 sn_mod289(vec4 x) { return x - floor(x * (1.0 / 289.0)) * 289.0; }
vec4 sn_permute(vec4 x) { return sn_mod289(((x * 34.0) + 10.0) * x); }
vec4 sn_taylorInvSqrt(vec4 r) { return 1.79284291400159 - 0.85373472095314 * r; }

float snoise(vec3 v) {
    const vec2 C = vec2(1.0 / 6.0, 1.0 / 3.0);
    const vec4 D = vec4(0.0, 0.5, 1.0, 2.0);
    vec3 i  = floor(v + dot(v, C.yyy));
    vec3 x0 = v - i + dot(i, C.xxx);
    vec3 g  = step(x0.yzx, x0.xyz);
    vec3 l  = 1.0 - g;
    vec3 i1 = min(g.xyz, l.zxy);
    vec3 i2 = max(g.xyz, l.zxy);
    vec3 x1 = x0 - i1 + C.xxx;
    vec3 x2 = x0 - i2 + C.yyy;
    vec3 x3 = x0 - D.yyy;
    i = sn_mod289(i);
    vec4 p = sn_permute(sn_permute(sn_permute(
                i.z + vec4(0.0, i1.z, i2.z, 1.0))
              + i.y + vec4(0.0, i1.y, i2.y, 1.0))
              + i.x + vec4(0.0, i1.x, i2.x, 1.0));
    float n_ = 0.142857142857;
    vec3 ns = n_ * D.wyz - D.xzx;
    vec4 j  = p - 49.0 * floor(p * ns.z * ns.z);
    vec4 x_ = floor(j * ns.z);
    vec4 y_ = floor(j - 7.0 * x_);
    vec4 x  = x_ * ns.x + ns.yyyy;
    vec4 y  = y_ * ns.x + ns.yyyy;
    vec4 h  = 1.0 - abs(x) - abs(y);
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
    vec4 norm = sn_taylorInvSqrt(vec4(dot(p0, p0), dot(p1, p1), dot(p2, p2), dot(p3, p3)));
    p0 *= norm.x; p1 *= norm.y; p2 *= norm.z; p3 *= norm.w;
    vec4 m = max(0.5 - vec4(dot(x0, x0), dot(x1, x1), dot(x2, x2), dot(x3, x3)), 0.0);
    m = m * m;
    return 105.0 * dot(m * m, vec4(dot(p0, x0), dot(p1, x1), dot(p2, x2), dot(p3, x3)));
}

// Fractal sum, OCTAVES from a #define so each tier compiles its own loop
// bound (GLSL ES 1.0 wants a constant one anyway). Returns roughly [-1, 1].
float fbm(vec3 p) {
    float sum = 0.0, amp = 0.5;
    for (int i = 0; i < OCTAVES; i++) {
        sum += amp * snoise(p);
        p = p * 2.03 + vec3(1.7, 9.2, 4.1);
        amp *= 0.5;
    }
    return sum;
}
`;

// ── The disc ────────────────────────────────────────────────────────────────

const SURFACE_VERTEX = /* glsl */ `
varying vec2 vUv;
varying vec3 vObjDir;
varying vec3 vViewNormal;
varying vec3 vViewPos;
void main() {
    vUv = uv;
    // Object space, so the churn rides round with the Sun's own spin and
    // has no seam or pole pinch the way anything keyed off the UVs would.
    vObjDir = normalize(position);
    vViewNormal = normalize(normalMatrix * normal);
    vec4 mv = modelViewMatrix * vec4(position, 1.0);
    vViewPos = mv.xyz;
    gl_Position = projectionMatrix * mv;
}
`;

const SURFACE_FRAGMENT = /* glsl */ `
uniform sampler2D map;
uniform float hasMap;
uniform vec3  baseColor;
uniform float uTime;
uniform float uIntensity;
varying vec2 vUv;
varying vec3 vObjDir;
varying vec3 vViewNormal;
varying vec3 vViewPos;
${SIMPLEX_3D}
void main() {
    vec3 p = vObjDir;
    float t = uTime;

    // Slow domain warp of the photograph: the plage and spot structure
    // drifts and folds instead of being painted on. Tiny amplitude — enough
    // to see it move, not enough to smear the texture into mush.
    vec2 warp = vec2(
        fbm(p * 3.0 + vec3(0.0, t * 0.020, 0.0)),
        fbm(p * 3.0 + vec3(17.3, 4.1, t * 0.020))
    ) * 0.012;
    vec3 surface = hasMap > 0.5 ? texture2D(map, vUv + warp).rgb : baseColor;

    // Granulation: fine convection cells, bright centres and dark lanes,
    // boiling at a slightly faster rate than the large-scale drift.
    float gran = fbm(p * 26.0 + vec3(t * 0.05, -t * 0.04, t * 0.03));
    surface *= 0.9 + 0.22 * gran;

    // Limb darkening, the Eddington linear law I = 1 - u(1 - mu) with the
    // Sun's own visible-light coefficient u ~ 0.6. mu is the cosine between
    // the surface normal and the line of sight.
    float mu = clamp(dot(normalize(vViewNormal), normalize(-vViewPos)), 0.0, 1.0);
    float limb = 1.0 - 0.6 * (1.0 - mu);
    // The limb is also cooler, so redder: the blue end falls away faster.
    vec3 tint = mix(vec3(1.0, 0.52, 0.22), vec3(1.0), pow(mu, 0.45));
    surface *= limb * tint;
    // The old stack of yellow glow shells lay over the disc as well as round
    // it, and lifted the whole photograph toward yellow-white. Keep that
    // heat, but centre-weighted, so the limb still falls away to orange.
    surface += vec3(0.20, 0.16, 0.05) * mu;

    gl_FragColor = vec4(surface * uIntensity, 1.0);
    #include <tonemapping_fragment>
    #include <colorspace_fragment>
}
`;

/**
 * The Sun's disc. `intensity` multiplies the final colour, and is how the
 * bloom tier pushes the disc into HDR; 1.0 leaves it at the brightness the
 * plain photograph had.
 */
export function createSunSurfaceMaterial({ intensity = 1, octaves = 3, color = '#FFF4A0' } = {}) {
    return new THREE.ShaderMaterial({
        uniforms: {
            map:        { value: null },
            hasMap:     { value: 0 },
            baseColor:  { value: new THREE.Color(color) },
            uTime:      { value: 0 },
            uIntensity: { value: intensity },
        },
        defines: { OCTAVES: octaves },
        vertexShader: SURFACE_VERTEX,
        fragmentShader: SURFACE_FRAGMENT,
    });
}

/** Hands the loaded photograph to a material from createSunSurfaceMaterial(). */
export function setSunSurfaceMap(material, texture) {
    material.uniforms.map.value = texture;
    material.uniforms.hasMap.value = texture ? 1 : 0;
}

// ── The corona ──────────────────────────────────────────────────────────────

/**
 * How far out the corona quad reaches, as a multiple of the Sun's radius.
 * Past about 3 radii every term in the fragment shader below has fallen to
 * nothing visible, and every extra radius is overdraw on the Sun's own focus
 * view, where the quad already covers most of the screen.
 */
export const CORONA_EXTENT = 3.2;

const CORONA_VERTEX = /* glsl */ `
uniform float uExtent;
uniform float uRadius;
varying vec2 vQuad;
varying vec3 vDir;
void main() {
    vQuad = position.xy;
    // The corner's direction from the Sun's centre, taken back from view
    // space into world space (the view matrix is rigid, so the inverse of
    // its rotation is its transpose, and v * M is transpose(M) * v). The
    // streamers are keyed off this rather than off vQuad: keyed off the
    // quad, the pattern was pinned to the screen, so orbiting the Sun
    // turned the disc underneath a corona that never moved — it read as a
    // sticker. Keyed off world directions, the corona is a 3D thing seen
    // edge-on at the limb, and turning the camera brings different
    // streamers round the edge. Linear in position, so interpolating it
    // across the quad is exact.
    vDir = vec3(position.xy, 0.0) * mat3(viewMatrix);
    // Billboarded here rather than by turning the mesh each frame: take the
    // Sun's centre into view space and spread the corners out in the view
    // plane. The model matrix's own scale (the true-sizes shrink on the
    // parent group) is read back off its first column, so the corona
    // shrinks with the disc without anything in the render loop.
    vec4 centre = modelViewMatrix * vec4(0.0, 0.0, 0.0, 1.0);
    float s = length(modelViewMatrix[0].xyz);
    centre.xy += position.xy * uExtent * uRadius * s;
    gl_Position = projectionMatrix * centre;
}
`;

const CORONA_FRAGMENT = /* glsl */ `
uniform float uTime;
uniform float uIntensity;
uniform float uExtent;
varying vec2 vQuad;
varying vec3 vDir;
${SIMPLEX_3D}

// One layer of outward flow: noise sampled on a sphere whose radius falls
// with tau, so a feature at a fixed spot on that sphere sits at a greater
// height x as tau grows — it rises off the limb. tau only runs over [0, 2),
// keeping the radius well clear of zero, which is why flow() below
// crossfades two of these half a cycle apart instead of letting one run.
float flowLayer(vec3 d, float x, float tau, float seed) {
    return snoise(d * (7.0 + 1.6 * x - tau) + seed);
}

float flow(vec3 d, float x, float t) {
    float c  = t * 0.035;
    float f0 = fract(c);
    float f1 = fract(c + 0.5);
    // Triangle weights: each layer is invisible at the moment it wraps.
    float w0 = 1.0 - abs(2.0 * f0 - 1.0);
    float w1 = 1.0 - w0;
    float n = flowLayer(d, x, f0 * 2.0, 0.0) * w0 + flowLayer(d, x, f1 * 2.0, 23.7) * w1;
    // Two blended noises are flatter than one; restore the contrast.
    return n * inversesqrt(w0 * w0 + w1 * w1);
}

void main() {
    float q = length(vQuad);           // 0 at the centre, 1 at the quad's inscribed edge
    float d = q * uExtent;             // distance from centre in solar radii
    float x = max(d - 1.0, 0.0);       // height above the limb
    vec3  dir = q > 0.0 ? normalize(vDir) : vec3(1.0, 0.0, 0.0);
    float t = uTime;

    // Streamers. Broad bundles fixed to directions in space, evolving
    // slowly, with finer rays flowing outward through them.
    float s1 = fbm(dir * 2.4 + vec3(0.0, t * 0.012, 0.0));
    float s2 = flow(dir, x, t);
    // Squared, so gaps between streamers fall to dark rather than to a
    // uniform wash: the rays read as rays.
    float streak = clamp(0.5 + 0.8 * s1 + 0.35 * s2, 0.0, 1.6);
    streak *= streak;

    // Three falloffs: a thin white-hot rim hugging the limb, the inner
    // corona, and the streamers reaching furthest. Kept steep on purpose —
    // a slow tail across a screen-filling quad reads as brown fog over
    // everything rather than as light.
    float rim   = exp(-x * 18.0);
    float inner = exp(-x * 5.0);
    float haze  = exp(-x * 2.2);

    float glow = rim * 0.8 + inner * (0.3 + 0.3 * streak) + haze * 0.09 * streak;

    // Fade the last stretch to nothing so the quad has no edge to notice.
    glow *= 1.0 - smoothstep(0.6, 1.0, q);

    vec3 hot  = vec3(1.0, 0.97, 0.88);
    vec3 gold = vec3(1.0, 0.85, 0.55);
    vec3 ember= vec3(1.0, 0.62, 0.30);
    vec3 col  = mix(ember, gold, inner);
    col = mix(col, hot, rim);

    vec3 rgb = col * glow * uIntensity;
    // Alpha matters only where the canvas is transparent (phones, which have
    // no Milky Way backdrop, and everyone before it loads). There the page
    // composites rgb * alpha, so alpha tracks how bright the glow is; over
    // anything opaque the summed alpha is already 1.
    gl_FragColor = vec4(rgb, clamp(max(rgb.r, max(rgb.g, rgb.b)) * 1.6, 0.0, 1.0));
    #include <tonemapping_fragment>
    #include <colorspace_fragment>
}
`;

/**
 * The corona: one camera-facing quad centred on the Sun, drawn additively.
 * Its centre sits at the Sun's own centre, so the depth test hides it behind
 * the disc and the glow appears to rise off the limb — and hides it behind
 * any planet in front, too.
 *
 * `radius` is the Sun's own radius in the mesh's local units.
 */
export function createCoronaMaterial({ radius, intensity = 1, octaves = 3 }) {
    return new THREE.ShaderMaterial({
        uniforms: {
            uTime:      { value: 0 },
            uIntensity: { value: intensity },
            uExtent:    { value: CORONA_EXTENT },
            uRadius:    { value: radius },
        },
        defines: { OCTAVES: octaves },
        vertexShader: CORONA_VERTEX,
        fragmentShader: CORONA_FRAGMENT,
        transparent: true,
        depthWrite: false,
        depthTest: true,
        // Additive in colour, straight sum in alpha. Three's stock
        // AdditiveBlending scales colour by the fragment's alpha, which here
        // would square the falloff; the colour is already what should land.
        blending: THREE.CustomBlending,
        blendEquation: THREE.AddEquation,
        blendSrc: THREE.OneFactor,
        blendDst: THREE.OneFactor,
        blendSrcAlpha: THREE.OneFactor,
        blendDstAlpha: THREE.OneFactor,
    });
}

/**
 * The corona's mesh. A 2x2 quad — the vertex shader does all the sizing —
 * with culling off, since its bounding sphere is the unexpanded quad's and
 * would cull the corona whenever the Sun's centre left the frame.
 */
export function createCoronaMesh(material) {
    const mesh = new THREE.Mesh(new THREE.PlaneGeometry(2, 2), material);
    mesh.frustumCulled = false;
    // After the opaque bodies, so the depth test has them to test against.
    mesh.renderOrder = 1;
    return mesh;
}

// ── The wide glare ──────────────────────────────────────────────────────────

const GLARE_VERTEX = /* glsl */ `
uniform float uSizePx;
uniform vec2  uViewport;
varying vec2 vQuad;
void main() {
    vQuad = position.xy;
    // A fixed size in pixels, however far off the Sun is: placed at the
    // anchor's projected point and spread out in clip space, the same
    // convention three's Lensflare elements use (size = diameter in
    // drawing-buffer pixels). Scaling the offset by w keeps it that size
    // through the perspective divide, and the whole quad keeps the anchor's
    // depth, so a body nearer than the Sun cuts the glare where it overlaps.
    vec4 clip = projectionMatrix * modelViewMatrix * vec4(0.0, 0.0, 0.0, 1.0);
    vec2 halfNdc = vec2(uSizePx / uViewport.x, uSizePx / uViewport.y);
    clip.xy += position.xy * halfNdc * clip.w;
    // Behind the camera: collapse, rather than draw a mirror image.
    gl_Position = clip.w > 0.0 ? clip : vec4(2.0, 2.0, 2.0, 1.0);
}
`;

const GLARE_FRAGMENT = /* glsl */ `
uniform float uGain;
varying vec2 vQuad;
void main() {
    float r = length(vQuad);
    // A steep hot core over a long faint tail, so it reads as light
    // spilling out of a point rather than as a disc of colour.
    float glow = 0.55 * exp(-r * 28.0) + 0.22 * exp(-r * 9.0) + 0.06 * exp(-r * 3.5);
    glow *= 1.0 - smoothstep(0.7, 1.0, r);
    vec3 warm = vec3(1.0, 0.66, 0.37);
    vec3 hot  = vec3(1.0, 0.98, 0.92);
    vec3 rgb  = mix(warm, hot, exp(-r * 12.0)) * glow * uGain;
    // Its own alpha, for a transparent canvas, where the page composites
    // rgb * alpha. A wide, faint glow is almost all tail, and an alpha that
    // merely tracked brightness would square that tail away to nothing on a
    // phone; saturating it early shows everything above ~8% brightness at
    // its true level and lets only the last faint edge roll off.
    gl_FragColor = vec4(rgb, clamp(max(rgb.r, max(rgb.g, rgb.b)) * 12.0, 0.0, 1.0));
}
`;

/**
 * The wide glare round the Sun for the views where it is not what you are
 * looking at — the home view, another body focused — where the disc is a
 * few pixels across and nothing else says "the brightest thing in the
 * system is here". Brightness (setSunGlare's `gain`) is driven from the
 * render loop: off while the Sun itself is focused, where the disc and
 * corona carry the view.
 *
 * A screen-space quad of its own rather than one more Lensflare element:
 * Lensflare draws with three's stock additive blend, which scales alpha by
 * alpha, so on a transparent canvas (phones, with no Milky Way backdrop) the
 * page composited a wide soft glare away to almost nothing. This carries
 * its own alpha the way the corona does, and gets per-pixel occlusion from
 * the depth test besides.
 *
 * Add it to an object positioned just off the Sun's surface on the camera's
 * side — the lens flare's anchor — so the Sun's own disc does not occlude it.
 */
export function createSunGlare() {
    const material = new THREE.ShaderMaterial({
        uniforms: {
            uSizePx:   { value: 0 },
            uViewport: { value: new THREE.Vector2(1, 1) },
            uGain:     { value: 0 },
        },
        vertexShader: GLARE_VERTEX,
        fragmentShader: GLARE_FRAGMENT,
        transparent: true,
        depthWrite: false,
        depthTest: true,
        blending: THREE.CustomBlending,
        blendEquation: THREE.AddEquation,
        blendSrc: THREE.OneFactor,
        blendDst: THREE.OneFactor,
        blendSrcAlpha: THREE.OneFactor,
        blendDstAlpha: THREE.OneFactor,
    });
    const mesh = new THREE.Mesh(new THREE.PlaneGeometry(2, 2), material);
    mesh.frustumCulled = false;
    // Over the corona and the bodies, like the flare it sits with.
    mesh.renderOrder = 2;
    return mesh;
}

/**
 * Per-frame update for a glare from createSunGlare(): its diameter in
 * drawing-buffer pixels, the drawing buffer's size, and its brightness. At
 * gain 0 it is hidden outright rather than drawn black.
 */
export function setSunGlare(glare, { sizePx, viewportW, viewportH, gain }) {
    const u = glare.material.uniforms;
    u.uSizePx.value = sizePx;
    u.uViewport.value.set(viewportW, viewportH);
    u.uGain.value = gain;
    glare.visible = gain > 0.001;
}
