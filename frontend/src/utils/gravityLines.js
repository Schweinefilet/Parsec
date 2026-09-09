// The field-line overlay — one merged LineSegments of every traced streamline.
//
// LineSegments, not TubeGeometry: the orbit rings are tubes because they are
// built once and want a locked width, but these rebuild on every retrace
// (which happens whenever the planets have moved enough — see the gate in
// SolarSystem3D), and rebuilding ~130 tubes each time is real cost where one
// merged line buffer and a single draw call is close to free. The tradeoff is
// width: gl.LINES is one pixel on every platform. Additive blending plus the
// seed density reads as a field diagram anyway; if it ever looks too thin the
// swap is to three/examples/jsm/lines/Line2 (bundled with three, same as
// OrbitControls), noted here rather than done pre-emptively.
//
// A per-vertex fade attribute dims each line from its seed to its tail, so
// lines dissolve where they run out rather than stopping dead.

import * as THREE from 'three';
import { traceField } from './gravityField';
import { WEIGHT_CONFIG } from './gravityModel';

const VERT = /* glsl */`
    attribute float aFade;
    varying float vFade;
    void main() {
        vFade = aFade;
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
    }
`;

const FRAG = /* glsl */`
    precision highp float;
    uniform vec3  uColor;
    uniform float uOpacity;
    varying float vFade;
    void main() {
        gl_FragColor = vec4(uColor, vFade * uOpacity);
    }
`;

const TAIL_FADE = 0.12;   // alpha a line has decayed to by its last point

/**
 * @param {number[]} [opts.color]  rgb 0..1
 * @param {number}   [opts.initialCapacity]  vertices to preallocate
 */
export function makeGravityLines({ color = [0.62, 0.80, 1.0], initialCapacity = 24000 } = {}) {
    let capacity = initialCapacity;
    let positions = new Float32Array(capacity * 3);
    let fades = new Float32Array(capacity);

    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(positions, 3).setUsage(THREE.DynamicDrawUsage));
    geo.setAttribute('aFade', new THREE.BufferAttribute(fades, 1).setUsage(THREE.DynamicDrawUsage));
    geo.setDrawRange(0, 0);

    const mat = new THREE.ShaderMaterial({
        uniforms: {
            uColor: { value: new THREE.Color(color[0], color[1], color[2]) },
            uOpacity: { value: 0 },
        },
        vertexShader: VERT,
        fragmentShader: FRAG,
        transparent: true,
        depthWrite: false,
        blending: THREE.AdditiveBlending,
    });

    const object = new THREE.LineSegments(geo, mat);
    object.renderOrder = 3;
    object.frustumCulled = false;

    const grow = (needed) => {
        capacity = Math.ceil(needed * 1.5);
        positions = new Float32Array(capacity * 3);
        fades = new Float32Array(capacity);
        geo.setAttribute('position', new THREE.BufferAttribute(positions, 3).setUsage(THREE.DynamicDrawUsage));
        geo.setAttribute('aFade', new THREE.BufferAttribute(fades, 1).setUsage(THREE.DynamicDrawUsage));
    };

    return {
        object,

        /**
         * Re-trace and rebuild. `bodies` is the shared per-frame array
         * (`{ pos, weights }`), `cfg` the tracer config (see
         * GRAVITY_FIELD_DEFAULTS) with `bounds` already scaled for the layout.
         * Returns `{ lines, segments, steps }` for the perf log.
         */
        retrace(bodies, cfg) {
            const src = bodies.map(b => {
                const e = b.expansion ?? 1;   // 1 compressed; > 1 for outer planets at true scale
                return {
                    pos: b.pos,
                    fieldMass: b.weights.fieldMass * Math.pow(e, WEIGHT_CONFIG.fieldExpandMass),
                    minRadius: b.weights.minRadius * Math.pow(e, WEIGHT_CONFIG.fieldExpandRadius),
                    lineCount: b.weights.lineCount,
                };
            });
            const { lines, segmentCount, stepCount } = traceField(src, cfg);

            const vertsNeeded = segmentCount * 2;
            if (vertsNeeded > capacity) grow(vertsNeeded);

            let v = 0;
            for (const pts of lines) {
                const count = pts.length / 3;
                for (let i = 0; i < count - 1; i++) {
                    const a = i * 3, b = a + 3;
                    const fa = 1 - (1 - TAIL_FADE) * (i / (count - 1));
                    const fb = 1 - (1 - TAIL_FADE) * ((i + 1) / (count - 1));
                    positions[v * 3] = pts[a]; positions[v * 3 + 1] = pts[a + 1]; positions[v * 3 + 2] = pts[a + 2];
                    fades[v] = fa; v++;
                    positions[v * 3] = pts[b]; positions[v * 3 + 1] = pts[b + 1]; positions[v * 3 + 2] = pts[b + 2];
                    fades[v] = fb; v++;
                }
            }

            geo.attributes.position.needsUpdate = true;
            geo.attributes.aFade.needsUpdate = true;
            geo.setDrawRange(0, v);
            // No computeBoundingSphere: frustumCulled is off (the lines span
            // the scene) and it would run over the whole buffer, stale tail
            // included.

            return { lines: lines.length, segments: segmentCount, steps: stepCount };
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
