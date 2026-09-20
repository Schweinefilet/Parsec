import { useMemo, useRef, useState, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { ArrowLeftRight, ArrowUpRight } from 'lucide-react';
import PageHeader from '../components/PageHeader';
import { OBJECTS, CATEGORY_TABS, getObjectById } from '../data/objectCatalog';
import { radiusKm, isComparable, volumeRatio } from '../utils/objectSize';
import { objectImage } from '../data/objectImages';
import { accentOf } from '../data/categoryStyles';
import { useI18n } from '../i18n';

const DEFAULT_A = 'jupiter';
const DEFAULT_B = 'earth';

// Everything with a real physical size, grouped the way the catalog is and
// largest first inside each group — which is the order you want when the
// question is how big something is.
const COMPARABLE = OBJECTS.filter(isComparable);
// The tabs are kept as ids here and translated at render, so the groups do not
// have to be rebuilt when the language changes.
const GROUPS = CATEGORY_TABS
    .map(tab => ({
        tab,
        items: COMPARABLE
            .filter(o => o.category === tab.id)
            .sort((a, b) => radiusKm(b) - radiusKm(a)),
    }))
    .filter(g => g.items.length > 0);

/** A width, in whichever unit keeps it legible. */
const makeFmtKm = (t, num) => (km) => {
    if (km >= 10) return t('compare.km', { n: num(Math.round(km)) });
    if (km >= 1) return t('compare.km', { n: km.toFixed(1) });
    if (km >= 0.001) return t('compare.m', { n: num(Math.round(km * 1000)) });
    return t('compare.cm', { n: (km * 100000).toFixed(0) });
};

/** 11.2 rather than 11.20, but 1.08 rather than 1.1 — significance, not places. */
const makeFmtRatio = (num) => (n) => {
    if (n >= 1000) return num(Math.round(n));
    if (n >= 100) return n.toFixed(0);
    if (n >= 10) return n.toFixed(1);
    return n.toFixed(2);
};

const ObjectPicker = ({ value, onChange, label, groups, fmtKm, localize, t }) => (
    <label style={{ display: 'block', minWidth: 0, flex: '1 1 200px' }}>
        <span style={{
            display: 'block', fontSize: 9, fontWeight: 800, letterSpacing: '0.12em',
            textTransform: 'uppercase', color: 'var(--text-tertiary)', marginBottom: 5,
        }}>
            {label}
        </span>
        <select
            value={value}
            onChange={(e) => onChange(e.target.value)}
            className="focus-ring"
            style={{
                width: '100%', padding: '10px 12px', borderRadius: 'var(--radius-card)',
                background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.14)',
                color: '#fff', fontSize: '0.95rem', fontWeight: 700, cursor: 'pointer',
                appearance: 'none',
            }}
        >
            {groups.map(g => (
                <optgroup key={g.id} label={g.label} style={{ background: '#0b0d12' }}>
                    {g.items.map(src => {
                        const o = localize(src);
                        return (
                            <option key={o.id} value={o.id} style={{ background: '#0b0d12' }}>
                                {t('compare.option', { name: o.name, size: fmtKm(radiusKm(src) * 2) })}
                            </option>
                        );
                    })}
                </optgroup>
            ))}
        </select>
    </label>
);

/**
 * One body, drawn as a disc whose size is its real size relative to the other.
 *
 * `fraction` is this body's share of the larger one, so the bigger of the pair
 * always comes out at `maxPx` and the smaller lands wherever it truly falls —
 * which for Ceres beside the Sun is under a pixel, and that is the answer.
 */
