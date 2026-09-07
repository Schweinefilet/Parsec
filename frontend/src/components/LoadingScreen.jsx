import { useState, useEffect, useRef } from 'react';
import { Telescope } from 'lucide-react';
import {
    subscribeAssets, assetsEverReady, holdLogo, releaseLogo,
} from '../utils/assetLoading';
import { useReducedMotion } from '../hooks/useMediaQuery';
import { useI18n } from '../i18n';

// However slow the scene is, the screen never outstays this. A loading screen
// that will not go away is worse than the black canvas it was hiding: a texture
// that 404s, a request that hangs behind a captive portal, a tab throttled in
// the background with no frames to count — none of those should trap anyone.
const FAILSAFE_MS = 9000;
// And it always stays for at least this long, measured from the navigation
// rather than from this component mounting — off a warm cache the scene is
// ready in well under a second, and a screen that appears and vanishes reads
// as a flicker rather than as an opening.
const MIN_ON_SCREEN_MS = 3000;

// The handoff. The wordmark leads and the rest gets out of its way: the list
// and the bar go first, the black lifts underneath it, and the logo arrives
// last, into the header's own position.
const DETAIL_FADE_MS = 240;   // the bar and the asset names
const FLIGHT_MS = 950;        // centre → header
const BACKDROP_MS = 620;      // black → transparent, started under the flight
const BACKDROP_DELAY_MS = 140;
// Ease in and ease out — it gathers itself, travels, and sets down, rather
// than leaving at full speed. No overshoot: bounce is the wrong note for
// something arriving at its permanent home.
const FLIGHT_EASE = 'cubic-bezier(0.65, 0, 0.35, 1)';

// How much larger the wordmark is while loading. It is rendered at the header's
// exact size and scaled up, rather than rendered large and scaled down, so the
// state it finishes in is untransformed and pixel-identical to the header's.
const HERO_SCALE = 1.9;
// Sits above centre, leaving the bar and the names the space below it.
const HERO_RISE = 58;

/**
 * The wordmark itself, at the header's exact size. Two of these are stacked in
 * the flying copy so the colour change can be an opacity cross-fade; keeping
 * them one component is what stops the two from drifting apart.
 */
const Mark = ({ iconColor, textColor, style, name }) => (
    <span
        className="flex items-center gap-2"
        style={{
            color: textColor,
            textShadow: '0 1px 8px rgba(0,0,0,0.9)',
            ...style,
        }}
    >
        <Telescope className="h-5 w-5" aria-hidden="true" style={{ color: iconColor }} />
        {/* Latin whatever the page language, and its tracking is the whole
            look of it — see the [data-latin] rule in index.css. */}
        <span data-latin style={{ fontSize: 17, fontWeight: 800, letterSpacing: '0.14em' }}>
            {name}
        </span>
    </span>
);

/**
 * What the scene is fetching, while it fetches it — then the wordmark flies to
 * the header and hands over to the real one.
 *
 * Named assets rather than a bare bar, because the names are the interesting
 * part — "Saturn's rings", "Earth at night" — and because a percentage on its
 * own tells you nothing about whether anything is actually happening.
 */
