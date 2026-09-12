import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { ChevronLeft, MapPin, Eye } from 'lucide-react';
import NightSky3D from '../components/NightSky3D';
import NightSkyPanel from '../components/NightSkyPanel';
import TimeControl from '../components/TimeControl';
import CoachMark from '../components/CoachMark';
import { useObserverLocation } from '../hooks/useObserverLocation';
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
            <NightSky3D location={location} />
            <NightSkyPanel onOpen={onSettingsOpened} />
            {/* The same clock TimeControl scrubs on the solar-system page —
                utils/simTime.js is a site-wide singleton, not scoped to a
                route, so a date set here is still set there and back. */}
            <TimeControl />
            {showCoach && coachRect && (
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
