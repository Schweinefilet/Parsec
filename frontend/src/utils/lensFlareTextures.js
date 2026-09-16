// The Sun's camera lens-flare — built on three.js's own Lensflare object,
// which already does the hard part (screen-space placement, occlusion
// testing against whatever's in front of the Sun) via Object3D.onBeforeRender.
// Once created and added to a light positioned at the Sun, it needs no
// per-frame code of ours at all, which is why this can be built once
// alongside everything else in the scene-setup effect.
//
// The flare elements' textures are drawn on <canvas>, the same way every
// planet and moon surface in this app is (see proceduralTextures.js) —
// they're just gradients and shapes, so there's no reason to ship image
// assets for them. All of it is built once, at scene setup: the cost is a
// handful of canvas fills, and nothing here runs per frame.

import * as THREE from 'three';
import { Lensflare, LensflareElement } from 'three/examples/jsm/objects/Lensflare.js';

function makeCanvas(size) {
    const c = document.createElement('canvas');
    c.width = c.height = size;
    return c;
}

// The bright core: a soft, warm halo sitting right over the Sun itself.
// Kept deliberately faint — it lands additively on top of a Sun that is
// already white-hot, plus the five GLOW_LAYERS shells around it, so
// anything near full opacity here blows the whole centre of the frame out.
function haloTexture(size) {
    const c = makeCanvas(size);
    const ctx = c.getContext('2d');
    const r = size / 2;
    const g = ctx.createRadialGradient(r, r, 0, r, r, r);
    g.addColorStop(0,    'rgba(255,255,255,0.5)');
    g.addColorStop(0.15, 'rgba(255,244,200,0.3)');
    g.addColorStop(0.4,  'rgba(255,214,120,0.1)');
    g.addColorStop(1,    'rgba(255,180,80,0)');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, size, size);
    return new THREE.CanvasTexture(c);
}

