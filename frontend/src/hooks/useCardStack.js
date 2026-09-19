import { useEffect } from 'react';

// How much of a card has to be covered before it has finished receding, and
// how far back it goes. 120px is about the depth of a heading — far enough
// that the recede tracks the scroll rather than snapping, short enough that a
// card is settled behind its neighbour by the time it is mostly hidden. 0.94
// reads as "behind" at a glance without the card's edges visibly swinging
// inward as you drag.
const TUCK_TRAVEL = 120;
const TUCK_SCALE = 0.94;

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
            cards.forEach((card, i) => {
                const next = cards[i + 1];
                // The last card, and any card that opted out of pinning, never
                // goes behind anything — it is the one doing the covering.
                if (!next || card.classList.contains('detail-stack-flow')) {
                    card.style.transform = '';
                    return;
                }
                const height = card.offsetHeight;
                const covered = card.getBoundingClientRect().top + height
                    - next.getBoundingClientRect().top;
                const travel = Math.min(TUCK_TRAVEL, height);
                const p = Math.min(1, Math.max(0, covered / travel));
                card.style.transform = p > 0 ? `scale(${1 - (1 - TUCK_SCALE) * p})` : '';
            });
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
