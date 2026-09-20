import { createContext, useContext, useRef, useState } from 'react';
import { motion as Motion, useMotionValue, useSpring, useTransform } from 'motion/react';
import { useReducedMotion } from '../hooks/useMediaQuery';

/**
 * A row of controls that swell toward the pointer, macOS-dock style — after
 * Aceternity UI's FloatingDock, reshaped for this header.
 *
 * Aceternity's version takes a list of `{ title, icon, href }` and renders every
 * item as a link. The header's controls are not all links (a language dropdown,
 * a copy button, three router links, the search toggle), so items are passed as
 * `<DockItem label="…">` children instead: each keeps its own markup, handlers
 * and state, and the dock only decides how big it is.
 *
 * What is animated is the item's real width/height, published as the
 * `--dock-size` custom property and picked up by `.floating-dock .chrome-btn`
 * in index.css — *not* a transform. A `scale()` would take the whole subtree
 * with it, which means the language dropdown would balloon along with the
 * button that opened it, and the borders and glyphs would go soft at the peak.
 * Sizing the box for real keeps every edge crisp and leaves the dropdown alone.
 *
 * The wrapper keeps the header's own 36px row height while the button inside it
 * grows past the bottom edge, so a swollen icon spills onto the scene and the
 * 56px header never reflows. Labels hang below for the same reason: this dock
 * is anchored to the top of the window, so Aceternity's above-the-icon tooltip
 * would sit off-screen.
 *
 * Pointer only — a touch has no "near" to swell toward — and reduced motion
 * gets a plain, still row, since a spring is JS and index.css collapsing every
 * CSS duration does not reach it.
 */

const BASE = 36;      // .chrome-btn's resting size, and the header's row height
const PEAK = 58;      // the nearest item, at full magnification
const REACH = 120;    // px from an item's centre at which the swell has faded out

const DockContext = createContext(null);

export const FloatingDock = ({ children, className = '', style }) => {
    const mouseX = useMotionValue(Infinity);
    const reduced = useReducedMotion();

    const onPointerMove = (e) => {
        if (e.pointerType === 'mouse') mouseX.set(e.clientX);
    };

    return (
        <DockContext.Provider value={reduced ? null : mouseX}>
            <div
                onPointerMove={reduced ? undefined : onPointerMove}
                onPointerLeave={reduced ? undefined : () => mouseX.set(Infinity)}
                className={`floating-dock ${className}`.trim()}
                style={style}
            >
                {children}
            </div>
        </DockContext.Provider>
    );
};

export const DockItem = ({ label, children }) => {
    const mouseX = useContext(DockContext);
    // Hooks cannot be conditional, so a reduced-motion dock gets a motion value
    // that never leaves Infinity — every item then stays at BASE.
    const idle = useMotionValue(Infinity);
    const ref = useRef(null);
    const [hovered, setHovered] = useState(false);

    const distance = useTransform(mouseX ?? idle, (x) => {
        const bounds = ref.current?.getBoundingClientRect();
        // Measured from the item's centre, so the curve is symmetric on either
        // side. The centre drifts a little as the box grows; not enough to see.
        return bounds ? x - (bounds.left + bounds.width / 2) : Infinity;
    });
    const target = useTransform(distance, [-REACH, 0, REACH], [BASE, PEAK, BASE], { clamp: true });
    const size = useSpring(target, { mass: 0.1, stiffness: 150, damping: 12 });
    const sizePx = useTransform(size, (v) => `${v}px`);

    return (
        <Motion.div
            ref={ref}
            onPointerEnter={() => setHovered(true)}
            onPointerLeave={() => setHovered(false)}
            style={{
                // Square, and centred by the dock, so the icon grows evenly out
                // of the pill top and bottom. The header row cannot grow with
                // it: the dock's own height is fixed in index.css.
                width: sizePx, height: sizePx,
                // Deliberately not a containing block: .dock-label anchors to
                // the dock instead, so it can sit clear of the scene footnote.
                flexShrink: 0,
                '--dock-size': sizePx,
            }}
        >
            {children}
            {label && (
                <span className="dock-label" data-show={hovered || undefined} aria-hidden="true">
                    {label}
                </span>
            )}
        </Motion.div>
    );
};

export default FloatingDock;
