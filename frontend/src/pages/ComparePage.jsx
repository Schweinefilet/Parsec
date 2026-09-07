import { useMemo, useRef, useState, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { ChevronLeft, ArrowLeftRight, ArrowUpRight } from 'lucide-react';
import { OBJECTS, CATEGORY_TABS, getObjectById } from '../data/objectCatalog';
import { radiusKm, isComparable, volumeRatio } from '../utils/objectSize';
import { objectImage } from '../data/objectImages';
import { accentOf } from '../data/categoryStyles';

const DEFAULT_A = 'jupiter';
const DEFAULT_B = 'earth';

// Everything with a real physical size, grouped the way the catalog is and
// largest first inside each group — which is the order you want when the
// question is how big something is.
const COMPARABLE = OBJECTS.filter(isComparable);
const GROUPS = CATEGORY_TABS
    .map(tab => ({
        label: tab.label,
        items: COMPARABLE
            .filter(o => o.category === tab.id)
            .sort((a, b) => radiusKm(b) - radiusKm(a)),
    }))
    .filter(g => g.items.length > 0);

const fmtKm = (km) => {
    if (km >= 10) return `${Math.round(km).toLocaleString()} km`;
    if (km >= 1) return `${km.toFixed(1)} km`;
    if (km >= 0.001) return `${Math.round(km * 1000).toLocaleString()} m`;
    return `${(km * 100000).toFixed(0)} cm`;
};

/** 11.2 rather than 11.20, but 1.08 rather than 1.1 — significance, not places. */
const fmtRatio = (n) => {
    if (n >= 1000) return Math.round(n).toLocaleString();
    if (n >= 100) return n.toFixed(0);
    if (n >= 10) return n.toFixed(1);
    return n.toFixed(2);
};

const ObjectPicker = ({ value, onChange, label }) => (
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
            {GROUPS.map(g => (
                <optgroup key={g.label} label={g.label} style={{ background: '#0b0d12' }}>
                    {g.items.map(o => (
                        <option key={o.id} value={o.id} style={{ background: '#0b0d12' }}>
                            {o.name} — {fmtKm(radiusKm(o) * 2)} across
                        </option>
                    ))}
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
                        // A terminator and a rim, so a flat crop reads as a body
                        boxShadow: px > 8
                            ? `inset ${-px * 0.16}px ${-px * 0.1}px ${px * 0.4}px rgba(0,0,0,0.75), 0 0 ${Math.min(46, px * 0.34)}px rgba(${accent.rgb},0.38)`
                            : `0 0 6px rgba(${accent.rgb},0.9)`,
                        outline: px < 6 ? `1px solid rgba(${accent.rgb},0.9)` : 'none',
                        outlineOffset: 2,
                    }}
                />
            </div>
            <div style={{ textAlign: 'center', minWidth: 0 }}>
                <p style={{ margin: 0, fontSize: '0.95rem', fontWeight: 700, color: '#fff' }}>{object.name}</p>
                <p style={{ margin: '2px 0 0', fontSize: '0.75rem', color: 'var(--text-tertiary)', fontVariantNumeric: 'tabular-nums' }}>
                    {fmtKm(radiusKm(object) * 2)} across
                </p>
            </div>
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
            if (rowB) rows.push({ label: rowA.label, a: rowA.value, b: rowB.value });
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

    const sections = useMemo(() => buildRows(a, b), [a, b]);

    // Both discs plus the gap have to fit the card, and the smaller one's share
    // depends on the pair — Titan beside Saturn asks for almost nothing, Mercury
    // beside Ganymede for nearly as much again.
    const stageRef = useRef(null);
    const stageWidth = useMeasuredWidth(stageRef);
    const smallShare = Math.min(rA, rB) / Math.max(rA, rB);
    const gap = Math.min(64, Math.max(20, stageWidth * 0.06));
    const maxPx = stageWidth
        ? Math.max(60, Math.min(320, (stageWidth - gap) / (1 + smallShare)))
        : 0;

    return (
        <div style={{ position: 'relative', zIndex: 1, minHeight: 'var(--app-vh, 100vh)', paddingTop: 64 }}>
            <div style={{ maxWidth: 1180, margin: '0 auto', padding: '0 16px 40px' }}>

                {/* ── Header ── */}
                <div className="flex items-center gap-3 mb-4">
                    <button
                        onClick={() => navigate(-1)}
                        aria-label="Go back"
                        className="flex items-center justify-center rounded-xl focus-ring"
                        style={{
                            width: 36, height: 36, flexShrink: 0,
                            background: 'rgba(255,255,255,0.06)',
                            border: '1px solid rgba(255,255,255,0.14)',
                            color: 'rgba(255,255,255,0.85)', cursor: 'pointer',
                        }}
                    >
                        <ChevronLeft style={{ width: 18, height: 18 }} />
                    </button>
                    <div style={{ minWidth: 0 }}>
                        <h1 style={{ margin: 0, fontSize: 'clamp(1.15rem, 3vw, 1.6rem)', fontWeight: 800, letterSpacing: '-0.02em', color: '#fff' }}>
                            Compare
                        </h1>
                        <p style={{ margin: '1px 0 0', fontSize: '0.72rem', color: 'var(--text-tertiary)' }}>
                            Two bodies at true relative size
                        </p>
                    </div>
                </div>

                {/* ── Pickers ── */}
                <div className="glass flex flex-wrap items-end gap-3" style={{ padding: 16 }}>
                    <ObjectPicker label="First" value={idA} onChange={(v) => set(v, idB)} />
                    <button
                        onClick={() => set(idB, idA)}
                        aria-label="Swap the two objects"
                        title="Swap"
                        className="flex items-center justify-center rounded-xl focus-ring flex-shrink-0"
                        style={{
                            width: 40, height: 40, marginBottom: 1,
                            background: 'rgba(255,255,255,0.06)',
                            border: '1px solid rgba(255,255,255,0.14)',
                            color: 'rgba(255,255,255,0.8)', cursor: 'pointer',
                        }}
                    >
                        <ArrowLeftRight style={{ width: 16, height: 16 }} />
                    </button>
                    <ObjectPicker label="Second" value={idB} onChange={(v) => set(idA, v)} />
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
                        {ratio < 1.005
                            ? <>{a.name} and {b.name} are the same size</>
                            : <>{bigger.name} is <span style={{ color: 'var(--accent)' }}>{fmtRatio(ratio)}×</span> wider than {smaller.name}</>}
                    </p>
                    {ratio >= 1.005 && volume != null && (
                        <p style={{ margin: '6px 0 0', textAlign: 'center', fontSize: '0.85rem', color: 'var(--text-secondary)' }}>
                            {volume < 2
                                // "1.26 Mercurys would fit inside Ganymede" is
                                // both bad grammar and a strange way to picture
                                // it when the answer is barely more than one.
                                ? <>{bigger.name} has {fmtRatio(volume)}× the volume of {smaller.name}</>
                                : <>{fmtRatio(volume)} {smaller.name}s would fit inside {bigger.name}</>}
                        </p>
                    )}
                    <p style={{ margin: '10px 0 0', textAlign: 'center', fontSize: 11, color: 'var(--text-tertiary)' }}>
                        Drawn to scale — unlike the solar system view, nothing here is compressed
                    </p>
                </div>

                {/* ── The numbers ── */}
                {sections.length > 0 && (
                    <div className="glass" style={{ marginTop: 16, padding: '4px 20px 16px' }}>
                        {sections.map(sec => (
                            <div key={sec.section} style={{ marginTop: 16 }}>
                                <p style={{
                                    margin: '0 0 6px', fontSize: 9, fontWeight: 800, letterSpacing: '0.12em',
                                    textTransform: 'uppercase', color: 'var(--text-tertiary)',
                                }}>
                                    {sec.section}
                                </p>
                                {sec.rows.map(row => (
                                    <div
                                        key={row.label}
                                        className="grid items-baseline"
                                        style={{
                                            gridTemplateColumns: '1fr auto 1fr',
                                            gap: 12, padding: '7px 0',
                                            borderTop: '1px solid rgba(255,255,255,0.06)',
                                        }}
                                    >
                                        <span style={{ fontSize: '0.85rem', color: '#fff', textAlign: 'right', fontVariantNumeric: 'tabular-nums' }}>
                                            {row.a}
                                        </span>
                                        <span style={{ fontSize: '0.7rem', color: 'var(--text-tertiary)', textAlign: 'center', whiteSpace: 'nowrap' }}>
                                            {row.label}
                                        </span>
                                        <span style={{ fontSize: '0.85rem', color: '#fff', fontVariantNumeric: 'tabular-nums' }}>
                                            {row.b}
                                        </span>
                                    </div>
                                ))}
                            </div>
                        ))}
                    </div>
                )}

                <div className="flex flex-wrap justify-center gap-2" style={{ marginTop: 16 }}>
                    {[a, b].map((o, i) => (
                        <button
                            key={`${o.id}-${i}`}
                            onClick={() => navigate(`/object/${o.id}`)}
                            className="flex items-center gap-1.5 rounded-xl font-bold focus-ring"
                            style={{
                                padding: '9px 14px', fontSize: '0.8rem',
                                background: 'rgba(255,255,255,0.06)',
                                border: '1px solid rgba(255,255,255,0.14)',
                                color: 'rgba(255,255,255,0.85)', cursor: 'pointer',
                            }}
                        >
                            About {o.name}
                            <ArrowUpRight style={{ width: 14, height: 14 }} />
                        </button>
                    ))}
                </div>
            </div>
        </div>
    );
};

export default ComparePage;
