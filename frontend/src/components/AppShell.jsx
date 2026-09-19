import { useState, useEffect, useRef, useCallback } from 'react';
import { Link, useNavigate, useSearchParams, useMatch, useLocation } from 'react-router-dom';
import {
    Globe, Moon, Star, Eye, Zap, Telescope, CircleDot, Search,
    Crosshair, Sparkles, Satellite, Aperture, Radio, Archive, Scale,
    Link2, Check,
} from 'lucide-react';
import ObjectSearch from './ObjectSearch';
import LanguagePicker from './LanguagePicker';
import HeaderMenu from './HeaderMenu';
import CoachMark from './CoachMark';
import WhatsNew from './WhatsNew';
import pkg from '../../package.json';
import { useIsMobile } from '../hooks/useMediaQuery';
import { CATEGORY_TABS, CATEGORY_COUNTS, DEFAULT_TAB, resolveTab, getObjectById } from '../data/objectCatalog';
import { buildShareUrl, getCameraSnapshot } from '../utils/shareView';
import { simDate } from '../utils/simTime';
import { getScaleStage } from '../utils/scaleMode';
import { subscribeLogo } from '../utils/assetLoading';
import { syncDocumentHead } from '../utils/documentHead';
import { armSkyEntry } from '../utils/skyEntry';
import { armTrackerEntry } from '../utils/trackerEntry';
import { useObserverLocation } from '../hooks/useObserverLocation';
import { useI18n } from '../i18n';

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
    const { t, category, object: localizeObject } = useI18n();
    const [searchParams, setSearchParams] = useSearchParams();
    const match = useMatch('/object/:id');
    const focusedId = match?.params?.id;
    // The category bar belongs to the catalog and nothing else. On the tracker,
    // the compare view and the sky page it was context for a list that isn't
    // there — and tapping a tab silently threw you back to the solar system.
    const { pathname } = useLocation();
    const navigate = useNavigate();
    const { location: skyLocation } = useObserverLocation();
    const onOwnPage = ['/satellites', '/compare', '/sky'].includes(pathname);
    // The dive-to-Earth transition (utils/skyEntry.js) needs a real spot to
    // dive to and a mounted solar-system scene to dive through. Without a
    // remembered location there is nothing to zoom in on, so the icon just
    // navigates — /sky's own ask-card handles the prompt from there, same as
    // it always has. A modified click (new tab, middle-click) is left alone:
    // the cinematic only makes sense replacing the tab you're already in.
    // Arms the cinematic and goes to Earth instead, which is on the catch-all
    // route — so the scene is not torn down, and the ordinary focus fly-in
    // becomes the transition itself rather than the first half of it: it is
    // told to land on the pose the tracker's globe opens at. Same
    // modified-click bail-out as the sky icon below: a middle-click or a
    // cmd-click is someone asking for a tab, not for a two-second shot.
    const handleTrackerClick = (e) => {
        if (pathname === '/satellites') return;
        if (e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
        e.preventDefault();
        armTrackerEntry();
        navigate('/object/earth');
    };

    const handleSkyClick = (e) => {
        if (pathname === '/sky' || !skyLocation) return;
        if (e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
        e.preventDefault();
        armSkyEntry(skyLocation);
        navigate('/object/earth');
    };
    const activeTab = resolveTab(searchParams.get('tab'));
    const setTab = (id) => {
        setSearchParams({ tab: id }, { replace: true });
        // Keep the catalog heading just under the header. From the hero that's a
        // scroll down to it; from inside the catalog it holds the heading in
        // place — otherwise switching to a category with fewer objects lets the
        // browser clamp the scroll back up onto the scene, and you have to swipe
        // past it again. Anchored on #catalog rather than a viewport multiple,
        // because a one-card category isn't tall enough to reach innerHeight.
        requestAnimationFrame(() => {
            const el = document.getElementById('catalog');
            if (!el) return;
            const y = Math.max(0, el.getBoundingClientRect().top + window.scrollY - 60);
            const fromHero = window.scrollY < y * 0.6;
            window.scrollTo({ top: y, behavior: fromHero ? 'smooth' : 'auto' });
        });
    };

    // Keep <title> and the canonical link in step with the route — there is no
    // server render, so without this every page carried index.html's one title
    // and no canonical at all.
    useEffect(() => {
        const site = t('app.name');
        const full = (name) => (name ? `${name} — ${site}` : t('app.title'));
        let name, canonicalPath;
        if (focusedId) {
            const obj = getObjectById(focusedId);
            name = obj ? localizeObject(obj).name : null;
            canonicalPath = `/object/${focusedId}`;
        } else if (onOwnPage) {
            const key = {
                '/compare': 'compare.title',
                '/satellites': 'tracker.title', '/sky': 'nightSky.title',
            }[pathname];
            name = key ? t(key) : null;
            canonicalPath = pathname;
        } else {
            const isDefault = activeTab === DEFAULT_TAB;
            const tab = CATEGORY_TABS.find(x => x.id === activeTab);
            name = isDefault || !tab ? null : category(tab).label;
            canonicalPath = isDefault ? '/' : `/?tab=${activeTab}`;
        }
        syncDocumentHead({ title: full(name), canonicalPath });
    }, [focusedId, onOwnPage, pathname, activeTab, t, category, localizeObject]);

    // Hidden while the loading screen's copy is flying to this spot. Not a
    // fade: the flying one lands exactly here at exactly this size, so the two
    // are interchangeable and a cross-fade would only show as a flicker.
    const [logoHeld, setLogoHeld] = useState(false);
    useEffect(() => subscribeLogo(setLogoHeld), []);

    const isMobile = useIsMobile();
    const [scrolled, setScrolled] = useState(false);
    useEffect(() => {
        const onScroll = () => setScrolled(window.scrollY > 40);
        window.addEventListener('scroll', onScroll, { passive: true });
        return () => window.removeEventListener('scroll', onScroll);
    }, []);

    const [searchOpen, setSearchOpen] = useState(false);
    const [copied, setCopied] = useState(false);
    const [whatsNewOpen, setWhatsNewOpen] = useState(false);
    const releaseLine = pkg.version.split('.').slice(0, 2).join('.');

    // First-visit hint pointing at the burger menu — mobile only, since
    // that's the only place five icons turned into one that now has to be
    // discovered rather than just seen. Same shape as NightSkyPage.jsx's
    // own single-target coach mark (its own flag, `p4rsec.coachMenu` —
    // having seen a *different* page's hint doesn't mean this one has been
    // seen), including the "no timer, no nag" honesty: a stored flag means
    // seen, a plain time-out doesn't set one, so a visitor who glanced away
    // gets another chance next visit.
    const [menuCoachSeen, setMenuCoachSeen] = useState(() => {
        try { return window.localStorage.getItem('p4rsec.coachMenu') === '1'; }
        catch { return true; }
    });
    const [menuCoachArmed, setMenuCoachArmed] = useState(false);
    const [menuCoachRect, setMenuCoachRect] = useState(null);
    const endMenuCoach = useCallback((persist) => {
        setMenuCoachSeen(true);
        if (persist) { try { window.localStorage.setItem('p4rsec.coachMenu', '1'); } catch { /* private window */ } }
    }, []);
    // Opening the menu themselves ends the run — they found it, same as
    // ScenePanel/NightSkyPanel's own onOpen-ends-the-hint convention.
    const onMenuOpened = useCallback(() => endMenuCoach(true), [endMenuCoach]);

    useEffect(() => {
        if (menuCoachSeen || !isMobile) return undefined;
        const timer = setTimeout(() => setMenuCoachArmed(true), 1300);
        return () => clearTimeout(timer);
    }, [menuCoachSeen, isMobile]);

    const showMenuCoach = menuCoachArmed && !menuCoachSeen && isMobile && !searchOpen;

    useEffect(() => {
        if (!showMenuCoach) { setMenuCoachRect(null); return undefined; }
        const measure = () => {
            const el = document.querySelector('[data-coach="menu"]');
            if (el) setMenuCoachRect(el.getBoundingClientRect());
        };
        measure();
        const raf = requestAnimationFrame(measure);
        window.addEventListener('resize', measure);
        return () => { cancelAnimationFrame(raf); window.removeEventListener('resize', measure); };
    }, [showMenuCoach]);

    // A miss doesn't mark it seen — the next visit gets another chance,
    // same convention as every other coach mark in this codebase.
    useEffect(() => {
        if (!showMenuCoach) return undefined;
        const timer = setTimeout(() => endMenuCoach(false), 8000);
        return () => clearTimeout(timer);
    }, [showMenuCoach, endMenuCoach]);

    // Everything else about the page is already in its address; only the
    // scene's camera, clock and layout are not, so those get folded in here.
    const share = async () => {
        const url = buildShareUrl({
            href: window.location.href,
            camera: getCameraSnapshot(),
            simDate: simDate(),
            scaleStage: getScaleStage(),
        });
        try {
            await navigator.clipboard.writeText(url);
            setCopied(true);
            setTimeout(() => setCopied(false), 1800);
        } catch {
            // Clipboard blocked — put it in the address bar instead, where it
            // can at least be copied by hand.
            window.history.replaceState(null, '', url);
        }
    };
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

    // On desktop the bar appears once you scroll, keeping the hero view clean.
    // On a phone that would strand people: OrbitControls takes every touch on
    // the canvas, so there is no swipe to scroll with, and the bar you would
    // scroll to reach is the only other way into the catalog. Keep it visible.
    const navHidden = onOwnPage || !!focusedId || (!scrolled && !isMobile);

    return (
        <div
            className="min-h-screen text-white flex flex-col"
            style={{ paddingBottom: navHidden ? 0 : 68, transition: 'padding-bottom 500ms ease' }}
        >
            <a href="#catalog" className="skip-link">{t('app.skipToCatalog')}</a>

            {/* ── Floating header ── */}
            {/* Once the page scrolls, the ticker and cards pass beneath this
                overlay header; a soft scrim keeps the logo readable instead of
                letting the two sets of text collide. */}
            {/* The bar itself is full-bleed so its scrim can reach both window
                edges; the row inside it rides the .spine, which puts the
                wordmark directly above the catalog heading and the leading edge
                of the first card, and the actions directly above the last card's
                trailing edge. Before this the header sat on the window's own
                gutter and the content on a centred 1280px column — two left
                edges 160px apart on a wide screen, which is most of why the
                page read as unsettled. */}
            <header
                className="fixed top-0 left-0 right-0 z-50"
                style={{
                    height: 56,
                    pointerEvents: 'none',
                    background: scrolled
                        ? 'linear-gradient(to bottom, rgba(3,5,9,0.92) 0%, rgba(3,5,9,0.72) 55%, rgba(3,5,9,0) 100%)'
                        : 'none',
                    backdropFilter: scrolled ? 'blur(8px)' : 'none',
                    WebkitBackdropFilter: scrolled ? 'blur(8px)' : 'none',
                    transition: 'background var(--t-slow) var(--ease-out), backdrop-filter var(--t-slow) var(--ease-out)',
                }}
            >
              <div className="spine flex items-center justify-between" style={{ height: '100%' }}>
                {/* On a phone the open search field wants the whole bar, so the
                    wordmark steps aside for it. */}
                {!(searchOpen && isMobile) && (
                <div
                    className="flex items-center gap-1.5 flex-shrink-0"
                    style={{ visibility: logoHeld ? 'hidden' : 'visible' }}
                >
                    <Link
                        to="/"
                        data-app-logo
                        aria-label={t('app.home')}
                        className="flex items-center gap-2 focus-ring rounded-lg"
                        style={{
                            color: 'rgba(255,255,255,0.92)', pointerEvents: 'auto',
                            textShadow: '0 1px 8px rgba(0,0,0,0.9)',
                        }}
                        onClick={() => window.scrollTo({ top: 0, behavior: 'instant' })}
                    >
                        <Telescope className="h-5 w-5" style={{ color: 'var(--accent)' }} aria-hidden="true" />
                        {/* Set in caps with the tracking opened up. Lowercase
                            "p4rsec" reads as a handle; in caps the 4 sits in the
                            run of letters as a substituted A rather than as a typo,
                            and it matches the uppercase labels the rest of the
                            interface already uses. */}
                        <span data-latin style={{ fontSize: 17, fontWeight: 800, letterSpacing: '0.14em' }}>
                            {t('app.name')}
                        </span>
                    </Link>
                    {/* Build version — opens the "what's new" panel. Not inside
                        the link: [data-app-logo] is what the loading screen
                        measures to land the flown wordmark on. */}
                    <button
                        type="button"
                        data-latin
                        onClick={() => setWhatsNewOpen(true)}
                        aria-label={t('nav.whatsNew')}
                        title={t('nav.whatsNew')}
                        className="focus-ring rounded"
                        style={{
                            background: 'none', border: 'none', padding: '2px 3px', margin: '-2px -3px',
                            fontSize: 9, fontWeight: 600, letterSpacing: '0.08em',
                            lineHeight: 1,
                            color: 'rgba(255,255,255,0.36)',
                            textShadow: '0 1px 6px rgba(0,0,0,0.9)',
                            fontVariantNumeric: 'tabular-nums',
                            pointerEvents: 'auto', cursor: 'pointer',
                        }}
                    >
                        v{pkg.version}
                    </button>
                </div>
                )}

                <div
                    ref={searchRef}
                    className="flex items-center gap-2"
                    style={{ pointerEvents: 'auto', ...(searchOpen && isMobile ? { flex: 1 } : {}) }}
                >
                    {/* Below the (max-width: 767px) breakpoint these six collapse
                        behind one burger button — at a ~390px viewport the seven
                        icon buttons plus the wordmark measurably overflowed the
                        header (the search button's own right edge landed past
                        the viewport edge). Desktop keeps the original inline row,
                        completely unchanged. */}
                    {!searchOpen && isMobile && (
                        <HeaderMenu
                            onShare={share} copied={copied} onSkyClick={handleSkyClick}
                            onTrackerClick={handleTrackerClick}
                            onOpen={onMenuOpened}
                        />
                    )}
                    {!searchOpen && !isMobile && <LanguagePicker />}
                    {!searchOpen && !isMobile && (
                        <button
                            onClick={share}
                            title={copied ? t('nav.copied') : t('nav.copyLink')}
                            aria-label={t('nav.copyLink')}
                            data-tone={copied ? 'positive' : undefined}
                            className="chrome-btn focus-ring"
                        >
                            {copied
                                ? <Check className="h-4 w-4" aria-hidden="true" />
                                : <Link2 className="h-4 w-4" aria-hidden="true" />}
                        </button>
                    )}
                    {!searchOpen && !isMobile && (
                        <Link
                            to="/satellites"
                        onClick={handleTrackerClick}
                            title={t('nav.trackerTitle')}
                            aria-label={t('nav.tracker')}
                            className="chrome-btn focus-ring"
                        >
                            <Satellite className="h-4 w-4" aria-hidden="true" />
                        </Link>
                    )}
                    {!searchOpen && !isMobile && (
                        <Link
                            to="/sky"
                            onClick={handleSkyClick}
                            title={t('nav.skyTitle')}
                            aria-label={t('nav.sky')}
                            className="chrome-btn focus-ring"
                        >
                            <Star className="h-4 w-4" aria-hidden="true" />
                        </Link>
                    )}
                    {!searchOpen && !isMobile && (
                        <Link
                            to="/compare"
                            title={t('nav.compareTitle')}
                            aria-label={t('nav.compare')}
                            className="chrome-btn focus-ring"
                        >
                            <Scale className="h-4 w-4" aria-hidden="true" />
                        </Link>
                    )}
                    {searchOpen && (
                        <div className="animate-fade-in" style={{ width: isMobile ? '100%' : 'clamp(200px, 52vw, 340px)' }}>
                            <ObjectSearch autoFocus onClose={() => setSearchOpen(false)} />
                        </div>
                    )}
                    <button
                        onClick={() => setSearchOpen(v => !v)}
                        aria-label={searchOpen ? t('nav.searchClose') : t('nav.search')}
                        aria-expanded={searchOpen}
                        title={t('nav.searchShortcut')}
                        data-on={searchOpen || undefined}
                        className="chrome-btn focus-ring"
                    >
                        <Search className="h-4 w-4" aria-hidden="true" />
                    </button>
                </div>
              </div>
            </header>

            {/* First-visit hint at the burger menu — position:fixed, viewport-
                absolute from the measured rect, so it lands right regardless
                of scroll position or page direction. */}
            {showMenuCoach && menuCoachRect && (
                <CoachMark
                    text={t('nav.hintMenu')}
                    arrow="up"
                    onDismiss={() => endMenuCoach(true)}
                    style={{
                        left: menuCoachRect.left + menuCoachRect.width / 2,
                        top: menuCoachRect.bottom + 8,
                        transform: 'translateX(-50%)',
                        maxWidth: 190,
                    }}
                />
            )}

            <main className="flex-1 max-w-7xl mx-auto w-full">{children}</main>

            {/* ── Category bar ──
                Tabs keep their natural width and the bar scrolls, so labels never
                compress into each other on narrow screens.

                `inert` while hidden: opacity:0 leaves buttons in the tab order,
                so a keyboard user was tabbing through 13 invisible categories
                before reaching anything on screen. */}
            <nav
                ref={navRef}
                aria-label={t('nav.categories')}
                inert={navHidden || undefined}
                aria-hidden={navHidden || undefined}
                className="fixed bottom-0 left-0 right-0 z-50 flex transition-all duration-500 ease-in-out no-scrollbar"
                style={{
                    // Not .glass: at 8% white over bright catalog imagery the
                    // labels were barely legible. This needs to be opaque enough
                    // to read against anything scrolling underneath it.
                    background: 'rgba(6,8,12,0.92)',
                    backdropFilter: 'blur(22px) saturate(150%)',
                    WebkitBackdropFilter: 'blur(22px) saturate(150%)',
                    borderTop: '1px solid var(--hairline-hi)',
                    boxShadow: '0 -8px 28px rgba(0,0,0,0.45)',
                    height: 68,
                    overflowX: 'auto',
                    overflowY: 'hidden',
                    padding: '0 var(--s-2)',
                    transform: navHidden ? 'translateY(100%)' : 'translateY(0)',
                    opacity: navHidden ? 0 : 1,
                    pointerEvents: navHidden ? 'none' : 'auto',
                    transitionTimingFunction: 'var(--ease-glide)',
                }}
            >
                {/* Inner track: `margin: auto` centres the tabs when the window
                    is wide enough to hold them all, and collapses to zero when
                    it isn't, so the bar still scrolls from the first tab. A bare
                    `justify-content: center` would clip the start when the tabs
                    overflow. Which way it lands depends on window width, which
                    is why this looked fine on one machine and left-packed on
                    another. */}
                <div style={{ display: 'flex', alignItems: 'stretch', gap: 2, margin: '0 auto', flex: '0 0 auto' }}>
                {CATEGORY_TABS.map((tab) => {
                    const { id } = tab;
                    const { label } = category(tab);
                    const Icon = TAB_ICONS[id] ?? CircleDot;
                    const isActive = activeTab === id;
                    const count = CATEGORY_COUNTS[id];
                    return (
                        <button
                            key={id}
                            data-active={isActive}
                            onClick={() => setTab(id)}
                            aria-current={isActive ? 'page' : undefined}
                            aria-label={`${label} — ${t('catalog.count', { count })}`}
                            className="cat-tab flex flex-col items-center justify-center gap-1 relative flex-shrink-0 focus-ring"
                            style={{
                                minWidth: 76,
                                padding: 'var(--s-2) var(--s-3)',
                                borderRadius: 'var(--r-md)',
                                color: isActive ? '#fff' : 'rgba(255,255,255,0.42)',
                                cursor: 'pointer',
                            }}
                        >
                            <Icon
                                className="h-5 w-5"
                                style={{
                                    transform: isActive ? 'translateY(-1px) scale(1.1)' : 'none',
                                    transition: 'transform var(--t-base) var(--ease-out)',
                                }}
                                aria-hidden="true"
                            />
                            {/* Label with the object count beside it, so a tab that
                                holds one object reads differently from one that
                                holds twenty before you open it. */}
                            <span style={{ display: 'flex', alignItems: 'center', gap: 5, whiteSpace: 'nowrap' }} aria-hidden="true">
                                <span style={{
                                    fontSize: 'var(--fs-label)', fontWeight: 600,
                                    letterSpacing: '0.01em',
                                }}>
                                    {label}
                                </span>
                                {/* The count sits in its own chip rather than
                                    running on as a second number, so "Moons 23"
                                    can't be misread as one label. */}
                                <span style={{
                                    fontSize: 9, fontWeight: 700, fontVariantNumeric: 'tabular-nums',
                                    padding: '1px 4px', borderRadius: 'var(--r-xs)', lineHeight: 1.3,
                                    background: isActive ? 'rgba(255,255,255,0.14)' : 'rgba(255,255,255,0.06)',
                                    color: isActive ? 'rgba(255,255,255,0.80)' : 'rgba(255,255,255,0.34)',
                                    transition: 'background var(--t-base) var(--ease-out), color var(--t-base) var(--ease-out)',
                                }}>
                                    {count}
                                </span>
                            </span>
                            {isActive && (
                                <span
                                    className="absolute rounded-full"
                                    style={{
                                        bottom: 4, width: 20, height: 2,
                                        background: 'var(--accent)',
                                        boxShadow: '0 0 10px rgba(255,255,255,0.55)',
                                    }}
                                />
                            )}
                        </button>
                    );
                })}
                </div>
            </nav>

            <WhatsNew
                open={whatsNewOpen}
                onClose={() => setWhatsNewOpen(false)}
                currentVersion={releaseLine}
            />
        </div>
    );
};

export default AppShell;
