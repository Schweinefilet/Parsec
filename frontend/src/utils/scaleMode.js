// Compressed layout, or true distances.
//
// The scene is drawn with its radii squeezed — Earth's ring at 96 units and
// Neptune's at 340, where the real ratio is 1 to 30. That is what makes a
// picture of the solar system legible, and it is also a lie the "*not to scale"
// note in the corner has been apologising for. This is the toggle that tells
// the truth instead.
//
// Only distances change. Bodies keep their drawn sizes, because at true scale
// Earth would be four thousandths of a scene unit across and there would be
// nothing on screen at all — which is a fact worth stating in words rather than
// demonstrating with an empty view. The label says which half is honest.
//
// Held here rather than in React state for the same reason simTime is: the
// render loop reads it every frame, and a two-second transition should not be
// two hundred renders.

/** Scene units per AU once distances are true. Earth's present ring, so the
 *  inner system stays put and the outer planets are the ones that move. */
export const AU_UNITS = 96;

const DURATION_MS = 2200;

let from = 0;          // where the transition started
let to = 0;            // 0 compressed, 1 true
let startedAt = -Infinity;

const listeners = new Set();
const notify = () => listeners.forEach(fn => fn());

// Smooth at both ends, so the planets set off and arrive without a jerk
const ease = (t) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);

/** Whether true distances are selected — not whether the move has finished. */
export function isTrueScale() {
    return to === 1;
}

/** 0 fully compressed, 1 fully true, in between while it is moving. */
export function scaleProgress(now = Date.now()) {
    if (now >= startedAt + DURATION_MS) return to;
    const t = Math.max(0, (now - startedAt) / DURATION_MS);
    return from + (to - from) * ease(t);
}

/** True while the scene is still moving between the two layouts. */
export function isScaleSettling(now = Date.now()) {
    return now < startedAt + DURATION_MS;
}

export function setTrueScale(on, now = Date.now()) {
    const next = on ? 1 : 0;
    if (next === to) return;
    from = scaleProgress(now);      // reverse mid-flight without a jump
    to = next;
    startedAt = now;
    notify();
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

/** Test seam: drop straight to one layout or the other. */
export function __setScaleImmediate(on) {
    from = to = on ? 1 : 0;
    startedAt = -Infinity;
    notify();
}
