import * as THREE from 'three';

// Procedurally built spacecraft. The viewer originally pointed at .glb files
// that were never shipped, so every craft fell back to one generic grey box.
// These are assembled from primitives to each vehicle's recognisable silhouette
// — Hubble's tube, Webb's hexagonal mirror and kite sunshield, the Voyager dish
// and boom — which reads far better than a shared placeholder and costs no
// download at all.

const MAT = {
    foil:   () => new THREE.MeshStandardMaterial({ color: '#d9c17a', roughness: 0.35, metalness: 0.85 }),
    white:  () => new THREE.MeshStandardMaterial({ color: '#dfe3e8', roughness: 0.55, metalness: 0.20 }),
    silver: () => new THREE.MeshStandardMaterial({ color: '#b3bac2', roughness: 0.30, metalness: 0.88 }),
    dark:   () => new THREE.MeshStandardMaterial({ color: '#26292e', roughness: 0.60, metalness: 0.50 }),
    panel:  () => new THREE.MeshStandardMaterial({ color: '#1d2a5e', roughness: 0.35, metalness: 0.55,
                                                   emissive: '#0b1330', emissiveIntensity: 0.35 }),
    gold:   () => new THREE.MeshStandardMaterial({ color: '#e8b53a', roughness: 0.25, metalness: 0.95,
                                                   emissive: '#3a2a05', emissiveIntensity: 0.30 }),
    copper: () => new THREE.MeshStandardMaterial({ color: '#b87333', roughness: 0.40, metalness: 0.80 }),
};

// Track everything we create so the viewer can dispose it on unmount
function builder(group, registry) {
    return (geometry, material, { pos = [0, 0, 0], rot = [0, 0, 0], scale } = {}) => {
        const mesh = new THREE.Mesh(geometry, material);
        mesh.position.set(...pos);
        mesh.rotation.set(...rot);
        if (scale) mesh.scale.set(...(Array.isArray(scale) ? scale : [scale, scale, scale]));
        group.add(mesh);
        registry.geometries.push(geometry);
        registry.materials.push(material);
        return mesh;
    };
}

// Solar array: a framed panel with cell striping
function solarArray(add, { pos, rot = [0, 0, 0], w = 2.6, h = 1.1 }) {
    add(new THREE.BoxGeometry(w, 0.03, h), MAT.panel(), { pos, rot });
    add(new THREE.BoxGeometry(w + 0.06, 0.05, 0.05), MAT.silver(), { pos: [pos[0], pos[1], pos[2] - h / 2], rot });
    add(new THREE.BoxGeometry(w + 0.06, 0.05, 0.05), MAT.silver(), { pos: [pos[0], pos[1], pos[2] + h / 2], rot });
    // Cell division lines
    const n = Math.max(2, Math.round(w / 0.55));
    for (let i = 1; i < n; i++) {
        const x = pos[0] - w / 2 + (w * i) / n;
        add(new THREE.BoxGeometry(0.015, 0.04, h), MAT.dark(), { pos: [x, pos[1], pos[2]], rot });
    }
}

function dish(add, { pos, rot = [0, 0, 0], radius = 1.2, depth = 0.34 }) {
    // Parabola-ish: a wide, shallow open cone
    add(new THREE.ConeGeometry(radius, depth, 40, 1, true), MAT.white(),
        { pos, rot: [rot[0] + Math.PI, rot[1], rot[2]] });
    add(new THREE.CylinderGeometry(radius * 0.045, radius * 0.045, depth * 2.2, 8), MAT.silver(),
        { pos: [pos[0], pos[1] + depth * 0.9, pos[2]], rot });
    add(new THREE.SphereGeometry(radius * 0.10, 12, 12), MAT.dark(),
        { pos: [pos[0], pos[1] + depth * 1.9, pos[2]] });
}

