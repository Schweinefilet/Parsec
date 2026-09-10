import { ArrowDown, ArrowUp, ArrowLeft, ArrowRight } from 'lucide-react';
import { useI18n } from '../i18n';

/**
 * A first-visit hint — an arrow and a line of text, no container, floating
 * over the scene the way the body labels do. The whole thing is a dismiss
 * button. `arrow` is the direction it points at its control; the parent
 * measures the control and hands the final position in through `style`.
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
    const column = arrow === 'up' || arrow === 'down';

    return (
        <button
            type="button"
            onClick={onDismiss}
            aria-label={t('scene.hintDismiss')}
            className="focus-ring"
            style={{
                position: 'fixed', zIndex: 40,
                // Fixed layout regardless of page direction — `arrow` and the
                // parent's measured position already carry the sidedness. The
                // translated string still resolves its own bidi run.
                direction: 'ltr',
                display: 'flex', flexDirection: column ? 'column' : 'row',
                alignItems: 'center', gap: column ? 3 : 6,
                background: 'none', border: 'none', padding: 4, margin: 0,
                cursor: 'pointer',
                color: 'rgba(255,255,255,0.96)',
                fontSize: 12, fontWeight: 700, lineHeight: 1.3, letterSpacing: '0.01em',
                textAlign: 'center', whiteSpace: column ? 'normal' : 'nowrap',
                maxWidth: 210,
                textShadow: '0 1px 5px rgba(0,0,0,0.95), 0 0 16px rgba(0,0,0,0.75)',
                animation: 'coachIn 320ms ease both',
                ...style,
            }}
        >
            <Icon
                aria-hidden="true"
                style={{
                    width: 17, height: 17, flexShrink: 0, color: '#ffd166',
                    order: arrow === 'down' || arrow === 'right' ? 2 : 0,
                    filter: 'drop-shadow(0 1px 3px rgba(0,0,0,0.95))',
                    animation: 'coachArrow 1.4s ease-in-out infinite',
                    ...NUDGE[arrow],
                }}
            />
            <span>{text}</span>
        </button>
    );
};

export default CoachMark;
