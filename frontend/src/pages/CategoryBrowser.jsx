import { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { useSearchParams, useNavigate, useMatch } from 'react-router-dom';
import { ChevronDown, ChevronLeft, ArrowUpRight, Ruler, Orbit, Pause, SlidersHorizontal, Waves, Waypoints } from 'lucide-react';
// STASHED StarfieldBg — uncomment this and the <StarfieldBg /> below to restore it.
// import StarfieldBg from '../components/StarfieldBg';
import SolarSystem3D from '../components/SolarSystem3D';
import SystemTitle from '../components/SystemTitle';
import LoadingScreen from '../components/LoadingScreen';
import { DEFAULT_SYSTEM } from '../data/systems';
import SpaceDataStrip from '../components/SpaceDataStrip';
import ObjectCard from '../components/ObjectCard';
import ObjectDetailBody from '../components/ObjectDetailBody';
import ObjectHero from '../components/ObjectHero';
import SpacecraftViewer from '../components/SpacecraftViewer';
import TimeControl from '../components/TimeControl';
import DriftPanel from '../components/DriftPanel';
import ScenePanel from '../components/ScenePanel';
import CoachMark from '../components/CoachMark';
import { CATEGORY_TABS, getObjectsByCategory, getObjectById, resolveTab } from '../data/objectCatalog';
import { hasSceneBody } from '../data/solarSystemBodies';
import { useHorizons } from '../hooks/useHorizons';
import { useIsMobile, useIsShortViewport } from '../hooks/useMediaQuery';
import {
    getScaleStage, cycleScaleStage, subscribeScale, setScaleStage as setSceneStage,
    SCALE_COMPRESSED, SCALE_DISTANCES, SCALE_SIZES,
} from '../utils/scaleMode';
import {
    getVizMode, cycleVizMode, subscribeViz, VIZ_OFF, VIZ_GRID, VIZ_FIELD,
} from '../utils/vizMode';
import { getTrailsOn, toggleTrails, subscribeTrails } from '../utils/trailMode';
import { decodeView } from '../utils/shareView';
import { IDLE, getSkyEntryPhase, subscribeSkyEntry } from '../utils/skyEntry';
import {
    IDLE as TRK_IDLE, armTrackerEntry, getTrackerPhase, subscribeTracker,
} from '../utils/trackerEntry';
import { getRate, setRate, setOffsetDays } from '../utils/simTime';
import { useI18n } from '../i18n';

// The arrows point from the first letter of the alphabet to the last, so in a
// right-to-left interface they point the other way — and the alphabet named is
// the reader's own, not the Latin one.
const SORT_OPTIONS = [
    { value: 'default', key: 'catalog.sortDefault' },
    { value: 'name_az', key: 'catalog.sortAZ' },
    { value: 'name_za', key: 'catalog.sortZA' },
];

const SortDropdown = ({ value, onChange }) => {
    const { t } = useI18n();
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
                className="sort-trigger flex items-center gap-1.5 focus-ring"
                style={{
                    fontSize: 'var(--fs-sm)', color: 'var(--text-tertiary)',
                    padding: '7px var(--s-3)', borderRadius: 'var(--r-sm)',
                    border: '1px solid transparent', cursor: 'pointer',
                    whiteSpace: 'nowrap',
                    transition: 'background var(--t-base) var(--ease-out), border-color var(--t-base) var(--ease-out)',
                }}
            >
                {t('catalog.sort')}{' '}
                <span style={{ color: 'var(--text-primary)', fontWeight: 600 }}>
                    {selected && t(selected.key)}
                </span>
                <ChevronDown
                    className="h-3.5 w-3.5"
                    style={{
                        transform: open ? 'rotate(180deg)' : 'none',
                        transition: 'transform var(--t-base) var(--ease-out)',
                    }}
                />
            </button>
            {open && (
                <div className="glass animate-fade-in absolute top-full w-44 z-20 overflow-hidden"
                    style={{ insetInlineEnd: 0, marginTop: 'var(--s-2)', padding: 'var(--s-1)' }} role="listbox">
                    {SORT_OPTIONS.map(opt => (
                        <button
                            key={opt.value}
                            role="option"
                            aria-selected={opt.value === value}
                            onClick={() => { onChange(opt.value); setOpen(false); }}
                            className="sort-option w-full"
                            style={{
                                textAlign: 'start', display: 'block',
                                padding: '9px var(--s-3)', borderRadius: 'var(--r-sm)',
                                fontSize: 'var(--fs-sm)', cursor: 'pointer',
                                transition: 'background var(--t-fast) var(--ease-out), color var(--t-fast) var(--ease-out)',
                                ...(opt.value === value
                                    ? { color: '#fff', background: 'rgba(255,255,255,0.10)', fontWeight: 600 }
                                    : { color: 'var(--text-secondary)' }),
                            }}
                        >
                            {t(opt.key)}
                        </button>
                    ))}
                </div>
            )}
        </div>
    );
};

const LiveDistanceRow = ({ spacecraftId }) => {
    const { t } = useI18n();
    const { distanceAU } = useHorizons(spacecraftId);
    if (distanceAU == null) return null;
    const km = distanceAU * 149597870.7;
    const lightHours = km / 1079252848.8;   // km per light-hour
    return (
        <div className="glass p-5">
            <p className="text-[10px] font-bold uppercase tracking-widest" style={{ color: 'var(--text-tertiary)' }}>
                {t('spacecraft.distanceFromSun')}
            </p>
            <p className="text-lg font-bold mt-1 text-white num-run" style={{ fontVariantNumeric: 'tabular-nums' }}>
                {t.digits(distanceAU.toFixed(2))}{' '}
                <span className="text-sm font-medium" style={{ color: 'rgba(255,255,255,0.45)' }}>
                    {t('spacecraft.au')}
                </span>
            </p>
            <p className="text-xs mt-1" style={{ color: 'var(--text-tertiary)' }}>
                {t('spacecraft.lightDelay', {
                    km: (km / 1e9).toFixed(2), hours: lightHours.toFixed(1),
                })}
            </p>
            <p className="text-[10px] mt-2" style={{ color: 'rgba(255,255,255,0.28)' }}>
                {t('spacecraft.horizonsNote')}
            </p>
        </div>
    );
};

