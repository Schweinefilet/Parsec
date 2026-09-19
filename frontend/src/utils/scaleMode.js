// How honest the scene's layout is, in three stages.
//
// The scene is drawn with its radii squeezed — Earth's ring at 96 units and
// Neptune's at 340, where the real ratio is 1 to 30 — and with every body far
// too big for the space it sits in. That is what makes a picture of the solar
// system legible, and it is also a lie the "*not to scale" note in the corner
// has been apologising for. These are the stages that tell the truth instead:
//
//   0  compressed          the drawn layout, legible and false
//   1  true distances      rings move to their real radii, bodies stay drawn
//   2  true distances+sizes  one single scale for the whole scene
//
// Stage 2 is deliberately merciless. At one scale a unit is 1.56 million km,
// so Earth is four thousandths of a unit across while its orbit is ninety-six
// — every body in the scene is far below a pixel from the default *camera*
// framing, and what is left on screen is orbit rings, labels and a great deal
// of nothing. That emptiness is the honest picture, and nothing here props it
// up with a minimum dot size: fly to a body and it grows into its real
// proportions, which is the only way anything in this solar system is ever
// actually seen.
//
// Stage 2 is also where the site now opens (`stage` below), at the owner's
// request — every fresh page load starts here rather than at stage 0, since
// nothing persists a visitor's choice across visits and this module's default
// is therefore the site's default. A shared-view link still overrides it
// (CategoryBrowser reads `sharedView.scaleStage` once on mount), and cycling
// still runs 0 → 1 → 2 → 0 starting whichever stage you're on.
//
// Held here rather than in React state for the same reason simTime is: the
// render loop reads it every frame, and a two-second transition should not be
// two hundred renders.

/** Scene units per AU once distances are true. Earth's present ring, so the
 *  inner system stays put and the outer planets are the ones that move. */
export const AU_UNITS = 96;

/** IAU astronomical unit, in km. */
export const AU_KM = 149_597_870.7;

/** Kilometres to a scene unit once the whole scene is on one scale. */
export const KM_PER_UNIT = AU_KM / AU_UNITS;

export const SCALE_COMPRESSED = 0;
export const SCALE_DISTANCES  = 1;
export const SCALE_SIZES      = 2;
export const SCALE_STAGES     = 3;

const DURATION_MS = 2200;

// Two channels — how true the distances are, and how true the sizes are —
// eased on one shared clock. Cycling from stage 2 back to 0 moves both at
// once, which is the only case where they travel together.
//
// Starting both channels already at 1, with startedAt left at -Infinity
// (channel() below returns `to` outright once `now` has cleared
// startedAt + DURATION_MS, which -Infinity always has), lands the very first
// frame already at true distances and true sizes with nothing to animate —
// the opening view is the resting state, not a transition into it.
let distFrom = 1, distTo = 1;
let sizeFrom = 1, sizeTo = 1;
let startedAt = -Infinity;
let stage = SCALE_SIZES;

const listeners = new Set();
const notify = () => listeners.forEach(fn => fn());

// Smooth at both ends, so the planets set off and arrive without a jerk
const ease = (t) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);

const channel = (from, to, now) => {
    if (now >= startedAt + DURATION_MS) return to;
    const t = Math.max(0, (now - startedAt) / DURATION_MS);
    return from + (to - from) * ease(t);
};

/** 0 compressed, 1 true distances, 2 true distances and sizes. */
export const getScaleStage = () => stage;

/** Whether true distances are selected — not whether the move has finished. */
export function isTrueScale() {
    return distTo === 1;
}

/** Whether true sizes are selected — not whether the move has finished. */
export function isTrueSize() {
    return sizeTo === 1;
}

/** 0 fully compressed, 1 fully true, in between while it is moving. */
export function scaleProgress(now = Date.now()) {
    return channel(distFrom, distTo, now);
}

/** 0 drawn sizes, 1 true sizes, in between while it is moving. */
export function sizeProgress(now = Date.now()) {
    return channel(sizeFrom, sizeTo, now);
}

/** True while the scene is still moving between layouts. */
export function isScaleSettling(now = Date.now()) {
    return now < startedAt + DURATION_MS;
}

export function setScaleStage(next, now = Date.now()) {
    const clamped = Math.max(0, Math.min(SCALE_STAGES - 1, Math.round(next)));
    if (clamped === stage) return;
    // Catch both channels where they actually are, so reversing or skipping
    // mid-flight starts from the frame on screen rather than jumping.
    distFrom = scaleProgress(now);
    sizeFrom = sizeProgress(now);
    stage    = clamped;
    distTo   = clamped >= SCALE_DISTANCES ? 1 : 0;
    sizeTo   = clamped >= SCALE_SIZES ? 1 : 0;
    startedAt = now;
    notify();
}

/** compressed → true distances → true distances and sizes → compressed. */
export function cycleScaleStage() {
    setScaleStage((stage + 1) % SCALE_STAGES);
}

/** Distances only, leaving sizes drawn. The shared-view link's older form. */
export function setTrueScale(on, now = Date.now()) {
    setScaleStage(on ? SCALE_DISTANCES : SCALE_COMPRESSED, now);
}

export function toggleTrueScale() {
    setTrueScale(!isTrueScale());
}

export function subscribeScale(fn) {
    listeners.add(fn);
    return () => listeners.delete(fn);
}

/**
 * The radial factor to apply to something drawn at `compressed` scene units
 * whose true distance is `au` astronomical units.
 *
 * Every position in the scene is a direction times one of these, so a body, its
 * orbit ring and its share of a belt all move together by construction.
 */
export function radialFactor(compressedUnits, au, progress) {
    if (!(compressedUnits > 0) || !(au > 0)) return 1;
    const trueUnits = au * AU_UNITS;
    return 1 + (trueUnits / compressedUnits - 1) * progress;
}

/**
 * The factor to scale something drawn at `drawnUnits` scene units whose true
 * radius (or separation) is `km`, at size-progress `progress`.
 *
 * Same shape as radialFactor, and used the same way: a body, its atmosphere
 * shell, its rings and its moons' orbits all take one of these, so a system
 * shrinks as a piece rather than coming apart.
 */
export function sizeFactor(drawnUnits, km, progress) {
    if (!(drawnUnits > 0) || !(km > 0)) return 1;
    const trueUnits = km / KM_PER_UNIT;
    return 1 + (trueUnits / drawnUnits - 1) * progress;
}

/** Test seam: drop straight to a stage. Accepts the old boolean too. */
export function __setScaleImmediate(next) {
    const s = next === true ? SCALE_DISTANCES : next === false ? SCALE_COMPRESSED : next;
    stage    = Math.max(0, Math.min(SCALE_STAGES - 1, Math.round(s)));
    distFrom = distTo = stage >= SCALE_DISTANCES ? 1 : 0;
    sizeFrom = sizeTo = stage >= SCALE_SIZES ? 1 : 0;
    startedAt = -Infinity;
    notify();
}
