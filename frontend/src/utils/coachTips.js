// First-visit tips take turns.
//
// A phone has very little free screen, and three separate things used to claim
// it at once: the burger tip armed on a timer from the moment the page mounted
// (so it ran out under the loading screen, or appeared on top of the greeting's
// title), while the speed and settings tips armed on the first touch and could
// overlap it. Nothing knew about anything else.
//
// Anything that a tip must not appear over, or alongside, *holds* the tips
// under a name. A tip that wants to show waits until nothing holds them.
// Imperative with a subscribe, like simTime and assetLoading, because the
// holders (the loading screen, the greeting) and the waiter (the header) are
// siblings with no common parent state to lift into.

const holds = new Set();
const listeners = new Set();

function emit() {
    const held = holds.size > 0;
    for (const fn of listeners) fn(held);
}

/** Something is in the tips' way — until it calls releaseTips with the same name. */
export function holdTips(name) {
    if (holds.has(name)) return;
    holds.add(name);
    emit();
}

export function releaseTips(name) {
    if (holds.delete(name)) emit();
}

export const tipsHeld = () => holds.size > 0;

/** Calls `fn(held)` now and on every change. Returns the unsubscribe. */
export function subscribeTips(fn) {
    listeners.add(fn);
    fn(holds.size > 0);
    return () => listeners.delete(fn);
}

/** Test seam. */
export function __resetTips() {
    holds.clear();
    emit();
}
