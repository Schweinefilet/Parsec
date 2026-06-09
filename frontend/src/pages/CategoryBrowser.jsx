import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { useSearchParams, useNavigate, useParams } from 'react-router-dom';
import { ChevronDown, ChevronLeft, Globe, Moon, Star, Eye, Zap, CircleDot } from 'lucide-react';
import StarfieldBg from '../components/StarfieldBg';
import SolarSystem3D from '../components/SolarSystem3D';
import { CATEGORY_TABS, getObjectsByCategory, getObjectById } from '../data/objectCatalog';
import { useSpaceStrip } from '../hooks/useSpaceStrip';
import { useNasaImage } from '../hooks/useNasaImage';
import { computeDistanceSeries } from '../utils/astroFormatters';
import ObjectStatsPanel from '../components/ObjectStatsPanel';
import DataChart from '../components/DataChart';

const SCROLL_SPEED = 0.45;

// ── SpaceDataStrip ─────────────────────────────────────────────────────────────
const SpaceCell = ({ label, value, unit }) => (
    <div className="flex items-center gap-3 px-4 py-2 border-r border-white/10 flex-shrink-0">
        <span
            className="text-[11px] font-bold uppercase tracking-wider"
            style={{ color: 'var(--text-tertiary)' }}
        >
            {label}
        </span>
        {value != null ? (
            <span className="flex items-baseline gap-1">
                <span
                    className="text-sm font-bold tabular-nums"
                    style={{ color: 'var(--text-primary)', fontWeight: 600 }}
                >
                    {value}
                </span>
                {unit && (
                    <span className="text-[11px]" style={{ color: 'var(--text-secondary)' }}>
                        {unit}
                    </span>
                )}
            </span>
        ) : (
            <span className="text-xs animate-pulse" style={{ color: 'var(--text-tertiary)' }}>···</span>
        )}
    </div>
);

const SpaceDataStrip = () => {
    const cells       = useSpaceStrip();
    const trackRef    = useRef(null);
    const containerRef = useRef(null);
    const offsetRef   = useRef(0);
    const isDragging  = useRef(false);
    const dragStartX  = useRef(0);
    const dragStartOffset = useRef(0);
    const rafRef      = useRef(null);

    const normalize = useCallback((val) => {
        const track = trackRef.current;
        if (!track) return val;
        const w = track.scrollWidth / 2;
        if (w <= 0) return val;
        val = val % w;
        if (val > 0) val -= w;
        return val;
    }, []);

    useEffect(() => {
        const tick = () => {
            if (!isDragging.current && trackRef.current) {
                offsetRef.current = normalize(offsetRef.current - SCROLL_SPEED);
                trackRef.current.style.transform = `translateX(${offsetRef.current}px)`;
            }
            rafRef.current = requestAnimationFrame(tick);
        };
        rafRef.current = requestAnimationFrame(tick);
        return () => cancelAnimationFrame(rafRef.current);
    }, [normalize]);

    const handlePointerDown = useCallback(e => {
        isDragging.current = true;
        dragStartX.current = e.clientX;
        dragStartOffset.current = offsetRef.current;
        e.currentTarget.style.cursor = 'grabbing';
        e.currentTarget.setPointerCapture(e.pointerId);
    }, []);

    const handlePointerMove = useCallback(e => {
        if (!isDragging.current) return;
        const newOffset = normalize(dragStartOffset.current + (e.clientX - dragStartX.current));
        offsetRef.current = newOffset;
        if (trackRef.current) trackRef.current.style.transform = `translateX(${newOffset}px)`;
    }, [normalize]);

    const handlePointerUp = useCallback(e => {
        isDragging.current = false;
        if (e.currentTarget) e.currentTarget.style.cursor = 'grab';
    }, []);

    return (
        <div
            ref={containerRef}
            className="glass overflow-hidden select-none"
            style={{ padding: '4px 0', cursor: 'grab', borderRadius: 'var(--radius-card)' }}
            onPointerDown={handlePointerDown}
            onPointerMove={handlePointerMove}
            onPointerUp={handlePointerUp}
            onPointerCancel={handlePointerUp}
        >
            <div ref={trackRef} className="flex" style={{ willChange: 'transform' }}>
                {[0, 1].flatMap(copy =>
                    cells.map(cell => (
                        <SpaceCell
                            key={`${cell.key}-${copy}`}
                            label={cell.label}
                            value={cell.value}
                            unit={cell.unit}
                        />
                    ))
                )}
            </div>
        </div>
    );
};

