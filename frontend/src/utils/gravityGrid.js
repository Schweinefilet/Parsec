// The warped-grid overlay — the "embedding diagram" look: a sheet in the
// ecliptic plane dimpled downward under each body.
//
//   y(x,z) = -sum over bodies of  m_i * exp( -((x-x_i)^2 + (z-z_i)^2) / r_i^2 )
//
// where m_i and r_i are the visual well depth and radius from gravityModel,
// not real mass or radius. The sum runs in the vertex shader over an array
// uniform (capped at MAX_GRAVITY_BODIES); the mesh topology is built once and
// only the uniforms change, so the sheet deforms for free as the bodies move.
//
// The grid lines themselves are drawn in the fragment shader from the
// undisplaced plane coordinates, so they bend into the wells in 3-D the way
// the rubber-sheet picture does, with no extra geometry.

import * as THREE from 'three';
import { MAX_GRAVITY_BODIES, WEIGHT_CONFIG } from './gravityModel';

const VERT = /* glsl */`
    uniform vec3  uBodies[${MAX_GRAVITY_BODIES}];   // xz = plane position, y = well depth
    uniform float uRadii[${MAX_GRAVITY_BODIES}];    // Gaussian sigma
    uniform int   uCount;
    uniform float uHalfExtent;

    varying vec2  vPlane;      // undisplaced plane coords, scene units
    varying float vDepth;      // how far this vertex sank

    void main() {
        vec2 p = position.xz * (2.0 * uHalfExtent);
        float h = 0.0;
        for (int i = 0; i < ${MAX_GRAVITY_BODIES}; i++) {
            if (i >= uCount) break;
            vec2  d = p - uBodies[i].xz;
            float r = uRadii[i];
            h += uBodies[i].y * exp(-dot(d, d) / (r * r));
        }
        vPlane = p;
        vDepth = h;
        gl_Position = projectionMatrix * modelViewMatrix * vec4(p.x, -h, p.y, 1.0);
    }
`;

const FRAG = /* glsl */`
    precision highp float;
    uniform vec3  uColor;
    uniform float uOpacity;
    uniform float uHalfExtent;
    uniform float uCells;

    varying vec2  vPlane;
    varying float vDepth;

    void main() {
        // Anti-aliased grid lines from the plan-view coordinate.
        vec2 c  = vPlane / (2.0 * uHalfExtent) + 0.5;
        vec2 g  = abs(fract(c * uCells) - 0.5);
        vec2 fw = fwidth(c * uCells);
        vec2 ln = smoothstep(fw * 1.5, vec2(0.0), g);
        float line = max(ln.x, ln.y);
        if (line < 0.001) discard;

        // Fade out toward the edge so the sheet has no hard border, and let
        // the deep parts of a well glow a little.
        float edge  = 1.0 - smoothstep(0.72, 1.0, length(vPlane) / uHalfExtent);
        float glow  = 1.0 + clamp(vDepth * 0.06, 0.0, 1.6);

        gl_FragColor = vec4(uColor * glow, line * edge * uOpacity);
    }
`;

/**
 * @param {object}  opts
 * @param {number}  opts.segments        grid subdivisions per side (>> 25)
 * @param {number}  opts.halfExtent      compressed-layout half-width, scene units
 * @param {number}  opts.halfExtentTrue  half-width to ease toward at true distances
 * @param {number}  opts.cells           grid cells across the full width
 * @param {THREE.Quaternion} opts.orientation  rotates the sheet onto the ecliptic
 * @param {number[]} [opts.color]        rgb 0..1
 */
export function makeGravityGrid({
    segments, halfExtent, halfExtentTrue, cells, orientation, color = [0.42, 0.72, 1.0],
}) {
    const geo = new THREE.PlaneGeometry(1, 1, segments, segments).rotateX(-Math.PI / 2);

    const uniforms = {
        uBodies: { value: Array.from({ length: MAX_GRAVITY_BODIES }, () => new THREE.Vector3()) },
        uRadii: { value: new Float32Array(MAX_GRAVITY_BODIES).fill(1) },
        uCount: { value: 0 },
        uHalfExtent: { value: halfExtent },
        uCells: { value: cells },
        uColor: { value: new THREE.Color(color[0], color[1], color[2]) },
        uOpacity: { value: 0 },
    };

    const mat = new THREE.ShaderMaterial({
        uniforms,
        vertexShader: VERT,
        fragmentShader: FRAG,
        transparent: true,
        depthWrite: false,
        blending: THREE.AdditiveBlending,
        side: THREE.DoubleSide,
        // fwidth() — free on WebGL2, needs the extension asked for on WebGL1.
        extensions: { derivatives: true },
    });

    const mesh = new THREE.Mesh(geo, mat);
    mesh.quaternion.copy(orientation);
    mesh.renderOrder = 3;                 // after the bodies, before the labels
    mesh.frustumCulled = false;           // the wells push verts well past the base plane
    mesh.updateMatrixWorld(true);

    const invWorld = new THREE.Matrix4().copy(mesh.matrixWorld).invert();
    const _local = new THREE.Vector3();

    return {
        mesh,

        /**
         * Push the current body positions and the layout width into the
         * shader. `bodies` is the shared per-frame array: `{ pos, weights,
         * expansion }` — `expansion` is the body's radial spread in the
         * current layout (1 compressed), which widens the outer wells so they
         * survive the zoom-out to true distances. `scaleT` is scaleProgress().
         */
        update(bodies, scaleT) {
            uniforms.uHalfExtent.value = halfExtent + (halfExtentTrue - halfExtent) * scaleT;
            const n = Math.min(bodies.length, MAX_GRAVITY_BODIES);
            for (let i = 0; i < n; i++) {
                _local.copy(bodies[i].pos).applyMatrix4(invWorld);   // world → sheet-local
                const e = bodies[i].expansion ?? 1;
                const s = bodies[i].wellScale ?? 1;   // uniform size mult (Sun grows with the layout)
                const depth = bodies[i].weights.gridDepth * Math.pow(e, WEIGHT_CONFIG.gridExpandDepth) * s;
                uniforms.uBodies.value[i].set(_local.x, depth, _local.z);
                uniforms.uRadii.value[i] = bodies[i].weights.gridRadius
                    * Math.pow(e, WEIGHT_CONFIG.gridExpandRadius) * s;
            }
            uniforms.uCount.value = n;
        },

        setOpacity(o) {
            uniforms.uOpacity.value = o;
        },

        dispose() {
            geo.dispose();
            mat.dispose();
        },
    };
}
