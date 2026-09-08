import { ChevronLeft } from 'lucide-react';
import { useI18n } from '../i18n';

/**
 * The header the standalone pages share — tracker, compare, "what's up
 * tonight". A back button and a title on one row, the subtitle on its own row
 * beneath, aligned with the title.
 *
 * The subtitle used to stack under the title inside the flex row, which left
 * the back button vertically centred against a two-line block and wedged
 * against the title on a phone. Pulling it out drops the row to a single line:
 * `[back] [title] [trailing]`, with the title free to grow and truncate rather
 * than wrap into the button.
 */
const PageHeader = ({ onBack, backLabel, title, subtitle, trailing }) => {
    const { t } = useI18n();
    return (
        <div className="mb-4">
            <div className="flex items-center gap-3">
                <button
                    onClick={onBack}
                    aria-label={backLabel ?? t('nav.back')}
                    className="flex items-center justify-center rounded-xl focus-ring flex-shrink-0"
                    style={{
                        width: 36, height: 36,
                        background: 'rgba(255,255,255,0.06)',
                        border: '1px solid rgba(255,255,255,0.14)',
                        color: 'rgba(255,255,255,0.85)', cursor: 'pointer',
                    }}
                >
                    <ChevronLeft className="flip-rtl" style={{ width: 18, height: 18 }} />
                </button>
                <h1 style={{
                    margin: 0, flex: 1, minWidth: 0,
                    fontSize: 'clamp(1.15rem, 3vw, 1.6rem)', fontWeight: 800,
                    letterSpacing: '-0.02em', color: '#fff',
                    whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
                }}>
                    {title}
                </h1>
                {trailing && <div className="flex-shrink-0">{trailing}</div>}
            </div>
            {subtitle && (
                <p style={{
                    // 48 = back button (36) + the row gap (12), so the subtitle
                    // starts under the title in both directions.
                    margin: '5px 0 0', marginInlineStart: 48,
                    fontSize: '0.72rem', color: 'var(--text-tertiary)',
                }}>
                    {subtitle}
                </p>
            )}
        </div>
    );
};

export default PageHeader;
