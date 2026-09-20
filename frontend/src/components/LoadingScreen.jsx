import { useState, useEffect, useRef } from 'react';
import { Telescope } from 'lucide-react';
import {
    subscribeAssets, assetsEverReady, holdLogo, releaseLogo,
} from '../utils/assetLoading';
import { useReducedMotion } from '../hooks/useMediaQuery';
import EncryptedText from './EncryptedText';
import { useEncryptedText } from '../hooks/useEncryptedText';
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

// The handoff. The wordmark leads and the rest gets out of its way: the
// readout goes first, the orrery swells and dissolves as though the view were
// moving forward through it, the black lifts underneath, and the wordmark
// arrives last into the header's own position.
const DETAIL_FADE_MS = 260;   // the bar, the count and the asset name
const FLIGHT_MS = 950;        // centre → header
const BACKDROP_MS = 620;      // black → transparent, started under the flight
const BACKDROP_DELAY_MS = 140;
// Ease in and ease out — it gathers itself, travels, and sets down, rather
// than leaving at full speed. No overshoot: bounce is the wrong note for
// something arriving at its permanent home.
const FLIGHT_EASE = 'var(--ease-inout)';

// How much larger the wordmark is while loading. It is rendered at the header's
// exact size and scaled up, rather than rendered large and scaled down, so the
// state it finishes in is untransformed and pixel-identical to the header's.
const HERO_SCALE = 1.9;
// How long the wordmark takes to decode out of its ciphertext, and how far
// through that the logo starts resolving with it.
//
// The decode is measured against the clock, not counted in frames, and this
// screen is on during the one stretch of the session where the main thread is
// least able to deliver a frame — building the scene can swallow whole seconds
// at a time. A short decode spends most of itself inside one of those gaps and
// what finally paints is the tail of it, or nothing at all. At 2600 it is
// still running when the thread comes back up, so the wordmark is seen to
// decode rather than seen to have decoded.
const DECODE_MS = 2600;
const ICON_FROM = 0.55;
// Sits above centre: the orrery is symmetrical about the wordmark but the
// readout hangs below it, so the composition as a whole is bottom-heavy and
// this lifts it back onto the optical centre.
const HERO_RISE = 58;
// How far below the wordmark's centre the readout sits is --boot-drop, worked
// out in CSS from the ring size (see .boot-readout) — the outermost orbit's
// lower edge scales with the figure, so this cannot be a constant.

/**
 * The orbits. `k` multiplies the base diameter (the CSS clamps that against
 * the viewport), and each takes longer than the one inside it — not Kepler's
 * exact 3/2 power, but the same direction, which is what makes a set of
 * concentric rings read as a system rather than as a target.
 *
 * The negative delays start each orbit part-way round. They are not arbitrary:
 * they are solved so the four bodies sit near 45°, 135°, 225° and 315° at
 * t = 2s — one per quadrant, at about the moment the screen is most likely to
 * be looked at. Left at zero the four line up into a spoke, which is the one
 * arrangement that reads as a diagram rather than as a system.
 *
 * Which means a period cannot be changed on its own. These are the original
 * set taken a fifth faster, by request, with every delay re-solved from
 * `delay = 2 - dur × (angle / 360 + n)` — n being whatever whole turn it takes
 * to keep the delay negative, since a positive one would hold the orbit still
 * until it elapsed. Change a duration without redoing that and the quadrants
 * collapse back into a spoke.
 */
const RINGS = [
    { k: 1,    dur: 13.6, delay: -13.3, angle: 45 },
    { k: 1.45, dur: 20.8, delay: -5.8,  angle: 135 },
    { k: 2.02, dur: 30.4, delay: -17,   angle: 225 },
    { k: 2.72, dur: 44,   delay: -36.5, angle: 315 },
];

/**
 * The wordmark itself, at the header's exact size. Two of these are stacked in
 * the flying copy so the colour change can be an opacity cross-fade; keeping
 * them one component is what stops the two from drifting apart.
 */