const BodyDisc = ({ object, fraction, maxPx }) => {
    const { object: localize } = useI18n();
    const named = localize(object);
    const px = Math.max(1, fraction * maxPx);
    const photo = objectImage(object.id);
    const accent = accentOf(object.category);
    return (
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 10, minWidth: 0 }}>
            <div style={{ height: maxPx, display: 'flex', alignItems: 'center' }}>
                <div
                    aria-hidden="true"
                    style={{
                        width: px, height: px, borderRadius: '50%', flexShrink: 0,
                        background: photo
                            ? `#05070a center/cover url(${photo})`
                            : `radial-gradient(circle at 32% 30%, rgba(${accent.rgb},0.55), rgba(${accent.rgb},0.16) 55%, #05070a 100%)`,
                        // A terminator and a rim, so a flat crop reads as a body.
                        // No outer glow — it read as a soft-focus halo rather
                        // than a disc, which looked unpolished next to the rest
                        // of the page's flat, precise styling.
                        boxShadow: px > 8
                            ? `inset ${-px * 0.16}px ${-px * 0.1}px ${px * 0.4}px rgba(0,0,0,0.75)`
                            : 'none',
                        outline: px < 6 ? `1px solid rgba(${accent.rgb},0.9)` : 'none',
                        outlineOffset: 2,
                    }}
                />
            </div>
            {/* Name only. The diameter is in the picker above ("Jupiter —
                142,984 km across") and the sentence below, and a second copy
                under a two-pixel Earth disc just wrapped onto three lines. */}
            <p style={{
                margin: 0, textAlign: 'center', fontSize: '0.95rem', fontWeight: 700,
                color: '#fff', whiteSpace: 'nowrap',
            }}>
                {named.name}
            </p>
        </div>
    );
};

/** The rows both objects share, in the catalog's own sections and order. */
function buildRows(a, b) {
    const sections = [];
    for (const secA of a.stats ?? []) {
        const secB = (b.stats ?? []).find(s => s.section === secA.section);
        const rows = [];
        for (const rowA of secA.rows) {
            const rowB = secB?.rows.find(r => r.label === rowA.label);
            // Matched on the English label, shown with the translated value —
            // which is why localizeObject keeps `label` and adds `valueText`
            // beside it rather than overwriting.
            if (rowB) {
                rows.push({
                    label: rowA.label,
                    a: rowA.valueText ?? rowA.value,
                    b: rowB.valueText ?? rowB.value,
                });
            }
        }
        if (rows.length) sections.push({ section: secA.section, rows });
    }
    return sections;
}

/**
 * Width of an element, tracked as it changes.
 *
 * The discs are sized in pixels because their ratio has to be exact, so the
 * frame they sit in has to be a number too — a fixed 320 put Saturn half off
 * the side of a phone.
 */
function useMeasuredWidth(ref) {
    const [width, setWidth] = useState(0);
    useEffect(() => {
        const el = ref.current;
        if (!el) return;
        setWidth(el.clientWidth);
        if (typeof ResizeObserver !== 'function') return;
        const ro = new ResizeObserver(([entry]) => setWidth(entry.contentRect.width));
        ro.observe(el);
        return () => ro.disconnect();
    }, [ref]);
    return width;
}

