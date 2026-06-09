import React, { useState, useEffect, useRef } from 'react';
import { Link, useSearchParams, useMatch } from 'react-router-dom';
import { Globe, Moon, Star, Eye, Zap, Telescope, CircleDot, Search } from 'lucide-react';
import ObjectSearch from './ObjectSearch';

const TABS = [
    { id: 'planets',    label: 'Planets',    icon: Globe },
    { id: 'dwarf-planets', label: 'Dwarf Planets', icon: CircleDot },
    { id: 'moons',      label: 'Moons',      icon: Moon },
    { id: 'exoplanets', label: 'Exoplanets', icon: Star },
    { id: 'deep-sky',   label: 'Deep Sky',   icon: Eye },
    { id: 'neos',       label: 'NEOs',       icon: Zap },
];

const AppShell = ({ children }) => {
    const [searchParams, setSearchParams] = useSearchParams();
    const match = useMatch('/object/:id');
    const id = match?.params?.id;
    const activeTab = searchParams.get('tab') || 'planets';

    const setTab = id => setSearchParams({ tab: id }, { replace: true });

    const [scrolled, setScrolled] = useState(false);
    useEffect(() => {
        const onScroll = () => setScrolled(window.scrollY > 40);
        window.addEventListener('scroll', onScroll, { passive: true });
        return () => window.removeEventListener('scroll', onScroll);
    }, []);

    const [searchOpen, setSearchOpen] = useState(false);
    const searchRef = useRef(null);

    // Close search on outside click
    useEffect(() => {
        if (!searchOpen) return;
        const handler = (e) => {
            if (searchRef.current && !searchRef.current.contains(e.target)) {
                setSearchOpen(false);
            }
        };
        document.addEventListener('mousedown', handler);
        return () => document.removeEventListener('mousedown', handler);
    }, [searchOpen]);

    return (
        <div className="min-h-screen text-white flex flex-col" style={{ paddingBottom: id || !scrolled ? '0' : '64px', transition: 'padding-bottom 500ms ease' }}>

            {/* ── Floating header — transparent overlay, lets solar system show through ── */}
            <header
                className="fixed top-0 left-0 right-0 z-50 flex items-center justify-between px-5 md:px-8"
                style={{ height: '56px', pointerEvents: 'none' }}
            >
                {/* Parsec logo — standalone, no container */}
                <Link
                    to="/"
                    className="flex items-center gap-2 font-bold text-lg flex-shrink-0"
                    style={{ color: 'rgba(255,255,255,0.90)', pointerEvents: 'auto', textShadow: '0 1px 8px rgba(0,0,0,0.8)' }}
                >
                    <Telescope className="h-5 w-5" style={{ color: 'var(--accent)' }} />
                    <span>Parsec</span>
                </Link>

                {/* Search — icon + expandable input */}
                <div ref={searchRef} className="flex items-center gap-2" style={{ pointerEvents: 'auto' }}>
                    {searchOpen && (
                        <div
                            className="animate-fade-in"
                            style={{ width: 'clamp(220px, 30vw, 340px)' }}
                        >
                            <ObjectSearch
                                autoFocus
                                onClose={() => setSearchOpen(false)}
                            />
                        </div>
                    )}
                    <button
                        onClick={() => setSearchOpen(v => !v)}
                        className="flex items-center justify-center rounded-xl transition-all"
                        style={{
                            width: '36px',
                            height: '36px',
                            background: searchOpen ? 'rgba(255,255,255,0.15)' : 'rgba(0,0,0,0.40)',
                            border: '1px solid rgba(255,255,255,0.14)',
                            color: 'rgba(255,255,255,0.80)',
                            backdropFilter: 'blur(14px)',
                            flexShrink: 0,
                        }}
                    >
                        <Search className="h-4 w-4" />
                    </button>
                </div>
            </header>

            {/* ── Main content — no top padding so solar system touches the top edge ── */}
            <main className="flex-1 max-w-7xl mx-auto w-full">
                {children}
            </main>

            {/* ── Bottom tab bar ── */}
            <nav
                className="glass fixed bottom-0 left-0 right-0 z-50 flex items-center justify-around transition-all duration-500 ease-in-out"
                style={{
                    borderRadius: 0,
                    borderLeft: 'none',
                    borderRight: 'none',
                    borderBottom: 'none',
                    height: '64px',
                    transform: (id || !scrolled) ? 'translateY(100%)' : 'translateY(0)',
                    opacity: (id || !scrolled) ? 0 : 1,
                    pointerEvents: (id || !scrolled) ? 'none' : 'auto',
                }}
            >
                {TABS.map(({ id, label, icon: Icon }) => { // eslint-disable-line no-unused-vars
                    const isActive = activeTab === id;
                    return (
                        <button
                            key={id}
                            onClick={() => setTab(id)}
                            className="flex flex-col items-center gap-0.5 px-3 py-1.5 rounded-xl transition-all relative"
                            style={isActive
                                ? { color: '#fff' }
                                : { color: 'rgba(255,255,255,0.40)' }
                            }
                        >
                            <Icon
                                className="h-5 w-5 transition-transform"
                                style={{ transform: isActive ? 'scale(1.1)' : 'scale(1)' }}
                            />
                            <span className="text-[10px] font-semibold tracking-wide">{label}</span>
                            {isActive && (
                                <span
                                    className="absolute -bottom-0.5 w-4 h-0.5 rounded-full"
                                    style={{ background: 'var(--accent)' }}
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
