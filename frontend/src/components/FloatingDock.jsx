import { Children, createContext, useContext, useRef } from 'react';
import { motion as Motion, useMotionValue, useSpring, useTransform, useReducedMotion } from 'motion/react';

/**
 * A row of controls that swell toward the pointer, macOS-dock style — after
 * Aceternity UI's FloatingDock, reshaped for this header.
 *
 * Aceternity's version takes a list of `{ title, icon, href }` and renders every
 * item as a link. The header's controls are not all links (a language dropdown,
 * a copy button, three router links, the search toggle), so this takes them as
 * children instead and wraps each in a DockItem — the buttons keep their own
 * markup, click handlers and state, and the dock only decides how big they are.
 *
 * The magnification is the wrapper's width plus a scale on its content, not a
 * width on the button itself: neighbours are pushed apart rather than
 * overlapped, and the header's fixed 56px height never has to move.
 *
 * Pointer only. A touch has no "near" to swell toward, and `prefers-reduced-motion`
 * gets a plain row — index.css zeroes CSS durations, but a spring is JS and
 * ignores that.
 */

const BASE = 36;      // .chrome-btn is 36×36
const PEAK = 1.28;    // how far the nearest item grows
const REACH = 90;     // px from an item's centre at which the swell has faded out

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
                className={`floating-dock ${className}`}
                style={style}
            >
                {Children.toArray(children).map((child, i) => (
                    <DockItem key={child.key ?? i}>{child}</DockItem>
                ))}
            </div>
        </DockContext.Provider>
    );
};

const DockItem = ({ children }) => {
    const mouseX = useContext(DockContext);
    // Hooks can't be conditional, so a reduced-motion dock gets a motion value
    // that never leaves Infinity — the scale then stays at 1.
    const idle = useMotionValue(Infinity);
    const ref = useRef(null);

    const distance = useTransform(mouseX ?? idle, (x) => {
        const bounds = ref.current?.getBoundingClientRect();
        // The wrapper's own width changes as it swells, but its centre does not
        // drift enough to matter, and measuring from the centre keeps the curve
        // symmetric on either side.
        return bounds ? x - (bounds.left + bounds.width / 2) : Infinity;
    });
    const target = useTransform(distance, [-REACH, 0, REACH], [1, PEAK, 1]);
    const scale = useSpring(target, { mass: 0.1, stiffness: 150, damping: 12 });
    const width = useTransform(scale, (s) => BASE * s);

    return (
        <Motion.div
            ref={ref}
            style={{
                width, height: BASE, flexShrink: 0,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}
        >
            <Motion.div style={{ scale, display: 'flex' }}>{children}</Motion.div>
        </Motion.div>
    );
};

export default FloatingDock;
