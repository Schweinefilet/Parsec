// The field-line overlay — every traced streamline in one merged LineSegments,
// each tinted with the colour of the body it flows into and carrying a small
// arrowhead partway along to show which way the flow runs.
//
// Plain gl.LINES: one pixel on every platform, but a merged buffer with a
// single draw call is close to free to refill, which matters because these
// rebuild on every retrace (~400 lines) — unlike the orbit rings, which are
// TubeGeometry because they are built once and want a locked width. A fat-line
// pass (LineSegments2) was tried and dropped: the hairline is the look we
// want back.
//
// Colour is baked per vertex: the body tint times a fade that runs from dim at
// the seed end to full where the line plunges into the body, so the picture
// reads as flow *into* the masses. The arrowhead sits at ARROW_AT along each
// line, drawn at full tint so it stands out of the faded shaft.

import * as THREE from 'three';
import { traceField } from './gravityField';
import { WEIGHT_CONFIG } from './gravityModel';

const VERT = /* glsl */`
    attribute vec3 aColor;
    varying vec3 vColor;
    void main() {
        vColor = aColor;
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
    }
`;

const FRAG = /* glsl */`
    precision highp float;
    uniform float uOpacity;
    varying vec3 vColor;
    void main() {
        gl_FragColor = vec4(vColor, uOpacity);
    }
`;

const SEED_FADE   = 0.12;   // vertex brightness at the seed end; 1.0 where it meets the body
const BASE_TINT   = new THREE.Color(0.62, 0.80, 1.0);   // the old single colour — fallback when a body has none
const TINT_MIX    = 0.72;   // how far the base moves toward the body's own colour
const ARROW_AT    = 0.55;   // fraction along each line where the arrowhead sits
const ARROW_BARBS = 4;      // segments per arrowhead — a 4-sided splay reads from any angle
const ARROW_FADE  = 1.0;    // arrowheads at full tint, brighter than the shaft around them

const _tint = new THREE.Color();
const _pA = new THREE.Vector3();
const _pB = new THREE.Vector3();
const _tan = new THREE.Vector3();
const _p1 = new THREE.Vector3();
const _p2 = new THREE.Vector3();
const _radial = new THREE.Vector3();

/**
 * @param {number} [opts.initialCapacity] vertices to preallocate
 */
