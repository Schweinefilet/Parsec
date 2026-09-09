// The field-line overlay — every traced streamline in one fat-line batch,
// each tinted with the colour of the body it flows into and carrying a small
// arrowhead partway along to show which way the flow runs.
//
// Fat lines (three's LineSegments2 / LineMaterial), not plain gl.LINES: the
// GL line is one pixel on every platform, and at the seed densities here a
// hairline reads as a grey haze rather than a field. LineSegments2 draws each
// segment as an instanced quad, so width is real and vertex colour is free —
// the cost is a `resolution` uniform the scene has to keep in step with the
// canvas (see setResolution). Not TubeGeometry, which the orbit rings use:
// those are built once, these rebuild on every retrace (~400 lines) and a
// merged instanced buffer with one draw call is far cheaper to refill.
//
// Colour is baked per vertex: the body tint times a fade that runs from dim
// at the seed end to full where the line plunges into the body, so the
// picture reads as flow *into* the masses. The arrowhead sits at ARROW_AT
// along each line, drawn at full tint so it stands out of the faded shaft.

import * as THREE from 'three';
import { LineSegments2 } from 'three/examples/jsm/lines/LineSegments2.js';
import { LineSegmentsGeometry } from 'three/examples/jsm/lines/LineSegmentsGeometry.js';
import { LineMaterial } from 'three/examples/jsm/lines/LineMaterial.js';
import { traceField } from './gravityField';
import { WEIGHT_CONFIG } from './gravityModel';

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
 * @param {number} [opts.linewidth]       line width in CSS pixels
 * @param {number} [opts.initialCapacity] segments to preallocate
 */
export function makeGravityLines({ linewidth = 2.6, initialCapacity = 32000 } = {}) {
    let capacity = initialCapacity;                       // segments
    let positions = new Float32Array(capacity * 6);       // xyz, xyz per segment
    let colors = new Float32Array(capacity * 6);          // rgb, rgb per segment

    const geo = new LineSegmentsGeometry();
    geo.setPositions(positions);
    geo.setColors(colors);
    geo.instanceCount = 0;

    const mat = new LineMaterial({
        linewidth,
        worldUnits: false,
        vertexColors: true,
        transparent: true,
        depthWrite: false,
        blending: THREE.AdditiveBlending,
        alphaToCoverage: false,
    });
    mat.opacity = 0;
    // A sane default so the width maths isn't dividing by 1px before the scene
    // wires setResolution to the canvas.
    if (typeof window !== 'undefined') {
        mat.resolution.set(window.innerWidth || 1, window.innerHeight || 1);
    }

    const object = new LineSegments2(geo, mat);
    object.renderOrder = 3;
    object.frustumCulled = false;   // the lines span the scene; skip the per-frame cull test

    const grow = (neededSegs) => {
        capacity = Math.ceil(neededSegs * 1.5);
        positions = new Float32Array(capacity * 6);
        colors = new Float32Array(capacity * 6);
        geo.setPositions(positions);
        geo.setColors(colors);
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

            const maxSegs = segmentCount + lines.length * ARROW_BARBS;
            if (maxSegs > capacity) grow(maxSegs);

            let seg = 0;
            const put = (ax, ay, az, bx, by, bz, r1, g1, b1, r2, g2, b2) => {
                const o = seg * 6;
                positions[o] = ax; positions[o + 1] = ay; positions[o + 2] = az;
                positions[o + 3] = bx; positions[o + 4] = by; positions[o + 5] = bz;
                colors[o] = r1; colors[o + 1] = g1; colors[o + 2] = b1;
                colors[o + 3] = r2; colors[o + 4] = g2; colors[o + 5] = b2;
                seg++;
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

            geo.attributes.instanceStart.data.needsUpdate = true;
            geo.attributes.instanceColorStart.data.needsUpdate = true;
            geo.instanceCount = seg;

            return { lines: lines.length, segments: seg, steps: stepCount };
        },

        setOpacity(o) {
            mat.opacity = o;
        },

        /** Keep the fat-line shader's pixel maths in step with the canvas (CSS px). */
        setResolution(w, h) {
            mat.resolution.set(w, h);
        },

        dispose() {
            geo.dispose();
            mat.dispose();
        },
    };
}
