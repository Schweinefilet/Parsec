import { useState, useEffect, useRef } from 'react';
import { Telescope } from 'lucide-react';
import {
    subscribeAssets, assetsEverReady, holdLogo, releaseLogo,
} from '../utils/assetLoading';
import { useReducedMotion } from '../hooks/useMediaQuery';

// However slow the scene is, the screen never outstays this. A loading screen
// that will not go away is worse than the black canvas it was hiding: a texture
// that 404s, a request that hangs behind a captive portal, a tab throttled in
// the background with no frames to count — none of those should trap anyone.
const FAILSAFE_MS = 9000;

// The handoff. The wordmark leads and the rest gets out of its way: the list
// and the bar go first, the black lifts underneath it, and the logo arrives
// last, into the header's own position.
const DETAIL_FADE_MS = 240;   // the bar and the asset names
const FLIGHT_MS = 820;        // centre → header
const BACKDROP_MS = 620;      // black → transparent, started under the flight
const BACKDROP_DELAY_MS = 140;
// Decisive push, long settle. An overshoot would read as bounce, which is the
// wrong note for something arriving at its permanent home.
const FLIGHT_EASE = 'cubic-bezier(0.22, 1, 0.36, 1)';

// How much larger the wordmark is while loading. It is rendered at the header's
// exact size and scaled up, rather than rendered large and scaled down, so the
// state it finishes in is untransformed and pixel-identical to the header's.
const HERO_SCALE = 1.9;
// Sits above centre, leaving the bar and the names the space below it.
const HERO_RISE = 58;

/**
 * What the scene is fetching, while it fetches it — then the wordmark flies to
 * the header and hands over to the real one.
 *
 * Named assets rather than a bare bar, because the names are the interesting
 * part — "Saturn's rings", "Earth at night" — and because a percentage on its
 * own tells you nothing about whether anything is actually happening.
 */
const LoadingScreen = () => {
    // Once per page load, not once per visit to the scene. Navigating to the
    // tracker and back rebuilds the scene, and covering it again for textures
    // the browser already has would be a loading screen for no loading.
    const [suppressed] = useState(() => assetsEverReady());
    const [assets, setAssets] = useState(null);
    const [expired, setExpired] = useState(false);
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
        const t = setTimeout(() => setExpired(true), FAILSAFE_MS);
        return () => clearTimeout(t);
    }, [suppressed]);

    const finished = expired || !!assets?.done;
    const flightMs = reduceMotion ? 0 : FLIGHT_MS;

    // Hand the wordmark back at the moment the flight lands, and only then stop
    // rendering — so the canvas is not left behind a transparent full-screen
    // layer for the rest of the session.
    useEffect(() => {
        if (!finished || suppressed) return undefined;
        const t = setTimeout(() => {
            releaseLogo();
            setGone(true);
        }, flightMs + 40);
        return () => clearTimeout(t);
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
                        {finished ? 'Ready' : total ? `Loading ${loaded} of ${total}` : 'Starting up'}
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
                                    {item.name}
                                </span>
                                {item.failed && <span style={{ fontSize: 10, color: '#ff8a80' }}>skipped</span>}
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
                    className="flex items-center gap-2"
                    style={{
                        position: 'fixed', zIndex: 201, pointerEvents: 'none',
                        left: home.left, top: home.top, height: home.height,
                        transformOrigin: 'center center',
                        transform: finished ? 'none' : heroTransform,
                        // Gold while it is the only thing on screen, the
                        // header's white by the time it gets there.
                        color: finished ? 'rgba(255,255,255,0.92)' : '#fff',
                        textShadow: '0 1px 8px rgba(0,0,0,0.9)',
                        transition: finished
                            ? `transform ${flightMs}ms ${FLIGHT_EASE}, color ${flightMs}ms ease`
                            : 'none',
                        willChange: 'transform',
                    }}
                >
                    <Telescope
                        className="h-5 w-5"
                        aria-hidden="true"
                        style={{
                            color: finished ? 'var(--accent)' : '#ffd166',
                            transition: finished ? `color ${flightMs}ms ease` : 'none',
                        }}
                    />
                    <span style={{ fontSize: 17, fontWeight: 800, letterSpacing: '0.14em' }}>
                        P4RSEC
                    </span>
                </div>
            )}
        </>
    );
};

export default LoadingScreen;
