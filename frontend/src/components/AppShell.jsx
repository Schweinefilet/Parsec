import React from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { Globe, Moon, Star, Eye, Zap, Telescope, CircleDot } from 'lucide-react';
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
    const activeTab = searchParams.get('tab') || 'planets';

    const setTab = id => setSearchParams({ tab: id }, { replace: true });

    return (
        <div className="min-h-screen text-white flex flex-col" style={{ paddingBottom: '64px' }}>
            {/* ── Sticky header ── */}
            <header
                className="glass flex items-center px-4 md:px-8 gap-4 sticky top-0 z-50"
                style={{
                    borderRadius: 0,
                    borderLeft: 'none',
                    borderRight: 'none',
                    borderTop: 'none',
                    height: '56px',
                }}
            >
                <Link
                    to="/"
                    className="flex items-center gap-2 font-bold text-lg flex-shrink-0"
                    style={{ color: 'var(--text-primary)' }}
                >
                    <Telescope className="h-6 w-6" style={{ color: 'var(--accent)' }} />
                    <span>Parsec</span>
                </Link>

                <div className="flex-1 max-w-lg mx-auto">
                    <ObjectSearch />
                </div>
            </header>

            {/* ── Main content ── */}
            <main className="flex-1 p-4 md:p-8 max-w-7xl mx-auto w-full">
                {children}
            </main>

            {/* ── Bottom tab bar ── */}
            <nav
                className="glass fixed bottom-0 left-0 right-0 z-50 flex items-center justify-around"
                style={{
                    borderRadius: 0,
                    borderLeft: 'none',
                    borderRight: 'none',
                    borderBottom: 'none',
                    height: '64px',
                }}
            >
                {TABS.map(({ id, label, icon: Icon }) => {
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
