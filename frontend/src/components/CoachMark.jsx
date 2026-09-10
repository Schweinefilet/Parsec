import { ArrowDown, ArrowUp, ArrowLeft, ArrowRight } from 'lucide-react';
import { useI18n } from '../i18n';

/**
 * A one-line hint that points at a control, shown once to a first-time
 * visitor. CategoryBrowser owns the "seen" flag and the order they appear in;
 * this is just the bubble. The whole thing is a button — tap anywhere on it
 * to dismiss.
 *
 * `arrow` is the direction it points: a hint sitting below a control points
 * 'up' at it, one to its right points 'left', and so on. Position comes in
 * through `style` (the parent knows where each control is).
 */
const ARROW = { up: ArrowUp, down: ArrowDown, left: ArrowLeft, right: ArrowRight };
const NUDGE = {
    up:    { '--cy': '-3px' },
    down:  { '--cy': '3px' },
    left:  { '--cx': '-3px' },
    right: { '--cx': '3px' },
};

const CoachMark = ({ text, arrow = 'down', style, onDismiss }) => {
    const { t } = useI18n();
    const Icon = ARROW[arrow] ?? ArrowDown;
    // The arrow leads: at the start edge for a sideways point, on top for an
    // up/down one, so it reads as "look this way" before the words.
    const column = arrow === 'up' || arrow === 'down';

    return (
        <button
            type="button"
            onClick={onDismiss}
            aria-label={t('scene.hintDismiss')}
            className="animate-fade-in focus-ring"
            style={{
                position: 'absolute', zIndex: 25,
                display: 'flex', flexDirection: column ? 'column' : 'row',
                alignItems: 'center', gap: 6,
                maxWidth: 224,
                padding: '9px 12px',
                borderRadius: 13,
                background: 'rgba(16,20,28,0.95)',
                border: '1px solid rgba(255,255,255,0.16)',
                boxShadow: '0 10px 30px rgba(0,0,0,0.55)',
                backdropFilter: 'blur(8px)',
                WebkitBackdropFilter: 'blur(8px)',
                color: 'rgba(255,255,255,0.92)',
                fontSize: 11, fontWeight: 600, lineHeight: 1.35,
                letterSpacing: '0.01em', textAlign: 'center',
                cursor: 'pointer',
                ...style,
            }}
        >
            <Icon
                aria-hidden="true"
                style={{
                    width: 15, height: 15, flexShrink: 0, color: '#ffd166',
                    order: arrow === 'down' || arrow === 'right' ? 2 : 0,
                    animation: 'coachArrow 1.5s ease-in-out infinite',
                    ...NUDGE[arrow],
                }}
            />
            <span>{text}</span>
        </button>
    );
};

export default CoachMark;
