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
// assets for them.

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

const GHOSTS = [
    { size: 56, distance: 0.35, sides: 6, colors: ['rgba(255,255,255,0.26)', 'rgba(180,220,255,0.12)', 'rgba(180,220,255,0)'] },
    { size: 32, distance: 0.55, sides: 6, colors: ['rgba(255,240,220,0.22)', 'rgba(255,200,140,0.1)',  'rgba(255,200,140,0)'] },
    { size: 84, distance: 0.85, sides: 8, colors: ['rgba(140,190,255,0.2)',  'rgba(110,160,255,0.08)', 'rgba(110,160,255,0)'] },
    { size: 22, distance: 1.15, sides: 6, colors: ['rgba(255,255,255,0.18)', 'rgba(200,220,255,0.07)', 'rgba(200,220,255,0)'] },
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
    GHOSTS.forEach(({ size, distance, sides, colors }) => {
        flare.addElement(new LensflareElement(ghostTexture(128, sides, colors), size, distance));
    });
    return flare;
}