const Mark = ({ iconColor, textColor, style, name, shown, reveal = 1 }) => (
    <span
        className="flex items-center gap-2"
        style={{
            color: textColor,
            textShadow: '0 1px 8px rgba(0,0,0,0.9)',
            ...style,
        }}
    >
        {/* The logo resolves with the last of the wordmark rather than being
            there from the start — opacity and scale only. A blur would say
            "diffuse" more literally, but it is a paint property, and every
            frame of it would land on the main thread at the one moment it is
            busiest building the scene. These two composite. */}
        <Telescope
            className="h-5 w-5"
            aria-hidden="true"
            style={{
                color: iconColor,
                opacity: reveal,
                transform: `scale(${(0.72 + 0.28 * reveal).toFixed(3)})`,
            }}
        />
        {/* Latin whatever the page language, and its tracking is the whole
            look of it — see the [data-latin] rule in index.css. */}
        <span data-latin style={{ fontSize: 17, fontWeight: 800, letterSpacing: '0.14em' }}>
            <EncryptedText text={name} shown={shown ?? name} />
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

    // One decode, shared by both copies of the flying wordmark — see
    // EncryptedText.jsx for why it cannot be two. Settles well inside
    // MIN_ON_SCREEN_MS, so the mark is standing plainly for a beat before it
    // ever starts moving.
    const appName = t('app.name');
    // Runs from mount. It used to be held until `home` — the header's measured
    // box — had landed, because the mark was not rendered until then, and
    // holding it meant the decode could not play out against a wordmark nobody
    // could see. The mark now renders centred from the first paint whether or
    // not `home` has arrived (see the fallback layout below), so there is
    // nothing left to wait for, and waiting cost real time: measuring `home`
    // needs a commit, and on a cold load the main thread is busy enough
    // building the scene that the one it needed landed nearly three seconds
    // in. The whole decode sat behind that.
    const { shown: markText, progress: decoded } = useEncryptedText(appName, {
        duration: DECODE_MS, enabled: !suppressed,
    });
    // The logo arrives with the tail of the wordmark rather than alongside all
    // of it, so the two read as one thing resolving rather than as a fade.
    const iconReveal = Math.min(1, Math.max(0, (decoded - ICON_FROM) / (1 - ICON_FROM)));

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
    // The handoff waits for the wordmark to finish decoding. `home` is measured
    // off the header, and on a cold load the main thread is busy enough
    // building the scene that it can land a second or two in — so the decode
    // starts late, and without this the three-second minimum would call the
    // flight while letters were still turning over. The failsafe is deliberately
    // not gated: it exists for the case where nothing else will fire.
    const decodeSettled = decoded >= 1;
    const finished = expired || (!!assets?.done && minElapsed && decodeSettled);
    const flightMs = reduceMotion ? 0 : FLIGHT_MS;

    // The decode starts when this mounts; MIN_ON_SCREEN_MS is counted from the
    // navigation. On a cold load those are nearly the same moment, so a fast
    // set of assets can call the handoff while letters are still turning over.
    // The wordmark that flies to the header is the one the header will keep, so
    // it settles the instant the flight is called rather than arriving as
    // ciphertext and decoding in the corner of the screen.
    const settledText = finished ? appName : markText;
    const settledReveal = finished ? 1 : iconReveal;

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

    // One name, not a list. What is arriving if anything is, otherwise the
    // last thing that did — so the line has something to say from the first
    // texture to the last, and never blinks out between two of them.
    const items = assets?.items ?? [];
    const current = items.find(i => !i.done) ?? items[items.length - 1] ?? null;

    // Centre-of-viewport, scaled up — expressed as a transform away from the
    // header's box, so that clearing the transform *is* the landing.
    const heroTransform = home
        ? `translate(${(window.innerWidth / 2 - (home.left + home.width / 2)).toFixed(1)}px, `
          + `${(window.innerHeight / 2 - HERO_RISE - (home.top + home.height / 2)).toFixed(1)}px) `
          + `scale(${HERO_SCALE})`
        : null;

    // Where the mark is laid out before `home` has been measured: a full-width
    // row centred on the viewport, which lands the wordmark in exactly the
    // place the transform above lands it on. Same position, same scale, so the
    // swap to the header-box layout the moment `home` arrives is invisible —
    // and the wordmark is on screen, decoding, from the loading screen's very
    // first paint instead of from whenever the main thread next has a commit
    // to spare. With no `home` there is nowhere to fly to, so a load that
    // somehow never measures one simply ends with the mark fading out on the
    // spot rather than with no mark at all, which is what used to happen.
    const heroBox = {
        left: 0, right: 0, top: '50%',
        display: 'flex', justifyContent: 'center',
        transform: `translateY(${-HERO_RISE}px) scale(${HERO_SCALE})`,
    };

    return (
        <>
            {/* The black. Nothing but the ground now — the orrery and the
                readout are siblings above it rather than children of it, so
                each can leave on its own schedule instead of all of them
                fading together with the backdrop underneath them. */}
            <div
                aria-hidden="true"
                style={{
                    position: 'fixed', inset: 0, zIndex: 199,
                    background: '#000',
                    opacity: finished ? 0 : 1,
                    transition: finished
                        ? `opacity ${reduceMotion ? 200 : BACKDROP_MS}ms var(--ease-out) ${reduceMotion ? 0 : BACKDROP_DELAY_MS}ms`
                        : 'none',
                    pointerEvents: finished ? 'none' : 'auto',
                }}
            />

            {/* The orrery, centred on the wordmark's hero position — the
                wordmark stands where the Sun would. */}
            <div
                className="boot-orrery"
                aria-hidden="true"
                data-leaving={finished || undefined}
                style={{ top: `calc(50% - ${HERO_RISE}px)` }}
            >
                {RINGS.map((ring, i) => (
                    <div
                        key={ring.k}
                        className="boot-ring"
                        style={{ '--k': ring.k }}
                    >
                        <div
                            className="boot-orbit"
                            style={{
                                '--dur': `${ring.dur}s`,
                                '--delay': `${ring.delay}s`,
                                // Only read under prefers-reduced-motion, where
                                // it stands in for the animation's position.
                                '--angle': `${ring.angle}deg`,
                            }}
                        >
                            <span className="boot-body-anchor">
                                {/* Runs the orbit backwards so the body keeps
                                    facing the viewer — see .boot-body-spin. */}
                                <span className="boot-body-spin">
                                    {/* Lit once the load has passed this
                                        orbit's share of the whole, so the
                                        figure reports progress as well as
                                        decorating it — and all four are lit
                                        the moment the screen says READY, which
                                        is the beat the whole thing builds to.
                                        `finished` has to be part of that test:
                                        the bar is forced full there, and an
                                        outermost body still sitting dim beside
                                        a full bar reads as something stuck. */}
                                    <span
                                        className="boot-body"
                                        data-lit={finished || pct >= ((i + 1) / RINGS.length) * 100 || undefined}
                                    />
                                </span>
                            </span>
                        </div>
                    </div>
                ))}
            </div>

            {/* The readout. Centred like everything else — this used to be a
                five-name list set flush left inside a centred column, which
                put the only ragged edge on screen directly under a centred
                wordmark and a centred bar. */}
            <div
                className="boot-readout"
                role="status"
                aria-live="polite"
                data-leaving={finished || undefined}
                style={{
                    top: `calc(50% - ${HERO_RISE}px + var(--boot-drop))`,
                    transitionDuration: `${DETAIL_FADE_MS}ms`,
                }}
            >
                <div className="boot-bar">
                    <div
                        className="boot-bar-fill"
                        style={{ '--p': finished ? 1 : (total ? loaded / total : 0) }}
                    />
                    {!finished && <div className="boot-bar-gleam" />}
                </div>

                <p className="boot-count">
                    {finished ? t('loading.ready')
                        : total ? t('loading.progress', { loaded, total })
                        : t('loading.starting')}
                </p>

                {/* Keyed on the name so React swaps the node when it changes,
                    which replays the entry animation — that is the cross-fade.

                    Out of the live region: it changes once per texture, and a
                    polite region that renames itself fourteen times in three
                    seconds is noise rather than information. The count above
                    carries the state; these names are colour. */}
                <p
                    key={current?.key ?? 'none'}
                    aria-hidden="true"
                    className={`boot-asset${current?.failed ? ' boot-asset-failed' : ''}`}
                >
                    {current
                        ? `${assetLabel(current.name)}${current.failed ? ` · ${t('loading.skipped')}` : ''}`
                        : ' '}
                </p>
            </div>

            {/* The wordmark, above the black so it is still there once the black
                has gone. Laid out on the header's own box and transformed away
                from it, so the finished state is no transform at all — which is
                what makes the handover invisible rather than a cross-fade.
                Until that box has been measured it falls back to a centred row
                that puts the mark in the same place, so the decode is visible
                from the first paint. */}
            <div
                ref={flyingRef}
                aria-hidden="true"
                style={{
                    position: 'fixed', zIndex: 201, pointerEvents: 'none',
                    ...(home
                        ? { left: home.left, top: home.top, height: home.height }
                        : heroBox),
                    transformOrigin: 'center center',
                    transform: home
                        ? (finished ? 'none' : heroTransform)
                        : heroBox.transform,
                    opacity: !home && finished ? 0 : 1,
                    // Transform only. Colour was animated here before and
                    // it is a paint property — it cannot run on the
                    // compositor, so every frame of the flight forced a
                    // repaint on a main thread that is busy building the
                    // scene, which is exactly when it could least afford
                    // one. The gold-to-white change is now two stacked
                    // copies cross-fading on opacity, which composites.
                    transition: finished
                        ? `transform ${flightMs}ms ${FLIGHT_EASE}, opacity ${flightMs}ms ease`
                        : 'none',
                    willChange: 'transform',
                }}
            >
                {/* The one that stays: the header's own colours, so what is
                    left standing at the end is what the header draws. */}
                <Mark
                    name={appName}
                    shown={settledText}
                    reveal={settledReveal}
                    iconColor="var(--accent)"
                    textColor="rgba(255,255,255,0.92)"
                />
                {/* The one that goes: gold, over the top, faded out across
                    the flight. */}
                <Mark
                    name={appName}
                    shown={settledText}
                    reveal={settledReveal}
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
        </>
    );
};

export default LoadingScreen;
