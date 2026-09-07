import { useState, useEffect, Fragment } from 'react';
import { useI18n } from '../i18n';

const SUPER_MAP = { '⁰': '0', '¹': '1', '²': '2', '³': '3', '⁴': '4', '⁵': '5', '⁶': '6', '⁷': '7', '⁸': '8', '⁹': '9' };
const SUPER_RE = /([⁰¹²³⁴⁵⁶⁷⁸⁹]+)/;

/**
 * Render Unicode superscript runs ("10²³") as real <sup> elements.
 * Returns React nodes rather than an HTML string so nothing needs
 * dangerouslySetInnerHTML.
 */
function withSuperscripts(value) {
    if (typeof value !== 'string') return value;
    return value.split(SUPER_RE).map((part, i) =>
        SUPER_RE.test(part) && SUPER_MAP[part[0]]
            ? <sup key={i}>{[...part].map(c => SUPER_MAP[c] ?? c).join('')}</sup>
            : <Fragment key={i}>{part}</Fragment>
    );
}

const ObjectStatsPanel = ({ object: source }) => {
    const { t, object: localize } = useI18n();
    const object = localize(source);
    const sections = Array.isArray(object?.stats) ? object.stats : [];
    const [activeSection, setActiveSection] = useState(sections[0]?.section ?? '');

    // Reset to the first tab whenever a different object is shown
    useEffect(() => {
        setActiveSection(sections[0]?.section ?? '');
    }, [object?.id]); // eslint-disable-line react-hooks/exhaustive-deps

    if (sections.length === 0) {
        return (
            <div className="glass p-6" style={{ color: 'var(--text-tertiary)', fontSize: '0.875rem' }}>
                {t('stats.none')}
            </div>
        );
    }

    const current = sections.find(s => s.section === activeSection) ?? sections[0];
    // Physical/Orbital values are short, so they tile more densely than General.
    const dense = current.section === 'Physical' || current.section === 'Orbital';

    return (
        <div className="glass flex flex-col overflow-hidden" style={{ borderRadius: 'var(--radius-card)' }}>
            <div className="flex px-4 pt-3 gap-1" role="tablist" aria-label={t('stats.aria', { name: object?.name ?? t('stats.object') })}>
                {sections.map(s => {
                    const selected = current.section === s.section;
                    return (
                        <button
                            key={s.section}
                            role="tab"
                            aria-selected={selected}
                            onClick={() => setActiveSection(s.section)}
                            className="px-3 py-1.5 rounded-lg text-xs font-semibold transition-all mb-0.5 focus-ring"
                            style={selected
                                ? { background: 'rgba(255,255,255,0.15)', color: '#fff' }
                                : { color: 'rgba(255,255,255,0.45)' }}
                        >
                            {s.sectionLabel ?? s.section}
                        </button>
                    );
                })}
            </div>

            {/* auto-fit keeps a trailing odd row full-width and collapses to one
                column on narrow screens, without needing dynamic class names */}
            <div
                className="grid gap-2 p-4"
                style={{ gridTemplateColumns: `repeat(auto-fit, minmax(${dense ? 132 : 180}px, 1fr))` }}
                role="tabpanel"
            >
                {current.rows.map(({ label, value, labelText, valueText }) => (
                    <div key={label} className="p-3">
                        <div
                            className="text-[10px] font-semibold uppercase tracking-wider mb-1"
                            style={{ color: 'var(--text-tertiary)' }}
                        >
                            {labelText ?? label}
                        </div>
                        {/* A number and its unit are one run: isolated, so a
                            neighbouring right-to-left word cannot drag the
                            minus sign to the far end of "−180 to 430 °C". */}
                        <div className="text-sm font-bold leading-snug num-run" style={{ color: 'var(--text-primary)' }}>
                            {withSuperscripts(valueText ?? value)}
                        </div>
                    </div>
                ))}
            </div>
        </div>
    );
};

export default ObjectStatsPanel;
