import { ChevronLeft } from 'lucide-react';
import { useI18n } from '../i18n';

/**
 * The header the standalone pages share — the satellite tracker and compare.
 *
 * The back button used to sit *beside* the title, which pushed the title (and,
 * via a matching 48px indent, the subtitle) in from the page's leading edge
 * while every panel below them stayed flush to it — three left edges on a page
 * with one column. It is now a back *link* on its own row above the title, so
 * the title, the subtitle and the content beneath all share a single edge and
 * the button is where a back control is normally looked for anyway.
 */
const PageHeader = ({ onBack, backLabel, title, subtitle, trailing }) => {
    const { t } = useI18n();
    return (
        <div style={{ marginBottom: 'var(--s-7)' }}>
            <button
                onClick={onBack}
                aria-label={backLabel ?? t('nav.back')}
                className="page-back focus-ring"
            >
                <ChevronLeft className="flip-rtl" style={{ width: 15, height: 15 }} aria-hidden="true" />
                <span>{backLabel ?? t('nav.back')}</span>
            </button>
            <div
                className="flex items-end justify-between"
                style={{ gap: 'var(--s-4)', marginTop: 'var(--s-3)' }}
            >
                <div style={{ minWidth: 0 }}>
                    <h1 style={{
                        margin: 0,
                        fontSize: 'clamp(1.5rem, 3.2vw, 2.15rem)', fontWeight: 700,
                        letterSpacing: 'var(--tr-tighter)', color: '#fff', lineHeight: 1.1,
                        whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
                    }}>
                        {title}
                    </h1>
                    {subtitle && (
                        <p style={{
                            margin: '7px 0 0',
                            fontSize: 'var(--fs-sm)', color: 'var(--text-tertiary)',
                        }}>
                            {subtitle}
                        </p>
                    )}
                </div>
                {trailing && <div className="flex-shrink-0">{trailing}</div>}
            </div>
        </div>
    );
};

export default PageHeader;
