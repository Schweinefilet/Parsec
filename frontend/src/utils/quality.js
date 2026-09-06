// Device-appropriate render settings.
//
// The scene was authored for a desktop GPU: 4K maps on every planet came to
// roughly 400 MB of GPU texture memory, which is over what mobile Safari will
// hand a tab. Past that limit iOS does not warn — it drops textures, stalls, or
// kills the page, which is what "loads poorly on iPhone" looked like.
//
// So quality is chosen once at startup and everything expensive reads from it:
// texture resolution, device pixel ratio, shadows, belt density, and geometry
// detail.

/** @typedef {'low'|'medium'|'high'} Tier */

function detectTier() {
    if (typeof window === 'undefined') return 'high';

    const coarse = window.matchMedia?.('(pointer: coarse)').matches ?? false;
    const shortSide = Math.min(window.screen?.width ?? 1920, window.screen?.height ?? 1080);
    const cores = navigator.hardwareConcurrency ?? 8;
    // Chrome-only, absent on Safari — treated as "unknown", not "low"
    const memory = navigator.deviceMemory ?? null;

    // Phones: a coarse pointer on a small screen. This is the tier that has to
    // fit inside mobile Safari's budget, so it is deliberately conservative.
    if (coarse && shortSide <= 480) return 'low';

    // Tablets, and any device advertising few cores or little memory
    if (coarse || cores <= 4 || (memory !== null && memory <= 4)) return 'medium';

    return 'high';
}

const TIERS = {
    low: {
        texturePath: '/textures/1k/',
        maxPixelRatio: 1.5,
        pixelBudget: 1_100_000,
        shadows: false,
        // Analytic ring/moon shadows are cheap (no shadow map) so they stay on
        planetSegments: 32,
        moonSegments: 24,
        skySegments: 24,
        beltParticles: { asteroid: 1200, kuiper: 1600 },
        beltLOD: false,          // instanced STL asteroids: skip entirely
        beltLODRotate: false,
        // No Milky Way sphere on phones. It is a full-screen backdrop with an
        // 8192-wide map behind it, which is the worst possible shape for a
        // mobile GPU: maximum overdraw for something you look past.
        skyTexture: null,
        heroTextureSize: 512,    // procedural map resolution for close-up bodies
        minorTextureSize: 256,
        // Kept on: tile-based mobile GPUs resolve MSAA cheaply, and without it
        // planet limbs stair-step badly at this pixel ratio. The savings that
        // matter on this tier are texture memory and fill rate, not this.
        antialias: true,
        starCount: 70,
    },
    medium: {
        texturePath: '/textures/',
        maxPixelRatio: 2,
        pixelBudget: 2_200_000,
        shadows: true,
        planetSegments: 48,
        moonSegments: 32,
        skySegments: 48,
        beltParticles: { asteroid: 2200, kuiper: 3200 },
        beltLOD: true,
        beltLODRotate: false,    // build the instances once, don't spin them per frame
        skyTexture: 'milky_way.jpg',            // 2K
        heroTextureSize: 1024,
        minorTextureSize: 512,
        antialias: true,
        starCount: 140,
    },
    high: {
        texturePath: '/textures/',
        maxPixelRatio: 2,
        pixelBudget: 3_200_000,
        shadows: true,
        planetSegments: 64,
        moonSegments: 48,
        skySegments: 64,
        beltParticles: { asteroid: 3500, kuiper: 5000 },
        beltLOD: true,
        beltLODRotate: true,
        // Desktop gets the full 8K sky. It costs ~170 MB of GPU texture memory,
        // which only a discrete/desktop GPU should be asked for — but it is the
        // difference between a starfield and a Milky Way.
        skyTexture: '8k/milky_way.jpg',
        heroTextureSize: 1024,
        minorTextureSize: 512,
        antialias: true,
        starCount: 260,
    },
};

let cached = null;

/** Render settings for this device. Resolved once and reused. */
export function quality() {
    if (!cached) {
        const tier = detectTier();
        cached = { tier, ...TIERS[tier] };
    }
    return cached;
}

/** Full URL for a texture, at the resolution this device should load. */
export function texturePath(file) {
    return quality().texturePath + file;
}

/**
 * Device pixel ratio to render a canvas of this CSS size at.
 *
 * A flat DPR cap ignores how big the surface is: an iPad at 820x1180 and DPR 2
 * is 3.9 million fragments, three times a typical laptop, which is why tablets
 * struggled even though their GPU is fine. Budgeting total pixels scales the
 * ratio down only when the surface is genuinely large.
 */
export function pixelRatioFor(cssWidth, cssHeight) {
    const q = quality();
    const dpr = Math.min(window.devicePixelRatio || 1, q.maxPixelRatio);
    const area = Math.max(1, cssWidth * cssHeight);
    const fitted = Math.sqrt(q.pixelBudget / area);
    // Never below 1 — sub-native rendering looks worse than a slower frame rate
    return Math.max(1, Math.min(dpr, fitted));
}

/** Test seam: force a tier regardless of what the device reports. */
export function __setTier(tier) {
    cached = tier ? { tier, ...TIERS[tier] } : null;
}
