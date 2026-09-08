import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

// jsdom does no layout, so a stylesheet bug cannot be caught by rendering. It
// can be caught by reading, and one class of it is worth reading for: mixing a
// logical inset with the physical property it resolves to.
//
// This is not hypothetical. `.skip-link` was written as
//
//     inset-inline-start: -9999px;
//     left: auto;
//
// intending the second line as a reset of the old physical rule. In a
// left-to-right page those two *are the same property*, the later declaration
// wins, and `auto` parks an absolutely positioned element at its static
// position — so the "Skip to catalog" link, which exists to be invisible until
// focused, sat in the top corner of every page in the default language. It
// shipped, because every test passed and the language it broke was the one
// nobody thought to look at.

/** Rule blocks, as { selector, body }. Good enough for a flat stylesheet. */
function rules(text) {
    const out = [];
    const re = /([^{}]+)\{([^{}]*)\}/g;
    let m;
    while ((m = re.exec(text)) !== null) {
        const selector = m[1].trim().replace(/\s+/g, ' ');
        if (selector.startsWith('@')) continue;   // at-rule preludes
        out.push({ selector, body: m[2] });
    }
    return out;
}

// Read off disk rather than imported: `?raw` on a stylesheet goes through
// Vite's CSS pipeline first and comes back empty, and this test is about the
// source text, not about what the bundler makes of it.
const css = readFileSync(resolve(process.cwd(), 'src/index.css'), 'utf8');

const CONFLICTS = [
    ['inset-inline-start', ['left', 'right']],
    ['inset-inline-end', ['left', 'right']],
    ['margin-inline-start', ['margin-left', 'margin-right']],
    ['margin-inline-end', ['margin-left', 'margin-right']],
    ['padding-inline-start', ['padding-left', 'padding-right']],
    ['padding-inline-end', ['padding-left', 'padding-right']],
];

const declares = (body, prop) =>
    new RegExp(String.raw`(^|;|\})\s*${prop}\s*:`, 'm').test(body);

describe('the stylesheet', () => {
    it('never sets a logical inset and its physical twin in the same rule', () => {
        const clashes = [];
        for (const { selector, body } of rules(css)) {
            for (const [logical, physicals] of CONFLICTS) {
                if (!declares(body, logical)) continue;
                for (const physical of physicals) {
                    if (declares(body, physical)) {
                        clashes.push(`${selector} { ${logical} + ${physical} }`);
                    }
                }
            }
        }
        expect(clashes).toEqual([]);
    });

    it('keeps the skip link off screen until it is focused', () => {
        const link = rules(css).find(r => r.selector === '.skip-link');
        const focused = rules(css).find(r => r.selector === '.skip-link:focus');
        expect(link, '.skip-link rule').toBeTruthy();
        expect(focused, '.skip-link:focus rule').toBeTruthy();
        // Positioned, parked off the start edge, and brought back on focus.
        expect(link.body).toMatch(/position:\s*absolute/);
        expect(link.body).toMatch(/inset-inline-start:\s*-\d{3,}/);
        expect(focused.body).toMatch(/inset-inline-start:\s*0/);
        // And nothing in either that could win over those.
        expect(link.body).not.toMatch(/(^|;)\s*(left|right):/m);
        expect(focused.body).not.toMatch(/(^|;)\s*(left|right):/m);
    });

    it('turns the directional icons around, and only those', () => {
        expect(css).toMatch(/:root\[dir="rtl"\]\s*\.flip-rtl\s*\{[^}]*scaleX\(-1\)/);
    });
});
