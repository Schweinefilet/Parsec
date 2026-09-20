import { useState, useEffect, useMemo, useRef } from 'react';
import { Telescope } from 'lucide-react';
import {
    subscribeAssets, assetsEverReady, holdLogo, releaseLogo,
} from '../utils/assetLoading';
import { useReducedMotion, useIsTouch } from '../hooks/useMediaQuery';
import EncryptedText from './EncryptedText';
import { useEncryptedText, cipherFrames } from '../hooks/useEncryptedText';
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
// The decode does not start with the screen. It starts when the scene is
// ready, and is the last thing that happens before the handoff — see
// `start` below. Running it any earlier does not work: the decode is a
// real-time animation driven from the main thread, and this screen is on
// during the one stretch of the session where that thread is least able to
// deliver a frame. Building the scene blocks it for seconds at a time on a
// phone, and a decode inside one of those gaps is not slowed, it is skipped:
// the clock runs on regardless and the next frame to paint is the finished
// word. Held until the thread is free, every frame of it is drawn.
//
// Which also means it can be brisk again. It was stretched to 2600 to try to
// outlast the build, and nothing has to outlast anything now.
const DECODE_MS = 1800;
// On a phone the wordmark is not on screen at all while the scene is building.
// It fades in when the scene reports ready, stands there as ciphertext for a
// beat, and only then resolves.
//
// Which is a retreat, and a deliberate one. The held scramble is CSS precisely
// so that it can run while the main thread cannot, and on a desktop it does —
// which is why this is not the behaviour there. On a phone it has now been
// reported wrong twice, and whatever an engine is doing with a dozen little
// animations at the exact moment it is also compiling shaders and uploading
// textures, the answer is not to keep guessing at it from a laptop. There is
// nothing to get wrong in an empty middle. What anybody actually came for is
// the decode, and holding the wordmark back until the thread is free is what
// guarantees every frame of that is drawn.
const REVEAL_MS = 420;
// And a beat at full strength before it starts resolving, so the fade and the
// decode read as two events rather than one muddled one — the entire decode
// then happens against a wordmark that is already fully there.
const REVEAL_HOLD_MS = 140;
const ICON_FROM = 0.55;
// The telescope is not absent while the wordmark is still encrypted, only
// unresolved: it is drawn faintly, at its own size, from the moment the mark
// fades in. It has to be, because the mark is centred as a whole — icon, gap
// and lettering — so an icon that is not drawn at all leaves its space empty
// and the lettering sitting half an icon's width to the right of the progress
// bar and the orrery it is supposed to share a centre line with. The whole
// decode would play out off centre and then correct itself as the telescope
// arrived. Holding its place costs nothing and it still resolves with the
// tail of the decode.
const ICON_HELD = 0.32;
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
const Mark = ({ iconColor, textColor, style, name, shown, frames, reveal = 1 }) => (
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
            <EncryptedText text={name} shown={shown} frames={frames} />
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
    // Whether the wordmark has finished fading in. Also the decode's go signal.
    const [revealed, setRevealed] = useState(false);
    // Where the header's wordmark is. Null until measured, which is also the
    // signal to fall back to a plain centred layout.
    const [home, setHome] = useState(null);
    const reduceMotion = useReducedMotion();
    // Where the held scramble is not trusted, and the wordmark waits offstage
    // for the scene instead of standing on it. See REVEAL_MS.
    const holdOffstage = useIsTouch();
    const flyingRef = useRef(null);

    // One decode, shared by both copies of the flying wordmark — see
    // EncryptedText.jsx for why it cannot be two. Settles well inside
    // MIN_ON_SCREEN_MS, so the mark is standing plainly for a beat before it
    // ever starts moving.
    const appName = t('app.name');
    // `assets.done` is the scene's own signal that the last texture has landed
    // and it has drawn a frame with it — which is also the moment the main
    // thread stops being swallowed whole by the build, and so the first moment
    // an animation driven from it can be seen at all. Nothing of the wordmark
    // is on screen before it. The failsafe below covers the case where that
    // signal never comes.
    const sceneReady = !!assets?.done;
    // On screen scrambling from the first paint, or offstage until the scene
    // is ready and the fade-in has run.
    const markLive = !holdOffstage || sceneReady;
    const { shown: markText, progress: decoded } = useEncryptedText(appName, {
        duration: DECODE_MS,
        enabled: !suppressed,
        start: holdOffstage ? revealed : sceneReady,
    });
    // The glyphs the wordmark cycles through until then. Generated once, and
    // shared by both copies of the flying mark for the same reason the decode
    // itself is: two sets would land different letters on the same frame and
    // the cross-fade between the copies would show it. Withheld while the mark
    // is offstage: a reel nobody can see is still a dozen animations running
    // through the busiest moment of the load.
    const frames = useMemo(() => cipherFrames(appName), [appName]);
    const liveFrames = markLive ? frames : null;
    // The logo arrives with the tail of the wordmark rather than alongside all
    // of it, so the two read as one thing resolving rather than as a fade — but
    // from ICON_HELD rather than from nothing, so it is standing in its own
    // place the whole time. See ICON_HELD.
    const revealT = Math.min(1, Math.max(0, (decoded - ICON_FROM) / (1 - ICON_FROM)));
    const iconReveal = ICON_HELD + (1 - ICON_HELD) * revealT;

    useEffect(() => subscribeAssets(setAssets), []);

    // Fade in, stand there, then decode. Timed rather than driven off the
    // transition's own `transitionend`, which does not fire if the element is
    // never composited and, under reduced motion, is over in a thousandth of
    // a millisecond — this way the beat is the same beat either way.
    useEffect(() => {
        if (!holdOffstage || !sceneReady || suppressed || revealed) return undefined;
        const timer = setTimeout(() => setRevealed(true),
            (reduceMotion ? 0 : REVEAL_MS) + REVEAL_HOLD_MS);
        return () => clearTimeout(timer);
    }, [holdOffstage, sceneReady, suppressed, revealed, reduceMotion]);

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

    // The handoff waits for the wordmark to finish decoding, which is the
    // whole shape of the ending: the scene reports ready, the word comes good,
    // and only then does it fly. Without this the three-second minimum would
    // call the flight over a wordmark still turning over — and now that the
    // decode does not begin until the scene is ready, that is the usual case
    // rather than the unlucky one. The failsafe is deliberately not gated: it
    // exists for the case where nothing else will fire.
    const decodeSettled = decoded >= 1;
    const finished = expired || (sceneReady && minElapsed && decodeSettled);
    const flightMs = reduceMotion ? 0 : FLIGHT_MS;

    // The failsafe can call the handoff over a half-decoded wordmark. The
    // wordmark that flies to the header is the one the header will keep, so it
    // settles the instant the flight is called rather than arriving as
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
    //
    // documentElement.clientWidth/Height rather than window.innerWidth/Height:
    // this is a fixed element, so it is laid out against the layout viewport,
    // and those are the two numbers that measure it. window.innerHeight is the
    // *visual* viewport, which on a phone is shorter than the layout one by
    // however much of the URL bar is currently showing — centring against it
    // puts the wordmark off centre by half that, and the two disagree by a
    // scrollbar's width on a desktop as well.
    const vw = document.documentElement.clientWidth;
    const vh = document.documentElement.clientHeight;
    const heroTransform = home
        ? `translate(${(vw / 2 - (home.left + home.width / 2)).toFixed(1)}px, `
          + `${(vh / 2 - HERO_RISE - (home.top + home.height / 2)).toFixed(1)}px) `
          + `scale(${HERO_SCALE})`
        : null;

    // Where the mark is laid out before `home` has been measured: pinned to the
    // centre of the viewport and pulled back by half its own size, which lands
    // the wordmark in exactly the place the transform above lands it on. Same
    // position, same scale, so the swap to the header-box layout the moment
    // `home` arrives is invisible — and the wordmark is on screen from the
    // loading screen's very first paint instead of from whenever the main
    // thread next has a commit to spare. With no `home` there is nowhere to fly
    // to, so a load that somehow never measures one simply ends with the mark
    // fading out on the spot rather than with no mark at all.
    //
    // It has to shrink to fit the wordmark, exactly as the header-box layout
    // does. This was a full-width flex row centred on the viewport, which put
    // the *first* copy of the mark in the right place and threw the second one
    // — the gold one, laid over it with `inset: 0` — across the whole width of
    // the screen and then scaled that by 1.9 about its centre, leaving it
    // hanging off the left edge. So the opening showed two wordmarks, one
    // centred and one adrift, until `home` landed and collapsed the box back
    // onto the mark. On a phone `home` can be seconds late, which is the whole
    // time anybody was looking.
    const heroBox = {
        left: '50%', top: '50%',
        transform: `translate(-50%, calc(-50% - ${HERO_RISE}px)) scale(${HERO_SCALE})`,
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
                that puts the mark in the same place.

                Not drawn at all until the scene is ready: it fades in, holds,
                and decodes, all of it on a main thread that has finished
                building the scene and can therefore draw every frame of it. */}
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
                    // Offstage until the scene is ready, where that applies;
                    // then the fade-in. The `!home` case is the load that never
                    // measured a box to fly to, which ends by fading out on the
                    // spot instead.
                    opacity: (markLive && !(!home && finished)) ? 1 : 0,
                    // Transform only. Colour was animated here before and
                    // it is a paint property — it cannot run on the
                    // compositor, so every frame of the flight forced a
                    // repaint on a main thread that is busy building the
                    // scene, which is exactly when it could least afford
                    // one. The gold-to-white change is now two stacked
                    // copies cross-fading on opacity, which composites.
                    transition: finished
                        ? `transform ${flightMs}ms ${FLIGHT_EASE}, opacity ${flightMs}ms ease`
                        // Transform stays off the transition until the flight —
                        // the swap from the fallback layout to the header's box
                        // the moment `home` lands is a change of both `left` and
                        // `transform` to the same place, and easing one of the
                        // two would slide the mark there from wherever it was.
                        : `opacity ${reduceMotion ? 0 : REVEAL_MS}ms var(--ease-out)`,
                    willChange: 'transform, opacity',
                }}
            >
                {/* The one that stays: the header's own colours, so what is
                    left standing at the end is what the header draws. */}
                <Mark
                    name={appName}
                    shown={settledText}
                    frames={liveFrames}
                    reveal={settledReveal}
                    iconColor="var(--accent)"
                    textColor="rgba(255,255,255,0.92)"
                />
                {/* The one that goes: gold, over the top, faded out across
                    the flight. */}
                <Mark
                    name={appName}
                    shown={settledText}
                    frames={liveFrames}
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
