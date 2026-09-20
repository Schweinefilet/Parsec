import { useEffect } from 'react';

// How much of a card has to be covered before it has finished receding, and
// how far back it goes. 120px is about the depth of a heading — far enough
// that the recede tracks the scroll rather than snapping, short enough that a
// card is settled behind its neighbour by the time it is mostly hidden. 0.94
// reads as "behind" at a glance without the card's edges visibly swinging
// inward as you drag.
const TUCK_TRAVEL = 120;
// How much smaller a card gets for each full card covering it, and how many
// levels deep the stack keeps counting. Depth accumulates: a card with two
// cards over it sits further back than one with a single card over it, which is
// what makes the pile read as a pile rather than as two cards at the same size.
// The cap stops the card at the bottom of a long sheet shrinking to nothing.
//
// 0.12 a level, where this was once 0.06 in total — by request, so a covered
// card reads as having gone behind rather than as having been cropped. Most
// sheets only ever tuck one card (a three-card sheet with one opted out of
// pinning has exactly one that can recede), so the first level has to carry the
// effect on its own; the accumulation is what the longer spacecraft sheets get.
const TUCK_STEP = 0.12;
const TUCK_MAX_LEVELS = 2;

/**
 * The recede half of the detail sheet's card stack (`.detail-stack` in
 * index.css).
 *
 * Sticky alone already puts the outgoing card behind the incoming one, but
 * both stay full size, so the card being covered reads as cropped rather than
 * as tucked underneath. Each pinned card is scaled down here by however much
 * of it the next card has covered, anchored at its own top edge: the strip of
 * it still showing narrows as it sinks, which is what depth looks like.
 *
 * Runs outside React, the way anything that moves with the scroll has to —
 * the transform is written straight to the node inside a rAF and no state is
 * touched. The render only decides whether it is on at all.
 *
 * Two measurement notes. `transform-origin: top center` (set in the CSS
 * alongside the sticky rule) is what makes `rect.top` safe to read back: a
 * top-anchored scale does not move it. `rect.height` is not safe — that is the
 * *scaled* height, and feeding it into the next frame's maths is a loop that
 * settles on the wrong number — so coverage is measured against `offsetHeight`,
 * which is the layout height and ignores the transform.
 */
export function useCardStack(scrollerRef, enabled) {
    useEffect(() => {
        const scroller = scrollerRef.current;
        if (!enabled || !scroller) return;
        const stack = scroller.querySelector('.detail-stack');
        if (!stack || typeof ResizeObserver !== 'function') return;

        let frame = 0;
        const apply = () => {
            frame = 0;
            const cards = [...stack.children];
            // Front to back, carrying the depth forward: each card sits as far
            // back as the one in front of it, plus however much of itself that
            // card has covered. Reading the rects is safe in either order,
            // because a top-anchored scale does not move them.
            let depth = 0;
            for (let i = cards.length - 1; i >= 0; i--) {
                const card = cards[i];
                const next = cards[i + 1];
                // The last card, and any card that opted out of pinning, never
                // goes behind anything — it is the one doing the covering.
                if (!next || card.classList.contains('detail-stack-flow')) {
                    card.style.transform = '';
                    continue;
                }
                const height = card.offsetHeight;
                const covered = card.getBoundingClientRect().top + height
                    - next.getBoundingClientRect().top;
                const travel = Math.min(TUCK_TRAVEL, height);
                const p = Math.min(1, Math.max(0, covered / travel));
                depth = Math.min(TUCK_MAX_LEVELS, depth + p);
                card.style.transform = depth > 0 ? `scale(${1 - TUCK_STEP * depth})` : '';
            }
        };
        const schedule = () => { if (!frame) frame = requestAnimationFrame(apply); };

        apply();
        scroller.addEventListener('scroll', schedule, { passive: true });
        // The column's height changes whenever a card does — switching the
        // stats panel's tab is the common one — and that moves every card
        // below it without the sheet having been scrolled at all.
        const ro = new ResizeObserver(schedule);
        ro.observe(stack);

        return () => {
            if (frame) cancelAnimationFrame(frame);
            scroller.removeEventListener('scroll', schedule);
            ro.disconnect();
            for (const card of stack.children) card.style.transform = '';
        };
    }, [scrollerRef, enabled]);
}
