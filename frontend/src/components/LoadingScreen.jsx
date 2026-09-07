import { useState, useEffect } from 'react';
import { Telescope } from 'lucide-react';
import { subscribeAssets, assetsEverReady } from '../utils/assetLoading';

// However slow the scene is, the screen never outstays this. A loading screen
// that will not go away is worse than the black canvas it was hiding: a texture
// that 404s, a request that hangs behind a captive portal, a tab throttled in
// the background with no frames to count — none of those should trap anyone.
const FAILSAFE_MS = 9000;
// And it never flashes up for a reload off a warm cache. Under this, the scene
// was ready before anyone could read a word of it.
const MIN_VISIBLE_MS = 260;

/**
 * What the scene is fetching, while it fetches it.
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

    useEffect(() => subscribeAssets(setAssets), []);
    useEffect(() => {
        const t = setTimeout(() => setExpired(true), FAILSAFE_MS);
        return () => clearTimeout(t);
    }, []);

    const finished = expired || !!assets?.done;

    // Fade out, then stop rendering — so the canvas is not sitting behind a
    // transparent full-screen layer for the rest of the session.
    useEffect(() => {
        if (!finished) return;
        const t = setTimeout(() => setGone(true), 620);
        return () => clearTimeout(t);
    }, [finished]);

    // Nothing has been requested yet: hold the screen rather than flashing an
    // empty one, since the scene's first texture is a frame or two away.
    const total = assets?.total ?? 0;
    const loaded = assets?.loaded ?? 0;
    const pct = total ? Math.round((loaded / total) * 100) : 0;

    if (suppressed || gone) return null;

    // The last few that finished, newest first, plus whatever is in flight.
    const items = assets?.items ?? [];
    const inFlight = items.filter(i => !i.done).slice(0, 3);
    const recent = items.filter(i => i.done).slice(-4).reverse();
    const shown = [...inFlight, ...recent].slice(0, 5);

    return (
        <div
            aria-hidden={finished || undefined}
            role="status"
            aria-live="polite"
            style={{
                position: 'fixed', inset: 0, zIndex: 200,
                display: 'flex', flexDirection: 'column',
                alignItems: 'center', justifyContent: 'center',
                background: '#000',
                opacity: finished ? 0 : 1,
                transition: `opacity 600ms ease ${finished ? MIN_VISIBLE_MS : 0}ms`,
                pointerEvents: finished ? 'none' : 'auto',
                padding: '0 24px',
            }}
        >
            <div className="flex items-center gap-2.5" style={{ marginBottom: 26 }}>
                <Telescope style={{ width: 22, height: 22, color: '#ffd166' }} aria-hidden="true" />
                <span style={{
                    fontSize: 20, fontWeight: 800, letterSpacing: '0.18em',
                    color: 'rgba(255,255,255,0.94)',
                }}>
                    P4RSEC
                </span>
            </div>

            {/* The bar */}
            <div style={{
                width: 'min(340px, 76vw)', height: 2, borderRadius: 2,
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
                {finished
                    ? 'Ready'
                    : total
                        ? `Loading ${loaded} of ${total}`
                        : 'Starting up'}
            </p>

            {/* What those numbers are. A fixed-height block, so the layout does
                not jump every time a name arrives or leaves. */}
            <div style={{
                marginTop: 16, height: 88, width: 'min(340px, 76vw)',
                display: 'flex', flexDirection: 'column', gap: 4,
                overflow: 'hidden',
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
                        {item.failed && (
                            <span style={{ fontSize: 10, color: '#ff8a80' }}>skipped</span>
                        )}
                    </span>
                ))}
            </div>
        </div>
    );
};

export default LoadingScreen;
