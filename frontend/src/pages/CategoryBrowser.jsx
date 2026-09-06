import { useState, useEffect, useMemo, useCallback } from 'react';
import { useSearchParams, useNavigate, useMatch } from 'react-router-dom';
import { ChevronDown, ChevronLeft, ArrowUpRight } from 'lucide-react';
import StarfieldBg from '../components/StarfieldBg';
import SolarSystem3D from '../components/SolarSystem3D';
import SpaceDataStrip from '../components/SpaceDataStrip';
import ObjectCard from '../components/ObjectCard';
import ObjectDetailBody from '../components/ObjectDetailBody';
import SpacecraftViewer from '../components/SpacecraftViewer';
import TimeControl from '../components/TimeControl';
import { CATEGORY_TABS, getObjectsByCategory, getObjectById } from '../data/objectCatalog';
import { useHorizons } from '../hooks/useHorizons';
import { useIsMobile } from '../hooks/useMediaQuery';

const SORT_OPTIONS = [
    { value: 'default', label: 'Default Order' },
    { value: 'name_az', label: 'Name A → Z' },
    { value: 'name_za', label: 'Name Z → A' },
];

const SortDropdown = ({ value, onChange }) => {
    const [open, setOpen] = useState(false);
    const selected = SORT_OPTIONS.find(o => o.value === value);

    useEffect(() => {
        if (!open) return;
        const close = () => setOpen(false);
        window.addEventListener('click', close);
        return () => window.removeEventListener('click', close);
    }, [open]);

    return (
        <div className="relative" onClick={e => e.stopPropagation()}>
            <button
                onClick={() => setOpen(o => !o)}
                aria-expanded={open}
                aria-haspopup="listbox"
                className="flex items-center gap-1.5 text-sm"
                style={{ color: 'var(--text-secondary)' }}
            >
                Sort:{' '}
                <span className="font-medium" style={{ color: 'var(--text-primary)' }}>
                    {selected?.label}
                </span>
                <ChevronDown className={`h-3.5 w-3.5 transition-transform ${open ? 'rotate-180' : ''}`} />
            </button>
            {open && (
                <div className="glass absolute right-0 top-full mt-1 w-44 z-20 py-1 overflow-hidden" role="listbox">
                    {SORT_OPTIONS.map(opt => (
                        <button
                            key={opt.value}
                            role="option"
                            aria-selected={opt.value === value}
                            onClick={() => { onChange(opt.value); setOpen(false); }}
                            className="w-full text-left px-4 py-2 text-sm"
                            style={opt.value === value
                                ? { color: '#fff', background: 'rgba(255,255,255,0.12)' }
                                : { color: 'var(--text-secondary)' }}
                        >
                            {opt.label}
                        </button>
                    ))}
                </div>
            )}
        </div>
    );
};

const LiveDistanceRow = ({ spacecraftId }) => {
    const { distanceAU } = useHorizons(spacecraftId);
    if (distanceAU == null) return null;
    const km = distanceAU * 149597870.7;
    const lightHours = km / 1079252848.8;   // km per light-hour
    return (
        <div className="glass p-5">
            <p className="text-[10px] font-bold uppercase tracking-widest" style={{ color: 'var(--text-tertiary)' }}>
                Distance from the Sun
            </p>
            <p className="text-lg font-bold mt-1 text-white" style={{ fontVariantNumeric: 'tabular-nums' }}>
                {distanceAU.toFixed(2)}{' '}
                <span className="text-sm font-medium" style={{ color: 'rgba(255,255,255,0.45)' }}>AU</span>
            </p>
            <p className="text-xs mt-1" style={{ color: 'var(--text-tertiary)' }}>
                {(km / 1e9).toFixed(2)} billion km · light takes {lightHours.toFixed(1)} hours to reach us
            </p>
            <p className="text-[10px] mt-2" style={{ color: 'rgba(255,255,255,0.28)' }}>
                Extrapolated from JPL Horizons state vectors
            </p>
        </div>
    );
};

