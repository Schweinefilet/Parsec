import { useState, useEffect, useCallback, useMemo } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { MapPin, Eye, Camera, RotateCw } from 'lucide-react';
import NightSky3D from '../components/NightSky3D';
import NightSkyPanel from '../components/NightSkyPanel';
import TimeControl from '../components/TimeControl';
import CoachMark from '../components/CoachMark';
import ArPermissionCard from '../components/ArPermissionCard';
import SceneBack from '../components/SceneBack';
import SceneDialog from '../components/SceneDialog';
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
 * view takes. It asks for a location first, for the reason its own
 * "askTitle"/"askBody" card gives — which sky you see depends on where you
 * are standing;
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

    // The shared way out of a full-bleed page (components/SceneBack), on the
    // same spine as the wordmark above it and as the focused-body view's copy.
    const backButton = <SceneBack onClick={() => navigate('/')} />;

    if (!location) {
        return (
            <div style={FULL_BLEED}>
                {backButton}
                <SceneDialog icon={Eye} title={t('nightSky.askTitle')} body={t('nightSky.askBody')}>
                    {error && <p className="dialog-error">{error}</p>}
                    <div className="dialog-actions">
                        <button onClick={request} disabled={asking} className="action-btn focus-ring">
                            <MapPin aria-hidden="true" />
                            {t(asking ? 'nightSky.asking' : 'nightSky.useLocation')}
                        </button>
                    </div>
                </SceneDialog>
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
                    data-on={arMode}
                    className="chrome-btn scene-under-back focus-ring"
                    // .scene-under-back:
                    // Stacked below the back button rather than beside it
                    // on the same row: "Go back" is short in English, but
                    // long enough in other locales (and even in English,
                    // it turns out) to run under a same-row button fixed
                    // at any single offset — it doesn't just get close, it
                    // sat right on top of the button. Below it needs no
                    // per-locale width to dodge, since nothing is competing
                    // for the same horizontal space. The compass HUD
                    // already owns the mirrored top-right spot
                    // (NightSky3D.jsx's .sky-compass), so this can't just
                    // mirror the back button's own position there either.
                >
                    <Camera className="h-4 w-4" aria-hidden="true" />
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
                <SceneDialog
                    icon={RotateCw}
                    title={t('nightSky.arRotatePortrait')}
                    scrim passive maxWidth={320} zIndex={25}
                />
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
                    target={coachRect}
                    // The tab hugs the leading edge, so the tip opens toward the sky.
                    side={rtl ? 'left' : 'right'}
                    maxWidth={200}
                    onDismiss={() => endCoach(true)}
                />
            )}
            <p className="scene-credit">{t('nightSky.credit')}</p>
        </div>
    );
};

export default NightSkyPage;