// ── ObjectCard ─────────────────────────────────────────────────────────────────
const CATEGORY_COLORS = {
    stars:      'rgba(253, 184, 19, 0.18)',
    planets:    'rgba(100, 160, 255, 0.18)',
    'dwarf-planets': 'rgba(210, 190, 160, 0.18)',
    moons:      'rgba(180, 180, 220, 0.15)',
    exoplanets: 'rgba(255, 180, 80, 0.15)',
    'deep-sky': 'rgba(120, 220, 180, 0.15)',
    neos:       'rgba(255, 120, 80, 0.15)',
};

const CATEGORY_TEXT = {
    stars:      'rgba(253, 184, 19, 0.95)',
    planets:    'rgba(100, 160, 255, 0.9)',
    'dwarf-planets': 'rgba(220, 205, 180, 0.95)',
    moons:      'rgba(200, 200, 240, 0.9)',
    exoplanets: 'rgba(255, 190, 100, 0.9)',
    'deep-sky': 'rgba(140, 230, 190, 0.9)',
    neos:       'rgba(255, 140, 100, 0.9)',
};

const ObjectCard = ({ object }) => {
    const navigate = useNavigate();
    const imageUrl = useNasaImage(object.name, object.imageQuery);
    const hasImage = !!imageUrl;

    const badgeBg  = CATEGORY_COLORS[object.category] ?? 'rgba(255,255,255,0.1)';
    const badgeTxt = CATEGORY_TEXT[object.category]   ?? 'rgba(255,255,255,0.7)';

    const containerStyle = hasImage
        ? {
            position: 'relative',
            overflow: 'hidden',
            borderRadius: 'var(--radius-card)',
            minHeight: '130px',
            border: '1px solid var(--glass-border)',
            boxShadow: 'var(--glass-shadow), var(--glass-specular)',
            background: '#000',
            transition: 'border-color 0.3s ease, box-shadow 0.3s ease',
          }
        : { padding: '18px', borderRadius: '16px', minHeight: '130px' };

    return (
        <div
            className={`${hasImage ? '' : 'glass '}flex flex-col justify-between cursor-pointer`}
            style={containerStyle}
            onClick={() => navigate(`/object/${object.id}`)}
        >
            {/* Full-cover background image — <img> with object-fit:cover avoids black-bar letterboxing */}
            {hasImage && (
                <img
                    src={imageUrl}
                    alt=""
                    style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'cover', objectPosition: 'center' }}
                />
            )}

            {/* Dark overlay keeps text readable over the photo */}
            {hasImage && (
                <div
                    className="card-overlay absolute inset-0"
                    style={{
                        background: 'rgba(0, 0, 0, 0.52)',
                        backdropFilter: 'blur(2px)',
                        WebkitBackdropFilter: 'blur(2px)',
                    }}
                />
            )}

            {/* Content — z-10 floats above the overlay */}
            <div className="relative z-10 flex justify-between items-start" style={hasImage ? { padding: '18px 18px 0' } : {}}>
                <div className="min-w-0 flex-1 pr-2">
                    <h3
                        className="font-bold"
                        style={{ color: '#fff', fontSize: '0.95rem', letterSpacing: '-0.01em', fontWeight: 700 }}
                    >
                        {object.name}
                    </h3>
                    <p className="text-xs mt-0.5 truncate" style={{ color: 'rgba(255,255,255,0.6)' }}>
                        {object.type}
                    </p>
                </div>
                <span
                    className="text-[10px] font-bold px-2 py-0.5 rounded-lg flex-shrink-0"
                    style={{ background: badgeBg, color: badgeTxt }}
                >
                    {object.category.replace('-', ' ').toUpperCase()}
                </span>
            </div>

            <div className="relative z-10 mt-3" style={hasImage ? { padding: '0 18px 18px' } : {}}>
                <p className="text-lg font-bold tabular-nums" style={{ color: '#fff', fontWeight: 700 }}>
                    {object.keyStatValue}
                </p>
                <p className="text-[10px] uppercase tracking-wider" style={{ color: 'rgba(255,255,255,0.45)' }}>
                    {object.keyStatLabel}
                </p>

                {object.secondaryStatValue && (
                    <div className="mt-2 flex items-baseline gap-1.5">
                        <span className="text-xs font-medium" style={{ color: 'rgba(255,255,255,0.65)' }}>
                            {object.secondaryStatValue}
                        </span>
                        <span className="text-[10px] uppercase tracking-wider" style={{ color: 'rgba(255,255,255,0.40)' }}>
                            {object.secondaryStatLabel}
                        </span>
                    </div>
                )}
            </div>
        </div>
    );
};

