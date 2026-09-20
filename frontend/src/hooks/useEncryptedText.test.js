import { describe, it, expect } from 'vitest';
import { cipherFrames, cipherText, CIPHER_LAYERS } from './useEncryptedText';

// The held scramble has no test the browser can fail visibly: a slot that
// draws the wrong glyph still draws *a* glyph, and a reel wound by the wrong
// number still turns. What can be pinned here are the invariants the look
// depends on — and CIPHER_LAYERS, which is the same number as the steps() and
// the wind in the .cipher-drum rule in index.css and cannot drift from them.

const NAME = 'P4RSEC';

describe('cipherFrames', () => {
    it('gives every letter and digit a full reel', () => {
        const frames = cipherFrames(NAME);
        expect(frames).toHaveLength(NAME.length);
        for (const [i, f] of frames.entries()) {
            expect(f.glyphs, `slot ${i}`).toHaveLength(CIPHER_LAYERS);
        }
    });

    it('never shows a slot the letter it is going to become', () => {
        // A slot that flashes its own answer mid-scramble reads as a letter
        // that landed and then came loose again.
        for (let run = 0; run < 200; run++) {
            for (const [i, f] of cipherFrames(NAME).entries()) {
                expect(f.glyphs, `slot ${i}`).not.toContain(NAME[i]);
            }
        }
    });

    it('never repeats a glyph across the seam or back to back', () => {
        // Either one reads as the scramble catching for a beat — and the seam
        // matters because the reel loops.
        for (let run = 0; run < 200; run++) {
            for (const { glyphs } of cipherFrames(NAME)) {
                for (let k = 1; k < glyphs.length; k++) {
                    expect(glyphs[k]).not.toBe(glyphs[k - 1]);
                }
                expect(glyphs[glyphs.length - 1]).not.toBe(glyphs[0]);
            }
        }
    });

    it('starts every slot at its own rate and part-way round', () => {
        // Six slots in step would loop visibly as a word even though each
        // letter is only looping as a letter.
        for (const { cycle, phase } of cipherFrames(NAME)) {
            expect(cycle).toBeGreaterThanOrEqual(340);
            expect(cycle).toBeLessThanOrEqual(520);
            expect(phase).toBeLessThanOrEqual(0);
            expect(phase).toBeGreaterThanOrEqual(-cycle);
        }
    });

    it('leaves punctuation and spacing alone', () => {
        // Structure rather than content: a wordmark whose punctuation jitters
        // reads as broken rather than as encrypted.
        for (const f of cipherFrames('A B-C')) {
            if (f.glyphs === null) expect(f.cycle).toBe(0);
        }
        expect(cipherFrames('A B-C').map(f => f.glyphs === null))
            .toEqual([false, true, false, true, false]);
    });
});

describe('cipherText', () => {
    it('is full length and settled at both ends of the decode', () => {
        expect(cipherText(NAME, 0)).toHaveLength(NAME.length);
        expect(cipherText(NAME, 1)).toBe(NAME);
    });

    it('settles left to right and never comes loose again', () => {
        // The flight lands on whatever this last returned, so a character that
        // un-settles would fly to the header as ciphertext.
        for (let step = 0; step <= 10; step++) {
            const p = step / 10;
            const settled = Math.floor(p * NAME.length);
            const out = cipherText(NAME, p);
            expect(out.slice(0, settled)).toBe(NAME.slice(0, settled));
        }
    });

    it('holds the unsettled tail at the same width', () => {
        for (let step = 0; step <= 10; step++) {
            expect(cipherText(NAME, step / 10)).toHaveLength(NAME.length);
        }
    });
});
