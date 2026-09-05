import * as THREE from 'three';
import { quality } from './quality';

// Procedurally painted equirectangular surface maps for the bodies we have no
// photographic texture for. Each profile below is drawn from what the body
// actually looks like — Io's sulfur plains, Europa's linea, Iapetus' two-tone
// hemispheres, Pluto's bright heart — so a generated world still reads as
// itself rather than as generic grey noise.
//
// Everything is deterministic: the same body id always produces the same
// surface, so nothing shifts between reloads or between the card and the globe.

// ── Deterministic RNG (FNV-1a seed → mulberry32) ───────────────────────────
function seededRand(seedKey) {
    let h = 2166136261;
    for (let i = 0; i < seedKey.length; i++) {
        h ^= seedKey.charCodeAt(i);
        h = Math.imul(h, 16777619);
    }
    let s = h >>> 0;
    return () => {
        s |= 0; s = (s + 0x6D2B79F5) | 0;
        let t = Math.imul(s ^ (s >>> 15), 1 | s);
        t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
        return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
}

// ── Drawing primitives ─────────────────────────────────────────────────────
// Every primitive draws three times (x, x−W, x+W) so features that straddle
// the UV seam continue across it instead of being cut in half.
function makePainter(ctx, W, H, rand) {
    const wrapped = (x, draw) => { draw(x); draw(x - W); draw(x + W); };
    const pick = (arr) => arr[Math.floor(rand() * arr.length) % arr.length];

    return {
        rand,
        wrapped,
        pick,

        fill(color) {
            ctx.fillStyle = color;
            ctx.fillRect(0, 0, W, H);
        },

        // Soft irregular colour blobs — regional albedo variation
        patches({ count, rMin, rMax, colors, alphaMin = 0.05, alphaMax = 0.18, yBias }) {
            for (let i = 0; i < count; i++) {
                const x = rand() * W;
                const y = yBias ? yBias(rand()) * H : rand() * H;
                const r = rMin + rand() * (rMax - rMin);
                const a = alphaMin + rand() * (alphaMax - alphaMin);
                const c = pick(colors);
                wrapped(x, (wx) => {
                    const g = ctx.createRadialGradient(wx, y, 0, wx, y, r);
                    g.addColorStop(0, `rgba(${c},${a})`);
                    g.addColorStop(0.6, `rgba(${c},${a * 0.45})`);
                    g.addColorStop(1, `rgba(${c},0)`);
                    ctx.fillStyle = g;
                    ctx.fillRect(wx - r, y - r, r * 2, r * 2);
                });
            }
        },

        // Impact craters. The rim is a soft gradient annulus rather than a
        // stroked circle — a hard stroke reads as a drawn ring instead of a
        // sunlit crater wall. Shading is offset so every crater is lit from
        // the same direction.
        craters({ count, rMin, rMax, floor = 0.18, rim = 0.13, rayChance = 0 }) {
            for (let i = 0; i < count; i++) {
                const x = rand() * W;
                const y = rand() * H;
                // Squared roll keeps most craters small with a few large ones
                const r = rMin + Math.pow(rand(), 2) * (rMax - rMin);
                const fa = floor * (0.6 + rand() * 0.7);
                const ra = rim * (0.6 + rand() * 0.7);
                const rays = rand() < rayChance;
                wrapped(x, (wx) => {
                    if (rays) {
                        const g = ctx.createRadialGradient(wx, y, r * 0.9, wx, y, r * 3.6);
                        g.addColorStop(0, `rgba(255,255,255,${ra * 0.45})`);
                        g.addColorStop(1, 'rgba(255,255,255,0)');
                        ctx.fillStyle = g;
                        ctx.fillRect(wx - r * 3.6, y - r * 3.6, r * 7.2, r * 7.2);
                    }
                    // Bowl
                    const g = ctx.createRadialGradient(wx, y, 0, wx, y, r);
                    g.addColorStop(0, `rgba(0,0,0,${fa})`);
                    g.addColorStop(0.70, `rgba(0,0,0,${fa * 0.5})`);
                    g.addColorStop(1, 'rgba(0,0,0,0)');
                    ctx.fillStyle = g;
                    ctx.beginPath(); ctx.arc(wx, y, r, 0, Math.PI * 2); ctx.fill();
                    // Sunlit rim: bright on the upper-left, shadowed lower-right
                    const lx = wx - r * 0.16, ly = y - r * 0.16;
                    const rg = ctx.createRadialGradient(lx, ly, r * 0.68, lx, ly, r * 1.08);
                    rg.addColorStop(0, 'rgba(255,255,255,0)');
                    rg.addColorStop(0.55, `rgba(255,255,255,${ra})`);
                    rg.addColorStop(1, 'rgba(255,255,255,0)');
                    ctx.fillStyle = rg;
                    ctx.beginPath(); ctx.arc(lx, ly, r * 1.08, 0, Math.PI * 2); ctx.fill();
                });
            }
        },

        // One named, oversized impact basin (Mimas' Herschel, Tethys' Odysseus)
        basin({ x, y, r, floor = 0.30, rim = 0.34, peak = true }) {
            const px = x * W, py = y * H, pr = r * W;
            wrapped(px, (wx) => {
                const g = ctx.createRadialGradient(wx, py, 0, wx, py, pr);
                g.addColorStop(0, `rgba(0,0,0,${floor})`);
                g.addColorStop(0.72, `rgba(0,0,0,${floor * 0.55})`);
                g.addColorStop(1, 'rgba(0,0,0,0)');
                ctx.fillStyle = g;
                ctx.beginPath(); ctx.arc(wx, py, pr, 0, Math.PI * 2); ctx.fill();
                // Feathered rim wall
                const lx = wx - pr * 0.10, ly = py - pr * 0.10;
                const rg = ctx.createRadialGradient(lx, ly, pr * 0.80, lx, ly, pr * 1.10);
                rg.addColorStop(0, 'rgba(255,255,255,0)');
                rg.addColorStop(0.5, `rgba(255,255,255,${rim})`);
                rg.addColorStop(1, 'rgba(255,255,255,0)');
                ctx.fillStyle = rg;
                ctx.beginPath(); ctx.arc(lx, ly, pr * 1.10, 0, Math.PI * 2); ctx.fill();
                if (peak) {
                    const pg = ctx.createRadialGradient(wx, py, 0, wx, py, pr * 0.24);
                    pg.addColorStop(0, `rgba(255,255,255,${rim * 0.75})`);
                    pg.addColorStop(1, 'rgba(255,255,255,0)');
                    ctx.fillStyle = pg;
                    ctx.beginPath(); ctx.arc(wx, py, pr * 0.24, 0, Math.PI * 2); ctx.fill();
                }
            });
        },

        // Long, gently curved fracture bands that cross most of the globe —
        // Europa's linea. Each is a dark core flanked by brighter ice ridges,
        // which is what makes them read as fractures rather than scratches.
        bands2({ count, core, edge, widthMin = 2, widthMax = 6, alpha = 0.30 }) {
            for (let i = 0; i < count; i++) {
                // Anchor each band anywhere on the map and run it out at its own
                // angle; drawing them all edge-to-edge produced parallel stripes.
                const cx = rand() * W;
                const cy = rand() * H;
                const angle = (rand() - 0.5) * Math.PI * 1.15;
                const half = W * (0.35 + rand() * 0.35);
                const dx = Math.cos(angle) * half;
                const dy = Math.sin(angle) * half * 0.55;
                // Perpendicular bow so the band curves rather than running straight
                const bow = (rand() - 0.5) * H * 0.30;
                const width = widthMin + rand() * (widthMax - widthMin);
                const a = alpha * (0.5 + rand() * 0.8);

                const draw = (color, lw, op) => {
                    ctx.strokeStyle = `rgba(${color},${op})`;
                    ctx.lineWidth = lw;
                    ctx.lineCap = 'round';
                    wrapped(cx, (wx) => {
                        ctx.beginPath();
                        ctx.moveTo(wx - dx, cy - dy);
                        ctx.quadraticCurveTo(wx - dy * 0.3 + bow, cy + dx * 0.12 + bow,
                            wx + dx, cy + dy);
                        ctx.stroke();
                    });
                };
                draw(edge, width * 2.1, a * 0.42);   // outer ice halo
                draw(core, width, a);                // dark core
                draw(edge, width * 0.34, a * 0.85);  // bright central ridge
            }
        },

        // Enceladus' tiger stripes: a few long curved fractures near one pole,
        // each with a diffuse halo of fresh ice.
        fractures({ count, y, color, halo, alpha = 0.35, spread = 0.05 }) {
            for (let i = 0; i < count; i++) {
                const yy = y * H + (i - (count - 1) / 2) * (H * spread);
                const bow = (rand() - 0.5) * H * 0.06;
                const path = (lw, op, col) => {
                    ctx.strokeStyle = `rgba(${col},${op})`;
                    ctx.lineWidth = lw;
                    ctx.lineCap = 'round';
                    ctx.beginPath();
                    ctx.moveTo(W * (0.08 + rand() * 0.04), yy + bow);
                    ctx.bezierCurveTo(
                        W * 0.35, yy - bow * 2,
                        W * 0.68, yy + bow * 2,
                        W * (0.90 - rand() * 0.04), yy - bow,
                    );
                    ctx.stroke();
                };
                path(14, alpha * 0.22, halo);
                path(6, alpha * 0.45, halo);
                path(2.2, alpha, color);
            }
        },

        // Latitudinal cloud/haze banding
        bands({ count, colors, alphaMin = 0.04, alphaMax = 0.12, blur = 10 }) {
            ctx.save();
            ctx.filter = `blur(${blur}px)`;
            for (let i = 0; i < count; i++) {
                const y = rand() * H;
                const hgt = H * (0.02 + rand() * 0.10);
                ctx.fillStyle = `rgba(${pick(colors)},${alphaMin + rand() * (alphaMax - alphaMin)})`;
                ctx.fillRect(-W, y, W * 3, hgt);
            }
            ctx.restore();
        },

        // Long shallow-curved fractures — Europa's linea, Triton's ridges
        lineae({ count, color, widthMin = 0.6, widthMax = 2.4, alphaMin = 0.10, alphaMax = 0.30, len = 0.7 }) {
            for (let i = 0; i < count; i++) {
                const x0 = rand() * W;
                const y0 = rand() * H;
                const angle = rand() * Math.PI * 2;
                const length = W * len * (0.3 + rand() * 0.7);
                const bow = (rand() - 0.5) * H * 0.5;
                const x1 = x0 + Math.cos(angle) * length;
                const y1 = y0 + Math.sin(angle) * length * 0.45;
                ctx.strokeStyle = `rgba(${color},${alphaMin + rand() * (alphaMax - alphaMin)})`;
                ctx.lineWidth = widthMin + rand() * (widthMax - widthMin);
                ctx.lineCap = 'round';
                wrapped(0, (off) => {
                    ctx.beginPath();
                    ctx.moveTo(x0 + off, y0);
                    ctx.quadraticCurveTo((x0 + x1) / 2 + off, (y0 + y1) / 2 + bow, x1 + off, y1);
                    ctx.stroke();
                });
            }
        },

        // Parallel groove sets — Ganymede's sulci, Miranda's coronae
        grooves({ sets, linesPerSet, color, alpha = 0.14, spacing = 3 }) {
            for (let s = 0; s < sets; s++) {
                const cx = rand() * W;
                const cy = rand() * H;
                const angle = rand() * Math.PI;
                const length = W * (0.10 + rand() * 0.22);
                ctx.save();
                ctx.translate(cx, cy);
                ctx.rotate(angle);
                for (let i = 0; i < linesPerSet; i++) {
                    const off = (i - linesPerSet / 2) * spacing;
                    ctx.strokeStyle = `rgba(${color},${alpha * (0.4 + rand() * 0.9)})`;
                    ctx.lineWidth = 0.6 + rand() * 1.5;
                    ctx.beginPath();
                    ctx.moveTo(-length / 2, off);
                    ctx.lineTo(length / 2, off + (rand() - 0.5) * 4);
                    ctx.stroke();
                }
                ctx.restore();
            }
        },

        // A specific named region (Pluto's Tombaugh Regio, Triton's polar cap)
        region({ x, y, rx, ry, color, alpha = 0.5, softness = 0.45, rotate = 0 }) {
            const px = x * W, py = y * H, prx = rx * W, pry = ry * H;
            wrapped(px, (wx) => {
                ctx.save();
                ctx.translate(wx, py);
                ctx.rotate(rotate);
                ctx.scale(1, pry / prx);
                const g = ctx.createRadialGradient(0, 0, prx * (1 - softness), 0, 0, prx);
                g.addColorStop(0, `rgba(${color},${alpha})`);
                g.addColorStop(1, `rgba(${color},0)`);
                ctx.fillStyle = g;
                ctx.beginPath(); ctx.arc(0, 0, prx, 0, Math.PI * 2); ctx.fill();
                ctx.restore();
            });
        },

        // Darken or brighten one hemisphere — Iapetus' famous two-tone split
        hemisphere({ center = 0.25, color, alpha = 0.5, feather = 0.22 }) {
            const cx = center * W;
            const half = W * 0.25;
            wrapped(cx, (wx) => {
                const g = ctx.createLinearGradient(wx - half - W * feather, 0, wx + half + W * feather, 0);
                g.addColorStop(0, `rgba(${color},0)`);
                g.addColorStop(0.5, `rgba(${color},${alpha})`);
                g.addColorStop(1, `rgba(${color},0)`);
                ctx.fillStyle = g;
                ctx.fillRect(wx - half - W * feather, 0, (half + W * feather) * 2, H);
            });
        },

        // Bright polar cap on the north (−1) or south (+1) edge
        polarCap({ side = 1, extent = 0.16, color = '255,255,255', alpha = 0.55 }) {
            const y0 = side > 0 ? H * (1 - extent) : 0;
            const g = ctx.createLinearGradient(0, side > 0 ? H : 0, 0, side > 0 ? y0 : H * extent);
            g.addColorStop(0, `rgba(${color},${alpha})`);
            g.addColorStop(1, `rgba(${color},0)`);
            ctx.fillStyle = g;
            ctx.fillRect(0, side > 0 ? y0 : 0, W, H * extent);
        },

        // Enceladus' tiger stripes: parallel fractures near one pole
        stripes({ count, y, color, alpha = 0.3, width = 2 }) {
            for (let i = 0; i < count; i++) {
                const yy = y * H + (i - count / 2) * (H * 0.035) + (rand() - 0.5) * 4;
                ctx.strokeStyle = `rgba(${color},${alpha * (0.6 + rand() * 0.6)})`;
                ctx.lineWidth = width * (0.6 + rand() * 0.8);
                ctx.lineCap = 'round';
                ctx.beginPath();
                ctx.moveTo(W * (0.12 + rand() * 0.1), yy);
                ctx.bezierCurveTo(W * 0.35, yy + (rand() - 0.5) * 12, W * 0.6, yy + (rand() - 0.5) * 12, W * (0.8 + rand() * 0.1), yy);
                ctx.stroke();
            }
        },

        // Fine per-pixel-ish noise so surfaces never look flat under specular light
        grain({ count, alpha = 0.05 }) {
            for (let i = 0; i < count; i++) {
                const bright = rand() > 0.5;
                ctx.fillStyle = `rgba(${bright ? '255,255,255' : '0,0,0'},${alpha * rand()})`;
                ctx.fillRect(rand() * W, rand() * H, 1 + rand() * 2, 1 + rand() * 2);
            }
        },
    };
}

// ── Per-body surface profiles ──────────────────────────────────────────────
// hero: painted at 1024×512 because you can fly right up to them.
const PROFILES = {
    // ── Jupiter's Galilean moons ───────────────────────────────────────────
    io: { hero: true, base: '#d8b06a', paint: (p) => {
        // Sulfur plains: yellow-white-orange mottling, volcanic paterae, no craters
        p.patches({ count: 90, rMin: 20, rMax: 130, alphaMin: 0.10, alphaMax: 0.30,
            colors: ['255,240,170', '250,205,90', '225,140,55', '255,255,225'] });
        p.patches({ count: 34, rMin: 6, rMax: 26, alphaMin: 0.25, alphaMax: 0.55,
            colors: ['70,45,30', '120,55,35', '40,30,25'] });          // dark paterae
        p.patches({ count: 22, rMin: 14, rMax: 44, alphaMin: 0.10, alphaMax: 0.22,
            colors: ['255,80,60', '255,140,90'] });                     // fresh sulfur flows
        p.grain({ count: 1600, alpha: 0.05 });
    }},

    europa: { hero: true, base: '#d5dde8', paint: (p) => {
        p.patches({ count: 34, rMin: 50, rMax: 170, alphaMin: 0.05, alphaMax: 0.13,
            colors: ['255,255,255', '196,214,238'] });
        // Global linea: long dark bands flanked by bright ice ridges
        p.bands2({ count: 26, core: '138,84,56', edge: '245,248,255',
            widthMin: 2.5, widthMax: 7, alpha: 0.42 });
        p.bands2({ count: 18, core: '120,74,52', edge: '235,242,252',
            widthMin: 1.2, widthMax: 3, alpha: 0.28 });
        // Younger, brighter cracks cutting across the older bands
        p.bands2({ count: 12, core: '210,225,245', edge: '255,255,255',
            widthMin: 1, widthMax: 2.4, alpha: 0.22 });
        p.patches({ count: 18, rMin: 10, rMax: 34, alphaMin: 0.06, alphaMax: 0.16,
            colors: ['150,96,66'] });                                   // chaos terrain
        p.craters({ count: 7, rMin: 2, rMax: 6, floor: 0.10, rim: 0.16 });
        p.grain({ count: 900, alpha: 0.03 });
    }},

    ganymede: { hero: true, base: '#9a9793', paint: (p) => {
        p.patches({ count: 26, rMin: 60, rMax: 190, alphaMin: 0.12, alphaMax: 0.26,
            colors: ['60,58,62', '75,70,72'] });                        // dark ancient terrain
        p.patches({ count: 30, rMin: 40, rMax: 130, alphaMin: 0.10, alphaMax: 0.22,
            colors: ['210,208,205', '185,188,195'] });                  // bright grooved terrain
        p.grooves({ sets: 26, linesPerSet: 9, color: '235,235,240', alpha: 0.16, spacing: 3.4 });
        p.grooves({ sets: 14, linesPerSet: 7, color: '40,38,40', alpha: 0.10, spacing: 4 });
        p.craters({ count: 90, rMin: 1.5, rMax: 11, floor: 0.16, rim: 0.16, rayChance: 0.30 });
        p.grain({ count: 1400, alpha: 0.05 });
    }},

    callisto: { hero: true, base: '#6b6560', paint: (p) => {
        // The most heavily cratered surface in the solar system
        p.patches({ count: 40, rMin: 30, rMax: 140, alphaMin: 0.08, alphaMax: 0.20,
            colors: ['40,36,34', '90,84,78'] });
        p.craters({ count: 260, rMin: 1.2, rMax: 16, floor: 0.20, rim: 0.20, rayChance: 0.34 });
        p.basin({ x: 0.30, y: 0.36, r: 0.075, floor: 0.20, rim: 0.34 });  // Valhalla
        p.basin({ x: 0.30, y: 0.36, r: 0.130, floor: 0.03, rim: 0.13, peak: false });
        p.grain({ count: 1800, alpha: 0.06 });
    }},

    // ── Saturn's moons ─────────────────────────────────────────────────────
    mimas: { hero: true, base: '#c9c6c1', paint: (p) => {
        p.craters({ count: 190, rMin: 1.2, rMax: 10, floor: 0.20, rim: 0.20 });
        p.basin({ x: 0.28, y: 0.40, r: 0.10, floor: 0.26, rim: 0.40 });   // Herschel
        p.grain({ count: 1100, alpha: 0.05 });
    }},

    enceladus: { hero: true, base: '#e9f0f7', paint: (p) => {
        p.patches({ count: 30, rMin: 40, rMax: 140, alphaMin: 0.06, alphaMax: 0.15,
            colors: ['255,255,255', '196,216,236'] });
        // Ancient cratered north, smooth resurfaced south
        p.craters({ count: 70, rMin: 1.2, rMax: 8, floor: 0.14, rim: 0.13,
            rayChance: 0.12 });
        p.region({ x: 0.5, y: 0.86, rx: 0.55, ry: 0.20, color: '255,255,255',
            alpha: 0.35, softness: 0.8 });
        p.fractures({ count: 4, y: 0.84, color: '58,116,168', halo: '120,180,224',
            alpha: 0.42, spread: 0.055 });                              // tiger stripes
        p.lineae({ count: 20, color: '150,178,206', widthMin: 0.6, widthMax: 1.8,
            alphaMin: 0.08, alphaMax: 0.18, len: 0.35 });
        p.grain({ count: 700, alpha: 0.03 });
    }},

    tethys: { base: '#c4c0ba', paint: (p) => {
        p.craters({ count: 150, rMin: 1.2, rMax: 9, floor: 0.18, rim: 0.18 });
        p.basin({ x: 0.62, y: 0.44, r: 0.075, floor: 0.20, rim: 0.30 });  // Odysseus
        p.lineae({ count: 5, color: '90,88,84', widthMin: 2, widthMax: 4,
            alphaMin: 0.14, alphaMax: 0.24, len: 0.9 });                  // Ithaca Chasma
        p.grain({ count: 900, alpha: 0.05 });
    }},

    dione: { base: '#bfbab4', paint: (p) => {
        p.craters({ count: 140, rMin: 1.2, rMax: 8, floor: 0.17, rim: 0.17 });
        p.lineae({ count: 30, color: '255,255,255', widthMin: 0.8, widthMax: 2.4,
            alphaMin: 0.12, alphaMax: 0.28, len: 0.45 });                 // wispy ice cliffs
        p.grain({ count: 900, alpha: 0.05 });
    }},

    rhea: { base: '#c2beb8', paint: (p) => {
        p.craters({ count: 190, rMin: 1.2, rMax: 10, floor: 0.18, rim: 0.19, rayChance: 0.22 });
        p.grain({ count: 1000, alpha: 0.05 });
    }},

    titan: { hero: true, base: '#d9a441', paint: (p) => {
        // Dark equatorial dune seas, drawn before the haze so they stay soft
        p.patches({ count: 26, rMin: 60, rMax: 150, alphaMin: 0.16, alphaMax: 0.30,
            colors: ['92,58,28', '116,74,34'],
            yBias: (r) => 0.38 + r * 0.28 });
        p.patches({ count: 14, rMin: 70, rMax: 190, alphaMin: 0.14, alphaMax: 0.24,
            colors: ['255,236,178', '250,224,158'] });                  // Xanadu
        p.patches({ count: 10, rMin: 12, rMax: 34, alphaMin: 0.10, alphaMax: 0.20,
            colors: ['60,70,86'], yBias: (r) => 0.04 + r * 0.16 });     // northern lakes
        p.polarCap({ side: -1, extent: 0.14, color: '214,228,238', alpha: 0.22 });
        // Thick atmosphere softens everything above
        p.bands({ count: 22, colors: ['255,214,138', '198,138,52', '255,240,200'],
            alphaMin: 0.05, alphaMax: 0.13, blur: 26 });
        p.grain({ count: 500, alpha: 0.02 });
    }},

    iapetus: { hero: true, base: '#b8b0a4', paint: (p) => {
        p.craters({ count: 150, rMin: 1.2, rMax: 11, floor: 0.16, rim: 0.16 });
        p.hemisphere({ center: 0.25, color: '18,12,8', alpha: 0.88, feather: 0.13 }); // Cassini Regio
        p.craters({ count: 60, rMin: 1.2, rMax: 7, floor: 0.12, rim: 0.06 });
        p.lineae({ count: 3, color: '60,55,50', widthMin: 2.5, widthMax: 4,
            alphaMin: 0.16, alphaMax: 0.24, len: 1.0 });                   // equatorial ridge
        p.grain({ count: 1000, alpha: 0.05 });
    }},

    // ── Uranian moons ──────────────────────────────────────────────────────
    miranda: { base: '#c0c0c6', paint: (p) => {
        p.patches({ count: 20, rMin: 30, rMax: 90, alphaMin: 0.10, alphaMax: 0.22,
            colors: ['70,70,78', '190,190,200'] });
        p.grooves({ sets: 16, linesPerSet: 8, color: '60,60,68', alpha: 0.20, spacing: 3 });
        p.grooves({ sets: 8, linesPerSet: 6, color: '235,235,240', alpha: 0.14, spacing: 3 });
        p.craters({ count: 70, rMin: 1, rMax: 5, floor: 0.16, rim: 0.14 });
        p.grain({ count: 800, alpha: 0.05 });
    }},

    ariel:   { base: '#c8c9d0', paint: (p) => {
        p.craters({ count: 110, rMin: 1, rMax: 6, floor: 0.14, rim: 0.15 });
        p.lineae({ count: 16, color: '90,92,100', widthMin: 1.5, widthMax: 3.5,
            alphaMin: 0.12, alphaMax: 0.22, len: 0.6 });                   // rift valleys
        p.grain({ count: 800, alpha: 0.045 });
    }},

    umbriel: { base: '#7e8188', paint: (p) => {
        p.craters({ count: 170, rMin: 1, rMax: 8, floor: 0.18, rim: 0.12 });
        p.region({ x: 0.42, y: 0.30, rx: 0.035, ry: 0.07, color: '255,255,255', alpha: 0.42 }); // Wunda
        p.grain({ count: 900, alpha: 0.05 });
    }},

    titania: { base: '#bcbbc2', paint: (p) => {
        p.craters({ count: 130, rMin: 1, rMax: 7, floor: 0.16, rim: 0.16 });
        p.lineae({ count: 12, color: '85,85,92', widthMin: 1.5, widthMax: 3,
            alphaMin: 0.12, alphaMax: 0.22, len: 0.7 });
        p.grain({ count: 800, alpha: 0.045 });
    }},

    oberon:  { base: '#a8a5ac', paint: (p) => {
        p.craters({ count: 175, rMin: 1, rMax: 8, floor: 0.19, rim: 0.15, rayChance: 0.18 });
        p.patches({ count: 12, rMin: 8, rMax: 22, alphaMin: 0.16, alphaMax: 0.30,
            colors: ['45,35,32'] });                                       // dark crater floors
        p.grain({ count: 900, alpha: 0.05 });
    }},

    // ── Neptune's moons ────────────────────────────────────────────────────
    triton: { hero: true, base: '#c3ccd9', paint: (p) => {
        // Cantaloupe terrain — overlapping dimpled cells with real contrast
        p.patches({ count: 180, rMin: 9, rMax: 26, alphaMin: 0.16, alphaMax: 0.34,
            colors: ['104,108,122', '248,250,255'] });
        p.patches({ count: 26, rMin: 50, rMax: 150, alphaMin: 0.14, alphaMax: 0.28,
            colors: ['232,176,164', '198,142,136'] });                  // tholin pink
        // Bright nitrogen-frost southern cap
        p.polarCap({ side: 1, extent: 0.34, color: '255,246,242', alpha: 0.72 });
        p.lineae({ count: 16, color: '92,84,88', widthMin: 0.8, widthMax: 2.2,
            alphaMin: 0.10, alphaMax: 0.20, len: 0.5 });
        // Dark geyser plume deposits streaked across the cap
        p.patches({ count: 14, rMin: 3, rMax: 10, alphaMin: 0.24, alphaMax: 0.44,
            colors: ['48,40,42'], yBias: (r) => 0.74 + r * 0.24 });
        p.grain({ count: 900, alpha: 0.04 });
    }},

    proteus: { base: '#7c8087', paint: (p) => {
        p.craters({ count: 130, rMin: 1, rMax: 8, floor: 0.20, rim: 0.14 });
        p.basin({ x: 0.55, y: 0.48, r: 0.09, floor: 0.22, rim: 0.20, peak: false });
        p.grain({ count: 800, alpha: 0.05 });
    }},

    nereid:  { base: '#95999f', paint: (p) => {
        p.craters({ count: 90, rMin: 1, rMax: 6, floor: 0.20, rim: 0.15 });
        p.grain({ count: 600, alpha: 0.05 });
    }},

    // ── Mars' moons + Amalthea: small, dark, battered ─────────────────────
    phobos: { base: '#8a7f74', paint: (p) => {
        p.craters({ count: 200, rMin: 1, rMax: 9, floor: 0.22, rim: 0.16 });
        p.basin({ x: 0.30, y: 0.44, r: 0.11, floor: 0.24, rim: 0.26 });    // Stickney
        p.lineae({ count: 26, color: '55,48,42', widthMin: 0.6, widthMax: 1.6,
            alphaMin: 0.10, alphaMax: 0.20, len: 0.5 });                   // grooves
        p.grain({ count: 1000, alpha: 0.06 });
    }},

    deimos: { base: '#a49a90', paint: (p) => {
        // Regolith blankets Deimos' craters — softer than Phobos
        p.patches({ count: 40, rMin: 15, rMax: 60, alphaMin: 0.06, alphaMax: 0.16,
            colors: ['200,190,180', '90,82,74'] });
        p.craters({ count: 90, rMin: 1, rMax: 6, floor: 0.13, rim: 0.09 });
        p.grain({ count: 900, alpha: 0.05 });
    }},

    amalthea: { base: '#a35f45', paint: (p) => {
        p.patches({ count: 30, rMin: 20, rMax: 70, alphaMin: 0.10, alphaMax: 0.24,
            colors: ['210,90,60', '120,50,35'] });                         // sulfur-stained red
        p.craters({ count: 120, rMin: 1, rMax: 8, floor: 0.22, rim: 0.14 });
        p.grain({ count: 900, alpha: 0.06 });
    }},

    // ── Dwarf planets & asteroids ─────────────────────────────────────────
    pluto: { hero: true, base: '#b9a08a', paint: (p) => {
        p.patches({ count: 44, rMin: 40, rMax: 150, alphaMin: 0.08, alphaMax: 0.22,
            colors: ['150,105,75', '90,60,45', '210,180,150'] });
        p.hemisphere({ center: 0.30, color: '55,32,22', alpha: 0.42, feather: 0.13 }); // Cthulhu Macula
        // Tombaugh Regio — the bright nitrogen-ice "heart"
        p.region({ x: 0.63, y: 0.56, rx: 0.10, ry: 0.20, color: '255,248,232', alpha: 0.72, softness: 0.5 });
        p.region({ x: 0.70, y: 0.52, rx: 0.07, ry: 0.15, color: '255,250,240', alpha: 0.55, softness: 0.55 });
        p.polarCap({ side: -1, extent: 0.14, color: '245,235,225', alpha: 0.35 });
        p.craters({ count: 40, rMin: 1, rMax: 6, floor: 0.10, rim: 0.08 });
        p.grain({ count: 1100, alpha: 0.045 });
    }},

    ceres: { hero: true, base: '#8d8a83', paint: (p) => {
        p.patches({ count: 34, rMin: 30, rMax: 110, alphaMin: 0.06, alphaMax: 0.16,
            colors: ['60,58,54', '120,116,110'] });
        p.craters({ count: 220, rMin: 1.2, rMax: 12, floor: 0.20, rim: 0.18, rayChance: 0.18 });
        // Occator's bright carbonate faculae
        p.region({ x: 0.42, y: 0.42, rx: 0.022, ry: 0.045, color: '255,255,250', alpha: 0.85, softness: 0.6 });
        p.region({ x: 0.46, y: 0.45, rx: 0.012, ry: 0.024, color: '255,255,250', alpha: 0.60, softness: 0.6 });
        p.grain({ count: 1400, alpha: 0.055 });
    }},

    pallas: { base: '#6e6c64', paint: (p) => {
        p.craters({ count: 190, rMin: 1, rMax: 9, floor: 0.22, rim: 0.16 });
        p.patches({ count: 24, rMin: 20, rMax: 70, alphaMin: 0.08, alphaMax: 0.20,
            colors: ['45,44,40', '110,108,100'] });
        p.grain({ count: 1000, alpha: 0.06 });
    }},

    haumea: { base: '#d8d6d0', paint: (p) => {
        p.patches({ count: 30, rMin: 40, rMax: 130, alphaMin: 0.05, alphaMax: 0.13,
            colors: ['255,255,255', '200,200,205'] });
        p.region({ x: 0.55, y: 0.50, rx: 0.06, ry: 0.13, color: '140,80,60', alpha: 0.30, softness: 0.6 });
        p.craters({ count: 30, rMin: 1, rMax: 5, floor: 0.09, rim: 0.09 });
        p.grain({ count: 700, alpha: 0.035 });
    }},

    makemake: { base: '#c19a80', paint: (p) => {
        p.patches({ count: 36, rMin: 40, rMax: 130, alphaMin: 0.07, alphaMax: 0.18,
            colors: ['160,105,75', '215,180,155', '110,70,55'] });          // tholin-reddened ice
        p.craters({ count: 26, rMin: 1, rMax: 5, floor: 0.10, rim: 0.08 });
        p.grain({ count: 800, alpha: 0.04 });
    }},

    eris: { base: '#dcdad6', paint: (p) => {
        // Among the most reflective surfaces in the solar system — fresh methane frost
        p.patches({ count: 30, rMin: 40, rMax: 140, alphaMin: 0.04, alphaMax: 0.10,
            colors: ['255,255,255', '205,205,210'] });
        p.craters({ count: 24, rMin: 1, rMax: 5, floor: 0.07, rim: 0.08 });
        p.grain({ count: 600, alpha: 0.03 });
    }},
};

// Fallback for any body without an explicit profile
const GENERIC = {
    rocky: (p) => {
        p.patches({ count: 40, rMin: 20, rMax: 80, alphaMin: 0.05, alphaMax: 0.16,
            colors: ['255,255,255', '0,0,0'] });
        p.craters({ count: 140, rMin: 1, rMax: 8, floor: 0.18, rim: 0.15 });
        p.grain({ count: 900, alpha: 0.05 });
    },
    icy: (p) => {
        p.patches({ count: 34, rMin: 40, rMax: 120, alphaMin: 0.04, alphaMax: 0.12,
            colors: ['255,255,255', '190,205,225'] });
        p.lineae({ count: 18, color: '150,170,195', widthMin: 0.6, widthMax: 2,
            alphaMin: 0.06, alphaMax: 0.16, len: 0.6 });
        p.grain({ count: 700, alpha: 0.035 });
    },
};

const cache = new Map();

/**
 * Build (or return a cached) CanvasTexture for a body.
 * @param {string} id      body id — selects the profile and seeds the RNG
 * @param {string} base    fallback base colour when the body has no profile
 * @param {'rocky'|'icy'} style  generic style used when there's no profile
 */
export function proceduralTexture(id, base, style = 'rocky') {
    const key = `${id}|${base}|${style}`;
    if (cache.has(key)) return cache.get(key);

    const profile = PROFILES[id];
    // Generated maps count against the same GPU budget as downloaded ones, so
    // their resolution follows the device tier too.
    const q = quality();
    const W = profile?.hero ? q.heroTextureSize : q.minorTextureSize;
    const H = W / 2;

    const canvas = document.createElement('canvas');
    canvas.width = W;
    canvas.height = H;
    const ctx = canvas.getContext('2d');

    const painter = makePainter(ctx, W, H, seededRand(id));
    painter.fill(profile?.base ?? base ?? '#8a8a8a');
    (profile?.paint ?? GENERIC[style] ?? GENERIC.rocky)(painter);

    const tex = new THREE.CanvasTexture(canvas);
    tex.colorSpace = THREE.SRGBColorSpace;
    tex.anisotropy = 4;
    cache.set(key, tex);
    return tex;
}

export function hasProfile(id) {
    return Object.prototype.hasOwnProperty.call(PROFILES, id);
}