export function makeGravityLines({ initialCapacity = 64000 } = {}) {
    let capacity = initialCapacity;                  // vertices
    let positions = new Float32Array(capacity * 3);
    let colors = new Float32Array(capacity * 3);     // tint * fade, baked per vertex

    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(positions, 3).setUsage(THREE.DynamicDrawUsage));
    geo.setAttribute('aColor', new THREE.BufferAttribute(colors, 3).setUsage(THREE.DynamicDrawUsage));
    geo.setDrawRange(0, 0);

    const mat = new THREE.ShaderMaterial({
        uniforms: { uOpacity: { value: 0 } },
        vertexShader: VERT,
        fragmentShader: FRAG,
        transparent: true,
        depthWrite: false,
        blending: THREE.AdditiveBlending,
    });

    const object = new THREE.LineSegments(geo, mat);
    object.renderOrder = 3;
    object.frustumCulled = false;   // the lines span the scene; skip the per-frame cull test

    const grow = (neededVerts) => {
        capacity = Math.ceil(neededVerts * 1.5);
        positions = new Float32Array(capacity * 3);
        colors = new Float32Array(capacity * 3);
        geo.setAttribute('position', new THREE.BufferAttribute(positions, 3).setUsage(THREE.DynamicDrawUsage));
        geo.setAttribute('aColor', new THREE.BufferAttribute(colors, 3).setUsage(THREE.DynamicDrawUsage));
    };

    return {
        object,

        /**
         * Re-trace and rebuild. `bodies` is the shared per-frame array
         * (`{ pos, color, weights, expansion?, wellScale? }`), `cfg` the tracer
         * config (see GRAVITY_FIELD_DEFAULTS) with `bounds` already scaled for
         * the layout. Returns `{ lines, segments, steps }` for the perf log.
         */
        retrace(bodies, cfg) {
            const src = bodies.map(b => {
                const e = b.expansion ?? 1;   // 1 compressed; > 1 for outer planets at true scale
                const s = b.wellScale ?? 1;   // Sun-only, grows the seed sphere with the layout
                return {
                    pos: b.pos,
                    fieldMass: b.weights.fieldMass * Math.pow(e, WEIGHT_CONFIG.fieldExpandMass),
                    minRadius: b.weights.minRadius * Math.pow(e, WEIGHT_CONFIG.fieldExpandRadius) * s,
                    lineCount: b.weights.lineCount,
                };
            });
            const tints = bodies.map(b => (b.color
                ? BASE_TINT.clone().lerp(_tint.set(b.color), TINT_MIX)
                : BASE_TINT.clone()));

            const { lines, lineBodies, segmentCount, stepCount } = traceField(src, cfg);

            const maxVerts = (segmentCount + lines.length * ARROW_BARBS) * 2;
            if (maxVerts > capacity) grow(maxVerts);

            let v = 0;   // vertex write cursor
            const put = (ax, ay, az, bx, by, bz, r1, g1, b1, r2, g2, b2) => {
                let o = v * 3;
                positions[o] = ax; positions[o + 1] = ay; positions[o + 2] = az;
                colors[o] = r1; colors[o + 1] = g1; colors[o + 2] = b1;
                v++;
                o = v * 3;
                positions[o] = bx; positions[o + 1] = by; positions[o + 2] = bz;
                colors[o] = r2; colors[o + 1] = g2; colors[o + 2] = b2;
                v++;
            };

            for (let li = 0; li < lines.length; li++) {
                const pts = lines[li];
                const count = pts.length / 3;
                const tint = tints[lineBodies[li]] ?? BASE_TINT;
                const tr = tint.r, tg = tint.g, tb = tint.b;

                for (let i = 0; i < count - 1; i++) {
                    const a = i * 3, b = a + 3;
                    const fa = SEED_FADE + (1 - SEED_FADE) * (i / (count - 1));
                    const fb = SEED_FADE + (1 - SEED_FADE) * ((i + 1) / (count - 1));
                    put(
                        pts[a], pts[a + 1], pts[a + 2],
                        pts[b], pts[b + 1], pts[b + 2],
                        tr * fa, tg * fa, tb * fa,
                        tr * fb, tg * fb, tb * fb,
                    );
                }

                // One arrowhead, pointing the way the line flows (toward the body).
                if (count >= 3) {
                    const m = Math.min(count - 2, Math.max(1, Math.round((count - 1) * ARROW_AT)));
                    _pA.set(pts[m * 3], pts[m * 3 + 1], pts[m * 3 + 2]);
                    _pB.set(pts[(m + 1) * 3], pts[(m + 1) * 3 + 1], pts[(m + 1) * 3 + 2]);
                    _tan.subVectors(_pB, _pA);
                    const stepLen = _tan.length();
                    if (stepLen > 1e-4) {
                        _tan.multiplyScalar(1 / stepLen);
                        const headLen = Math.min(22, Math.max(1.2, stepLen * 1.35));
                        const headW = headLen * 0.42;   // pointier than it is wide, so the barbs read as one arrow
                        // Lay the barb plane through the line's own bend — the
                        // tangent and the direction back to the body — so the
                        // arrowhead mostly faces the viewer rather than turning
                        // edge-on. Falls back to any perpendicular when the line
                        // runs dead straight at the body.
                        _radial.subVectors(_pA, src[lineBodies[li]].pos);
                        _radial.addScaledVector(_tan, -_radial.dot(_tan));
                        if (_radial.lengthSq() < 1e-6) {
                            _radial.set(Math.abs(_tan.y) > 0.9 ? 1 : 0, Math.abs(_tan.y) > 0.9 ? 0 : 1, 0);
                        }
                        _p1.copy(_radial).normalize();
                        _p2.crossVectors(_tan, _p1).normalize();
                        const apx = _pA.x + _tan.x * headLen;
                        const apy = _pA.y + _tan.y * headLen;
                        const apz = _pA.z + _tan.z * headLen;
                        const cr = tr * ARROW_FADE, cg = tg * ARROW_FADE, cb = tb * ARROW_FADE;
                        for (const perp of [_p1, _p2]) {
                            for (const sgn of [1, -1]) {
                                put(
                                    apx, apy, apz,
                                    _pA.x + perp.x * headW * sgn,
                                    _pA.y + perp.y * headW * sgn,
                                    _pA.z + perp.z * headW * sgn,
                                    cr, cg, cb, cr, cg, cb,
                                );
                            }
                        }
                    }
                }
            }

            geo.attributes.position.needsUpdate = true;
            geo.attributes.aColor.needsUpdate = true;
            geo.setDrawRange(0, v);
            // No computeBoundingSphere: frustumCulled is off and it would run
            // over the whole buffer, stale tail included.

            return { lines: lines.length, segments: v / 2, steps: stepCount };
        },

        setOpacity(o) {
            mat.uniforms.uOpacity.value = o;
        },

        dispose() {
            geo.dispose();
            mat.dispose();
        },
    };
}
