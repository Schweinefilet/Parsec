import React, { useState, useMemo, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { ChevronLeft, Globe, Moon, Star, Eye, Zap, CircleDot } from 'lucide-react';
import { getObjectById } from '../data/objectCatalog';
import { computeDistanceSeries } from '../utils/astroFormatters';
import ObjectStatsPanel from '../components/ObjectStatsPanel';
import DataChart from '../components/DataChart';
import StarfieldBg from '../components/StarfieldBg';
import { useNasaImage } from '../hooks/useNasaImage';
import PlanetViewer from '../components/PlanetViewer';

const CATEGORY_ICONS = {
    stars:      Star,
    planets:    Globe,
    'dwarf-planets': CircleDot,
    moons:      Moon,
    exoplanets: Star,
    'deep-sky': Eye,
    neos:       Zap,
};

const CATEGORY_COLORS = {
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

const ObjectDetail = () => {
    const { id } = useParams();
    const navigate = useNavigate();
    const [timeRange, setTimeRange] = useState('1y');

    const [visible, setVisible] = useState(false);
    useEffect(() => {
        const id = setTimeout(() => setVisible(true), 50);
        return () => clearTimeout(id);
    }, []);

    const object   = getObjectById(id);
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
    const accentColor = object ? (CATEGORY_COLORS[object.category] ?? '#ffffff') : '#ffffff';
    const CategoryIcon = object ? (CATEGORY_ICONS[object.category] ?? Globe) : Globe;

    if (!object) {
        return (
            <div className="min-h-screen flex items-center justify-center"
                style={{ color: 'var(--text-secondary)' }}>
                <div className="text-center">
                    <p className="text-xl font-bold mb-4">Object not found</p>
                    <button
                        onClick={() => navigate('/')}
                        className="px-4 py-2 rounded-xl text-sm font-bold transition-colors"
                        style={{ background: 'rgba(255,255,255,0.1)', color: '#fff' }}
                    >
                        Back to Catalog
                    </button>
                </div>
            </div>
        );
    }

    const chartTitle    = object.id === 'earth' ? 'Distance from Sun'
                        : object.id === 'luna'  ? 'Distance from Earth'
                        : 'Distance from Earth';
    const chartSubtitle = object.id === 'earth'
        ? 'Astronomical Units (AU) — eccentricity e = 0.0167'
        : object.id === 'luna'
        ? 'Astronomical Units (AU) — eccentricity e = 0.0549'
        : object.orbital?.e != null
        ? `Astronomical Units (AU) — eccentricity e = ${object.orbital.e.toFixed(3)}`
        : 'Astronomical Units (AU) — circular orbit approximation';

    const isPlanetOrMoon = object.category === 'planets' || object.category === 'dwarf-planets' || object.category === 'stars' || object.id === 'luna';
    const physicalRows   = object.stats?.find(s => s.section === 'Physical')?.rows ?? [];

    return (
        <div
            className="min-h-screen text-white"
            style={{ paddingBottom: '40px', opacity: visible ? 1 : 0, transition: 'opacity 300ms ease' }}
        >
            <StarfieldBg canvasId="starfield-detail" />

            {/* ── Header bar ── */}
            <div
                className="glass sticky top-0 z-50 flex items-center gap-3 px-4 md:px-8"
                style={{
                    borderRadius: 0,
                    borderLeft: 'none',
                    borderRight: 'none',
                    borderTop: 'none',
                    height: '56px',
                }}
            >
                <button
                    onClick={() => navigate(-1)}
                    className="flex items-center gap-1.5 text-sm transition-colors flex-shrink-0"
                    style={{ color: 'var(--text-secondary)' }}
                >
                    <ChevronLeft className="h-4 w-4" />
                    Back
                </button>

                <div className="h-5 w-px" style={{ background: 'rgba(255,255,255,0.15)' }} />

                <CategoryIcon className="h-4 w-4 flex-shrink-0" style={{ color: accentColor }} />
                <span className="font-bold text-base truncate">{object.name}</span>
                <span
                    className="text-xs px-2.5 py-0.5 rounded-lg flex-shrink-0 hidden md:inline-block"
                    style={{ background: 'rgba(255,255,255,0.08)', color: 'var(--text-secondary)' }}
                >
                    {object.type}
                </span>
            </div>

            {/* ═══ DIAGRAM — planets & moons ═══
                3D model is the centrepiece; 4 annotations point inward from the corners.
                Left side: name+type (primary) and first physical stat (secondary).
                Right side: key stat and second physical stat.
            */}
            {isPlanetOrMoon && (
                <div className="relative z-10" style={{ padding: '28px 20px 4px' }}>
                    <div style={{
                        maxWidth: '860px',
                        margin: '0 auto',
                        display: 'flex',
                        alignItems: 'center',
                        minHeight: '260px',
                    }}>

                        {/* ── Left annotations ── */}
                        <div style={{
                            flex: 1,
                            minWidth: 0,
                            display: 'flex',
                            flexDirection: 'column',
                            gap: '52px',
                            alignItems: 'flex-end',
                        }}>

                            {/* Name + Type */}
                            <div style={{ display: 'flex', alignItems: 'center' }}>
                                <div style={{ textAlign: 'right', minWidth: 0 }}>
                                    <div style={{
                                        fontSize: 'clamp(1.2rem, 4.2vw, 1.85rem)',
                                        fontWeight: 900,
                                        letterSpacing: '-0.025em',
                                        color: '#fff',
                                        lineHeight: 1.1,
                                    }}>
                                        {object.name}
                                    </div>
                                    <div style={{
                                        fontSize: '0.58rem',
                                        fontWeight: 700,
                                        letterSpacing: '0.15em',
                                        textTransform: 'uppercase',
                                        color: 'rgba(255,255,255,0.33)',
                                        marginTop: '5px',
                                    }}>
                                        {object.type}
                                    </div>
                                </div>
                                {/* connector: line → dot */}
                                <div style={{ display: 'flex', alignItems: 'center', flexShrink: 0 }}>
                                    <div style={{ width: '30px', height: '1px', background: 'rgba(255,255,255,0.16)' }} />
                                    <div style={{ width: '5px', height: '5px', borderRadius: '50%', background: 'rgba(255,255,255,0.24)', flexShrink: 0 }} />
                                </div>
                            </div>

                            {/* Physical stat 0 — typically Diameter */}
                            {physicalRows[0] && (
                                <div style={{ display: 'flex', alignItems: 'center' }}>
                                    <div style={{ textAlign: 'right', minWidth: 0 }}>
                                        <div style={{
                                            fontSize: 'clamp(0.76rem, 2.3vw, 0.9rem)',
                                            fontWeight: 800,
                                            color: 'rgba(255,255,255,0.68)',
                                        }}>
                                            {physicalRows[0].value}
                                        </div>
                                        <div style={{
                                            fontSize: '0.55rem',
                                            fontWeight: 700,
                                            letterSpacing: '0.13em',
                                            textTransform: 'uppercase',
                                            color: 'rgba(255,255,255,0.26)',
                                            marginTop: '3px',
                                        }}>
                                            {physicalRows[0].label}
                                        </div>
                                    </div>
                                    <div style={{ display: 'flex', alignItems: 'center', flexShrink: 0 }}>
                                        <div style={{ width: '30px', height: '1px', background: 'rgba(255,255,255,0.10)' }} />
                                        <div style={{ width: '4px', height: '4px', borderRadius: '50%', background: 'rgba(255,255,255,0.18)', flexShrink: 0 }} />
                                    </div>
                                </div>
                            )}
                        </div>

                        {/* ── Planet 3D model ── */}
                        <div style={{ width: 'clamp(150px, 30vw, 250px)', flexShrink: 0 }}>
                            <PlanetViewer planetName={object.name} />
                        </div>

                        {/* ── Right annotations ── */}
                        <div style={{
                            flex: 1,
                            minWidth: 0,
                            display: 'flex',
                            flexDirection: 'column',
                            gap: '52px',
                            alignItems: 'flex-start',
                        }}>

                            {/* Key stat — distance from sun / earth */}
                            <div style={{ display: 'flex', alignItems: 'center' }}>
                                {/* connector: dot → line */}
                                <div style={{ display: 'flex', alignItems: 'center', flexShrink: 0 }}>
                                    <div style={{ width: '5px', height: '5px', borderRadius: '50%', background: 'rgba(255,255,255,0.24)', flexShrink: 0 }} />
                                    <div style={{ width: '30px', height: '1px', background: 'rgba(255,255,255,0.16)' }} />
                                </div>
                                <div style={{ minWidth: 0 }}>
                                    <div style={{
                                        fontSize: 'clamp(0.76rem, 2.3vw, 0.9rem)',
                                        fontWeight: 800,
                                        color: 'rgba(255,255,255,0.68)',
                                    }}>
                                        {object.keyStatValue}
                                    </div>
                                    <div style={{
                                        fontSize: '0.55rem',
                                        fontWeight: 700,
                                        letterSpacing: '0.13em',
                                        textTransform: 'uppercase',
                                        color: 'rgba(255,255,255,0.26)',
                                        marginTop: '3px',
                                    }}>
                                        {object.keyStatLabel}
                                    </div>
                                </div>
                            </div>

                            {/* Physical stat 1 — typically Surface Temp */}
                            {physicalRows[1] && (
                                <div style={{ display: 'flex', alignItems: 'center' }}>
                                    <div style={{ display: 'flex', alignItems: 'center', flexShrink: 0 }}>
                                        <div style={{ width: '4px', height: '4px', borderRadius: '50%', background: 'rgba(255,255,255,0.18)', flexShrink: 0 }} />
                                        <div style={{ width: '30px', height: '1px', background: 'rgba(255,255,255,0.10)' }} />
                                    </div>
                                    <div style={{ minWidth: 0 }}>
                                        <div style={{
                                            fontSize: 'clamp(0.76rem, 2.3vw, 0.9rem)',
                                            fontWeight: 800,
                                            color: 'rgba(255,255,255,0.68)',
                                        }}>
                                            {physicalRows[1].value}
                                        </div>
                                        <div style={{
                                            fontSize: '0.55rem',
                                            fontWeight: 700,
                                            letterSpacing: '0.13em',
                                            textTransform: 'uppercase',
                                            color: 'rgba(255,255,255,0.26)',
                                            marginTop: '3px',
                                        }}>
                                            {physicalRows[1].label}
                                        </div>
                                    </div>
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            )}

            {/* ═══ CONTENT ═══ */}
            <div
                className="px-4 md:px-8 max-w-2xl mx-auto w-full relative z-10"
                style={{ paddingTop: isPlanetOrMoon ? '8px' : '32px' }}
            >
                <div className="flex flex-col gap-4">

                    {/* Hero image — non-planet objects only */}
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

                    {/* Key stats strip — non-planet objects only */}
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

                    {/* Stats panel */}
                    <ObjectStatsPanel object={object} />
                </div>
            </div>

        </div>
    );
};

export default ObjectDetail;
