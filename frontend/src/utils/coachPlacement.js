// Where a first-visit tip goes, given the control it points at.
//
// Tips used to be handed a hand-worked `left` / `top` / `transform` by whoever
// mounted them. That put the burger tip's box at `left: 308px` on a 390px
// phone, and a fixed box sizes itself to the room to its right: 82px. The text
// wrapped into a tall sliver and landed across the page title. The speed tip
// had the opposite problem: centred above its control, it printed straight
// over the "Explore the catalog" pill. So the geometry lives here now, in one
// place and in plain numbers, and every tip is clamped to the screen.
//
// Rects are `{ left, right, top, bottom }` in layout-viewport pixels, which is
// what getBoundingClientRect() returns and what `position: fixed` uses.

export const GUTTER = 12;   // the closest a tip gets to the screen edge
export const GAP = 10;      // target edge to tip edge, the nub included
const NUB_INSET = 16;       // the nub stays this far from the tip's corners
const AVOID_MARGIN = 8;     // clear air kept around anything to steer round

const clamp = (v, lo, hi) => Math.min(Math.max(v, lo), Math.max(lo, hi));

/**
 * The widest horizontal run a tip above or below its target may occupy: the
 * screen inside its gutters, minus every rect in `avoid`. Of the runs that are
 * left, the one nearest the target's centre wins, so a tip steers to whichever
 * side of an obstruction the target is on (or the roomier one, on a tie).
 * Returns `[from, to]`.
 */
export function freeRun({ target, viewport, avoid = [], gutter = GUTTER }) {
    let runs = [[gutter, viewport.width - gutter]];
    for (const a of avoid) {
        const lo = a.left - AVOID_MARGIN;
        const hi = a.right + AVOID_MARGIN;
        runs = runs.flatMap(([from, to]) => {
            if (hi <= from || lo >= to) return [[from, to]];
            const kept = [];
            if (lo > from) kept.push([from, lo]);
            if (hi < to) kept.push([hi, to]);
            return kept;
        });
    }
    if (!runs.length) return [gutter, viewport.width - gutter];
    const cx = (target.left + target.right) / 2;
    const distance = ([from, to]) => (cx < from ? from - cx : cx > to ? cx - to : 0);
    return runs.reduce((best, run) => {
        const d = distance(run) - distance(best);
        return d < 0 || (d === 0 && run[1] - run[0] > best[1] - best[0]) ? run : best;
    });
}

/**
 * The widest a tip may be before it wraps, so the text wraps to fit the room
 * it has rather than being squeezed after the fact. Called before the tip is
 * measured, which is why it cannot depend on the tip's own size.
 */
export function coachMaxWidth({ target, viewport, side, cap = 232, avoid = [], gutter = GUTTER, gap = GAP }) {
    let room;
    if (side === 'right') room = viewport.width - gutter - (target.right + gap);
    else if (side === 'left') room = target.left - gap - gutter;
    else {
        const [from, to] = freeRun({ target, viewport, avoid, gutter });
        room = to - from;
    }
    return Math.max(0, Math.min(cap, room));
}

/**
 * Position a tip of measured `size` ({ w, h }) beside `target`.
 *
 * `side` is where the tip sits relative to the target: 'above' | 'below' |
 * 'left' | 'right'. Above and below flip if there is no room on the asked-for
 * side and there is on the other. The tip is always clamped inside the
 * gutters, and `nub` says how far along the tip's edge (from its left for
 * above/below, from its top for left/right) the pointer belongs, so it can
 * keep aiming at the target when the tip has slid sideways to stay on screen.
 */
export function placeCoach({ target, size, viewport, side = 'below', avoid = [], gutter = GUTTER, gap = GAP }) {
    const { w, h } = size;
    const cx = (target.left + target.right) / 2;
    const cy = (target.top + target.bottom) / 2;

    if (side === 'above' || side === 'below') {
        const above = target.top - gap - h;
        const below = target.bottom + gap;
        let s = side;
        if (s === 'above' && above < gutter && below + h <= viewport.height - gutter) s = 'below';
        else if (s === 'below' && below + h > viewport.height - gutter && above >= gutter) s = 'above';
        const [from, to] = freeRun({ target, viewport, avoid, gutter });
        const left = clamp(cx - w / 2, from, to - w);
        return {
            side: s,
            left,
            top: s === 'above' ? above : below,
            nub: clamp(cx - left, NUB_INSET, w - NUB_INSET),
        };
    }

    const left = side === 'right' ? target.right + gap : target.left - gap - w;
    let top = clamp(cy - h / 2, gutter, viewport.height - gutter - h);
    // Beside a control that has a neighbour above or below it (the settings
    // tab sits right over the "Explore the catalog" pill), centring can push
    // the tip's edge onto that neighbour. Slide it clear, up first.
    for (const a of avoid) {
        const across = left < a.right + AVOID_MARGIN && left + w > a.left - AVOID_MARGIN;
        const down = top < a.bottom + AVOID_MARGIN && top + h > a.top - AVOID_MARGIN;
        if (!across || !down) continue;
        const up = a.top - AVOID_MARGIN - h;
        top = up >= gutter ? up : clamp(a.bottom + AVOID_MARGIN, gutter, viewport.height - gutter - h);
    }
    return { side, left, top, nub: clamp(cy - top, NUB_INSET, h - NUB_INSET) };
}