const LoadingScreen = () => {
    const { t, assetLabel } = useI18n();
    // Once per page load, not once per visit to the scene. Navigating to the
    // tracker and back rebuilds the scene, and covering it again for textures
    // the browser already has would be a loading screen for no loading.
    const [suppressed] = useState(() => assetsEverReady());
    const [assets, setAssets] = useState(null);
    const [expired, setExpired] = useState(false);
    const [minElapsed, setMinElapsed] = useState(
        () => performance.now() >= MIN_ON_SCREEN_MS);
    const [gone, setGone] = useState(false);
    // Where the header's wordmark is. Null until measured, which is also the
    // signal to fall back to a plain centred layout.
    const [home, setHome] = useState(null);
    const reduceMotion = useReducedMotion();
    const flyingRef = useRef(null);

    useEffect(() => subscribeAssets(setAssets), []);

    // Take the header's place for the duration, and measure it. Measured on
    // every resize too: a window that changes width between the first paint and
    // the handoff would otherwise fly the wordmark to where the header used to
    // be.
    useEffect(() => {
        if (suppressed) return undefined;
        holdLogo();
        const measure = () => {
            const el = document.querySelector('[data-app-logo]');
            if (!el) return;
            const r = el.getBoundingClientRect();
            if (r.width) setHome({ left: r.left, top: r.top, width: r.width, height: r.height });
        };
        measure();
        // The header mounts alongside this, so one frame later is when it has
        // a box worth measuring.
        const raf = requestAnimationFrame(measure);
        window.addEventListener('resize', measure);
        return () => {
            cancelAnimationFrame(raf);
            window.removeEventListener('resize', measure);
            releaseLogo();
        };
    }, [suppressed]);

    useEffect(() => {
        if (suppressed) return undefined;
        const timer = setTimeout(() => setExpired(true), FAILSAFE_MS);
        return () => clearTimeout(timer);
    }, [suppressed]);

    // performance.now() is measured from the navigation, so this is three
    // seconds of page rather than three seconds of component.
    useEffect(() => {
        if (suppressed || minElapsed) return undefined;
        const timer = setTimeout(() => setMinElapsed(true),
            Math.max(0, MIN_ON_SCREEN_MS - performance.now()));
        return () => clearTimeout(timer);
    }, [suppressed, minElapsed]);

    // The failsafe is not held back by the minimum — it is longer than it
    // anyway, and it exists for the case where nothing else will fire.
    const finished = expired || (!!assets?.done && minElapsed);
    const flightMs = reduceMotion ? 0 : FLIGHT_MS;

    // Hand the wordmark back at the moment the flight lands, and only then stop
    // rendering — so the canvas is not left behind a transparent full-screen
    // layer for the rest of the session.
    useEffect(() => {
        if (!finished || suppressed) return undefined;
        const timer = setTimeout(() => {
            releaseLogo();
            setGone(true);
        }, flightMs + 40);
        return () => clearTimeout(timer);
    }, [finished, suppressed, flightMs]);

    const total = assets?.total ?? 0;
    const loaded = assets?.loaded ?? 0;
    const pct = total ? Math.round((loaded / total) * 100) : 0;

    if (suppressed || gone) return null;

    // The last few that finished, newest first, plus whatever is in flight.
    const items = assets?.items ?? [];
    const inFlight = items.filter(i => !i.done).slice(0, 3);
    const recent = items.filter(i => i.done).slice(-4).reverse();
    const shown = [...inFlight, ...recent].slice(0, 5);

    // Centre-of-viewport, scaled up — expressed as a transform away from the
    // header's box, so that clearing the transform *is* the landing.
    const heroTransform = home
        ? `translate(${(window.innerWidth / 2 - (home.left + home.width / 2)).toFixed(1)}px, `
          + `${(window.innerHeight / 2 - HERO_RISE - (home.top + home.height / 2)).toFixed(1)}px) `
          + `scale(${HERO_SCALE})`
        : null;

    const detailStyle = {
        opacity: finished ? 0 : 1,
        transition: `opacity ${DETAIL_FADE_MS}ms ease`,
    };

    return (
        <>
            {/* The black, and everything that is not the wordmark. */}
            <div
                aria-hidden={finished || undefined}
                role="status"
                aria-live="polite"
                style={{
                    position: 'fixed', inset: 0, zIndex: 200,
                    background: '#000',
                    opacity: finished ? 0 : 1,
                    transition: finished
                        ? `opacity ${reduceMotion ? 200 : BACKDROP_MS}ms ease ${reduceMotion ? 0 : BACKDROP_DELAY_MS}ms`
                        : 'none',
                    pointerEvents: finished ? 'none' : 'auto',
                }}
            >
                <div style={{
                    position: 'absolute', left: '50%', top: `calc(50% - ${HERO_RISE - 46}px)`,
                    transform: 'translateX(-50%)',
                    display: 'flex', flexDirection: 'column', alignItems: 'center',
                    width: 'min(340px, 76vw)',
                    ...detailStyle,
                }}>
                    {/* The bar */}
                    <div style={{
                        width: '100%', height: 2, borderRadius: 2,
                        background: 'rgba(255,255,255,0.12)', overflow: 'hidden',
                    }}>
                        <div style={{
                            width: `${finished ? 100 : pct}%`, height: '100%',
                            background: 'linear-gradient(90deg, rgba(255,209,102,0.7), #ffd166)',
                            transition: 'width 300ms ease',
                        }} />
                    </div>

                    <p style={{
                        margin: '14px 0 0', fontSize: 10, fontWeight: 700,
                        letterSpacing: '0.14em', textTransform: 'uppercase',
                        color: 'rgba(255,255,255,0.42)', fontVariantNumeric: 'tabular-nums',
                    }}>
                        {finished ? t('loading.ready')
                            : total ? t('loading.progress', { loaded, total })
                            : t('loading.starting')}
                    </p>

                    {/* What those numbers are. A fixed-height block, so the
                        layout does not jump every time a name comes or goes. */}
                    <div style={{
                        marginTop: 16, height: 88, width: '100%',
                        display: 'flex', flexDirection: 'column', gap: 4, overflow: 'hidden',
                    }}>
                        {shown.map(item => (
                            <span
                                key={item.key}
                                className="flex items-center gap-2"
                                style={{
                                    fontSize: 11,
                                    color: item.done ? 'rgba(255,255,255,0.34)' : 'rgba(255,255,255,0.78)',
                                    transition: 'color 400ms ease',
                                }}
                            >
                                <span style={{
                                    width: 4, height: 4, borderRadius: 999, flexShrink: 0,
                                    background: item.failed ? '#ff8a80'
                                        : item.done ? 'rgba(255,255,255,0.28)' : '#ffd166',
                                }} />
                                <span style={{ whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                                    {assetLabel(item.name)}
                                </span>
                                {item.failed && (
                                    <span style={{ fontSize: 10, color: '#ff8a80' }}>
                                        {t('loading.skipped')}
                                    </span>
                                )}
                            </span>
                        ))}
                    </div>
                </div>
            </div>

            {/* The wordmark, above the black so it is still there once the black
                has gone. Laid out on the header's own box and transformed away
                from it, so the finished state is no transform at all — which is
                what makes the handover invisible rather than a cross-fade. */}
            {home && (
                <div
                    ref={flyingRef}
                    aria-hidden="true"
                    style={{
                        position: 'fixed', zIndex: 201, pointerEvents: 'none',
                        left: home.left, top: home.top, height: home.height,
                        transformOrigin: 'center center',
                        transform: finished ? 'none' : heroTransform,
                        // Transform only. Colour was animated here before and
                        // it is a paint property — it cannot run on the
                        // compositor, so every frame of the flight forced a
                        // repaint on a main thread that is busy building the
                        // scene, which is exactly when it could least afford
                        // one. The gold-to-white change is now two stacked
                        // copies cross-fading on opacity, which composites.
                        transition: finished
                            ? `transform ${flightMs}ms ${FLIGHT_EASE}`
                            : 'none',
                        willChange: 'transform',
                    }}
                >
                    {/* The one that stays: the header's own colours, so what is
                        left standing at the end is what the header draws. */}
                    <Mark
                        name={t('app.name')}
                        iconColor="var(--accent)"
                        textColor="rgba(255,255,255,0.92)"
                    />
                    {/* The one that goes: gold, over the top, faded out across
                        the flight. */}
                    <Mark
                        name={t('app.name')}
                        iconColor="#ffd166"
                        textColor="#fff"
                        style={{
                            position: 'absolute', inset: 0,
                            opacity: finished ? 0 : 1,
                            transition: finished ? `opacity ${flightMs}ms ease` : 'none',
                            willChange: 'opacity',
                        }}
                    />
                </div>
            )}
        </>
    );
};

export default LoadingScreen;
