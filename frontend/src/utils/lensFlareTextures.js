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
function haloTexture(size) {
    const c = makeCanvas(size);
    const ctx = c.getContext('2d');
    const r = size / 2;
    const g = ctx.createRadialGradient(r, r, 0, r, r, r);
    g.addColorStop(0,    'rgba(255,255,255,1)');
    g.addColorStop(0.15, 'rgba(255,244,200,0.9)');
    g.addColorStop(0.4,  'rgba(255,214,120,0.32)');
    g.addColorStop(1,    'rgba(255,180,80,0)');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, size, size);
    return new THREE.CanvasTexture(c);
}

// A thin, bright horizontal bar through the Sun's own position — this is
// what reads as the diagonal-ish streak lines in a camera glare (the
// element itself is drawn upright; the camera roll and framing at any given
// moment are what make it look diagonal, exactly as with a real lens).
function streakTexture(size) {
    const c = makeCanvas(size);
    const ctx = c.getContext('2d');
    const cx = size / 2, cy = size / 2;

    // A linear alpha ramp still reads as a solid bar against black (low
    // opacity is plenty visible), so this needs graduated stops rather
    // than a straight fade to zero at the edges — otherwise it either
    // looks like a scanline (fades too slowly) or gets swallowed entirely
    // inside the halo element's own glow (fades too fast).
    const bar = ctx.createLinearGradient(0, 0, size, 0);
    bar.addColorStop(0,    'rgba(170,205,255,0)');
    bar.addColorStop(0.15, 'rgba(170,205,255,0)');
    bar.addColorStop(0.3,  'rgba(180,210,255,0.06)');
    bar.addColorStop(0.42, 'rgba(195,220,255,0.16)');
    bar.addColorStop(0.47, 'rgba(225,235,255,0.45)');
    bar.addColorStop(0.5,  'rgba(255,255,255,0.75)');
    bar.addColorStop(0.53, 'rgba(225,235,255,0.45)');
    bar.addColorStop(0.58, 'rgba(195,220,255,0.16)');
    bar.addColorStop(0.7,  'rgba(180,210,255,0.06)');
    bar.addColorStop(0.85, 'rgba(170,205,255,0)');
    bar.addColorStop(1,    'rgba(170,205,255,0)');
    ctx.fillStyle = bar;
    ctx.fillRect(0, cy - size * 0.012, size, size * 0.024);

    const core = ctx.createRadialGradient(cx, cy, 0, cx, cy, size * 0.1);
    core.addColorStop(0, 'rgba(255,255,255,0.8)');
    core.addColorStop(1, 'rgba(255,255,255,0)');
    ctx.fillStyle = core;
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

const GHOSTS = [
    { size: 70,  distance: 0.35, sides: 6, colors: ['rgba(255,255,255,0.5)',  'rgba(180,220,255,0.26)', 'rgba(180,220,255,0)'] },
    { size: 40,  distance: 0.55, sides: 6, colors: ['rgba(255,240,220,0.42)', 'rgba(255,200,140,0.2)',  'rgba(255,200,140,0)'] },
    { size: 110, distance: 0.85, sides: 8, colors: ['rgba(140,190,255,0.38)', 'rgba(110,160,255,0.16)', 'rgba(110,160,255,0)'] },
    { size: 26,  distance: 1.15, sides: 6, colors: ['rgba(255,255,255,0.32)', 'rgba(200,220,255,0.14)', 'rgba(200,220,255,0)'] },
];

/**
 * Builds the Sun's lens-flare. `.add()` it onto a light (or any Object3D)
 * positioned at the Sun — three.js tracks that object's screen position and
 * occlusion every frame on its own via onBeforeRender, so this needs no
 * manual update from the render loop.
 */
export function createSunLensflare() {
    const flare = new Lensflare();
    flare.addElement(new LensflareElement(haloTexture(256), 420, 0));
    flare.addElement(new LensflareElement(streakTexture(512), 1600, 0));
    GHOSTS.forEach(({ size, distance, sides, colors }) => {
        flare.addElement(new LensflareElement(ghostTexture(128, sides, colors), size, distance));
    });
    return flare;
}