// Planets whose moons exist in the 3D scene
const PLANETS_WITH_MOONS = new Set(['earth', 'mars', 'jupiter', 'saturn', 'uranus', 'neptune']);
const SPACECRAFT_CATEGORIES = new Set(['space-stations', 'space-telescopes', 'deep-space-probes', 'historical']);
// The standalone model viewer is stashed for now. Flip this back to true to
// bring it back; SpacecraftViewer and its procedural models are untouched.
const SHOW_SPACECRAFT_VIEWER = false;

const CategoryBrowser = () => {
    const { t, rtl, intl, object: localize, category: localizeCategory } = useI18n();
    const match = useMatch('/object/:id');
    const id = match?.params?.id;
    const navigate = useNavigate();
    const [searchParams] = useSearchParams();
    const activeTab = resolveTab(searchParams.get('tab'));
    const [sortBy, setSortBy] = useState('default');
    const isMobile = useIsMobile();
    const isShort = useIsShortViewport();
    // The focused-object view (sheet vs. flanking annotations, where the body
    // sits) also switches to the compact treatment on a landscape phone, which
    // is wide enough to miss the mobile breakpoint but too short for the tall
    // desktop layout. The hero and the catalog grid stay keyed on width alone.
    const compactFocus = isMobile || isShort;

    const object = useMemo(
        () => (id ? localize(getObjectById(id)) : null), [id, localize]);

    // Whether the scene has a body to fly to. Exoplanets, deep-sky targets,
    // near-Earth asteroids and most spacecraft have none — asking the category
    // was a poor proxy, since it called Andromeda "in scene" and then focused
    // on nothing. Those objects show imagery instead.
    const inScene = !!object && hasSceneBody(object.id);
    const isSpacecraftCard = !!object && !inScene;
    const isSpacecraft = !!object && SPACECRAFT_CATEGORIES.has(object.category);

    // ── UI state ───────────────────────────────────────────────────────────
    const [hasInteracted3D, setHasInteracted3D] = useState(false);
    // The scene owns the layout and reads it every frame; this is only so the
    // button can show which way it is set.
    // The scene drifts slowly by default; this holds it still.
    const [autoRotate, setAutoRotate] = useState(true);
    const [scaleStage, setScaleStageUI] = useState(getScaleStage);
    useEffect(() => subscribeScale(() => setScaleStageUI(getScaleStage())), []);
    // One pill cycled compressed → true distances → true distances and sizes,
    // the same shape the gravity pill beside it already uses: the label carries
    // the state, because a cycle button otherwise gives no clue what it does.
    const scaleLabel = scaleStage === SCALE_SIZES ? 'scene.trueDistancesSizes'
        : scaleStage === SCALE_DISTANCES ? 'scene.trueDistances'
            : 'scene.compressedDistances';
    const [vizMode, setVizModeUI] = useState(getVizMode);
    useEffect(() => subscribeViz(() => setVizModeUI(getVizMode())), []);
    const [trailsOn, setTrailsOnUI] = useState(getTrailsOn);
    useEffect(() => subscribeTrails(() => setTrailsOnUI(getTrailsOn())), []);

    // A shared link carries the camera, the clock and the layout. Read once, on
    // mount, because after that they belong to whoever is driving — rereading
    // would yank the view back every time the URL changed for another reason.
    const [sharedView] = useState(() => decodeView(window.location.search));
    useEffect(() => {
        if (sharedView.scaleStage) setSceneStage(sharedView.scaleStage);
        if (sharedView.at) {
            setOffsetDays((sharedView.at.getTime() - Date.now()) / 86400000);
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);
    const [pageScrolled, setPageScrolled] = useState(false);
    // Phone only: the drift and scale toggles fold behind one button so the
    // hero isn't three rows of controls deep on a small screen.
    const [sceneOptsOpen, setSceneOptsOpen] = useState(false);
    const [moonHintVisible, setMoonHintVisible] = useState(false);
    const [sheetOpen, setSheetOpen] = useState(false);
    const [descriptionOpen, setDescriptionOpen] = useState(false);
    // True only for the panel's own timed arrival, false the moment a reader
    // takes the handle. The two want different speeds: the automatic reveal is
    // part of the arrival and reads better slow, while a tap is a direct
    // manipulation and a slow one just feels unresponsive.
    const [autoRevealing, setAutoRevealing] = useState(false);

    // The /sky cinematic flies the camera down onto Earth's surface, and it
    // gets there by focusing Earth — which otherwise brings this page's whole
    // focused-object treatment with it: the description sliding in over the
    // shot, the stats either side, the moon hint. None of that belongs on a
    // dive, so the overlay steps aside for the length of one.
    //
    // The tracker hand-off wants exactly the same thing for exactly the same
    // reason — it focuses the ISS to get its first beat — so it shares the
    // flag rather than growing a second one that does the same job. Both are
    // "a cinematic owns the frame right now".
    const cinematic = () => getSkyEntryPhase() !== IDLE || getTrackerPhase() !== TRK_IDLE;
    const [skyDiving, setSkyDiving] = useState(cinematic);
    useEffect(() => {
        const sync = () => setSkyDiving(cinematic());
        const unsubSky = subscribeSkyEntry(sync);
        const unsubTrk = subscribeTracker(sync);
        return () => { unsubSky(); unsubTrk(); };
    }, []);

    // ── First-visit coach marks ────────────────────────────────────────────
    // Two hints the first time someone explores the scene, one after the other
    // (`coachStep` 0 → speed, 1 → settings): each an arrow and a line of text
    // pinned to its control (see the measure effect). A stored flag means
    // "seen"; a plain time-out doesn't set it, so a visitor who glanced away
    // gets one more chance next time.
    const [coachSeen, setCoachSeen] = useState(() => {
        try { return window.localStorage.getItem('p4rsec.coach') === '1'; }
        catch { return true; }   // no storage → don't nag
    });
    const [coachArmed, setCoachArmed] = useState(false);
    const [coachStep, setCoachStep] = useState(0);
    const [coachRects, setCoachRects] = useState(null);
    const endCoach = useCallback((persist) => {
        setCoachSeen(true);
        if (persist) { try { window.localStorage.setItem('p4rsec.coach', '1'); } catch { /* private window */ } }
    }, []);
    const nextCoach = useCallback((persist) => {
        setCoachStep(s => (s === 0 ? 1 : s));
        if (coachStep === 1) endCoach(persist);
    }, [coachStep, endCoach]);
    // Opening the settings drawer ends the run — they found it.
    const onSettingsOpened = useCallback(() => {
        setCoachSeen((seen) => {
            if (!seen) { try { window.localStorage.setItem('p4rsec.coach', '1'); } catch { /* empty */ } }
            return true;
        });
    }, []);

    // Arm a beat after the first scene interaction — the greeting has faded by
    // then and the reader is clearly poking around.
    useEffect(() => {
        if (coachSeen || !hasInteracted3D) return undefined;
        const t = setTimeout(() => setCoachArmed(true), 1300);
        return () => clearTimeout(t);
    }, [coachSeen, hasInteracted3D]);

    const showCoach = coachArmed && !coachSeen && !id && !pageScrolled;

    // Measure the current step's control so its hint can centre on it and sit a
    // clear gap away. Re-measured on resize and one frame later (layout settles
    // after the toggles fade in).
    useEffect(() => {
        if (!showCoach) { setCoachRects(null); return undefined; }
        // Step 0 aims at the fast-forward button when the transport is open,
        // otherwise the whole (collapsed) time pill.
        const pick = () => (coachStep === 0
            ? (document.querySelector('[data-coach="ff"]') ?? document.querySelector('[data-coach="time"]'))
            : document.querySelector('[data-coach="tab"]'));
        const measure = () => setCoachRects(pick()?.getBoundingClientRect() ?? null);
        measure();
        const raf = requestAnimationFrame(measure);
        window.addEventListener('resize', measure);
        return () => { cancelAnimationFrame(raf); window.removeEventListener('resize', measure); };
    }, [showCoach, coachStep, isMobile]);

    // Leaving the hero ends the run for good; otherwise each step advances on
    // its own after a while, and the last one fades without marking itself seen.
    useEffect(() => {
        if (coachSeen || !coachArmed) return undefined;
        if (id || pageScrolled) { endCoach(true); return undefined; }
        const t = setTimeout(() => nextCoach(false), 8000);
        return () => clearTimeout(t);
    }, [coachSeen, coachArmed, coachStep, id, pageScrolled, nextCoach, endCoach]);

    useEffect(() => {
        const onScroll = () => setPageScrolled(window.scrollY > 40);
        window.addEventListener('scroll', onScroll, { passive: true });
        return () => window.removeEventListener('scroll', onScroll);
    }, []);

    // The view-options popover only belongs to the hero. Fold it away when the
    // page scrolls or an object is focused, so it isn't sitting open behind the
    // fade the next time the hero comes back.
    useEffect(() => {
        if (pageScrolled || id) setSceneOptsOpen(false);
    }, [pageScrolled, id]);

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
    //
    // Mobile waits far longer than desktop, because on a phone this panel is
    // the thing that also moves the planet: opening it sets `focusOffsetY`
    // below, which lifts the body up the frame to make room. At 1.5s that
    // landed on top of the fly-in — the longest of which (true sizes) runs
    // 2.4s — so the body arrived centred and was immediately shoved upward
    // while the sheet was still sliding. 4s clears every flight the scene has
    // with room to spare, and lets the arrival be its own moment before
    // anything else moves. (The lift itself is eased in the scene now too;
    // the delay is what stops the two motions overlapping at all.)
    const revealDelay = compactFocus ? 4000 : 1500;
    useEffect(() => {
        setSheetOpen(false);
        setDescriptionOpen(false);
        setAutoRevealing(false);
        setMoonHintVisible(false);
        if (!id) return;
        // Arming the cinematic while already focused on Earth doesn't change
        // `id`, so this effect re-running on `skyDiving` is also what closes
        // a description that was already open when the dive started.
        if (skyDiving) return;
        const openAt = setTimeout(() => {
            setAutoRevealing(true);
            setDescriptionOpen(true);
            if (compactFocus) setSheetOpen(true);
        }, revealDelay);
        const timers = [openAt];
        if (PLANETS_WITH_MOONS.has(id)) {
            timers.push(setTimeout(() => setMoonHintVisible(true), 1700));
            timers.push(setTimeout(() => setMoonHintVisible(false), 9500));
        }
        return () => timers.forEach(clearTimeout);
    }, [id, isSpacecraftCard, compactFocus, skyDiving, revealDelay]);

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

    // Focusing an object resets the clock to real time, so the flight in and
    // whatever you're watching read at their natural pace instead of
    // whatever speed the overview happened to be left at — you can still
    // speed up or slow down from there while focused. Leaving returns the
    // clock to the pace it had before you focused anything. Keyed on `id`
    // being present at all (not `inScene`) so a spacecraft card gets the same
    // treatment; keyed off a captured ref rather than re-firing on every `id`
    // change so clicking from one focused body straight to another (a moon,
    // say) doesn't re-reset the rate you already chose mid-focus.
    const preFocusRateRef = useRef(null);
    useEffect(() => {
        if (id) {
            if (preFocusRateRef.current === null) {
                preFocusRateRef.current = getRate();
                setRate(1);
            }
        } else if (preFocusRateRef.current !== null) {
            setRate(preFocusRateRef.current);
            preFocusRateRef.current = null;
        }
    }, [id]);

    const currentCategory = localizeCategory(
        CATEGORY_TABS.find(tab => tab.id === activeTab));
    const objects = getObjectsByCategory(currentCategory.id);
    // Sorted on the translated names with the reader's own collation — an
    // alphabetical list of English names is not alphabetical in Arabic.
    const sorted = useMemo(() => objects.map(localize).sort((a, b) => {
        if (sortBy === 'name_az') return a.name.localeCompare(b.name, intl);
        if (sortBy === 'name_za') return b.name.localeCompare(a.name, intl);
        return 0;
    }), [objects, sortBy, localize, intl]);

    // `valueText` and `labelText` are the translated pair that localizeObject
    // adds beside the English `value`/`label` — the English ones stay because
    // they are what a section and a row are identified by, and reading them
    // here is how the flanking annotations kept saying MASS on an Arabic page.
    const physicalRows = (object?.stats?.find(s => s.section === 'Physical')?.rows ?? [])
        .map(r => ({ value: r.valueText ?? r.value, label: r.labelText ?? r.label }));
    const scrollToCatalog = useCallback(() => {
        // Land with the "Planets — 8 objects" heading just under the header, not
        // a full viewport down — on a phone the scene is shorter than that and
        // `innerHeight` overshot the heading clean off the top.
        const el = document.getElementById('catalog');
        const top = el
            ? Math.max(0, el.getBoundingClientRect().top + window.scrollY - 60)
            : window.innerHeight;
        window.scrollTo({ top, behavior: 'smooth' });
    }, []);

    // Mobile lifts the focused body clear of the sheet — but only while the
    // sheet is actually covering it. Collapsed, the viewport is free again and
    // the object returns to centre instead of staying pinned to the top half.
    // Desktop keeps the body centred throughout.
    const focusOffsetY = id && compactFocus && sheetOpen ? 0.24 : 0;

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
            {/* Over everything, and only on the page that owns the scene: the
                tracker and the sky pages load no textures, so a screen waiting
                on them there would be waiting on nothing. */}
            <LoadingScreen />

            {/* STASHED StarfieldBg — restore with its import at the top of this file.
                <StarfieldBg canvasId="starfield-browser" /> */}

            {/* The page's document heading. Visually hidden on the home view —
                the solar system itself is the title — but present for search
                engines and screen readers, which otherwise found no h1 at all.
                On a focused object the visible name below takes over. */}
            {!id && (
                <h1 style={{
                    position: 'absolute', width: 1, height: 1, padding: 0, margin: -1,
                    overflow: 'hidden', clip: 'rect(0 0 0 0)', whiteSpace: 'nowrap', border: 0,
                }}>
                    {t('app.srTitle')}
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
                    // Full bleed out of the centred <main>. Both margins, not
                    // just the left one: with a width and a single margin set,
                    // the box is over-constrained, and CSS resolves that by
                    // discarding the *end* margin — which is the right one in a
                    // left-to-right page and the left one in a right-to-left
                    // page. Setting only margin-left therefore worked in
                    // English and slid the whole scene 80px off the left edge
                    // in Arabic. Two equal margins are not over-constrained at
                    // all, and land it correctly either way.
                    style={{
                        width: '100vw',
                        marginLeft: 'calc(-50vw + 50%)',
                        marginRight: 'calc(-50vw + 50%)',
                    }}
                    onPointerDown={() => setHasInteracted3D(true)}
                    onWheel={() => setHasInteracted3D(true)}
                >
                    <div style={{
                        // Barely there. The scene is irrelevant to these objects,
                        // and at a readable opacity its planet labels drift across
                        // the image competing with it.
                        opacity: isSpacecraftCard ? 0.05 : 1,
                        filter: isSpacecraftCard ? 'saturate(0.3)' : 'none',
                        transition: 'opacity 600ms ease, filter 600ms ease',
                        pointerEvents: isSpacecraftCard ? 'none' : 'auto',
                    }}>
                        <SolarSystem3D
                            focusedId={inScene ? id : null}
                            focusOffsetY={focusOffsetY}
                            height={sceneHeight}
                            initialCamera={sharedView.camera}
                            autoRotate={autoRotate}
                        />
                    </div>

                    {/* Which system you are looking at. A heading today and a
                        dropdown the moment data/systems.js has a second entry.
                        It goes on the first drag, with the instruction under it
                        — both are a greeting, and once you are moving the scene
                        yourself neither is telling you anything. It goes on a
                        card or a scroll to the catalog for the same reason. */}
                    <SystemTitle
                        currentId={DEFAULT_SYSTEM}
                        compact={isMobile}
                        hidden={!!id || pageScrolled || hasInteracted3D}
                        hint={t(isMobile ? 'scene.hintMobile' : 'scene.hintDesktop')}
                    />

                    {/* Imagery stands in for objects the scene cannot place */}
                    {object && !inScene && (
                        <div
                            className="absolute inset-0 flex justify-center pointer-events-none"
                            style={{
                                zIndex: 3,
                                padding: '0 16px',
                                // Compact sits it under the header and above the
                                // sheet; centring would bury it, since the sheet
                                // opens over the lower half.
                                alignItems: compactFocus ? 'flex-start' : 'center',
                                paddingTop: compactFocus ? 76 : 0,
                            }}
                        >
                            <ObjectHero object={object} compact={compactFocus} />
                        </div>
                    )}

                    {/* Time scrubber. Kept while a planet is focused on desktop —
                        watching a moon system wind forward is the best of it, and
                        the bottom-left corner is clear of the centred sheet. Hidden
                        on a focused mobile view, where the sheet takes that space. */}
                    <TimeControl
                        hidden={(compactFocus && !!id) || (!!id && !inScene)}
                        focused={inScene && !!id}
                    />


                    {/* Catalog entry point, plus the scene toggles.
                        Desktop: the pill sits centred, aligned with the time
                        control (a 1.5.2 decision); the toggles live in the
                        ScenePanel drawer against the leading edge, collapsed by
                        default (4.2.0 — the fan was growing a pill per feature).
                        Phone: the drawer fights the thumb there, so the toggles
                        stay folded behind one button up the start edge above the
                        time control, and the pill sits alongside it. */}
                    {(() => {
                        const pill = (active) => ({
                            pointerEvents: id || pageScrolled ? 'none' : 'auto',
                            opacity: id || pageScrolled ? 0 : 1,
                            background: active ? 'rgba(255,209,102,0.16)' : 'rgba(0,0,0,0.42)',
                            border: `1px solid ${active ? 'rgba(255,209,102,0.34)' : 'rgba(255,255,255,0.16)'}`,
                            backdropFilter: 'blur(14px)',
                            WebkitBackdropFilter: 'blur(14px)',
                            color: active ? '#ffd166' : 'rgba(255,255,255,0.78)',
                            padding: '7px 15px', fontSize: 10, fontWeight: 700,
                            letterSpacing: '0.1em', textTransform: 'uppercase',
                            cursor: 'pointer', whiteSpace: 'nowrap',
                        });
                        const driftBtn = (
                            <button
                                key="drift"
                                onClick={() => setAutoRotate(v => !v)}
                                aria-pressed={!autoRotate}
                                aria-label={t(autoRotate ? 'scene.driftingAria' : 'scene.heldStillAria')}
                                title={t(autoRotate ? 'scene.driftingTitle' : 'scene.heldStillTitle')}
                                inert={(!!id || pageScrolled) || undefined}
                                className="flex items-center gap-1.5 rounded-full transition-opacity duration-700 focus-ring"
                                style={pill(!autoRotate)}
                            >
                                {autoRotate
                                    ? <Orbit style={{ width: 13, height: 13 }} />
                                    : <Pause style={{ width: 13, height: 13 }} />}
                                {t(autoRotate ? 'scene.drifting' : 'scene.heldStill')}
                            </button>
                        );
                        const driftPanel = (
                            <DriftPanel
                                key="driftpanel"
                                driftOn={autoRotate}
                                onWake={() => setAutoRotate(true)}
                                disabled={!!id || pageScrolled}
                            />
                        );
                        const scaleBtn = (
                            <button
                                key="scale"
                                onClick={cycleScaleStage}
                                aria-pressed={scaleStage !== SCALE_COMPRESSED}
                                aria-label={t('scene.scaleAria', { state: t(scaleLabel) })}
                                title={t('scene.scaleAria', { state: t(scaleLabel) })}
                                inert={(!!id || pageScrolled) || undefined}
                                className="flex items-center gap-1.5 rounded-full transition-opacity duration-700 focus-ring"
                                style={pill(scaleStage !== SCALE_COMPRESSED)}
                            >
                                <Ruler style={{ width: 13, height: 13 }} />
                                {/* Every value names a layout, so the three read as
                                    one setting with three settings rather than as a
                                    verb one way and a noun the other. "To scale"
                                    was also ambiguous about which state it meant. */}
                                {t(scaleLabel)}
                            </button>
                        );
                        // One pill, cycled off → warped grid → field lines → off.
                        // The label carries the state because a cycle button
                        // otherwise gives no clue what it does or where it is.
                        const gravState = vizMode === VIZ_GRID ? 'scene.gravityStateGrid'
                            : vizMode === VIZ_FIELD ? 'scene.gravityStateField'
                                : 'scene.gravityStateOff';
                        const gravBtn = (
                            <button
                                key="gravity"
                                onClick={cycleVizMode}
                                aria-pressed={vizMode !== VIZ_OFF}
                                aria-label={t('scene.gravityAria', { state: t(gravState) })}
                                title={t('scene.gravityAria', { state: t(gravState) })}
                                inert={(!!id || pageScrolled) || undefined}
                                className="flex items-center gap-1.5 rounded-full transition-opacity duration-700 focus-ring"
                                style={pill(vizMode !== VIZ_OFF)}
                            >
                                <Waves style={{ width: 13, height: 13 }} />
                                {vizMode === VIZ_OFF
                                    ? t('scene.gravity')
                                    : `${t('scene.gravity')} · ${t(gravState)}`}
                            </button>
                        );
                        const trailsBtn = (
                            <button
                                key="trails"
                                onClick={toggleTrails}
                                aria-pressed={trailsOn}
                                aria-label={t(trailsOn ? 'scene.trailsOnAria' : 'scene.trailsOffAria')}
                                title={t(trailsOn ? 'scene.trailsOnAria' : 'scene.trailsOffAria')}
                                inert={(!!id || pageScrolled) || undefined}
                                className="flex items-center gap-1.5 rounded-full transition-opacity duration-700 focus-ring"
                                style={pill(trailsOn)}
                            >
                                <Waypoints style={{ width: 13, height: 13 }} />
                                {t('scene.trails')}
                            </button>
                        );
                        const exploreBtn = (
                            <button
                                onClick={scrollToCatalog}
                                aria-label={t('scene.scrollToCatalog')}
                                inert={(!!id || pageScrolled) || undefined}
                                className="chip explore-chip transition-opacity duration-700 focus-ring"
                                style={{
                                    pointerEvents: id || pageScrolled ? 'none' : 'auto',
                                    opacity: id || pageScrolled ? 0 : 1,
                                }}
                            >
                                {t('scene.exploreCatalog')}
                                {/* Nudges down on hover, in the direction it
                                    is about to send the page. */}
                                <ChevronDown className="explore-chev" style={{ width: 14, height: 14 }} />
                            </button>
                        );

                        // ── Desktop: centred pill, toggles in the edge drawer ──
                        if (!isMobile) {
                            return (
                                <>
                                    {/* Against the trailing edge of the spine,
                                        opposite the transport — so the bottom of
                                        the scene reads as one bar with an anchor
                                        at each end, the way the header does, and
                                        the two can never collide. Centring it put
                                        it hard against the transport's right edge
                                        at every window width from 1280px up: the
                                        transport is ~510px wide, and half a 1280px
                                        window minus the spine gutter is exactly
                                        that much room. */}
                                    <div
                                        className="absolute flex pointer-events-none"
                                        style={{
                                            bottom: 'var(--scene-baseline)',
                                            insetInlineEnd: 'var(--scene-inset)',
                                            zIndex: 4,
                                        }}
                                    >
                                        {exploreBtn}
                                    </div>
                                    <ScenePanel
                                        autoRotate={autoRotate}
                                        onToggleDrift={() => setAutoRotate(v => !v)}
                                        onWakeDrift={() => setAutoRotate(true)}
                                        onOpen={onSettingsOpened}
                                        scaleStage={scaleStage}
                                        vizMode={vizMode}
                                        trailsOn={trailsOn}
                                        disabled={!!id || pageScrolled}
                                    />
                                </>
                            );
                        }

                        // ── Phone: a start-aligned column above the time control ──
                        const anyActive = !autoRotate || scaleStage !== SCALE_COMPRESSED || vizMode !== VIZ_OFF || trailsOn;
                        return (
                            <div
                                style={{
                                    position: 'absolute', insetInlineStart: 12, bottom: 62, zIndex: 4,
                                    display: 'flex', flexDirection: 'column', alignItems: 'flex-start',
                                    gap: 8, pointerEvents: 'none',
                                }}
                            >
                                {sceneOptsOpen && (
                                    <div className="animate-fade-in" style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-start', gap: 8 }}>
                                        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                                            {driftBtn}
                                            {driftPanel}
                                        </div>
                                        {scaleBtn}
                                        {gravBtn}
                                        {trailsBtn}
                                    </div>
                                )}
                                <button
                                    onClick={() => { if (!sceneOptsOpen) onSettingsOpened(); setSceneOptsOpen(v => !v); }}
                                    aria-expanded={sceneOptsOpen}
                                    aria-label={t(sceneOptsOpen ? 'scene.viewOptionsClose' : 'scene.viewOptions')}
                                    inert={(!!id || pageScrolled) || undefined}
                                    data-coach="tab"
                                    className="flex items-center justify-center rounded-full transition-opacity duration-700 focus-ring"
                                    style={{
                                        pointerEvents: id || pageScrolled ? 'none' : 'auto',
                                        opacity: id || pageScrolled ? 0 : 1,
                                        width: 34, height: 34,
                                        background: (sceneOptsOpen || anyActive) ? 'rgba(255,209,102,0.16)' : 'rgba(0,0,0,0.42)',
                                        border: `1px solid ${(sceneOptsOpen || anyActive) ? 'rgba(255,209,102,0.34)' : 'rgba(255,255,255,0.16)'}`,
                                        backdropFilter: 'blur(14px)',
                                        WebkitBackdropFilter: 'blur(14px)',
                                        color: (sceneOptsOpen || anyActive) ? '#ffd166' : 'rgba(255,255,255,0.78)',
                                        cursor: 'pointer',
                                    }}
                                >
                                    <SlidersHorizontal style={{ width: 15, height: 15 }} />
                                </button>
                                {exploreBtn}
                            </div>
                        );
                    })()}

                    {/* First-visit coach marks — an arrow + a line, pinned to
                        one control at a time (coachStep). All geometry is
                        viewport-absolute, from the anchor's measured rect, so it
                        lands right in a mirrored right-to-left layout too. */}
                    {showCoach && coachStep === 0 && coachRects && (
                        <CoachMark
                            text={t('scene.hintSpeed')}
                            arrow="down"
                            onDismiss={() => nextCoach(true)}
                            style={{
                                left: coachRects.left + coachRects.width / 2,
                                bottom: window.innerHeight - coachRects.top + 8,
                                transform: 'translateX(-50%)',
                                maxWidth: 260,
                            }}
                        />
                    )}
                    {showCoach && coachStep === 1 && coachRects && (
                        <CoachMark
                            text={t('scene.hintTools')}
                            arrow={rtl ? 'right' : 'left'}
                            onDismiss={() => nextCoach(true)}
                            style={{
                                // sits just outside the tab, on the side that
                                // faces the scene — the tab hugs the leading
                                // edge, so left of it in Arabic, right in English
                                left: rtl
                                    ? coachRects.left - (isMobile ? 8 : 12)
                                    : coachRects.right + (isMobile ? 8 : 12),
                                top: coachRects.top + coachRects.height / 2,
                                transform: rtl ? 'translate(-100%, -50%)' : 'translateY(-50%)',
                                whiteSpace: isMobile ? 'normal' : 'nowrap',
                                maxWidth: isMobile ? 190 : 320,
                            }}
                        />
                    )}

                    {/* Back to solar system */}
                    {id && (
                        <button
                            onClick={() => navigate('/')}
                            title={t('scene.backTitle')}
                            // .page-back, the same control the tracker and
                            // compare pages use, rather than the circular
                            // icon button this was: a named link reads as a
                            // way out where a lone chevron over a planet
                            // reads as scene furniture. No aria-label — the
                            // visible text is the accessible name now, and
                            // one that didn't contain the other would be the
                            // WCAG "label in name" trap; the fuller wording
                            // stays as the tooltip.
                            //
                            // The fade-in animation is `both`-filled, so it
                            // pins opacity at 1 and an inline opacity can't
                            // fade this out — the class has to come off.
                            className={`page-back absolute focus-ring${skyDiving ? '' : ' animate-fade-in'}`}
                            style={{
                                // On the spine, directly under the wordmark.
                                // .page-back's own -8px start margin is what
                                // makes the chevron optically flush with it,
                                // rather than the glyph's side bearing
                                // sitting a few pixels proud.
                                top: 68, insetInlineStart: 'var(--scene-inset)', zIndex: 20,
                                opacity: skyDiving ? 0 : 1,
                                transition: 'opacity var(--t-slower) var(--ease-out)',
                                pointerEvents: skyDiving ? 'none' : 'auto',
                            }}
                        >
                            <ChevronLeft className="flip-rtl" style={{ width: 15, height: 15 }} aria-hidden="true" />
                            <span>{t('nav.back')}</span>
                        </button>
                    )}

                    {/* Desktop annotations flanking the body */}
                    {!compactFocus && object && (
                        <div
                            // One grid across the whole scene rather than two
                            // independent flex columns. As two columns, each
                            // side stacked from its own top edge — and because
                            // the left one leads with a display-size name and
                            // the right one with a single stat, the two stats
                            // that were meant to read as a pair sat about 15px
                            // apart vertically, which looked like a mistake
                            // rather than a composition. Sharing row tracks
                            // makes the rows line up by construction.
                            //
                            // The columns are anchored to the page spine and
                            // read outward-in: the name's leading edge lands
                            // directly under the wordmark.
                            className="focus-annotations transition-all duration-1000 ease-out"
                            style={{
                                zIndex: 5,
                                opacity: id && !skyDiving ? 1 : 0,
                                transform: id ? 'scale(1)' : 'scale(0.96)',
                                // No 700ms wait on the way out — the dive is
                                // already moving by the time this is asked to go.
                                transitionDelay: id && !skyDiving ? '700ms' : '0ms',
                            }}
                        >
                            <div className="fa-col fa-start">
                                <h1 className="font-extrabold leading-none text-white"
                                    style={{
                                        fontSize: 'clamp(1.4rem, 3.4vw, 2.4rem)',
                                        letterSpacing: 'var(--tr-tighter)', margin: 0,
                                    }}>
                                    {object.shortName ?? object.name}
                                </h1>
                                <p className="label" style={{ marginTop: 6 }}>
                                    {object.type}
                                </p>
                                {PLANETS_WITH_MOONS.has(id) && (
                                    <p className="transition-opacity duration-700"
                                        style={{
                                            opacity: moonHintVisible ? 1 : 0,
                                            color: 'var(--text-tertiary)',
                                            fontSize: 'var(--fs-tiny)', fontWeight: 600,
                                            letterSpacing: '0.04em', marginTop: 10,
                                        }}>
                                        {t('scene.clickMoon')}
                                    </p>
                                )}
                            </div>

                            <div className="fa-col fa-end">
                                <p className="fa-figure num-run">{object.keyStatValue}</p>
                                <p className="label label-dim" style={{ marginTop: 3 }}>
                                    {object.keyStatLabel}
                                </p>
                            </div>

                            <div className="fa-col fa-start">
                                {physicalRows[0] && (<>
                                    <p className="fa-figure num-run">{physicalRows[0].value}</p>
                                    <p className="label label-dim" style={{ marginTop: 3 }}>
                                        {physicalRows[0].label}
                                    </p>
                                </>)}
                            </div>

                            <div className="fa-col fa-end">
                                {physicalRows[1] && (<>
                                    <p className="fa-figure num-run">{physicalRows[1].value}</p>
                                    <p className="label label-dim" style={{ marginTop: 3 }}>
                                        {physicalRows[1].label}
                                    </p>
                                </>)}
                            </div>
                        </div>
                    )}

                    {/* Desktop: description slides down from the top.
                        `max-w-2xl mx-auto` moved onto this outermost box
                        rather than a wrapper two levels in — with `left:0;
                        right:0` alone, this box's own hit-testable area was
                        the full viewport width (only the card inside it was
                        narrow), and with no pointerEvents override it sat at
                        z-index 6 over the scene, silently eating clicks on
                        whatever object was under that empty left/right
                        margin — hover still worked (the scene's own
                        mousemove-driven highlight isn't scoped to the
                        canvas), only clicks came up dead, and only in that
                        top strip while the description happened to be open,
                        which is exactly what made it read as a mysterious
                        "top of the screen" bug rather than an obvious one.
                        pointerEvents stays none out here and only comes back
                        on the card itself, so even the padding this box still
                        carries can't repeat the same mistake at a smaller
                        scale. */}
                    {!compactFocus && object && (
                        <div className="max-w-2xl mx-auto" style={{
                            position: 'absolute', top: 0, left: 0, right: 0, zIndex: 6,
                            pointerEvents: 'none',
                            transform: descriptionOpen ? 'translateY(0)' : 'translateY(-100%)',
                            transition: `transform ${autoRevealing ? '1.05s' : '0.45s'} cubic-bezier(0.32,0.72,0,1)`,
                        }}>
                            <div style={{ padding: '72px var(--s-4) var(--s-6)' }}>
                                {/* Clear of the header rather than tucked under
                                    it: at 36px the card's top edge landed level
                                    with the wordmark and read as a second row of
                                    chrome instead of as something that had just
                                    arrived over the scene. */}
                                <div className="glass" style={{ pointerEvents: 'auto', padding: 'var(--s-6)' }}>
                                    <p style={{
                                        color: 'rgba(255,255,255,0.80)', lineHeight: 1.7,
                                        fontSize: 'var(--fs-base)', margin: 0,
                                    }}>
                                        {object.description}
                                    </p>
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
                                // 84 on desktop, not 74: the chevron button is
                                // about 84px tall, so the old peek clipped its
                                // lower arrow and sat the pair lower than they
                                // needed to be. The compact handle is a 4px grab
                                // bar and keeps 74.
                                // The dive sends it all the way off rather than
                                // leaving the peek sitting over the shot — on a
                                // phone that peek is the biggest thing on screen
                                // after the planet itself.
                                transform: skyDiving
                                    ? 'translateY(100%)'
                                    : sheetOpen
                                        ? 'translateY(0)'
                                        : `translateY(calc(100% - ${compactFocus ? 74 : 84}px))`,
                                transition: `transform ${autoRevealing ? '1.05s' : '0.45s'} cubic-bezier(0.32,0.72,0,1)`,
                            }}
                        >
                            <button
                                onClick={() => { setAutoRevealing(false); setSheetOpen(v => !v); }}
                                aria-expanded={sheetOpen}
                                aria-label={t(sheetOpen ? 'scene.hideDetails' : 'scene.showDetails')}
                                style={{
                                    display: 'flex', flexDirection: 'column', alignItems: 'center',
                                    width: '100%', background: 'none', border: 'none',
                                    cursor: 'pointer', padding: '14px 0 6px',
                                    animation: sheetOpen ? 'none' : 'scrollPromptBob 1.8s ease-in-out infinite',
                                }}
                            >
                                {compactFocus ? (
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
                                maxHeight: compactFocus ? '58vh' : '60vh',
                                overflowY: 'auto',
                                overscrollBehavior: 'contain',
                                WebkitOverflowScrolling: 'touch',
                                padding: compactFocus ? '0 12px 24px' : '0 16px 32px',
                                // In the compact view the sheet sits directly over the
                                // body, and a bright planet behind translucent glass
                                // makes white text vanish. Give the sheet its own dark
                                // base.
                                background: compactFocus
                                    ? 'linear-gradient(to bottom, rgba(4,6,10,0) 0%, rgba(4,6,10,0.86) 6%, rgba(4,6,10,0.96) 22%, #04060a 45%)'
                                    : 'none',
                            }}>
                                <div className="max-w-2xl mx-auto flex flex-col gap-4">
                                    {/* The compact view carries the identity that the
                                        desktop annotations show flanking the body */}
                                    {compactFocus && (
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
                                                {/* Spacecraft get a full stats card of their own directly
                                                    below — operator, launch year, altitude — so a second
                                                    stat here only repeated one of those. And an asteroid's
                                                    first physical row is its diameter, which is already the
                                                    key stat — "~370 m / DIAMETER" twice. */}
                                                {physicalRows[0] && !isSpacecraft
                                                    && physicalRows[0].label !== object.keyStatLabel && (
                                                    <div>
                                                        <p style={{ color: '#fff', fontSize: '0.9rem', fontWeight: 700, margin: 0 }}>{physicalRows[0].value}</p>
                                                        <p style={{ color: 'rgba(255,255,255,0.38)', fontSize: '0.55rem', fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase', margin: 0 }}>{physicalRows[0].label}</p>
                                                    </div>
                                                )}
                                            </div>
                                        </div>
                                    )}

                                    {isSpacecraft && (
                                        <>
                                            {SHOW_SPACECRAFT_VIEWER && isSpacecraftCard && (
                                                <div className="glass overflow-hidden" style={{ borderRadius: 'var(--radius-card)' }}>
                                                    <SpacecraftViewer spacecraftId={object.id} />
                                                </div>
                                            )}
                                            <div className="glass p-5">
                                                <div className="grid grid-cols-2 gap-x-6 gap-y-4">
                                                    <div>
                                                        <p className="text-[10px] font-bold uppercase tracking-widest mb-0.5" style={{ color: 'var(--text-tertiary)' }}>{t('spacecraft.launchYear')}</p>
                                                        <p className="font-bold text-white">{object.launchYear}</p>
                                                    </div>
                                                    <div>
                                                        <p className="text-[10px] font-bold uppercase tracking-widest mb-0.5" style={{ color: 'var(--text-tertiary)' }}>{t('spacecraft.status')}</p>
                                                        <span className="text-xs font-bold px-2 py-0.5 rounded-lg" style={{
                                                            background: object.currentStatus === 'active' ? 'rgba(80,200,120,0.15)' : 'rgba(140,140,140,0.15)',
                                                            color: object.currentStatus === 'active' ? '#50e090' : 'rgba(200,200,200,0.7)',
                                                        }}>
                                                            {t(object.currentStatus === 'active'
                                                                ? 'spacecraft.statusActive'
                                                                : 'spacecraft.statusInactive')}
                                                        </span>
                                                    </div>
                                                    <div className="col-span-2">
                                                        <p className="text-[10px] font-bold uppercase tracking-widest mb-0.5" style={{ color: 'var(--text-tertiary)' }}>{t('spacecraft.operator')}</p>
                                                        <p className="font-bold text-white text-sm">{object.operator}</p>
                                                    </div>
                                                    <div className="col-span-2">
                                                        <p className="text-[10px] font-bold uppercase tracking-widest mb-0.5" style={{ color: 'var(--text-tertiary)' }}>{t('spacecraft.locationAltitude')}</p>
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
                                            // Arms the hand-off rather than
                                            // cutting to the page. From the
                                            // station's own card that is a
                                            // short flight out to Earth,
                                            // which is the shot the tracker
                                            // opens on.
                                            onClick={() => {
                                                armTrackerEntry();
                                                navigate('/object/earth');
                                            }}
                                            className="w-full rounded-2xl font-bold py-3.5 text-sm flex items-center justify-center gap-1.5 focus-ring"
                                            style={{
                                                background: 'rgba(80,200,120,0.18)',
                                                color: '#50e090',
                                                border: '1px solid rgba(80,200,120,0.30)',
                                                cursor: 'pointer',
                                            }}
                                        >
                                            {t('spacecraft.trackIss')}
                                            <ArrowUpRight className="flip-rtl" style={{ width: 16, height: 16 }} />
                                        </button>
                                    )}

                                    {/* Desktop already shows the description above the fold */}
                                    <ObjectDetailBody object={object} showDescription={compactFocus} />
                                </div>
                            </div>
                        </div>
                    )}
                </div>

                {/* ── Ticker ── */}
                <div
                    className="transition-all duration-500 ease-in-out"
                    style={{
                        // Both margins — see the note on the scene above.
                        width: '100vw',
                        marginLeft: 'calc(-50vw + 50%)',
                        marginRight: 'calc(-50vw + 50%)',
                        opacity: id ? 0 : 1,
                        maxHeight: id ? 0 : 100,
                        overflow: 'hidden',
                        pointerEvents: id ? 'none' : 'auto',
                    }}
                >
                    <SpaceDataStrip />
                </div>

                {/* ── Catalog ──
                    maxHeight was a fixed 4000px cap, which the 23-moon list had
                    grown past — the last few moons were being clipped by the
                    overflow:hidden. The cap only ever existed for the
                    collapse-on-focus transition, and that transition is never
                    actually seen (focusing scrolls to the top first, and body
                    scroll is locked), so `none` is safe and nothing is cut.

                    minHeight (phone only) keeps a one- or two-object category
                    (Stars, Comets) tall enough that its heading can still scroll
                    up under the header instead of the scene staying wedged above
                    it. Desktop skips it: the scene doesn't hold the scroll the
                    same way there, and a lone card over a viewport of black is
                    worse than the alternative. */}
                <div
                    id="catalog"
                    className="transition-all duration-500 ease-in-out flex flex-col gap-6 px-4 md:px-8"
                    style={{
                        opacity: id ? 0 : 1,
                        maxHeight: id ? 0 : 'none',
                        minHeight: id || !isMobile ? undefined : 'calc(100vh - 120px)',
                        overflow: 'hidden',
                        pointerEvents: id ? 'none' : 'auto',
                        paddingTop: 'var(--s-8)',
                        paddingBottom: 'var(--s-6)',
                    }}
                >
                    {/* Heading row, with a hairline under it. The rule is what
                        makes the catalog read as its own chapter rather than as
                        more page under the ticker — and it lands on exactly the
                        spine the header and the cards use. */}
                    <div
                        className="flex flex-col sm:flex-row sm:items-end justify-between gap-2 sm:gap-4"
                        style={{ paddingBottom: 'var(--s-4)', borderBottom: '1px solid var(--hairline)' }}
                    >
                        <div style={{ minWidth: 0 }}>
                            <div style={{ display: 'flex', alignItems: 'baseline', gap: 'var(--s-3)' }}>
                                <h2 style={{
                                    fontSize: 'var(--fs-xl)', fontWeight: 700,
                                    letterSpacing: 'var(--tr-tight)', color: '#fff', margin: 0,
                                }}>
                                    {currentCategory.label}
                                </h2>
                                <span className="label" style={{ color: 'var(--text-quaternary)' }}>
                                    {t('catalog.count', { count: objects.length })}
                                </span>
                            </div>
                            <p style={{
                                fontSize: 'var(--fs-sm)', color: 'var(--text-tertiary)',
                                margin: '5px 0 0',
                            }}>
                                {currentCategory.description}
                            </p>
                        </div>
                        <SortDropdown value={sortBy} onChange={setSortBy} />
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-5">
                        {sorted.map(obj => <ObjectCard key={obj.id} object={obj} />)}
                        {sorted.length === 0 && (
                            <div className="col-span-full py-16 text-center" style={{ color: 'var(--text-tertiary)' }}>
                                {t('catalog.empty')}
                            </div>
                        )}
                    </div>
                </div>
            </div>
        </>
    );
};

export default CategoryBrowser;
