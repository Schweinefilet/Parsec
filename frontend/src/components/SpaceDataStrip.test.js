import { describe, it, expect } from 'vitest';

// The seamless-marquee guarantee, isolated from the DOM: for the loop to show
// no gap at any point in its cycle, the container must never be wider than
// (copies - 1) copy-widths — otherwise the visible window runs past the end
// of the rendered track before the wrap point arrives. This is exactly the
// condition the component's ResizeObserver callback maintains.
function copiesNeeded(containerWidth, perCopyWidth, margin = 2) {
    return Math.min(16, Math.max(2, Math.ceil(containerWidth / perCopyWidth) + margin));
}

function hasGap(containerWidth, perCopyWidth, copies) {
    // Worst case in the cycle: offset has reached -perCopyWidth (about to wrap).
    // The gap condition is containerWidth > (copies - 1) * perCopyWidth.
    return containerWidth > (copies - 1) * perCopyWidth;
}

describe('marquee copy count', () => {
    it('never leaves a gap, across realistic container and cell widths', () => {
        // Real numbers observed: ~1140px for one copy of the 7 telemetry cells.
        // Bounded below 16 copies, which is where the safety cap (below) takes
        // over instead of the width calculation.
        const perCopyWidths = [500, 1140, 2000];
        const containerWidths = [390, 820, 1280, 1728, 2560, 3840];
        for (const perCopy of perCopyWidths) {
            for (const container of containerWidths) {
                const copies = copiesNeeded(container, perCopy);
                expect(
                    hasGap(container, perCopy, copies),
                    `gap at container=${container} perCopy=${perCopy} copies=${copies}`,
                ).toBe(false);
            }
        }
    });

    // This is the regression: two fixed copies is exactly what shipped before,
    // and it gaps as soon as the container is wider than one copy — which a
    // full-viewport-width ticker on any normal desktop window is.
    it('fails the no-gap condition at a fixed 2 copies once the container widens', () => {
        const perCopy = 1140;
        expect(hasGap(1728, perCopy, 2)).toBe(true);
    });

    // The 16-copy ceiling exists to keep the DOM bounded; past it the no-gap
    // guarantee above no longer holds for pathologically narrow content on a
    // very wide screen (7 real cells never get close to this).
    it('stays within the copy cap for a very narrow copy on a huge screen', () => {
        expect(copiesNeeded(3840, 50)).toBe(16);
        expect(hasGap(3840, 50, 16)).toBe(true);
    });

    it('never asks for fewer than 2 copies, however much room there is to spare', () => {
        expect(copiesNeeded(50, 5000)).toBeGreaterThanOrEqual(2);
    });
});
