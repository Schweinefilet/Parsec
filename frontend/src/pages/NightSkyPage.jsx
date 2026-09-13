import { useState, useEffect, useCallback, useMemo } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { ChevronLeft, MapPin, Eye, Camera, RotateCw } from 'lucide-react';
import NightSky3D from '../components/NightSky3D';
import NightSkyPanel from '../components/NightSkyPanel';
import TimeControl from '../components/TimeControl';
import CoachMark from '../components/CoachMark';
import ArPermissionCard from '../components/ArPermissionCard';
import { useObserverLocation } from '../hooks/useObserverLocation';
import { useCameraStream } from '../hooks/useCameraStream';
import { isArViewerSupported } from '../utils/arSupport';
import { requestDeviceOrientationPermission } from '../utils/deviceOrientation';
import { useI18n } from '../i18n';

// Full bleed out of AppShell's centred <main> (max-w-7xl mx-auto — 1280px on
// a wide screen, with the rest split as equal margins). Both margins, not
// just the leading one: with a width and a single margin set, the box is
// over-constrained and CSS resolves that by discarding the *end* margin —
// the trailing one in English, the leading one in Arabic — so a single
// margin-inline-start looks right in one direction and slides the whole
// scene off the edge in the other. Exactly CategoryBrowser.jsx's own fix for
// its full-bleed 3D viewport, for the same reason.
const FULL_BLEED = {
    position: 'relative', minHeight: 'var(--app-vh, 100vh)',
    width: '100vw', marginLeft: 'calc(-50vw + 50%)', marginRight: 'calc(-50vw + 50%)',
};

/**
 * AR mode is portrait-only (see utils/deviceOrientation.js's own header,
 * "No roll, ever" / screen-orientation note): beta/gamma are reported
 * relative to the device's *physical* frame, not the current screen
 * orientation, and iOS/Android compensate for that differently in ways
 * that need a real device to get right — out of scope for now, so a
 * landscape hold gets a nudge instead of a silently misaligned sky.
 * `screen.orientation` is preferred (explicit, unambiguous); a viewport
 * aspect-ratio comparison is the fallback for the one browser that lacks
 * it entirely (Safari didn't ship the Screen Orientation API until 16.4).
 */
function isPortraitOrientation() {
    const type = typeof screen !== 'undefined' ? screen.orientation?.type : undefined;
    if (type) return type.startsWith('portrait');
    if (typeof window !== 'undefined') return window.innerHeight >= window.innerWidth;
    return true;
}

/**
 * The night sky, from your location, right now — a full-bleed 3D dome rather
 * than a page with a scene in it, the same posture the solar-system home
 * view takes. /tonight already asks for a location for the same reason (see
 * its own "askTitle"/"askBody" card, which this mirrors rather than shares —
 * this codebase groups i18n strings by where they appear, not by meaning);
 * granting it here also makes it available there, and back, with no second
 * prompt — both read the same utils/useObserverLocation.js.
 */