// ── Sort Dropdown ──────────────────────────────────────────────────────────────
const SORT_OPTIONS = [
    { value: 'default', label: 'Default Order' },
    { value: 'name_az',  label: 'Name A → Z' },
    { value: 'name_za',  label: 'Name Z → A' },
];

const SortDropdown = ({ value, onChange }) => {
    const [open, setOpen] = useState(false);
    const selected = SORT_OPTIONS.find(o => o.value === value);
    return (
        <div className="relative">
            <button
                onClick={() => setOpen(o => !o)}
                className="flex items-center gap-1.5 text-sm transition-colors"
                style={{ color: 'var(--text-secondary)' }}
            >
                Sort:{' '}
                <span className="font-medium" style={{ color: 'var(--text-primary)' }}>
                    {selected?.label}
                </span>
                <ChevronDown className={`h-3.5 w-3.5 transition-transform ${open ? 'rotate-180' : ''}`} />
            </button>
            {open && (
                <div className="glass absolute right-0 top-full mt-1 w-44 z-20 py-1 overflow-hidden">
                    {SORT_OPTIONS.map(opt => (
                        <button
                            key={opt.value}
                            onClick={() => { onChange(opt.value); setOpen(false); }}
                            className="w-full text-left px-4 py-2 text-sm transition-colors"
                            style={opt.value === value
                                ? { color: '#fff', background: 'rgba(255,255,255,0.12)' }
                                : { color: 'var(--text-secondary)' }
                            }
                        >
                            {opt.label}
                        </button>
                    ))}
                </div>
            )}
        </div>
    );
};

// ── CategoryBrowser ────────────────────────────────────────────────────────────
const CATEGORY_ICONS = {
    stars:      Star,
    planets:    Globe,
    'dwarf-planets': CircleDot,
    moons:      Moon,
    exoplanets: Star,
    'deep-sky': Eye,
    neos:       Zap,
};

const CATEGORY_ACCENT_COLORS = {
    stars:      '#fdb813',
    planets:    '#64a0ff',
    'dwarf-planets': '#d9c3a8',
    moons:      '#c8c8f0',
    exoplanets: '#ffbe50',
    'deep-sky': '#8cdcbe',
    neos:       '#ff8c50',
};

const TIME_RANGES = [
    { key: '3m',  label: '3M',  days: 90  },
    { key: '6m',  label: '6M',  days: 180 },
    { key: '1y',  label: '1Y',  days: 365 },
    { key: '2y',  label: '2Y',  days: 730 },
];

const HAS_ORBIT_CHART = new Set(['planets', 'dwarf-planets', 'moons', 'neos']);

class ErrorBoundary extends React.Component {
    constructor(props) {
        super(props);
        this.state = { hasError: false };
    }
    static getDerivedStateFromError() { return { hasError: true }; }
    render() {
        if (this.state.hasError) {
            return (
                <div className="w-full h-full flex items-center justify-center p-8 text-center"
                    style={{ color: 'var(--text-tertiary)' }}>
                    Chart could not be rendered.
                </div>
            );
        }
        return this.props.children;
    }
}

