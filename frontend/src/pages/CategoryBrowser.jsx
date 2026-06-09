import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { ChevronDown } from 'lucide-react';
import StarfieldBg from '../components/StarfieldBg';
import SolarSystem3D from '../components/SolarSystem3D';
import { CATEGORY_TABS, getObjectsByCategory } from '../data/objectCatalog';
import { useSpaceStrip } from '../hooks/useSpaceStrip';
import { useNasaImage } from '../hooks/useNasaImage';

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
const CategoryBrowser = () => {
    const [searchParams] = useSearchParams();
    const activeTab = searchParams.get('tab') || 'planets';
    const [sortBy, setSortBy] = useState('default');

    const currentCategory = CATEGORY_TABS.find(t => t.id === activeTab) ?? CATEGORY_TABS[0];
    const objects = getObjectsByCategory(currentCategory.id);

    const sorted = [...objects].sort((a, b) => {
        if (sortBy === 'name_az') return a.name.localeCompare(b.name);
        if (sortBy === 'name_za') return b.name.localeCompare(a.name);
        return 0;
    });

    return (
        <>
            <StarfieldBg canvasId="starfield-browser" />
            <div className="relative space-y-6" style={{ zIndex: 1 }}>
                {/* Hero solar system */}
                <SolarSystem3D />

                {/* Live space data ticker */}
                <SpaceDataStrip />

                {/* Category header + sort */}
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 sm:gap-4" style={{ marginTop: '40px' }}>
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
        </>
    );
};

export default CategoryBrowser;