// Planets whose moons exist in the 3D scene
const PLANETS_WITH_MOONS = new Set(['earth', 'mars', 'jupiter', 'saturn', 'uranus', 'neptune']);
const SPACECRAFT_CATEGORIES = new Set(['space-stations', 'space-telescopes', 'deep-space-probes', 'historical']);
// Spacecraft that exist in the 3D scene, so they get the fly-to treatment
// rather than a separate card.
const SPACECRAFT_IN_SCENE = new Set(['iss', 'voyager1', 'voyager2']);
// The standalone model viewer is stashed for now. Flip this back to true to
// bring it back; SpacecraftViewer and its procedural models are untouched.
const SHOW_SPACECRAFT_VIEWER = false;

const CategoryBrowser = () => {
    const match = useMatch('/object/:id');
    const id = match?.params?.id;
    const navigate = useNavigate();
    const [searchParams] = useSearchParams();
    const activeTab = searchParams.get('tab') || 'planets';
    const [sortBy, setSortBy] = useState('default');
    const isMobile = useIsMobile();

    const object = useMemo(() => (id ? getObjectById(id) : null), [id]);

    // Objects rendered by the solar-system scene use the 3D presentation; the
    // rest (Hubble, Voyager, …) get the spacecraft viewer card instead.
    const inScene = !!object
        && (!SPACECRAFT_CATEGORIES.has(object.category) || SPACECRAFT_IN_SCENE.has(object.id));
    const isSpacecraftCard = !!object && !inScene;

    // ── UI state ───────────────────────────────────────────────────────────
    const [hasInteracted3D, setHasInteracted3D] = useState(false);
    const [pageScrolled, setPageScrolled] = useState(false);
    const [moonHintVisible, setMoonHintVisible] = useState(false);
    const [sheetOpen, setSheetOpen] = useState(false);
    const [descriptionOpen, setDescriptionOpen] = useState(false);

    useEffect(() => {
        const onScroll = () => setPageScrolled(window.scrollY > 40);
        window.addEventListener('scroll', onScroll, { passive: true });
        return () => window.removeEventListener('scroll', onScroll);
    }, []);

    // Escape leaves a focused object
    useEffect(() => {
        if (!id) return;
        const onKey = (e) => { if (e.key === 'Escape') navigate('/'); };
        window.addEventListener('keydown', onKey);
        return () => window.removeEventListener('keydown', onKey);
    }, [id, navigate]);

    // Once the camera fly-in settles, the description slides in on its own.
    // The stats sheet stays collapsed until asked for — on desktop the two are
    // independent, so reading the description doesn't cost you the view of the
    // object. On mobile there is only one panel, and it still opens fully.
    // Spacecraft cards have no fly-in, so they open immediately.
    useEffect(() => {
        setSheetOpen(false);
        setDescriptionOpen(false);
        setMoonHintVisible(false);
        if (!id) return;
        if (isSpacecraftCard) { setSheetOpen(true); setDescriptionOpen(true); return; }

        const openAt = setTimeout(() => {
            setDescriptionOpen(true);
            if (isMobile) setSheetOpen(true);
        }, 1500);
        const timers = [openAt];
        if (PLANETS_WITH_MOONS.has(id)) {
            timers.push(setTimeout(() => setMoonHintVisible(true), 1700));
            timers.push(setTimeout(() => setMoonHintVisible(false), 9500));
        }
        return () => timers.forEach(clearTimeout);
    }, [id, isSpacecraftCard, isMobile]);

    // Returning to the top of the page also returns the browser scroll position
    useEffect(() => { if (id) window.scrollTo({ top: 0, behavior: 'instant' }); }, [id]);

    // Lock page scrolling while an object is focused
    useEffect(() => {
        if (!id) return;
        const prevBody = document.body.style.overflow;
        const prevRoot = document.documentElement.style.overflow;
        document.body.style.overflow = 'hidden';
        document.documentElement.style.overflow = 'hidden';
        return () => {
            document.body.style.overflow = prevBody;
            document.documentElement.style.overflow = prevRoot;
        };
    }, [id]);

    const currentCategory = CATEGORY_TABS.find(t => t.id === activeTab) ?? CATEGORY_TABS[0];
    const objects = getObjectsByCategory(currentCategory.id);
    const sorted = useMemo(() => [...objects].sort((a, b) => {
        if (sortBy === 'name_az') return a.name.localeCompare(b.name);
        if (sortBy === 'name_za') return b.name.localeCompare(a.name);
        return 0;
    }), [objects, sortBy]);

    const physicalRows = object?.stats?.find(s => s.section === 'Physical')?.rows ?? [];
    const scrollToCatalog = useCallback(() => {
        window.scrollTo({ top: window.innerHeight, behavior: 'smooth' });
    }, []);

    // Mobile lifts the focused body clear of the sheet — but only while the
    // sheet is actually covering it. Collapsed, the viewport is free again and
    // the object returns to centre instead of staying pinned to the top half.
    // Desktop keeps the body centred throughout.
    const focusOffsetY = id && isMobile && sheetOpen ? 0.24 : 0;

    // OrbitControls sets touch-action:none on the canvas so one finger orbits.
    // That also means a full-height canvas swallows the swipe people use to
    // scroll, leaving the catalog — and the category bar, which only appears
    // once scrolled — unreachable on a phone unless they spot the button.
    // Ending the scene short of the fold puts the ticker on screen, which both
    // restores somewhere to swipe and signals there is more below.
    const sceneHeight = isMobile && !id
        ? 'calc(var(--app-vh, 100vh) - 68px)'   // leaves room for the category bar
        : 'var(--app-vh, 100vh)';

    return (
        <>
            <StarfieldBg canvasId="starfield-browser" />

            {/* The page's document heading. Visually hidden on the home view —
                the solar system itself is the title — but present for search
                engines and screen readers, which otherwise found no h1 at all.
                On a focused object the visible name below takes over. */}
            {!id && (
                <h1 style={{
                    position: 'absolute', width: 1, height: 1, padding: 0, margin: -1,
                    overflow: 'hidden', clip: 'rect(0 0 0 0)', whiteSpace: 'nowrap', border: 0,
                }}>
                    Parsec — an interactive 3D atlas of the solar system
                </h1>
            )}

            {/* No overflow:hidden here — this element sits inside a max-w-7xl
                <main>, so clipping it would cut the full-bleed 3D overlay's
                annotations off at the content edge. Scrolling is locked on
                <body> instead (see the effect above). */}
            <div className="relative" style={{ zIndex: 1, ...(id ? { height: 'var(--app-vh, 100vh)' } : {}) }}>

                {/* ── 3D viewport — full bleed ──
                    A spacecraft card has its own model viewer, so the solar
                    system behind it fades back and stops taking input. */}
                <div
                    className="relative"
                    style={{ width: '100vw', marginLeft: 'calc(-50vw + 50%)' }}
                    onPointerDown={() => setHasInteracted3D(true)}
                    onWheel={() => setHasInteracted3D(true)}
                >
                    <div style={{
                        opacity: isSpacecraftCard ? 0.10 : 1,
                        filter: isSpacecraftCard ? 'saturate(0.35)' : 'none',
                        transition: 'opacity 600ms ease, filter 600ms ease',
                        pointerEvents: isSpacecraftCard ? 'none' : 'auto',
                    }}>
                        <SolarSystem3D
                            focusedId={inScene ? id : null}
                            focusOffsetY={focusOffsetY}
                            height={sceneHeight}
                        />
                    </div>

                    {/* Time scrubber. Kept while a planet is focused on desktop —
                        watching a moon system wind forward is the best of it, and
                        the bottom-left corner is clear of the centred sheet. Hidden
                        on a focused mobile view, where the sheet takes that space. */}
                    <TimeControl hidden={isMobile && !!id} />

                    {/* Home hints */}
                    <div
                        className="absolute inset-x-0 flex flex-col items-center pointer-events-none"
                        // Sits above the time control's band rather than beside
                        // it: the control is bottom-left and this is centred, so
                        // on a narrower laptop window the two ran into each other.
                        style={{ bottom: isMobile ? 22 : 78, zIndex: 4, gap: 6, padding: '0 16px' }}
                    >
                        <p
                            className="transition-opacity duration-700"
                            style={{
                                opacity: id || hasInteracted3D ? 0 : 1,
                                color: 'rgba(255,255,255,0.58)',
                                fontSize: isMobile ? 10 : 11,
                                fontWeight: 600,
                                letterSpacing: '0.07em',
                                textShadow: '0 1px 6px rgba(0,0,0,0.9)',
                                textAlign: 'center',
                                margin: 0,
                            }}
                        >
                            {isMobile
                                ? 'Drag to orbit · Pinch to zoom · Tap to explore'
                                : 'Drag to orbit · Scroll to zoom · Click any object to explore'}
                        </p>
                        <button
                            onClick={scrollToCatalog}
                            aria-label="Scroll down to the object catalog"
                            inert={(!!id || pageScrolled) || undefined}
                            className="flex items-center gap-1.5 rounded-full transition-opacity duration-700 focus-ring"
                            style={{
                                pointerEvents: id || pageScrolled ? 'none' : 'auto',
                                opacity: id || pageScrolled ? 0 : 1,
                                background: 'rgba(0,0,0,0.42)',
                                border: '1px solid rgba(255,255,255,0.16)',
                                backdropFilter: 'blur(14px)',
                                WebkitBackdropFilter: 'blur(14px)',
                                color: 'rgba(255,255,255,0.78)',
                                padding: '7px 15px',
                                fontSize: 10,
                                fontWeight: 700,
                                letterSpacing: '0.1em',
                                textTransform: 'uppercase',
                                cursor: 'pointer',
                            }}
                        >
                            Explore the catalog
                            <ChevronDown style={{ width: 14, height: 14 }} />
                        </button>
                    </div>

                    {/* Back to solar system */}
                    {id && (
                        <button
                            onClick={() => navigate('/')}
                            aria-label="Back to solar system"
                            title="Back to solar system (Esc)"
                            className="absolute flex items-center justify-center rounded-xl animate-fade-in focus-ring"
                            style={{
                                top: 68, left: 20, zIndex: 20,
                                width: 38, height: 38,
                                background: 'rgba(0,0,0,0.45)',
                                border: '1px solid rgba(255,255,255,0.16)',
                                color: 'rgba(255,255,255,0.85)',
                                backdropFilter: 'blur(14px)',
                                WebkitBackdropFilter: 'blur(14px)',
                                cursor: 'pointer',
                            }}
                        >
                            <ChevronLeft style={{ width: 18, height: 18 }} />
                        </button>
                    )}

                    {/* Desktop annotations flanking the body */}
                    {!isMobile && object && inScene && (
                        <div
                            className="absolute inset-0 pointer-events-none flex items-center justify-between px-6 md:px-16 transition-all duration-1000 ease-out"
                            style={{
                                zIndex: 5,
                                opacity: id ? 1 : 0,
                                transform: id ? 'scale(1)' : 'scale(0.96)',
                                transitionDelay: id ? '700ms' : '0ms',
                            }}
                        >
                            <div className="flex flex-col gap-8 md:gap-14 items-end text-right"
                                style={{ maxWidth: '32%', textShadow: '0 2px 6px rgba(0,0,0,0.95)' }}>
                                <div>
                                    <h1 className="font-extrabold tracking-tight leading-none text-white"
                                        style={{ fontSize: 'clamp(1.2rem, 3.6vw, 2.2rem)' }}>
                                        {object.shortName ?? object.name}
                                    </h1>
                                    <p className="font-bold tracking-widest uppercase text-white/45 mt-1"
                                        style={{ fontSize: '0.62rem' }}>
                                        {object.type}
                                    </p>
                                    {PLANETS_WITH_MOONS.has(id) && (
                                        <p className="transition-opacity duration-700"
                                            style={{
                                                opacity: moonHintVisible ? 1 : 0,
                                                color: 'rgba(255,255,255,0.42)',
                                                fontSize: '0.6rem', fontWeight: 600,
                                                letterSpacing: '0.05em', marginTop: 10,
                                            }}>
                                            Click a moon to explore it
                                        </p>
                                    )}
                                </div>
                                {physicalRows[0] && (
                                    <div>
                                        <p className="font-extrabold text-white/90" style={{ fontSize: 'clamp(0.76rem, 2.2vw, 1rem)' }}>
                                            {physicalRows[0].value}
                                        </p>
                                        <p className="font-bold tracking-wider uppercase text-white/35 mt-0.5" style={{ fontSize: '0.55rem' }}>
                                            {physicalRows[0].label}
                                        </p>
                                    </div>
                                )}
                            </div>

                            <div className="flex-1" />

                            <div className="flex flex-col gap-8 md:gap-14 items-start text-left"
                                style={{ maxWidth: '32%', textShadow: '0 2px 6px rgba(0,0,0,0.95)' }}>
                                <div>
                                    <p className="font-extrabold text-white/90" style={{ fontSize: 'clamp(0.76rem, 2.2vw, 1rem)' }}>
                                        {object.keyStatValue}
                                    </p>
                                    <p className="font-bold tracking-wider uppercase text-white/35 mt-0.5" style={{ fontSize: '0.55rem' }}>
                                        {object.keyStatLabel}
                                    </p>
                                </div>
                                {physicalRows[1] && (
                                    <div>
                                        <p className="font-extrabold text-white/90" style={{ fontSize: 'clamp(0.76rem, 2.2vw, 1rem)' }}>
                                            {physicalRows[1].value}
                                        </p>
                                        <p className="font-bold tracking-wider uppercase text-white/35 mt-0.5" style={{ fontSize: '0.55rem' }}>
                                            {physicalRows[1].label}
                                        </p>
                                    </div>
                                )}
                            </div>
                        </div>
                    )}

                    {/* Desktop: description slides down from the top */}
                    {!isMobile && object && (
                        <div style={{
                            position: 'absolute', top: 0, left: 0, right: 0, zIndex: 6,
                            transform: descriptionOpen ? 'translateY(0)' : 'translateY(-100%)',
                            transition: 'transform 0.45s cubic-bezier(0.32,0.72,0,1)',
                        }}>
                            <div style={{ padding: '36px 16px 24px' }}>
                                <div className="max-w-2xl mx-auto">
                                    <div className="glass p-5">
                                        <p style={{ color: 'var(--text-secondary)', lineHeight: 1.65, fontSize: '0.9rem', margin: 0 }}>
                                            {object.description}
                                        </p>
                                    </div>
                                </div>
                            </div>
                        </div>
                    )}

                    {/* Detail sheet — bottom on both, but mobile gets the full content */}
                    {object && (
                        <div
                            style={{
                                position: 'absolute', bottom: 0, left: 0, right: 0, zIndex: 12,
                                pointerEvents: 'auto',
                                transform: sheetOpen ? 'translateY(0)' : 'translateY(calc(100% - 74px))',
                                transition: 'transform 0.45s cubic-bezier(0.32,0.72,0,1)',
                            }}
                        >
                            <button
                                onClick={() => setSheetOpen(v => !v)}
                                aria-expanded={sheetOpen}
                                aria-label={sheetOpen ? 'Hide details' : 'Show details'}
                                style={{
                                    display: 'flex', flexDirection: 'column', alignItems: 'center',
                                    width: '100%', background: 'none', border: 'none',
                                    cursor: 'pointer', padding: '14px 0 6px',
                                    animation: sheetOpen ? 'none' : 'scrollPromptBob 1.8s ease-in-out infinite',
                                }}
                            >
                                {isMobile ? (
                                    <span style={{
                                        width: 40, height: 4, borderRadius: 2,
                                        background: 'rgba(255,255,255,0.55)',
                                        boxShadow: '0 1px 6px rgba(0,0,0,0.8)',
                                    }} />
                                ) : (
                                    <>
                                        <ChevronDown style={{ width: 44, height: 44, color: 'rgba(255,255,255,0.80)', marginBottom: -24, transform: sheetOpen ? 'scaleX(1.5)' : 'scaleX(1.5) rotate(180deg)', transition: 'transform 0.35s ease' }} />
                                        <ChevronDown style={{ width: 44, height: 44, color: 'rgba(255,255,255,0.40)', transform: sheetOpen ? 'scaleX(1.5)' : 'scaleX(1.5) rotate(180deg)', transition: 'transform 0.35s ease' }} />
                                    </>
                                )}
                            </button>

                            <div style={{
                                maxHeight: isMobile ? '58vh' : '60vh',
                                overflowY: 'auto',
                                overscrollBehavior: 'contain',
                                WebkitOverflowScrolling: 'touch',
                                padding: isMobile ? '0 12px 24px' : '0 16px 32px',
                                // On mobile the sheet sits directly over the body, and
                                // a bright planet behind translucent glass makes white
                                // text vanish. Give the sheet its own dark base.
                                background: isMobile
                                    ? 'linear-gradient(to bottom, rgba(4,6,10,0) 0%, rgba(4,6,10,0.86) 6%, rgba(4,6,10,0.96) 22%, #04060a 45%)'
                                    : 'none',
                            }}>
                                <div className="max-w-2xl mx-auto flex flex-col gap-4">
                                    {/* Mobile carries the identity that desktop shows as annotations */}
                                    {isMobile && (
                                        <div className="glass p-4">
                                            <h1 style={{ color: '#fff', fontSize: '1.35rem', fontWeight: 800, letterSpacing: '-0.02em', margin: 0 }}>
                                                {object.shortName ?? object.name}
                                            </h1>
                                            <p style={{ color: 'rgba(255,255,255,0.45)', fontSize: '0.6rem', fontWeight: 700, letterSpacing: '0.12em', textTransform: 'uppercase', margin: '3px 0 10px' }}>
                                                {object.type}
                                            </p>
                                            <div style={{ display: 'flex', gap: 20, flexWrap: 'wrap' }}>
                                                <div>
                                                    <p style={{ color: '#fff', fontSize: '0.9rem', fontWeight: 700, margin: 0 }}>{object.keyStatValue}</p>
                                                    <p style={{ color: 'rgba(255,255,255,0.38)', fontSize: '0.55rem', fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase', margin: 0 }}>{object.keyStatLabel}</p>
                                                </div>
                                                {physicalRows[0] && (
                                                    <div>
                                                        <p style={{ color: '#fff', fontSize: '0.9rem', fontWeight: 700, margin: 0 }}>{physicalRows[0].value}</p>
                                                        <p style={{ color: 'rgba(255,255,255,0.38)', fontSize: '0.55rem', fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase', margin: 0 }}>{physicalRows[0].label}</p>
                                                    </div>
                                                )}
                                            </div>
                                        </div>
                                    )}

                                    {isSpacecraftCard && (
                                        <>
                                            {SHOW_SPACECRAFT_VIEWER && (
                                                <div className="glass overflow-hidden" style={{ borderRadius: 'var(--radius-card)' }}>
                                                    <SpacecraftViewer spacecraftId={object.id} />
                                                </div>
                                            )}
                                            <div className="glass p-5">
                                                <div className="grid grid-cols-2 gap-x-6 gap-y-4">
                                                    <div>
                                                        <p className="text-[10px] font-bold uppercase tracking-widest mb-0.5" style={{ color: 'var(--text-tertiary)' }}>Launch Year</p>
                                                        <p className="font-bold text-white">{object.launchYear}</p>
                                                    </div>
                                                    <div>
                                                        <p className="text-[10px] font-bold uppercase tracking-widest mb-0.5" style={{ color: 'var(--text-tertiary)' }}>Status</p>
                                                        <span className="text-xs font-bold px-2 py-0.5 rounded-lg" style={{
                                                            background: object.currentStatus === 'active' ? 'rgba(80,200,120,0.15)' : 'rgba(140,140,140,0.15)',
                                                            color: object.currentStatus === 'active' ? '#50e090' : 'rgba(200,200,200,0.7)',
                                                        }}>
                                                            {object.currentStatus?.toUpperCase()}
                                                        </span>
                                                    </div>
                                                    <div className="col-span-2">
                                                        <p className="text-[10px] font-bold uppercase tracking-widest mb-0.5" style={{ color: 'var(--text-tertiary)' }}>Operator</p>
                                                        <p className="font-bold text-white text-sm">{object.operator}</p>
                                                    </div>
                                                    <div className="col-span-2">
                                                        <p className="text-[10px] font-bold uppercase tracking-widest mb-0.5" style={{ color: 'var(--text-tertiary)' }}>Location / Altitude</p>
                                                        <p className="font-bold text-white text-sm">{object.altitude}</p>
                                                    </div>
                                                </div>
                                            </div>
                                        </>
                                    )}

                                    {object.category === 'deep-space-probes' && (
                                        <LiveDistanceRow spacecraftId={object.id} />
                                    )}

                                    {object.id === 'iss' && (
                                        <button
                                            onClick={() => navigate('/satellites')}
                                            className="w-full rounded-2xl font-bold py-3.5 text-sm flex items-center justify-center gap-1.5 focus-ring"
                                            style={{
                                                background: 'rgba(80,200,120,0.18)',
                                                color: '#50e090',
                                                border: '1px solid rgba(80,200,120,0.30)',
                                                cursor: 'pointer',
                                            }}
                                        >
                                            Track the ISS live
                                            <ArrowUpRight style={{ width: 16, height: 16 }} />
                                        </button>
                                    )}

                                    {/* Desktop already shows the description above the fold */}
                                    <ObjectDetailBody object={object} showDescription={isMobile || isSpacecraftCard} />
                                </div>
                            </div>
                        </div>
                    )}
                </div>

                {/* ── Ticker ── */}
                <div
                    className="transition-all duration-500 ease-in-out"
                    style={{
                        width: '100vw', marginLeft: 'calc(-50vw + 50%)',
                        opacity: id ? 0 : 1,
                        maxHeight: id ? 0 : 100,
                        overflow: 'hidden',
                        pointerEvents: id ? 'none' : 'auto',
                    }}
                >
                    <SpaceDataStrip />
                </div>

                {/* ── Catalog ── */}
                <div
                    id="catalog"
                    className="transition-all duration-500 ease-in-out flex flex-col gap-6 px-4 md:px-8"
                    style={{
                        opacity: id ? 0 : 1,
                        maxHeight: id ? 0 : 4000,
                        overflow: 'hidden',
                        pointerEvents: id ? 'none' : 'auto',
                        paddingTop: 24,
                    }}
                >
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 sm:gap-4">
                        <div>
                            <h2 className="font-bold" style={{ fontSize: '1.25rem', color: '#fff' }}>
                                {currentCategory.label}
                            </h2>
                            <p className="text-sm" style={{ color: 'var(--text-tertiary)' }}>
                                {currentCategory.description} &mdash; {objects.length} object{objects.length === 1 ? '' : 's'}
                            </p>
                        </div>
                        <SortDropdown value={sortBy} onChange={setSortBy} />
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                        {sorted.map(obj => <ObjectCard key={obj.id} object={obj} />)}
                        {sorted.length === 0 && (
                            <div className="col-span-full py-16 text-center" style={{ color: 'var(--text-tertiary)' }}>
                                No objects in this category yet.
                            </div>
                        )}
                    </div>
                </div>
            </div>
        </>
    );
};

export default CategoryBrowser;
