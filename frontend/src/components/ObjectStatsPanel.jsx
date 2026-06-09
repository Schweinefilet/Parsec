import React, { useState } from 'react';

// Convert Unicode superscript digits in stat values to <sup> HTML for proper typography
const SUPER_MAP = { '⁰':'0','¹':'1','²':'2','³':'3','⁴':'4','⁵':'5','⁶':'6','⁷':'7','⁸':'8','⁹':'9' };
function toHtml(str) {
    if (typeof str !== 'string') return str;
    return str.replace(/[⁰¹²³⁴⁵⁶⁷⁸⁹]+/g, m =>
        `<sup>${m.split('').map(c => SUPER_MAP[c]).join('')}</sup>`
    );
}

const ObjectStatsPanel = ({ object }) => {
    const sections = Array.isArray(object?.stats) ? object.stats : [];
    const [activeSection, setActiveSection] = useState(sections[0]?.section ?? '');

    if (sections.length === 0) {
        return (
            <div className="glass p-6" style={{ color: 'var(--text-tertiary)', fontSize: '0.875rem' }}>
                No stats available.
            </div>
        );
    }

    const currentSection = sections.find(s => s.section === activeSection) ?? sections[0];

    return (
        <div className="glass flex flex-col overflow-hidden" style={{ borderRadius: 'var(--radius-card)' }}>
            {/* Section tabs */}
            <div className="flex px-4 pt-3 gap-1">
                {sections.map(s => (
                    <button
                        key={s.section}
                        onClick={() => setActiveSection(s.section)}
                        className="px-3 py-1.5 rounded-lg text-xs font-semibold transition-all mb-0.5"
                        style={activeSection === s.section
                            ? { background: 'rgba(255,255,255,0.15)', color: '#fff' }
                            : { color: 'rgba(255,255,255,0.45)' }
                        }
                    >
                        {s.section}
                    </button>
                ))}
            </div>

            {/* Stats grid — last row spans full width when row count is odd */}
            <div className="grid grid-cols-2 gap-2 p-4">
                {currentSection.rows.map(({ label, value }, idx) => {
                    const isLastOdd = idx === currentSection.rows.length - 1 && currentSection.rows.length % 2 !== 0;
                    return (
                        <div key={label} className={`p-3${isLastOdd ? ' col-span-2' : ''}`}>
                            <div className="text-[10px] font-semibold uppercase tracking-wider mb-1"
                                style={{ color: 'var(--text-tertiary)' }}>
                                {label}
                            </div>
                            <div className="text-sm font-bold leading-snug" style={{ color: 'var(--text-primary)' }}
                                dangerouslySetInnerHTML={{ __html: toHtml(value) }} />
                        </div>
                    );
                })}
            </div>
        </div>
    );
};

export default ObjectStatsPanel;