const BUILDERS = {
    // ── Hubble: silver tube, aperture door, two long arrays, dishes ─────────
    hubble(add) {
        add(new THREE.CylinderGeometry(0.72, 0.72, 3.4, 32), MAT.silver(), { rot: [0, 0, Math.PI / 2] });
        add(new THREE.CylinderGeometry(0.74, 0.74, 0.18, 32), MAT.dark(), { pos: [1.72, 0, 0], rot: [0, 0, Math.PI / 2] });
        // Open aperture door, hinged back
        add(new THREE.CylinderGeometry(0.72, 0.72, 0.06, 32, 1, false, 0, Math.PI), MAT.foil(),
            { pos: [1.9, 0.5, 0], rot: [0, 0, Math.PI / 2.6] });
        add(new THREE.CylinderGeometry(0.60, 0.72, 1.0, 32), MAT.foil(), { pos: [-1.9, 0, 0], rot: [0, 0, Math.PI / 2] });
        solarArray(add, { pos: [0, 0, 1.75], w: 2.4, h: 2.2, rot: [0, 0, 0] });
        solarArray(add, { pos: [0, 0, -1.75], w: 2.4, h: 2.2, rot: [0, 0, 0] });
        // High-gain antennas
        dish(add, { pos: [0.5, 0.95, 0], radius: 0.34, depth: 0.12 });
        dish(add, { pos: [-0.7, -0.95, 0], radius: 0.34, depth: 0.12, rot: [Math.PI, 0, 0] });
        add(new THREE.CylinderGeometry(0.05, 0.05, 0.7, 8), MAT.silver(), { pos: [0.5, 0.6, 0] });
        add(new THREE.CylinderGeometry(0.05, 0.05, 0.7, 8), MAT.silver(), { pos: [-0.7, -0.6, 0] });
    },

    // ── JWST: hex mirror array over a layered kite sunshield ────────────────
    jwst(add) {
        // 18 hexagonal segments in a honeycomb
        const R = 0.30;                       // circumradius of one segment
        const dx = R * 1.5;
        const dz = R * Math.sqrt(3);
        const coords = [];
        for (let q = -2; q <= 2; q++) {
            for (let r = -2; r <= 2; r++) {
                const s = -q - r;
                if (Math.abs(s) > 2) continue;
                if (q === 0 && r === 0) continue;         // centre segment omitted
                if (Math.abs(q) === 2 && Math.abs(r) === 2) continue;
                coords.push([q * dx, (r + q / 2) * dz]);
            }
        }
        for (const [x, z] of coords.slice(0, 18)) {
            add(new THREE.CylinderGeometry(R * 0.97, R * 0.97, 0.07, 6), MAT.gold(),
                { pos: [x, 0.95, z], rot: [0, Math.PI / 6, 0] });
        }
        // Secondary mirror on its tripod
        add(new THREE.CylinderGeometry(0.17, 0.17, 0.05, 20), MAT.gold(), { pos: [1.05, 1.5, 0], rot: [0, 0, Math.PI / 2.6] });
        for (const dz2 of [-0.5, 0.5, 0]) {
            add(new THREE.CylinderGeometry(0.025, 0.025, 1.6, 6), MAT.dark(),
                { pos: [0.55, 1.28, dz2 * 0.7], rot: [dz2 * 0.28, 0, -0.62] });
        }
        // Five-layer sunshield, each layer a flattened kite
        for (let i = 0; i < 5; i++) {
            const s = 1 - i * 0.055;
            const shade = new THREE.MeshStandardMaterial({
                color: i < 2 ? '#c9a86b' : '#9fb4c9',
                roughness: 0.30, metalness: 0.80,
                transparent: true, opacity: 0.92, side: THREE.DoubleSide,
            });
            add(new THREE.BoxGeometry(4.4 * s, 0.012, 3.0 * s), shade,
                { pos: [0, 0.42 - i * 0.14, 0], rot: [0, Math.PI / 4, 0] });
        }
        // Bus + solar wing
        add(new THREE.BoxGeometry(1.0, 0.36, 0.9), MAT.dark(), { pos: [0, -0.42, 0] });
        solarArray(add, { pos: [-1.5, -0.5, 0], w: 1.5, h: 0.8 });
    },

    // ── Voyager / Pioneer style: big dish, bus, RTG boom, magnetometer ──────
    voyager(add) {
        dish(add, { pos: [0, 1.0, 0], radius: 1.55, depth: 0.5 });
        // Ten-sided equipment bus
        add(new THREE.CylinderGeometry(0.62, 0.62, 0.42, 10), MAT.foil(), { pos: [0, 0.2, 0] });
        add(new THREE.CylinderGeometry(0.30, 0.30, 0.22, 10), MAT.dark(), { pos: [0, -0.1, 0] });
        // RTG boom
        add(new THREE.CylinderGeometry(0.05, 0.05, 2.2, 8), MAT.silver(), { pos: [-1.2, 0.05, 0], rot: [0, 0, Math.PI / 2] });
        for (let i = 0; i < 3; i++) {
            add(new THREE.CylinderGeometry(0.15, 0.15, 0.42, 12), MAT.dark(),
                { pos: [-1.5 - i * 0.46, 0.05, 0], rot: [0, 0, Math.PI / 2] });
        }
        // Science boom + instruments
        add(new THREE.CylinderGeometry(0.05, 0.05, 2.0, 8), MAT.silver(), { pos: [1.1, 0.05, 0], rot: [0, 0, Math.PI / 2] });
        add(new THREE.BoxGeometry(0.34, 0.30, 0.34), MAT.white(), { pos: [1.85, 0.05, 0] });
        add(new THREE.CylinderGeometry(0.07, 0.07, 0.5, 10), MAT.dark(), { pos: [1.85, 0.05, 0.34], rot: [Math.PI / 2, 0, 0] });
        // Magnetometer boom — the long thin spar
        add(new THREE.CylinderGeometry(0.018, 0.018, 4.2, 6), MAT.silver(), { pos: [0, 0.1, -2.1], rot: [Math.PI / 2, 0, 0] });
        // Golden record
        add(new THREE.CylinderGeometry(0.26, 0.26, 0.03, 24), MAT.gold(), { pos: [0.4, 0.2, 0.6], rot: [Math.PI / 2, 0, 0] });
    },

    'new-horizons': function (add) {
        dish(add, { pos: [0, 0.85, 0], radius: 1.25, depth: 0.4 });
        // Triangular bus
        add(new THREE.CylinderGeometry(0.78, 0.78, 0.55, 3), MAT.foil(), { pos: [0, 0.15, 0], rot: [0, Math.PI / 6, 0] });
        // RTG on one side
        add(new THREE.CylinderGeometry(0.20, 0.20, 1.5, 14), MAT.dark(), { pos: [-1.15, 0.05, 0], rot: [0, 0, Math.PI / 2.2] });
        for (let i = -2; i <= 2; i++) {
            add(new THREE.BoxGeometry(0.06, 0.34, 0.34), MAT.silver(), { pos: [-1.15 + i * 0.2, 0.05 + i * 0.09, 0], rot: [0, 0, Math.PI / 2.2] });
        }
        add(new THREE.BoxGeometry(0.3, 0.26, 0.4), MAT.white(), { pos: [0.75, 0.05, 0.3] });
        add(new THREE.CylinderGeometry(0.09, 0.09, 0.44, 10), MAT.dark(), { pos: [0.95, 0.05, 0.55], rot: [Math.PI / 2.4, 0, 0] });
    },

    // ── Chandra: long cylinder, sunshade door, single wing pair ─────────────
    chandra(add) {
        add(new THREE.CylinderGeometry(0.52, 0.52, 3.8, 24), MAT.foil(), { rot: [0, 0, Math.PI / 2] });
        add(new THREE.CylinderGeometry(0.58, 0.52, 0.6, 24), MAT.silver(), { pos: [2.0, 0, 0], rot: [0, 0, Math.PI / 2] });
        add(new THREE.CylinderGeometry(0.60, 0.60, 0.05, 24, 1, false, 0, Math.PI), MAT.dark(),
            { pos: [2.4, 0.45, 0], rot: [0, 0, Math.PI / 2.4] });
        add(new THREE.BoxGeometry(0.9, 0.7, 0.7), MAT.dark(), { pos: [-2.1, 0, 0] });
        solarArray(add, { pos: [-0.9, 0, 1.9], w: 1.8, h: 2.4 });
        solarArray(add, { pos: [-0.9, 0, -1.9], w: 1.8, h: 2.4 });
        dish(add, { pos: [0.4, -0.85, 0], radius: 0.3, depth: 0.1, rot: [Math.PI, 0, 0] });
    },

    // ── Tiangong: three modules in a T, two big wing pairs ──────────────────
    tiangong(add) {
        add(new THREE.CylinderGeometry(0.46, 0.46, 2.3, 24), MAT.white(), { rot: [0, 0, Math.PI / 2] });
        add(new THREE.SphereGeometry(0.47, 20, 20), MAT.white(), { pos: [1.15, 0, 0] });
        add(new THREE.CylinderGeometry(0.36, 0.36, 1.9, 20), MAT.white(), { pos: [0, 0, 1.5], rot: [Math.PI / 2, 0, 0] });
        add(new THREE.CylinderGeometry(0.36, 0.36, 1.9, 20), MAT.white(), { pos: [0, 0, -1.5], rot: [Math.PI / 2, 0, 0] });
        add(new THREE.CylinderGeometry(0.22, 0.22, 0.5, 16), MAT.dark(), { pos: [-1.35, 0, 0], rot: [0, 0, Math.PI / 2] });
        solarArray(add, { pos: [0, 0, 3.2], w: 1.0, h: 2.6 });
        solarArray(add, { pos: [0, 0, -3.2], w: 1.0, h: 2.6 });
        solarArray(add, { pos: [1.9, 0, 1.5], w: 1.4, h: 2.2 });
        solarArray(add, { pos: [-1.9, 0, -1.5], w: 1.4, h: 2.2 });
    },

    // ── Mir: core module with radial modules and angled arrays ──────────────
    mir(add) {
        add(new THREE.CylinderGeometry(0.52, 0.52, 2.4, 20), MAT.white(), { rot: [0, 0, Math.PI / 2] });
        add(new THREE.SphereGeometry(0.5, 18, 18), MAT.white(), { pos: [1.3, 0, 0] });
        const arms = [[0, 1.3, 0, 0, 0, 0], [0, -1.3, 0, 0, 0, 0], [0, 0, 1.3, Math.PI / 2, 0, 0], [0, 0, -1.3, Math.PI / 2, 0, 0]];
        for (const [x, y, z, rx, ry, rz] of arms) {
            add(new THREE.CylinderGeometry(0.34, 0.34, 1.7, 16), MAT.foil(), { pos: [x + 1.3, y, z], rot: [rx, ry, rz] });
        }
        solarArray(add, { pos: [0, 0, 2.0], w: 1.2, h: 2.0, rot: [0.35, 0, 0] });
        solarArray(add, { pos: [0, 0, -2.0], w: 1.2, h: 2.0, rot: [-0.35, 0, 0] });
        solarArray(add, { pos: [-1.7, 0, 0], w: 1.6, h: 1.8 });
    },

    // ── Sputnik 1: polished sphere with four swept antennas ─────────────────
    sputnik1(add) {
        add(new THREE.SphereGeometry(0.75, 40, 40),
            new THREE.MeshStandardMaterial({ color: '#e8ecef', roughness: 0.10, metalness: 0.98 }));
        for (let i = 0; i < 4; i++) {
            const a = (i / 4) * Math.PI * 2 + Math.PI / 4;
            const len = 3.0;
            add(new THREE.CylinderGeometry(0.022, 0.008, len, 6), MAT.silver(), {
                pos: [Math.cos(a) * (0.6 + len * 0.24), -len * 0.32, Math.sin(a) * (0.6 + len * 0.24)],
                rot: [Math.sin(a) * 0.75, 0, -Math.cos(a) * 0.75],
            });
        }
    },
};

