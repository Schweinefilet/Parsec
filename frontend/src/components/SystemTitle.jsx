import { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { ChevronDown } from 'lucide-react';
import { SYSTEMS, systemById } from '../data/systems';

/**
 * The name of the system you are looking at, over the top of the scene.
 *
 * Built as a dropdown against the day there is a second system to go to — see
 * data/systems.js. With one entry it renders as a plain heading: no chevron,
 * no button, nothing to press. Adding an entry to that list turns it into a
 * working menu without touching this file.
 *
 * No webfont. The site loads none, and a display face for one line of text is
 * a network round trip on the critical path of a page that already fights to
 * start quickly. The weight comes from size and a very light stroke instead,
 * which is what the system stack is good at.
 *
 * An h2, not an h1: index.html already carries a visually hidden h1 naming
 * the site, and a second one competing with it helps neither a screen reader
 * nor a crawler.
 *
 * The opening instruction sits under the name as a child of the same column
 * rather than being positioned separately, so it stays the right distance
 * below a heading whose size is a clamp() and therefore not known here. The
 * two fade together, on one opacity: both are a greeting, and a greeting that
 * lingers after you have started is in the way of what you started doing.
 */
const SystemTitle = ({ currentId, hidden = false, compact = false, hint = null }) => {
    const navigate = useNavigate();
    const [open, setOpen] = useState(false);
    const wrapRef = useRef(null);

    const current = systemById(currentId);
    const hasChoice = SYSTEMS.length > 1;

    // Close on a click anywhere else, or on Escape. Only bound while open, so
    // the common case costs nothing.
    useEffect(() => {
        if (!open) return;
        const onDown = (e) => {
            if (!wrapRef.current?.contains(e.target)) setOpen(false);
        };
        const onKey = (e) => { if (e.key === 'Escape') setOpen(false); };
        document.addEventListener('pointerdown', onDown);
        document.addEventListener('keydown', onKey);
        return () => {
            document.removeEventListener('pointerdown', onDown);
            document.removeEventListener('keydown', onKey);
        };
    }, [open]);

    // Nothing to choose between, so nothing should suggest there is.
    useEffect(() => { if (!hasChoice && open) setOpen(false); }, [hasChoice, open]);

    const nameStyle = {
        margin: 0,
        fontSize: compact ? 'clamp(1.35rem, 7vw, 1.9rem)' : 'clamp(1.9rem, 3.6vw, 3rem)',
        fontWeight: 200,
        letterSpacing: compact ? '-0.01em' : '-0.015em',
        lineHeight: 1.05,
        whiteSpace: 'nowrap',
        // A hair of warmth at the foot of the letters, picking up the accent
        // the rest of the interface uses, rather than flat white.
        background: 'linear-gradient(175deg, #ffffff 38%, rgba(255,231,186,0.86) 100%)',
        WebkitBackgroundClip: 'text',
        backgroundClip: 'text',
        color: 'transparent',
        WebkitTextFillColor: 'transparent',
        // The scene behind is black but not empty; this keeps the letters off
        // whatever happens to drift under them.
        filter: 'drop-shadow(0 2px 18px rgba(0,0,0,0.85))',
    };

    return (
        <div
            ref={wrapRef}
            className="absolute inset-x-0 flex flex-col items-center transition-opacity duration-700"
            style={{
                top: compact ? 74 : 88,
                zIndex: 6,
                padding: '0 16px',
                opacity: hidden ? 0 : 1,
                // None on the band, auto on the control. This row spans the
                // full width and sits over the canvas, so anything else here
                // swallows drags across the whole top of the scene.
                pointerEvents: 'none',
            }}
            inert={hidden || undefined}
        >
            {hasChoice ? (
                <button
                    onClick={() => setOpen(v => !v)}
                    aria-haspopup="listbox"
                    aria-expanded={open}
                    aria-label={`${current.name} — choose another system`}
                    className="flex items-center gap-3 focus-ring rounded-2xl"
                    style={{
                        background: 'none', border: 'none', padding: '2px 8px',
                        cursor: 'pointer', color: 'inherit',
                        pointerEvents: hidden ? 'none' : 'auto',
                    }}
                >
                    <h2 style={nameStyle}>{current.name}</h2>
                    <ChevronDown
                        aria-hidden="true"
                        style={{
                            width: compact ? 18 : 24, height: compact ? 18 : 24,
                            flexShrink: 0, color: 'rgba(255,255,255,0.55)',
                            transform: open ? 'rotate(180deg)' : 'none',
                            transition: 'transform 260ms ease',
                        }}
                    />
                </button>
            ) : (
                <h2 style={nameStyle}>{current.name}</h2>
            )}

            {hint && (
                <p
                    className="transition-opacity duration-700"
                    style={{
                        margin: compact ? '8px 0 0' : '11px 0 0',
                        color: 'rgba(255,255,255,0.58)',
                        fontSize: compact ? 10 : 11,
                        fontWeight: 600,
                        letterSpacing: '0.07em',
                        textShadow: '0 1px 6px rgba(0,0,0,0.9)',
                        textAlign: 'center',
                        pointerEvents: 'none',
                    }}
                >
                    {hint}
                </p>
            )}

            {hasChoice && open && (
                <div
                    role="listbox"
                    aria-label="Systems"
                    className="glass"
                    style={{
                        marginTop: 12, padding: 6, minWidth: 260,
                        borderRadius: 18, textAlign: 'left',
                        pointerEvents: 'auto',
                    }}
                >
                    {SYSTEMS.map(s => (
                        <button
                            key={s.id}
                            role="option"
                            aria-selected={s.id === current.id}
                            onClick={() => { setOpen(false); navigate(s.to); }}
                            className="w-full focus-ring"
                            style={{
                                display: 'block', textAlign: 'left', cursor: 'pointer',
                                padding: '10px 12px', borderRadius: 13, border: 'none',
                                background: s.id === current.id ? 'rgba(255,255,255,0.08)' : 'none',
                            }}
                        >
                            <span style={{
                                display: 'block', fontSize: '0.95rem', fontWeight: 700,
                                color: s.id === current.id ? '#fff' : 'rgba(255,255,255,0.85)',
                            }}>
                                {s.name}
                            </span>
                            {s.blurb && (
                                <span style={{ display: 'block', marginTop: 2, fontSize: '0.76rem', color: 'var(--text-tertiary)' }}>
                                    {s.blurb}
                                </span>
                            )}
                        </button>
                    ))}
                </div>
            )}
        </div>
    );
};

export default SystemTitle;
