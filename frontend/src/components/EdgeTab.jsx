import { ChevronDown } from 'lucide-react';
import { useI18n } from '../i18n';

/**
 * The chevron tab that opens a scene drawer against the leading edge — the
 * solar system's view options and the night sky's settings share it, so the
 * two scenes read as one family.
 *
 * The mark is the focused-object sheet's pull handle laid on its side: two
 * ChevronDown, overlapped and widened by scaleX(1.5), each turned a quarter
 * turn so the pair reads » / «. It points into the scene when closed and back
 * at the edge when open; the direction lives in the rotation, so a
 * right-to-left layout just flips which way "into the scene" is. The heavier
 * chevron sits on the far side from the screen edge.
 *
 * Bare chevrons, no rail (see .edge-tab). It bobs while closed — the sheet
 * handle's animation turned sideways (edgeTabBob), on its own wrapper so it
 * doesn't fight the transforms below.
 */
const EdgeTab = ({ open, reduced, style, ...rest }) => {
    const { rtl } = useI18n();
    const chevDeg = (open === rtl) ? -90 : 90;
    // The row is pinned `direction: ltr`, so the first icon is always the
    // visual left and the second the visual right.
    const alphas = rtl ? [0.80, 0.40] : [0.40, 0.80];

    return (
        <button type="button" className="edge-tab focus-ring" style={style} {...rest}>
            <span
                style={{
                    display: 'block', pointerEvents: 'none',
                    '--bob-x': rtl ? '-4px' : '4px',
                    animation: (open || reduced) ? 'none' : 'edgeTabBob 1.8s ease-in-out infinite',
                }}
            >
                {/* Each icon overflows a tight wrapper so the row's width is
                    the ink, not the icon's empty box. */}
                <span aria-hidden="true" style={{ display: 'flex', alignItems: 'center', direction: 'ltr' }}>
                    {alphas.map((a, i) => (
                        <span
                            key={i}
                            style={{
                                width: 13, height: 30, flexShrink: 0, marginInlineStart: i ? -3 : 0,
                                display: 'flex', alignItems: 'center', justifyContent: 'center',
                            }}
                        >
                            <ChevronDown style={{
                                width: 34, height: 34, flexShrink: 0,
                                color: `rgba(255,255,255,${a})`,
                                transform: `rotate(${chevDeg}deg) scaleX(1.5)`,
                                transition: 'transform var(--t-slow) var(--ease-out)',
                            }} />
                        </span>
                    ))}
                </span>
            </span>
        </button>
    );
};

export default EdgeTab;
