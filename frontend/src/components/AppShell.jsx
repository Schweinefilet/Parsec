import { useState, useEffect, useRef } from 'react';
import { Link, useSearchParams, useMatch } from 'react-router-dom';
import {
    Globe, Moon, Star, Eye, Zap, Telescope, CircleDot, Search,
    Crosshair, Sparkles, Satellite, Aperture, Radio, Archive,
} from 'lucide-react';
import ObjectSearch from './ObjectSearch';
import { CATEGORY_TABS } from '../data/objectCatalog';

// Icon per category id. Kept beside the tab list rather than duplicating the
// list itself — CATEGORY_TABS in the catalog is the single source of truth, so
// a category can never exist in the data yet be unreachable from the nav.
const TAB_ICONS = {
    stars: Star,
    planets: Globe,
    'dwarf-planets': CircleDot,
    moons: Moon,
    exoplanets: Sparkles,
    'deep-sky': Eye,
    neos: Zap,
    asteroid: Crosshair,
    comet: Sparkles,
    'space-stations': Satellite,
    'space-telescopes': Aperture,
    'deep-space-probes': Radio,
    historical: Archive,
};

const AppShell = ({ children }) => {
    const [searchParams, setSearchParams] = useSearchParams();
    const match = useMatch('/object/:id');
    const focusedId = match?.params?.id;
    const activeTab = searchParams.get('tab') || 'planets';
    const setTab = (id) => setSearchParams({ tab: id }, { replace: true });

    const [scrolled, setScrolled] = useState(false);
    useEffect(() => {
        const onScroll = () => setScrolled(window.scrollY > 40);
        window.addEventListener('scroll', onScroll, { passive: true });
        return () => window.removeEventListener('scroll', onScroll);
    }, []);

    const [searchOpen, setSearchOpen] = useState(false);
    const searchRef = useRef(null);
    const navRef = useRef(null);

    useEffect(() => {
        if (!searchOpen) return;
        const handler = (e) => {
            if (searchRef.current && !searchRef.current.contains(e.target)) setSearchOpen(false);
        };
        document.addEventListener('mousedown', handler);
        return () => document.removeEventListener('mousedown', handler);
    }, [searchOpen]);

    // Cmd/Ctrl-K opens search from anywhere
    useEffect(() => {
        const onKey = (e) => {
            if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
                e.preventDefault();
                setSearchOpen(true);
            }
        };
        window.addEventListener('keydown', onKey);
        return () => window.removeEventListener('keydown', onKey);
    }, []);

    // Keep the selected tab in view when the bar scrolls horizontally
    useEffect(() => {
        const el = navRef.current?.querySelector('[data-active="true"]');
        el?.scrollIntoView({ inline: 'center', block: 'nearest', behavior: 'smooth' });
    }, [activeTab]);

    const navHidden = !!focusedId || !scrolled;

    return (
        <div
            className="min-h-screen text-white flex flex-col"
            style={{ paddingBottom: navHidden ? 0 : 68, transition: 'padding-bottom 500ms ease' }}
        >
            <a href="#catalog" className="skip-link">Skip to catalog</a>

            {/* ── Floating header ── */}
            {/* Once the page scrolls, the ticker and cards pass beneath this
                overlay header; a soft scrim keeps the logo readable instead of
                letting the two sets of text collide. */}
            <header
                className="fixed top-0 left-0 right-0 z-50 flex items-center justify-between px-5 md:px-8"
                style={{
                    height: 56,
                    pointerEvents: 'none',
                    background: scrolled
                        ? 'linear-gradient(to bottom, rgba(3,5,9,0.92) 0%, rgba(3,5,9,0.72) 55%, rgba(3,5,9,0) 100%)'
                        : 'none',
                    backdropFilter: scrolled ? 'blur(6px)' : 'none',
                    WebkitBackdropFilter: scrolled ? 'blur(6px)' : 'none',
                    transition: 'background 350ms ease, backdrop-filter 350ms ease',
                }}
            >
                <Link
                    to="/"
                    className="flex items-center gap-2 font-bold text-lg flex-shrink-0 focus-ring rounded-lg"
                    style={{ color: 'rgba(255,255,255,0.92)', pointerEvents: 'auto', textShadow: '0 1px 8px rgba(0,0,0,0.9)' }}
                    onClick={() => window.scrollTo({ top: 0, behavior: 'instant' })}
                >
                    <Telescope className="h-5 w-5" style={{ color: 'var(--accent)' }} aria-hidden="true" />
                    <span>Parsec</span>
                </Link>

                <div ref={searchRef} className="flex items-center gap-2" style={{ pointerEvents: 'auto' }}>
                    {searchOpen && (
                        <div className="animate-fade-in" style={{ width: 'clamp(200px, 52vw, 340px)' }}>
                            <ObjectSearch autoFocus onClose={() => setSearchOpen(false)} />
                        </div>
                    )}
                    <button
                        onClick={() => setSearchOpen(v => !v)}
                        aria-label={searchOpen ? 'Close search' : 'Search objects'}
                        aria-expanded={searchOpen}
                        title="Search (⌘K)"
                        className="flex items-center justify-center rounded-xl transition-all focus-ring"
                        style={{
                            width: 36, height: 36, flexShrink: 0,
                            background: searchOpen ? 'rgba(255,255,255,0.16)' : 'rgba(0,0,0,0.42)',
                            border: '1px solid rgba(255,255,255,0.16)',
                            color: 'rgba(255,255,255,0.85)',
                            backdropFilter: 'blur(14px)',
                            WebkitBackdropFilter: 'blur(14px)',
                            cursor: 'pointer',
                        }}
                    >
                        <Search className="h-4 w-4" aria-hidden="true" />
                    </button>
                </div>
            </header>

            <main className="flex-1 max-w-7xl mx-auto w-full">{children}</main>

            {/* ── Category bar ──
                Tabs keep their natural width and the bar scrolls, so labels never
                compress into each other on narrow screens. */}
            <nav
                ref={navRef}
                aria-label="Object categories"
                className="glass fixed bottom-0 left-0 right-0 z-50 flex items-stretch transition-all duration-500 ease-in-out no-scrollbar"
                style={{
                    borderRadius: 0,
                    borderLeft: 'none', borderRight: 'none', borderBottom: 'none',
                    height: 68,
                    overflowX: 'auto',
                    overflowY: 'hidden',
                    padding: '0 8px',
                    gap: 2,
                    transform: navHidden ? 'translateY(100%)' : 'translateY(0)',
                    opacity: navHidden ? 0 : 1,
                    pointerEvents: navHidden ? 'none' : 'auto',
                }}
            >
                {CATEGORY_TABS.map(({ id, label }) => {
                    const Icon = TAB_ICONS[id] ?? CircleDot;
                    const isActive = activeTab === id;
                    return (
                        <button
                            key={id}
                            data-active={isActive}
                            onClick={() => setTab(id)}
                            aria-current={isActive ? 'page' : undefined}
                            className="flex flex-col items-center justify-center gap-1 rounded-xl transition-all relative flex-shrink-0 focus-ring"
                            style={{
                                minWidth: 72,
                                padding: '8px 10px',
                                color: isActive ? '#fff' : 'rgba(255,255,255,0.42)',
                                cursor: 'pointer',
                            }}
                        >
                            <Icon
                                className="h-5 w-5 transition-transform"
                                style={{ transform: isActive ? 'scale(1.12)' : 'scale(1)' }}
                                aria-hidden="true"
                            />
                            <span style={{ fontSize: 10, fontWeight: 600, letterSpacing: '0.02em', whiteSpace: 'nowrap' }}>
                                {label}
                            </span>
                            {isActive && (
                                <span
                                    className="absolute rounded-full"
                                    style={{ bottom: 2, width: 16, height: 2, background: 'var(--accent)' }}
                                />
                            )}
                        </button>
                    );
                })}
            </nav>
        </div>
    );
};

export default AppShell;
