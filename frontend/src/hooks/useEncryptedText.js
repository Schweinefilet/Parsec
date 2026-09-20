import { useEffect, useRef, useState } from 'react';
import { useReducedMotion } from './useMediaQuery';

/**
 * Drives one decode of text that arrives as ciphertext and resolves into
 * itself — after Aceternity UI's EncryptedText.
 *
 * Theirs is one component that owns both the animation and the markup. The
 * cipher lives apart from the drawing here because the loading screen needs one
 * decode driving *two* copies of the wordmark: the flying mark is a gold copy
 * stacked over a white one, cross-fading on opacity, and if each ran its own
 * scramble the two would land different letters on the same frame and the
 * cross-fade would show it. This runs the cipher once; components/EncryptedText
 * draws whatever it is currently saying.
 *
 * The string is at full length from the first frame rather than typing itself
 * on, so the opening reads as something being decoded rather than something
 * being written — and the wordmark does not grow across the screen while the
 * scene behind it is trying to load.
 *
 * Returns the ciphertext as it currently stands, how far through it is (0–1,
 * for anything that wants to resolve alongside it) and whether it has settled.
 */

// No I, J, M or W: the cipher runs at the wordmark's own tracking, and glyphs
// that wide or that narrow make the undecoded tail visibly breathe.
const CIPHER = 'ABCDEFGHKLNOPQRSTUVXYZ0123456789';

// Only letters and digits are scrambled. Anything else in the string is
// structure rather than content, and a wordmark whose punctuation jitters
// reads as broken rather than as encrypted.
const SCRAMBLED = /[\p{L}\p{N}]/u;

/**
 * How many glyphs a held slot cycles through before it repeats.
 *
 * Coupled to the `.cipher-drum` rule in index.css in two places at once: the
 * `steps(6, end)`, and the `* -6` the reel is wound by. The drum is this many
 * rows tall and is wound through exactly that many rows, so all three are the
 * same number or the reel stops in between glyphs.
 */
export const CIPHER_LAYERS = 6;

/**
 * The glyphs a held wordmark cycles through, one set per character, for the
 * stretch before the decode is let go.
 *
 * That scramble cannot be driven from here: it runs while the scene is being
 * built, and the main thread is blocked solid for seconds at a time doing it,
 * so a timer ticking a string produces one painted frame and then nothing.
 * What it produces instead is a fixed set of candidates per character, which
 * components/EncryptedText stacks into a reel and hands to CSS — a transform
 * animation runs on the compositor and keeps going through a blocked main
 * thread, which is the whole reason the orrery on the same screen never
 * stutters.
 *
 * Every slot gets its own cycle length and its own starting phase, so the six
 * of them are out of step from the first frame and the wordmark as a whole
 * never visibly loops even though each letter does. None of them can show the
 * letter it is going to become: a slot that flashes its own answer mid-scramble
 * reads as a letter that has landed and then come loose again.
 */
export function cipherFrames(text, layers = CIPHER_LAYERS) {
    const out = [];
    for (let i = 0; i < text.length; i++) {
        const ch = text[i];
        if (!SCRAMBLED.test(ch)) { out.push({ glyphs: null, cycle: 0 }); continue; }
        const pool = CIPHER.replace(ch.toUpperCase(), '');
        const glyphs = [];
        for (let k = 0; k < layers; k++) {
            let g;
            // Never twice in a row, and never the same at both ends of the
            // loop — either one reads as the scramble catching for a beat.
            do { g = pool[(Math.random() * pool.length) | 0]; }
            while (g === glyphs[k - 1] || (k === layers - 1 && g === glyphs[0]));
            glyphs.push(g);
        }
        const cycle = Math.round(340 + Math.random() * 180);
        // Negative, so the reel is already part-way round on the first frame
        // rather than every letter starting on its first glyph together.
        out.push({ glyphs, cycle, phase: -Math.round(Math.random() * cycle) });
    }
    return out;
}

export function cipherText(text, progress) {
    const settled = Math.floor(progress * text.length);
    let out = '';
    for (let i = 0; i < text.length; i++) {
        const ch = text[i];
        out += (i < settled || !SCRAMBLED.test(ch))
            ? ch
            : CIPHER[(Math.random() * CIPHER.length) | 0];
    }
    return out;
}

/**
 * `start` is the go signal. Before it comes, `shown` is null: the wordmark is
 * on screen at full length and scrambling, but it is CSS doing that (see
 * `cipherFrames`), not this, and the decode is the moment it comes good. The
 * caller holds it because the decode is a real-time animation and the main
 * thread is not always able to run one — see the loading screen, which waits
 * for the scene to stop building before it lets this go.
 *
 * Reduced motion gets the plain string, settled, from the first frame — the
 * durations index.css collapses are CSS ones, and this is a timer.
 */
export function useEncryptedText(text, {
    duration = 1400, interval = 55, enabled = true, start = true,
} = {}) {
    const reduced = useReducedMotion();
    const live = enabled && !reduced;
    // Ciphertext from the very first paint, not an empty box that fills in.
    // `shown: null` is the held state, and means "not saying anything yet" —
    // EncryptedText draws the CSS scramble over the slot instead.
    const [state, setState] = useState(() => (
        live
            ? { shown: start ? cipherText(text, 0) : null, progress: 0 }
            : { shown: text, progress: 1 }
    ));

    // The string is the only dependency that should restart a decode. A locale
    // switch changes it; a parent re-rendering every 55ms must not.
    const textRef = useRef(text);
    textRef.current = text;

    useEffect(() => {
        if (!live) { setState({ shown: text, progress: 1 }); return undefined; }
        // Held: the slots are scrambling in CSS and this has nothing to say.
        if (!start) { setState({ shown: null, progress: 0 }); return undefined; }
        setState({ shown: cipherText(text, 0), progress: 0 });
        // Measured against the clock rather than counted in ticks, so a frame
        // the main thread is too busy to deliver shortens the decode instead of
        // stretching it — the string still comes good when it said it would.
        const began = performance.now();
        const id = setInterval(() => {
            const p = Math.min(1, (performance.now() - began) / duration);
            setState({ shown: cipherText(textRef.current, p), progress: p });
            if (p >= 1) clearInterval(id);
        }, interval);
        return () => clearInterval(id);
    }, [text, duration, interval, live, start]);

    return { ...state, done: state.progress >= 1 };
}
