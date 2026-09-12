// The cinematic hand-off from the solar-system scene into /sky: focus Earth,
// dive to the observer's real spot on the globe, turn ~180° away from the
// ground, then let a curtain hide the cut to the night-sky route.
//
// Two components share one sequence across a route change that unmounts one
// of them, so — same reasoning as simTime.js/driftControl.js — the state
// lives here as a module singleton, not React state. SolarSystem3D.jsx owns
// the camera choreography (it is the only place with the Earth mesh's live
// transform) and drives phases 'armed' -> 'diving' -> 'turning' -> 'curtain'.
// SkyEntryCurtain.jsx only watches for 'curtain', fades to opaque, navigates,
// then calls resetSkyEntry() once the fade back out finishes. Neither side
// needs to know the other's internals, only this phase name.
//
// armSkyEntry() is called from wherever the /sky nav icon or the /tonight
// "See in 3D" CTA lives (AppShell.jsx, TonightPage.jsx) — both already know
// the observer's location, and both just navigate to /object/earth right
// after arming: whether that lands on an already-mounted scene or mounts a
// fresh one, the existing focus-on-Earth fly-in is what SolarSystem3D uses
// to notice the armed flag and take over.

export const IDLE = 'idle';
export const ARMED = 'armed';
export const DIVING = 'diving';
export const TURNING = 'turning';
export const CURTAIN = 'curtain';

// If the scene never picks the armed flag up — no Earth mesh yet, a stalled
// mount, some edge case that isn't a plain refocus-away — this is the
// failsafe that still lands the visitor on /sky rather than stranding the
// nav icon's click. Mirrors LoadingScreen.jsx's own FAILSAFE_MS philosophy.
const WATCHDOG_MS = 7000;

let phase = IDLE;
let observer = null; // { lat, lon } in degrees
let watchdog = null;

const listeners = new Set();
const notify = () => listeners.forEach(fn => fn());

function clearWatchdog() {
    if (watchdog !== null) { clearTimeout(watchdog); watchdog = null; }
}

/** Starts the sequence. A no-op while one is already in flight. */
export function armSkyEntry({ lat, lon }) {
    if (phase !== IDLE) return;
    observer = { lat, lon };
    phase = ARMED;
    clearWatchdog();
    watchdog = setTimeout(() => {
        if (phase !== IDLE && phase !== CURTAIN) setSkyEntryPhase(CURTAIN);
    }, WATCHDOG_MS);
    notify();
}

/** idle | armed | diving | turning | curtain */
export const getSkyEntryPhase = () => phase;

/** The observer this sequence is diving toward, or null while idle. */
export const getSkyEntryObserver = () => observer;

/** Advances (or aborts to) a phase. SolarSystem3D drives armed→diving→turning→curtain. */
export function setSkyEntryPhase(next) {
    if (next === phase) return;
    phase = next;
    if (next === IDLE) { observer = null; clearWatchdog(); }
    notify();
}

/** Cancels an in-flight sequence — the user refocused away from Earth, or the scene unmounted mid-flight. */
export function resetSkyEntry() {
    setSkyEntryPhase(IDLE);
}

export function subscribeSkyEntry(fn) {
    listeners.add(fn);
    return () => listeners.delete(fn);
}

/** Test seam. */
export function __resetSkyEntry() {
    phase = IDLE;
    observer = null;
    clearWatchdog();
    listeners.clear();
}