// A horizontal glint through the Sun's own position — the streak a real
// lens throws when it catches a bright light.
//
// Drawn as a vertically squashed radial gradient, NOT a filled rectangle:
// a rect's top and bottom edges are hard lines, and at any opacity that
// makes the streak visible at all, those edges read as a grey band laid
// over the scene rather than as light. Squashing the gradient gives a
// falloff on every side, so the streak has no edges to notice.
function streakTexture(size) {
    const c = makeCanvas(size);
    const ctx = c.getContext('2d');
    const cx = size / 2, cy = size / 2;
    ctx.globalCompositeOperation = 'lighter';

    const ellipse = (squash, radius, stops) => {
        ctx.save();
        ctx.translate(cx, cy);
        ctx.scale(1, squash);
        const g = ctx.createRadialGradient(0, 0, 0, 0, 0, radius);
        stops.forEach(([offset, color]) => g.addColorStop(offset, color));
        ctx.fillStyle = g;
        ctx.beginPath();
        ctx.arc(0, 0, radius, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
    };

    // The long, faint reach of the streak…
    ellipse(0.03, size / 2, [
        [0,    'rgba(255,255,255,0.26)'],
        [0.2,  'rgba(215,232,255,0.12)'],
        [0.55, 'rgba(185,212,255,0.035)'],
        [1,    'rgba(170,205,255,0)'],
    ]);
    // …and a slightly taller, brighter kernel where it crosses the Sun.
    ellipse(0.09, size * 0.12, [
        [0, 'rgba(255,252,240,0.3)'],
        [1, 'rgba(255,240,210,0)'],
    ]);

    return new THREE.CanvasTexture(c);
}

// The starburst: the spray of fine rays a real iris throws out of a very
// bright point, and the thing the Sun's flare was most obviously missing —
// it had one horizontal streak and nothing else radiating at all.
//
// Built from the same squashed-ellipse primitive as the streak above, one per
// ray, rotated. Each ellipse is symmetric about the centre, so one entry
// draws the ray and its opposite number together; the angles below therefore
// only need to cover a half-turn. `lighter` compositing is what lets them
// cross at the centre and pile into a hot core instead of painting over one
// another.
//
// The angles are deliberately not an even fan. A real iris does throw evenly
// spaced spikes, but an evenly spaced *and* evenly bright set reads as a
// drawn asterisk rather than as light — the eye finds the pattern
// immediately. Varying reach and brightness per ray, with two long dominant
// ones off the diagonal, is what makes it read as a lens catching the Sun.
const SPIKES = [
    // The two that carry the look: long, off-axis, and brighter than the rest.
    { angle: -34, reach: 1.00, squash: 0.016, core: 0.34, mid: 0.10, tint: '235,240,255' },
    { angle:  56, reach: 0.74, squash: 0.013, core: 0.22, mid: 0.06, tint: '255,238,205' },
    // The fan around them.
    { angle:  16, reach: 0.60, squash: 0.011, core: 0.15, mid: 0.04, tint: '255,246,225' },
    { angle:  76, reach: 0.52, squash: 0.010, core: 0.13, mid: 0.035, tint: '225,236,255' },
    { angle: 108, reach: 0.64, squash: 0.011, core: 0.14, mid: 0.04, tint: '255,250,240' },
    { angle: 136, reach: 0.44, squash: 0.009, core: 0.11, mid: 0.03, tint: '210,228,255' },
    { angle: 158, reach: 0.38, squash: 0.009, core: 0.10, mid: 0.025, tint: '255,235,200' },
    // Short fill, so the centre reads as a dense spray rather than six lines.
    { angle:  -8, reach: 0.30, squash: 0.008, core: 0.09, mid: 0.02, tint: '255,255,255' },
    { angle:  40, reach: 0.26, squash: 0.008, core: 0.08, mid: 0.02, tint: '255,255,255' },
    { angle:  92, reach: 0.28, squash: 0.008, core: 0.08, mid: 0.02, tint: '235,245,255' },
    { angle: 124, reach: 0.24, squash: 0.008, core: 0.07, mid: 0.018, tint: '255,248,230' },
];

function burstTexture(size) {
    const c = makeCanvas(size);
    const ctx = c.getContext('2d');
    const cx = size / 2, cy = size / 2;
    ctx.globalCompositeOperation = 'lighter';

    for (const { angle, reach, squash, core, mid, tint } of SPIKES) {
        ctx.save();
        ctx.translate(cx, cy);
        ctx.rotate((angle * Math.PI) / 180);
        ctx.scale(1, squash);
        const r = (size / 2) * reach;
        const g = ctx.createRadialGradient(0, 0, 0, 0, 0, r);
        g.addColorStop(0,    `rgba(${tint},${core})`);
        g.addColorStop(0.25, `rgba(${tint},${mid})`);
        g.addColorStop(0.6,  `rgba(${tint},${(mid * 0.25).toFixed(4)})`);
        g.addColorStop(1,    `rgba(${tint},0)`);
        ctx.fillStyle = g;
        ctx.beginPath();
        ctx.arc(0, 0, r, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
    }

    // A small round kernel where they all cross. Without it the rays meet at a
    // point that is bright but not *hot*, and the burst looks like it is
    // hovering in front of the Sun rather than coming out of it.
    const k = ctx.createRadialGradient(cx, cy, 0, cx, cy, size * 0.045);
    k.addColorStop(0,   'rgba(255,255,255,0.5)');
    k.addColorStop(0.5, 'rgba(255,246,220,0.16)');
    k.addColorStop(1,   'rgba(255,238,200,0)');
    ctx.fillStyle = k;
    ctx.fillRect(0, 0, size, size);

    return new THREE.CanvasTexture(c);
}

// A small polygonal "ghost" — the secondary reflections a real camera iris
// throws further along the line from the light, through screen centre.
function ghostTexture(size, sides, colors) {
    const c = makeCanvas(size);
    const ctx = c.getContext('2d');
    const cx = size / 2, cy = size / 2, r = size * 0.42;

    ctx.beginPath();
    for (let i = 0; i < sides; i++) {
        const a = (i / sides) * Math.PI * 2;
        const x = cx + r * Math.cos(a), y = cy + r * Math.sin(a);
        if (i === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
    }
    ctx.closePath();

    const g = ctx.createRadialGradient(cx, cy, 0, cx, cy, r);
    g.addColorStop(0,   colors[0]);
    g.addColorStop(0.7, colors[1]);
    g.addColorStop(1,   colors[2]);
    ctx.fillStyle = g;
    ctx.fill();

    return new THREE.CanvasTexture(c);
}

// Spread wider and further than the original four: a real flare's ghosts run
// the whole chord from the light, through screen centre, and out the far
// side, and clustering them all between 0.35 and 1.15 kept the whole effect
// bunched around the Sun. The two large, soft, low-opacity ones (0.18 and
// 1.55) are the ones that read as a lens rather than as confetti — big dim
// discs, not bright dots.
const GHOSTS = [
    { size: 120, distance: 0.18, sides: 8, colors: ['rgba(255,244,215,0.13)', 'rgba(255,215,150,0.05)', 'rgba(255,215,150,0)'] },
    { size: 56,  distance: 0.35, sides: 6, colors: ['rgba(255,255,255,0.26)', 'rgba(180,220,255,0.12)', 'rgba(180,220,255,0)'] },
    { size: 32,  distance: 0.55, sides: 6, colors: ['rgba(255,240,220,0.22)', 'rgba(255,200,140,0.1)',  'rgba(255,200,140,0)'] },
    { size: 84,  distance: 0.85, sides: 8, colors: ['rgba(140,190,255,0.2)',  'rgba(110,160,255,0.08)', 'rgba(110,160,255,0)'] },
    { size: 22,  distance: 1.15, sides: 6, colors: ['rgba(255,255,255,0.18)', 'rgba(200,220,255,0.07)', 'rgba(200,220,255,0)'] },
    { size: 46,  distance: 1.32, sides: 7, colors: ['rgba(190,215,255,0.16)', 'rgba(150,185,255,0.06)', 'rgba(150,185,255,0)'] },
    { size: 150, distance: 1.55, sides: 8, colors: ['rgba(255,235,205,0.1)',  'rgba(255,200,150,0.035)', 'rgba(255,200,150,0)'] },
];

/**
 * Builds the Sun's lens-flare. `.add()` it onto a light (or any Object3D)
 * positioned at the Sun — three.js tracks that object's screen position and
 * occlusion every frame on its own via onBeforeRender, so this needs no
 * manual update from the render loop.
 */
export function createSunLensflare() {
    const flare = new Lensflare();
    flare.addElement(new LensflareElement(haloTexture(256), 220, 0));
    flare.addElement(new LensflareElement(streakTexture(512), 1100, 0));
    // Wider than the halo and narrower than the streak, so the rays reach
    // well past the Sun's own glow without competing with the horizontal
    // glint the streak already owns. 512 rather than 256: at 256 the thinnest
    // rays (squash 0.008) come out under a pixel tall and alias into dashes.
    flare.addElement(new LensflareElement(burstTexture(512), 760, 0));
    GHOSTS.forEach(({ size, distance, sides, colors }) => {
        flare.addElement(new LensflareElement(ghostTexture(128, sides, colors), size, distance));
    });
    return flare;
}