const ComparePage = () => {
    const { t, num, object: localize, category, statLabel, sectionLabel } = useI18n();
    const fmtKm = useMemo(() => makeFmtKm(t, num), [t, num]);
    const fmtRatio = useMemo(() => makeFmtRatio(num), [num]);
    const groups = useMemo(
        () => GROUPS.map(g => ({ ...g, id: g.tab.id, label: category(g.tab).label })),
        [category]);
    const navigate = useNavigate();
    const [params, setParams] = useSearchParams();

    const pick = (key, fallback) => {
        const id = params.get(key);
        return getObjectById(id) && isComparable(getObjectById(id)) ? id : fallback;
    };
    const idA = pick('a', DEFAULT_A);
    const idB = pick('b', DEFAULT_B);
    const a = getObjectById(idA);
    const b = getObjectById(idB);

    const set = (nextA, nextB) => setParams({ a: nextA, b: nextB }, { replace: true });

    const rA = radiusKm(a);
    const rB = radiusKm(b);
    const bigger = rA >= rB ? a : b;
    const smaller = rA >= rB ? b : a;
    const ratio = Math.max(rA, rB) / Math.min(rA, rB);
    // Not the width ratio cubed: the giants are oblate enough that cubing an
    // equatorial radius overstates them by a noticeable margin.
    const volume = volumeRatio(bigger, smaller);

    const sections = useMemo(() => buildRows(localize(a), localize(b)), [a, b, localize]);

    // Both discs plus the gap have to fit the card, and the smaller one's share
    // depends on the pair — Titan beside Saturn asks for almost nothing, Mercury
    // beside Ganymede for nearly as much again.
    const stageRef = useRef(null);
    const stageWidth = useMeasuredWidth(stageRef);
    const smallShare = Math.min(rA, rB) / Math.max(rA, rB);
    const gap = Math.min(64, Math.max(20, stageWidth * 0.06));
    // Reserve a margin either side of the pair — without it the larger disc came
    // out at nearly the full stage width, and its glow (and, at the extreme, its
    // own edge) was sheared off flat by the card's overflow:hidden, which reads
    // as a clipped planet rather than a big one.
    const margin = Math.min(56, stageWidth * 0.14);
    const maxPx = stageWidth
        ? Math.max(60, Math.min(300, (stageWidth - gap - margin) / (1 + smallShare)))
        : 0;

    return (
        <div style={{ position: 'relative', zIndex: 1, minHeight: 'var(--app-vh, 100vh)', paddingTop: 'var(--s-10)' }}>
            {/* .spine, not a maxWidth of its own — this page's content lands on
                the same column as the header above it and the catalog's cards. */}
            <div className="spine" style={{ paddingBottom: 'var(--s-10)' }}>

                {/* ── Header ── */}
                <PageHeader
                    onBack={() => navigate(-1)}
                    title={t('compare.title')}
                    subtitle={t('compare.subtitle')}
                />

                {/* ── Pickers ── */}
                <div className="glass flex flex-wrap items-end" style={{ padding: 'var(--s-4)', gap: 'var(--s-3)' }}>
                    <ObjectPicker label={t('compare.first')} value={idA} onChange={(v) => set(v, idB)}
                        groups={groups} fmtKm={fmtKm} localize={localize} t={t} />
                    <button
                        onClick={() => set(idB, idA)}
                        aria-label={t('compare.swap')}
                        title={t('compare.swapTitle')}
                        className="swap-btn focus-ring flex-shrink-0"
                    >
                        <ArrowLeftRight style={{ width: 16, height: 16 }} />
                    </button>
                    <ObjectPicker label={t('compare.second')} value={idB} onChange={(v) => set(idA, v)}
                        groups={groups} fmtKm={fmtKm} localize={localize} t={t} />
                </div>

                {/* ── To scale ── */}
                <div className="glass" style={{ marginTop: 16, padding: '28px 20px 22px', overflow: 'hidden' }}>
                    <div
                        ref={stageRef}
                        className="flex items-center justify-center"
                        style={{ gap, flexWrap: 'nowrap', minHeight: 120 }}
                    >
                        {maxPx > 0 && <>
                            <BodyDisc object={a} fraction={rA / Math.max(rA, rB)} maxPx={maxPx} />
                            <BodyDisc object={b} fraction={rB / Math.max(rA, rB)} maxPx={maxPx} />
                        </>}
                    </div>

                    <p style={{
                        margin: '22px 0 0', textAlign: 'center',
                        fontSize: 'clamp(1rem, 2.4vw, 1.3rem)', fontWeight: 700, color: '#fff',
                    }}>
                        {/* One sentence, one key: splitting it into fragments
                            around the highlighted number would fix the English
                            word order for every language that does not share
                            it. The emphasis is lost; the sentence is not. */}
                        {ratio < 1.005
                            ? t('compare.sameSize', {
                                a: localize(a).name, b: localize(b).name })
                            : t('compare.widerThan', {
                                bigger: localize(bigger).name,
                                smaller: localize(smaller).name,
                                ratio: fmtRatio(ratio),
                            })}
                    </p>
                    {ratio >= 1.005 && volume != null && (
                        <p style={{ margin: '6px 0 0', textAlign: 'center', fontSize: '0.85rem', color: 'var(--text-secondary)' }}>
                            {/* "1.26 Mercurys would fit inside Ganymede" is both
                                bad grammar and a strange way to picture it when
                                the answer is barely more than one. */}
                            {t(volume < 2 ? 'compare.volumeSmall' : 'compare.volumeMany', {
                                bigger: localize(bigger).name,
                                smaller: localize(smaller).name,
                                ratio: fmtRatio(volume),
                            })}
                        </p>
                    )}
                    <p style={{ margin: '10px 0 0', textAlign: 'center', fontSize: 11, color: 'var(--text-tertiary)' }}>
                        {t('compare.note')}
                    </p>
                </div>

                {/* ── The numbers ──
                    A real two-column table. The rows used to be
                    `1fr auto 1fr`, which sounds balanced but puts the only
                    fixed-width thing — the label — in the middle and lets the
                    two flexible columns grow outwards, so both values ended up
                    pinned either side of the centre with a third of the card
                    empty on each flank. Fixing the *label* column instead
                    gives each value a column of its own to sit in, and the two
                    now line up under the names in the header row. */}
                {sections.length > 0 && (
                    <div className="glass" style={{ marginTop: 'var(--s-4)', padding: 'var(--s-5) var(--s-6) var(--s-6)' }}>
                        {/* Which column is which. Sticky, because the table is
                            longer than the viewport and a bare pair of numbers
                            halfway down it says nothing about whose they are. */}
                        <div className="cmp-row cmp-head">
                            <span style={{ fontSize: 'var(--fs-sm)', fontWeight: 700, color: '#fff' }}>
                                {localize(a).name}
                            </span>
                            <span />
                            <span style={{ fontSize: 'var(--fs-sm)', fontWeight: 700, color: '#fff' }}>
                                {localize(b).name}
                            </span>
                        </div>

                        {sections.map(sec => (
                            <div key={sec.section} style={{ marginTop: 'var(--s-6)' }}>
                                <p className="label" style={{ margin: '0 0 var(--s-2)', textAlign: 'center' }}>
                                    {sectionLabel(sec.section)}
                                </p>
                                {sec.rows.map(row => (
                                    <div
                                        key={row.label}
                                        className="cmp-row items-baseline"
                                        style={{
                                            padding: 'var(--s-3) 0',
                                            borderTop: '1px solid var(--hairline)',
                                        }}
                                    >
                                        <span className="num-run" style={{
                                            fontSize: 'var(--fs-base)', fontWeight: 600, color: '#fff',
                                        }}>
                                            {row.a}
                                        </span>
                                        <span style={{
                                            fontSize: 'var(--fs-xs)', color: 'var(--text-tertiary)',
                                            whiteSpace: 'nowrap',
                                        }}>
                                            {statLabel(row.label)}
                                        </span>
                                        <span className="num-run" style={{
                                            fontSize: 'var(--fs-base)', fontWeight: 600, color: '#fff',
                                        }}>
                                            {row.b}
                                        </span>
                                    </div>
                                ))}
                            </div>
                        ))}
                    </div>
                )}

                <div className="flex flex-wrap justify-center" style={{ marginTop: 'var(--s-6)', gap: 'var(--s-3)' }}>
                    {[a, b].map((o, i) => (
                        <button
                            key={`${o.id}-${i}`}
                            onClick={() => navigate(`/object/${o.id}`)}
                            className="ghost-btn focus-ring"
                        >
                            {t('compare.about', { name: localize(o).name })}
                            <ArrowUpRight className="flip-rtl" style={{ width: 14, height: 14 }} />
                        </button>
                    ))}
                </div>
            </div>
        </div>
    );
};

export default ComparePage;
