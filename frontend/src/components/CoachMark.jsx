import { useLayoutEffect, useRef, useState } from 'react';
import { useI18n } from '../i18n';
import { coachMaxWidth, placeCoach } from '../utils/coachPlacement';

/**
 * A first-visit tip: a line of text in a small callout with a pointer at the
 * control it is about. The whole thing is a dismiss button.
 *
 * It used to be bare text and an arrow, floating over the scene with a heavy
 * shadow the way the body labels do. Over the greeting, the planet names and
 * the buttons that is unreadable: the words land on other words. A surface
 * makes it legible on anything.
 *
 * It wears the same pane as the menus and drawers (--float-bg, a white
 * hairline, medium-weight text), so a tip reads as one more piece of the
 * site's chrome. It used to have its own amber outline, which made it look
 * like an ad dropped over the page rather than part of it.
 *
 * The surface is opaque — --float-bg's colour at full strength — rather than
 * the menus' 95%, on purpose. The pointer is a turned square that overlaps
 * the callout's edge, and two translucent layers stacked there show a seam.
 * Opaque has none, and needs no backdrop blur, which is a cost this page is
 * already careful with.
 *
 * The parent says *what* it points at (`target`, a rect from
 * getBoundingClientRect) and which `side` of it the callout sits on; where
 * exactly that lands is worked out here (utils/coachPlacement.js), from the
 * callout's own measured size, clamped to the screen. `avoid` lists rects the
 * callout must not cover. Nothing in a caller does pixel arithmetic, which is
 * how a tip once ended up 82px wide over the page title.
 */
const NUB = 9;          // the pointer's square, before it is turned 45°
const BORDER = 1;
const SURFACE = 'rgb(8 10 15)';                // --float-bg, opaque
const EDGE = 'rgba(255, 255, 255, 0.16)';      // between --chrome-border and -hi
const HALF = -(NUB / 2) - BORDER;   // puts the square's centre on the callout's outer edge

const edge = `${BORDER}px solid ${EDGE}`;

// Which side of the callout the pointer sits on, which two edges of the turned
// square are drawn (the two facing away from the callout), and the direction
// the callout nudges — toward the target, to say "here".
const BY_SIDE = {
    above: { at: (n) => ({ bottom: HALF, left: n - NUB / 2 - BORDER }), borders: { borderRight: edge, borderBottom: edge }, bob: { '--cy': '2px' } },
    below: { at: (n) => ({ top: HALF, left: n - NUB / 2 - BORDER }),    borders: { borderTop: edge, borderLeft: edge },     bob: { '--cy': '-2px' } },
    right: { at: (n) => ({ left: HALF, top: n - NUB / 2 - BORDER }),    borders: { borderLeft: edge, borderBottom: edge },  bob: { '--cx': '-2px' } },
    left:  { at: (n) => ({ right: HALF, top: n - NUB / 2 - BORDER }),   borders: { borderRight: edge, borderTop: edge },    bob: { '--cx': '2px' } },
};

// The layout viewport, which is what a fixed box is placed against. On a phone
// window.innerHeight is the visual viewport and is short by the URL bar.
const readViewport = () => ({
    width: document.documentElement.clientWidth || window.innerWidth,
    height: document.documentElement.clientHeight || window.innerHeight,
});

const CoachMark = ({ text, target, side = 'below', avoid = [], maxWidth = 232, onDismiss }) => {
    const { t, dir } = useI18n();
    const ref = useRef(null);
    const [size, setSize] = useState(null);

    const viewport = readViewport();
    // Fixed before measuring, so the text wraps to the room there is rather than
    // being squeezed into whatever a fixed box would shrink to.
    const cap = coachMaxWidth({ target, viewport, side, cap: maxWidth, avoid });

    // Drawn once, unseen, to measure — then placed before the browser paints,
    // so it never shows in the wrong place.
    useLayoutEffect(() => {
        const box = ref.current?.getBoundingClientRect();
        if (!box) return;
        setSize((prev) => (prev && prev.w === box.width && prev.h === box.height ? prev : { w: box.width, h: box.height }));
    }, [text, cap]);

    const placed = size ? placeCoach({ target, size, viewport, side, avoid }) : null;
    const shape = BY_SIDE[placed?.side ?? side];

    return (
        <button
            ref={ref}
            type="button"
            onClick={onDismiss}
            className="focus-ring"
            style={{
                position: 'fixed', zIndex: 40,
                left: placed?.left ?? 0, top: placed?.top ?? 0,
                visibility: placed ? 'visible' : 'hidden',
                // Explicit, not shrink-to-fit: a fixed box otherwise sizes itself
                // to the room to the right of `left`.
                width: 'max-content', maxWidth: cap,
                // Layout is physical (left/top above); the text itself follows the
                // page so Arabic wraps and punctuates right-to-left.
                direction: dir,
                padding: '8px 12px', margin: 0,
                borderRadius: 'var(--r-md)',
                background: SURFACE, border: edge,
                boxShadow: 'var(--sh-3)',
                color: 'rgba(255, 255, 255, 0.9)',
                fontSize: 'var(--fs-sm)', fontWeight: 500, lineHeight: 1.4,
                textAlign: 'center', textWrap: 'balance',
                cursor: 'pointer',
                // Fade in (opacity only, so it never fights the nudge's transform),
                // then lean toward the target, gently, for as long as it is up.
                animation: 'coachIn var(--t-slow) var(--ease-out) both, coachArrow 1.6s var(--ease-inout) var(--t-slow) infinite',
                ...shape.bob,
            }}
        >
            <span>{text}</span>
            {/* The button's name is its visible words, plus what pressing it does. */}
            <span className="sr-only">. {t('scene.hintDismiss')}</span>
            {placed && (
                <span
                    aria-hidden="true"
                    style={{
                        position: 'absolute', width: NUB, height: NUB,
                        background: SURFACE,
                        transform: 'rotate(45deg)',
                        ...shape.at(placed.nub),
                        ...shape.borders,
                    }}
                />
            )}
        </button>
    );
};

export default CoachMark;
