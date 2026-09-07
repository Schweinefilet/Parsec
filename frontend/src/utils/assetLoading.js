// What the scene is loading, for the loading screen to report.
//
// Imperative with a subscribe, like simTime and scaleMode: the scene is built
// once inside an effect with an empty dependency list, and anything it has to
// push out per asset cannot go through React state without re-running that
// effect or threading a ref through half the file.
//
// Every texture goes through one THREE.LoadingManager, so this is fed by that
// rather than by a list written by hand — a hand-written list is a list that
// goes stale the first time somebody adds a moon.

const listeners = new Set();

let state = {
    /** [{ key, name, done, failed }] in the order they started. */
    items: [],
    loaded: 0,
    total: 0,
    /** True once the manager has drained and the scene has drawn a frame. */
    done: false,
};

const byKey = new Map();

// Survives __resetAssets, which is per scene build; this is per page load.
let everReady = false;
export const assetsEverReady = () => everReady;

function emit() {
    state = { ...state, items: [...state.items] };
    for (const fn of listeners) fn(state);
}

export function subscribeAssets(fn) {
    listeners.add(fn);
    fn(state);
    return () => listeners.delete(fn);
}

export const assetState = () => state;

// "/textures/1k/earth_night.jpg" → "Earth night". Derived rather than mapped:
// a lookup table would need a line adding for every new file, and the one it
// was missing would be the one showing a URL to somebody.
const PRETTY = {
    'milky way': 'The Milky Way',
    'saturn ring': "Saturn's rings",
    'earth night': 'Earth at night',
    'earth clouds': "Earth's clouds",
};

export function assetName(url) {
    const file = String(url).split('/').pop().split('?')[0];
    const bare = file.replace(/\.(jpg|jpeg|png|webp|stl|bin|glb)$/i, '').replace(/[_-]+/g, ' ').trim();
    const key = bare.toLowerCase();
    if (PRETTY[key]) return PRETTY[key];
    return bare.charAt(0).toUpperCase() + bare.slice(1);
}

export function assetStarted(url) {
    if (byKey.has(url)) return;
    const item = { key: url, name: assetName(url), done: false, failed: false };
    byKey.set(url, item);
    state.items.push(item);
    state.total = state.items.length;
    emit();
}

export function assetFinished(url, failed = false) {
    const item = byKey.get(url);
    if (!item || item.done) return;
    item.done = true;
    item.failed = failed;
    state.loaded += 1;
    emit();
}

/**
 * The scene has drawn. Separate from the manager draining, because a texture
 * that has arrived is not the same as a texture that is on screen — the upload
 * to the GPU happens later, a couple per frame, and dismissing before the first
 * frame shows the black canvas the loading screen was covering.
 */
export function assetsSceneReady() {
    if (state.done) return;
    state.done = true;
    everReady = true;
    emit();
}

/** Test seam, and a fresh start when the scene remounts. */
export function __resetAssets() {
    byKey.clear();
    state = { items: [], loaded: 0, total: 0, done: false };
    emit();
}

// ── The logo handoff ─────────────────────────────────────────────────────────
// The loading screen's wordmark flies to the header's, and for that to land
// without a visible swap the header's own copy has to be invisible until the
// flight is over. The header owns that node, the loading screen owns the
// animation, and neither is a parent of the other — so it goes through here,
// the same way the scene's clock and layout already do.

const logoListeners = new Set();
let logoHeld = false;

function emitLogo() {
    for (const fn of logoListeners) fn(logoHeld);
}

export function subscribeLogo(fn) {
    logoListeners.add(fn);
    fn(logoHeld);
    return () => logoListeners.delete(fn);
}

/** The loading screen is drawing the wordmark; the header should not. */
export function holdLogo() {
    if (logoHeld) return;
    logoHeld = true;
    emitLogo();
}

/** The flight has landed. The header's copy is the one on screen from here. */
export function releaseLogo() {
    if (!logoHeld) return;
    logoHeld = false;
    emitLogo();
}