BUILDERS.voyager1 = BUILDERS.voyager;
BUILDERS.voyager2 = BUILDERS.voyager;

/**
 * Build a spacecraft into a group, normalised to roughly 4 scene units across
 * and centred on the origin. Returns the group plus the geometries/materials
 * created, so the caller can dispose them.
 */
export function buildSpacecraft(id) {
    const group = new THREE.Group();
    const registry = { geometries: [], materials: [] };
    const add = builder(group, registry);

    const build = BUILDERS[id];
    if (build) {
        build(add);
    } else {
        // Generic satellite for anything not modelled yet
        add(new THREE.BoxGeometry(1.6, 0.8, 0.8), MAT.foil());
        solarArray(add, { pos: [0, 0, 1.5], w: 1.2, h: 2.0 });
        solarArray(add, { pos: [0, 0, -1.5], w: 1.2, h: 2.0 });
        dish(add, { pos: [0, 0.8, 0], radius: 0.45, depth: 0.16 });
    }

    // Normalise size and centre
    const box = new THREE.Box3().setFromObject(group);
    const size = box.getSize(new THREE.Vector3());
    const maxDim = Math.max(size.x, size.y, size.z);
    if (maxDim > 0) {
        const s = 4 / maxDim;
        group.scale.setScalar(s);
        const centre = box.getCenter(new THREE.Vector3()).multiplyScalar(s);
        group.position.sub(centre);
    }

    return { group, ...registry };
}

export const hasSpacecraftModel = (id) => Object.prototype.hasOwnProperty.call(BUILDERS, id);