const CategoryBrowser = () => {
    const { id } = useParams();
    const [searchParams] = useSearchParams();
    const activeTab = searchParams.get('tab') || 'planets';
    const [sortBy, setSortBy] = useState('default');
    const [timeRange, setTimeRange] = useState('1y');

    const currentCategory = CATEGORY_TABS.find(t => t.id === activeTab) ?? CATEGORY_TABS[0];
    const objects = getObjectsByCategory(currentCategory.id);

    const sorted = [...objects].sort((a, b) => {
        if (sortBy === 'name_az') return a.name.localeCompare(b.name);
        if (sortBy === 'name_za') return b.name.localeCompare(a.name);
        return 0;
    });

    const object = useMemo(() => (id ? getObjectById(id) : null), [id]);
    const imageUrl = useNasaImage(object?.name ?? null, object?.imageQuery);

    const chartData = useMemo(() => {
        if (!object?.orbital) return [];
        const rangeDef = TIME_RANGES.find(r => r.key === timeRange) ?? TIME_RANGES[2];

        if (object.id === 'earth') {
            const step = 5;
            const nowSec = Math.floor(Date.now() / 1000);
            const points = [];
            for (let d = -rangeDef.days; d <= 0; d += step) {
                const M = ((2 * Math.PI * d) / 365.25) + (object.orbital.phase ?? 0);
                points.push({ time: nowSec + d * 86400, value: 1.0 + 0.0167 * Math.cos(M) });
            }
            return points;
        }

        if (object.id === 'luna') {
            const step = 1;
            const nowSec = Math.floor(Date.now() / 1000);
            const points = [];
            for (let d = -rangeDef.days; d <= 0; d += step) {
                const M = ((2 * Math.PI * d) / 27.32) + (object.orbital.phase ?? 0);
                points.push({ time: nowSec + d * 86400, value: 0.00257 * (1 + 0.0549 * Math.cos(M)) });
            }
            return points;
        }

        return computeDistanceSeries(
            object.orbital.a,
            object.orbital.period,
            rangeDef.days,
            object.orbital.phase ?? 0,
        );
    }, [object, timeRange]);

    const showChart   = object && HAS_ORBIT_CHART.has(object.category) && !!object.orbital;
    const accentColor = object ? (CATEGORY_ACCENT_COLORS[object.category] ?? '#ffffff') : '#ffffff';

    const chartTitle    = object?.id === 'earth' ? 'Distance from Sun'
                        : object?.id === 'luna'  ? 'Distance from Earth'
                        : 'Distance from Earth';
    const chartSubtitle = object?.id === 'earth'
        ? 'Astronomical Units (AU) — eccentricity e = 0.0167'
        : object?.id === 'luna'
        ? 'Astronomical Units (AU) — eccentricity e = 0.0549'
        : object?.orbital?.e != null
        ? `Astronomical Units (AU) — eccentricity e = ${object.orbital.e.toFixed(3)}`
        : 'Astronomical Units (AU) — circular orbit approximation';

    const isPlanetOrMoon = object && (object.category === 'planets' || object.category === 'dwarf-planets' || object.category === 'stars' || object.id === 'luna');
    const physicalRows   = object?.stats?.find(s => s.section === 'Physical')?.rows ?? [];

    return (
        <>
            <StarfieldBg canvasId="starfield-browser" />
            <div className="relative space-y-6" style={{ zIndex: 1 }}>
                
                {/* 3D Visualizer + Annotations Overlay */}
                <div className="relative">
                    <SolarSystem3D focusedId={id} />

                    {/* Annotations overlay (faded in if id is present) */}
                    <div
                        className="absolute inset-0 pointer-events-none flex items-center justify-between px-6 md:px-16 transition-all duration-700 ease-out"
                        style={{
                            zIndex: 5,
                            opacity: id && isPlanetOrMoon ? 1 : 0,
                            transform: id && isPlanetOrMoon ? 'scale(1)' : 'scale(0.96)',
                            pointerEvents: id && isPlanetOrMoon ? 'auto' : 'none',
                        }}
                    >
                        {isPlanetOrMoon && (
                            <>
                                {/* Left annotations */}
                                <div className="flex flex-col gap-8 md:gap-14 items-end text-right" style={{ maxWidth: '35%', textShadow: '0 2px 5px rgba(0,0,0,0.9)' }}>
                                    <div>
                                        <h1 className="font-extrabold tracking-tight leading-none text-white animate-fade-in" style={{ fontSize: 'clamp(1.2rem, 3.8vw, 2.2rem)' }}>
                                            {object?.name}
                                        </h1>
                                        <p className="font-bold tracking-widest uppercase text-white/40 mt-1" style={{ fontSize: '0.62rem' }}>
                                            {object?.type}
                                        </p>
                                    </div>

                                    {physicalRows[0] && (
                                        <div>
                                            <p className="font-extrabold text-white/90" style={{ fontSize: 'clamp(0.76rem, 2.3vw, 1rem)' }}>
                                                {physicalRows[0].value}
                                            </p>
                                            <p className="font-bold tracking-wider uppercase text-white/30 mt-0.5" style={{ fontSize: '0.55rem' }}>
                                                {physicalRows[0].label}
                                            </p>
                                        </div>
                                    )}
                                </div>

                                {/* Blank middle spacer */}
                                <div className="flex-1 pointer-events-none" />

                                {/* Right annotations */}
                                <div className="flex flex-col gap-8 md:gap-14 items-start text-left" style={{ maxWidth: '35%', textShadow: '0 2px 5px rgba(0,0,0,0.9)' }}>
                                    <div>
                                        <p className="font-extrabold text-white/90" style={{ fontSize: 'clamp(0.76rem, 2.3vw, 1rem)' }}>
                                            {object?.keyStatValue}
                                        </p>
                                        <p className="font-bold tracking-wider uppercase text-white/30 mt-0.5" style={{ fontSize: '0.55rem' }}>
                                            {object?.keyStatLabel}
                                        </p>
                                    </div>

                                    {physicalRows[1] && (
                                        <div>
                                            <p className="font-extrabold text-white/90" style={{ fontSize: 'clamp(0.76rem, 2.3vw, 1rem)' }}>
                                                {physicalRows[1].value}
                                            </p>
                                            <p className="font-bold tracking-wider uppercase text-white/30 mt-0.5" style={{ fontSize: '0.55rem' }}>
                                                {physicalRows[1].label}
                                            </p>
                                        </div>
                                    )}
                                </div>
                            </>
                        )}
                    </div>
                </div>

                {/* ── HOME STATE elements ── */}
                <div
                    className="transition-all duration-500 ease-in-out flex flex-col gap-6"
                    style={{
                        opacity: id ? 0 : 1,
                        maxHeight: id ? '0px' : '2000px',
                        overflow: 'hidden',
                        pointerEvents: id ? 'none' : 'auto',
                    }}
                >
                    {/* Live space data ticker */}
                    <SpaceDataStrip />

                    {/* Category header + sort */}
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 sm:gap-4" style={{ marginTop: '20px' }}>
                        <div>
                            <h2 className="font-bold" style={{ fontSize: '1.25rem', color: '#fff' }}>
                                {currentCategory.label}
                            </h2>
                            <p className="text-sm" style={{ color: 'var(--text-tertiary)' }}>
                                {currentCategory.description} &mdash; {objects.length} objects
                            </p>
                        </div>
                        <SortDropdown value={sortBy} onChange={setSortBy} />
                    </div>

                    {/* Card grid — last card spans 2 cols at sm when count is odd to avoid orphan */}
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                        {sorted.map((obj, idx) => {
                            const isLastOdd = idx === sorted.length - 1 && sorted.length % 2 !== 0;
                            return (
                                <div key={obj.id} className={isLastOdd ? 'sm:col-span-2 lg:col-span-1 xl:col-span-1' : ''}>
                                    <ObjectCard object={obj} />
                                </div>
                            );
                        })}
                        {sorted.length === 0 && (
                            <div className="col-span-full py-16 text-center" style={{ color: 'var(--text-tertiary)' }}>
                                No objects in this category yet.
                            </div>
                        )}
                    </div>
                </div>

                {/* ── DETAIL STATE elements ── */}
                <div
                    className="transition-all duration-500 ease-in-out"
                    style={{
                        opacity: id ? 1 : 0,
                        maxHeight: id ? '2500px' : '0px',
                        overflow: 'hidden',
                        pointerEvents: id ? 'auto' : 'none',
                    }}
                >
                    {object && (
                        <div className="px-4 md:px-8 max-w-2xl mx-auto w-full relative z-10 flex flex-col gap-4">
                            
                            {/* Hero image — non-planet/moon objects only */}
                            {!isPlanetOrMoon && imageUrl && (
                                <div
                                    style={{
                                        position: 'relative',
                                        overflow: 'hidden',
                                        borderRadius: 'var(--radius-card)',
                                        height: '220px',
                                        border: '1px solid var(--glass-border)',
                                        boxShadow: 'var(--glass-shadow)',
                                        background: '#000',
                                    }}
                                >
                                    <img
                                        src={imageUrl}
                                        alt={object.name}
                                        style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'cover', objectPosition: 'center' }}
                                    />
                                    <div
                                        className="card-overlay absolute inset-0"
                                        style={{
                                            background: 'linear-gradient(to bottom, rgba(0,0,0,0.10) 0%, rgba(0,0,0,0.65) 100%)',
                                        }}
                                    />
                                    <div style={{ position: 'absolute', bottom: 16, left: 18, right: 18 }}>
                                        <p className="font-bold text-lg text-white leading-tight">{object.name}</p>
                                        <p className="text-sm" style={{ color: 'rgba(255,255,255,0.6)' }}>{object.type}</p>
                                    </div>
                                </div>
                            )}

                            {/* Key stats strip — non-planet/moon objects only */}
                            {!isPlanetOrMoon && (
                                <div className="glass p-4 flex gap-6 flex-wrap">
                                    <div>
                                        <p className="text-2xl font-black" style={{ color: '#fff' }}>
                                            {object.keyStatValue}
                                        </p>
                                        <p className="text-[10px] uppercase tracking-wider mt-0.5"
                                            style={{ color: 'var(--text-tertiary)' }}>
                                            {object.keyStatLabel}
                                        </p>
                                    </div>
                                    {object.secondaryStatValue && (
                                        <>
                                            <div className="w-px self-stretch" style={{ background: 'rgba(255,255,255,0.1)' }} />
                                            <div>
                                                <p className="text-xl font-bold" style={{ color: 'var(--text-secondary)' }}>
                                                    {object.secondaryStatValue}
                                                </p>
                                                <p className="text-[10px] uppercase tracking-wider mt-0.5"
                                                    style={{ color: 'var(--text-tertiary)' }}>
                                                    {object.secondaryStatLabel}
                                                </p>
                                            </div>
                                        </>
                                    )}
                                </div>
                            )}

                            {/* Description */}
                            <div className="glass p-5">
                                <p style={{ color: 'var(--text-secondary)', lineHeight: 1.65, fontSize: '0.9rem' }}>
                                    {object.description}
                                </p>
                            </div>

                            {/* Distance Chart */}
                            {showChart && object.orbital && (
                                <div className="glass p-5">
                                    <div className="flex items-center justify-between mb-4 flex-wrap gap-2">
                                        <div>
                                            <h4 className="font-bold text-sm text-white">{chartTitle}</h4>
                                            <p className="text-[10px]" style={{ color: 'var(--text-tertiary)' }}>
                                                {chartSubtitle}
                                            </p>
                                        </div>
                                        <div className="flex bg-white/5 p-0.5 rounded-lg border border-white/5">
                                            {TIME_RANGES.map(r => (
                                                <button
                                                    key={r.key}
                                                    onClick={() => setTimeRange(r.key)}
                                                    className="px-2.5 py-1 rounded-md text-[10px] font-bold transition-all"
                                                    style={timeRange === r.key
                                                        ? { background: 'rgba(255,255,255,0.12)', color: '#fff' }
                                                        : { color: 'rgba(255,255,255,0.40)' }
                                                    }
                                                >
                                                    {r.label}
                                                </button>
                                            ))}
                                        </div>
                                    </div>
                                    <div style={{ height: '160px', width: '100%' }}>
                                        <ErrorBoundary>
                                            <DataChart
                                                data={chartData}
                                                color={accentColor}
                                            />
                                        </ErrorBoundary>
                                    </div>
                                </div>
                            )}

                            {/* Stats panel */}
                            <ObjectStatsPanel object={object} />
                        </div>
                    )}
                </div>
            </div>
        </>
    );
};

export default CategoryBrowser;