const NightSkyPage = () => {
    const { t, rtl } = useI18n();
    const navigate = useNavigate();
    const { location, error, asking, request } = useObserverLocation();
    // A constellation picked from the header search bar (ObjectSearch.jsx)
    // — /sky?con=Ori — rather than a route param: constellations aren't
    // catalog objects with an /object/:id page of their own, just a spot to
    // pan this same scene to and open the info card for.
    const [searchParams] = useSearchParams();
    const targetConstellation = searchParams.get('con');

    // AR mode: swaps the virtual drag-to-look dome for the live camera feed,
    // oriented by the phone's own compass/tilt instead of a drag gesture.
    // Capability is a one-time, permission-free feature probe (see
    // arSupport.js's own header for why it's built on (pointer: coarse)
    // rather than useIsMobile()) — computed once, not on every render, since
    // none of the signals it reads change mid-session.
    const arSupported = useMemo(() => isArViewerSupported(), []);
    const [arMode, setArMode] = useState(false);
    const [showArCard, setShowArCard] = useState(false);
    const [arBusy, setArBusy] = useState(false);
    const [arOrientationError, setArOrientationError] = useState(null);
    const [arPortrait, setArPortrait] = useState(true);
    const {
        stream: cameraStream, error: cameraError,
        request: requestCameraStream, stop: stopCameraStream,
    } = useCameraStream();

    // Only tracked while AR is actually active — no reason to listen for
    // rotation on the virtual-dome view, which has no portrait restriction.
    useEffect(() => {
        if (!arMode) return;
        const update = () => setArPortrait(isPortraitOrientation());
        update();
        const orientation = typeof screen !== 'undefined' ? screen.orientation : null;
        orientation?.addEventListener('change', update);
        window.addEventListener('resize', update);
        return () => {
            orientation?.removeEventListener('change', update);
            window.removeEventListener('resize', update);
        };
    }, [arMode]);

    const openArCard = useCallback(() => {
        setArOrientationError(null);
        setShowArCard(true);
    }, []);

    const handleArCancel = useCallback(() => setShowArCard(false), []);

    // The actual permission-requesting user gesture. iOS 13+ Safari gates
    // orientation events behind their own explicit prompt, which has to run
    // — and be answered — before getUserMedia's, the more gesture-sensitive
    // of the two; everywhere else requestDeviceOrientationPermission()
    // resolves true immediately (nothing to ask). Sensor-driven heading is
    // now wired up on the other end of this (utils/deviceOrientation.js),
    // so a grant here really does turn into a working compass, not just a
    // permission formality.
    const handleArEnable = useCallback(async () => {
        setArBusy(true);
        setArOrientationError(null);
        const orientationGranted = await requestDeviceOrientationPermission();
        if (!orientationGranted) {
            setArOrientationError('Motion & orientation access was denied');
            setArBusy(false);
            return;
        }
        const stream = await requestCameraStream();
        setArBusy(false);
        if (stream) { setArMode(true); setShowArCard(false); }
    }, [requestCameraStream]);

    const handleArToggle = useCallback(() => {
        if (arMode) {
            stopCameraStream();
            setArMode(false);
        } else {
            openArCard();
        }
    }, [arMode, stopCameraStream, openArCard]);

    // First-visit hint pointing at the settings drawer — its own flag, not
    // the solar-system scene's `p4rsec.coach`: having seen that one doesn't
    // mean you've seen this page's different drawer.
    const [coachSeen, setCoachSeen] = useState(() => {
        try { return window.localStorage.getItem('p4rsec.coachSky') === '1'; } catch { return true; }
    });
    const [coachArmed, setCoachArmed] = useState(false);
    const [coachRect, setCoachRect] = useState(null);
    const endCoach = useCallback((persist) => {
        setCoachSeen(true);
        if (persist) { try { window.localStorage.setItem('p4rsec.coachSky', '1'); } catch { /* ignore */ } }
    }, []);
    const onSettingsOpened = useCallback(() => endCoach(true), [endCoach]);

    useEffect(() => {
        if (!location || coachSeen) return;
        const timer = setTimeout(() => setCoachArmed(true), 1300);
        return () => clearTimeout(timer);
    }, [location, coachSeen]);

    const showCoach = coachArmed && !coachSeen;

    useEffect(() => {
        if (!showCoach) return;
        const measure = () => {
            const el = document.querySelector('[data-coach="tab"]');
            if (el) setCoachRect(el.getBoundingClientRect());
        };
        measure();
        const raf = requestAnimationFrame(measure);
        window.addEventListener('resize', measure);
        return () => { cancelAnimationFrame(raf); window.removeEventListener('resize', measure); };
    }, [showCoach]);

    // A miss doesn't mark it seen — the next visit gets another chance,
    // same convention as the solar-system scene's own coach marks.
    useEffect(() => {
        if (!showCoach) return;
        const timer = setTimeout(() => endCoach(false), 8000);
        return () => clearTimeout(timer);
    }, [showCoach, endCoach]);

    const backButton = (
        <button
            onClick={() => navigate(-1)}
            aria-label={t('nav.back')}
            className="absolute flex items-center justify-center rounded-xl focus-ring"
            style={{
                top: 68, insetInlineStart: 20, zIndex: 20,
                width: 38, height: 38,
                background: 'rgba(0,0,0,0.45)',
                border: '1px solid rgba(255,255,255,0.16)',
                color: 'rgba(255,255,255,0.85)',
                backdropFilter: 'blur(14px)',
                WebkitBackdropFilter: 'blur(14px)',
                cursor: 'pointer',
            }}
        >
            <ChevronLeft className="flip-rtl" style={{ width: 18, height: 18 }} />
        </button>
    );

    if (!location) {
        return (
            <div style={FULL_BLEED}>
                {backButton}
                <div style={{
                    position: 'absolute', inset: 0, display: 'flex',
                    alignItems: 'center', justifyContent: 'center', padding: 20,
                }}>
                    <div className="glass" style={{ padding: 28, textAlign: 'center', maxWidth: 420 }}>
                        <Eye style={{ width: 26, height: 26, color: 'var(--accent)', margin: '0 auto 10px' }} />
                        <p style={{ margin: 0, fontSize: '1.05rem', fontWeight: 700, color: '#fff' }}>
                            {t('nightSky.askTitle')}
                        </p>
                        <p style={{ margin: '6px auto 0', fontSize: '0.85rem', color: 'var(--text-secondary)' }}>
                            {t('nightSky.askBody')}
                        </p>
                        {error && (
                            <p style={{ margin: '10px 0 0', fontSize: '0.8rem', color: '#ff8a80' }}>{error}</p>
                        )}
                        <button
                            onClick={request}
                            disabled={asking}
                            className="flex items-center gap-2 rounded-xl font-bold focus-ring"
                            style={{
                                margin: '16px auto 0', padding: '11px 18px', fontSize: '0.85rem',
                                background: 'rgba(255,209,102,0.14)',
                                border: '1px solid rgba(255,209,102,0.28)',
                                color: '#ffd166', cursor: asking ? 'default' : 'pointer',
                                opacity: asking ? 0.6 : 1,
                            }}
                        >
                            <MapPin style={{ width: 15, height: 15 }} />
                            {t(asking ? 'nightSky.asking' : 'nightSky.useLocation')}
                        </button>
                    </div>
                </div>
            </div>
        );
    }

    return (
        <div style={FULL_BLEED}>
            {backButton}
            {arSupported && (
                <button
                    onClick={handleArToggle}
                    aria-pressed={arMode}
                    aria-label={t(arMode ? 'nightSky.arClose' : 'nightSky.arOpen')}
                    title={t(arMode ? 'nightSky.arClose' : 'nightSky.arOpen')}
                    data-coach="ar-toggle"
                    className="absolute flex items-center justify-center rounded-xl focus-ring"
                    style={{
                        // To the back button's other side, on the same row —
                        // the compass HUD already owns the mirrored top-right
                        // spot (NightSky3D.jsx's .sky-compass), so this can't
                        // just mirror the back button's own position.
                        top: 68, insetInlineStart: 68, zIndex: 20,
                        width: 38, height: 38,
                        background: arMode ? 'rgba(255,209,102,0.16)' : 'rgba(0,0,0,0.45)',
                        border: '1px solid ' + (arMode ? 'rgba(255,209,102,0.34)' : 'rgba(255,255,255,0.16)'),
                        color: arMode ? '#ffd166' : 'rgba(255,255,255,0.85)',
                        backdropFilter: 'blur(14px)',
                        WebkitBackdropFilter: 'blur(14px)',
                        cursor: 'pointer',
                    }}
                >
                    <Camera style={{ width: 18, height: 18 }} />
                </button>
            )}
            <NightSky3D
                location={location}
                targetConstellation={targetConstellation}
                arMode={arMode}
                cameraStream={cameraStream}
            />
            {showArCard && (
                <ArPermissionCard
                    onEnable={handleArEnable}
                    onCancel={handleArCancel}
                    asking={arBusy}
                    error={arOrientationError || cameraError}
                />
            )}
            {arMode && !arPortrait && (
                <div
                    style={{
                        position: 'absolute', inset: 0, zIndex: 25,
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        padding: 20, background: 'rgba(0,0,0,0.7)', pointerEvents: 'none',
                    }}
                >
                    <div className="glass" style={{ padding: 28, textAlign: 'center', maxWidth: 320 }}>
                        <RotateCw style={{ width: 26, height: 26, color: 'var(--accent)', margin: '0 auto 10px' }} />
                        <p style={{ margin: 0, fontSize: '1rem', fontWeight: 700, color: '#fff' }}>
                            {t('nightSky.arRotatePortrait')}
                        </p>
                    </div>
                </div>
            )}
            <NightSkyPanel onOpen={onSettingsOpened} arMode={arMode} />
            {/* The same clock TimeControl scrubs on the solar-system page —
                utils/simTime.js is a site-wide singleton, not scoped to a
                route, so a date set here is still set there and back. Brought
                back after 5.0.2 removed it outright: leaving /sky with no way
                to see or undo a scrub meant a date set before arriving here —
                or scrubbed here on an earlier visit, since the clock persists
                across navigation — could leave the sky showing a stale sky
                with no visible explanation and no pill to press "Live" on. */}
            <TimeControl />
            {/* Suppressed while the AR card is up — CoachMark is
                position:fixed at z-index 40, above literally everything else
                on the page by design, which otherwise painted its "lines,
                twinkle, sky darkness" hint straight through the card's own
                body text the moment both happened to be armed at once. */}
            {showCoach && coachRect && !showArCard && (
                <CoachMark
                    text={t('nightSky.hintSettings')}
                    arrow={rtl ? 'right' : 'left'}
                    onDismiss={() => endCoach(true)}
                    style={{
                        left: rtl ? coachRect.left - 12 : coachRect.right + 12,
                        top: coachRect.top + coachRect.height / 2,
                        transform: rtl ? 'translate(-100%, -50%)' : 'translateY(-50%)',
                        maxWidth: 190,
                    }}
                />
            )}
            <p
                style={{
                    position: 'absolute', bottom: 10, insetInline: 0, zIndex: 5,
                    margin: 0, textAlign: 'center', fontSize: 10.5,
                    color: 'rgba(255,255,255,0.4)', pointerEvents: 'none',
                    textShadow: '0 1px 4px rgba(0,0,0,0.8)',
                }}
            >
                {t('nightSky.credit')}
            </p>
        </div>
    );
};

export default NightSkyPage;
