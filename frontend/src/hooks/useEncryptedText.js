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
 * Reduced motion gets the plain string, settled, from the first frame — the
 * durations index.css collapses are CSS ones, and this is a timer.
 */
export function useEncryptedText(text, { duration = 1400, interval = 55, enabled = true } = {}) {
    const reduced = useReducedMotion();
    const live = enabled && !reduced;
    // Ciphertext from the very first paint, not an empty box that fills in.
    const [state, setState] = useState(() => (
        live ? { shown: cipherText(text, 0), progress: 0 } : { shown: text, progress: 1 }
    ));

    // The string is the only dependency that should restart a decode. A locale
    // switch changes it; a parent re-rendering every 55ms must not.
    const textRef = useRef(text);
    textRef.current = text;

    useEffect(() => {
        if (!live) { setState({ shown: text, progress: 1 }); return undefined; }
        setState({ shown: cipherText(text, 0), progress: 0 });
        // Measured against the clock rather than counted in ticks, so a frame
        // the main thread is too busy to deliver — which, on this screen, is
        // most of them — shortens the decode instead of stretching it.
        const start = performance.now();
        const id = setInterval(() => {
            const p = Math.min(1, (performance.now() - start) / duration);
            setState({ shown: cipherText(textRef.current, p), progress: p });
            if (p >= 1) clearInterval(id);
        }, interval);
        return () => clearInterval(id);
    }, [text, duration, interval, live]);

    return { ...state, done: state.progress >= 1 };
}
