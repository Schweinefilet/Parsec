import { useState, useEffect, useMemo, useRef } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { MapPin, Crosshair, Sun, Moon, ArrowUpRight } from 'lucide-react';
import PageHeader from '../components/PageHeader';
import SatelliteGlobe from '../components/SatelliteGlobe';
import LiveFeed from '../components/LiveFeed';
import TrackerDebug from '../components/TrackerDebug';
import { debugRequested } from '../utils/debugFlag';
import { useSatelliteTracking } from '../hooks/useSatelliteTracking';
import { useNearestCountry } from '../hooks/useNearestCountry';
import { SATELLITES, DEFAULT_SATELLITE, satelliteById } from '../data/trackedSatellites';
import {
    HANDOFF, SETTLING, IDLE,
    getTrackerPhase, subscribeTracker, setTrackerPhase,
} from '../utils/trackerEntry';
import { useReducedMotion } from '../hooks/useMediaQuery';
import { useI18n } from '../i18n';

const EARTH_R_KM = 6371;

// How long the globe takes to leave full bleed and settle into its card on a
// hand-off arrival. The cross-fade before it (TrackerHandoff.jsx) is the cut;
// this is the beat after it, where the Earth you flew to becomes the Earth in
// the card rather than being replaced by it.
//
// Done with transform and clip-path rather than by animating the element's
// box: the canvas would otherwise be resized on every frame of it, and a
// renderer.setSize per frame for three quarters of a second is exactly the
// kind of cost utils/quality.js exists to keep out of this app. Scaling by
// the height ratio and clipping to the card's rect happens to land on the
// identical picture the card renders at its own size — same vertical field of
// view, same pixels per degree — so the swap at the end has nothing to hide.
const SETTLE_MS = 760;
const SETTLE_EASE = 'cubic-bezier(0.32, 0.72, 0, 1)';

// Great-circle distance between two lat/lon pairs, in km
function haversine(a, b) {
    const toRad = (d) => (d * Math.PI) / 180;
    const dLat = toRad(b.lat - a.lat);
    const dLon = toRad(b.lon - a.lon);
    const s = Math.sin(dLat / 2) ** 2
        + Math.cos(toRad(a.lat)) * Math.cos(toRad(b.lat)) * Math.sin(dLon / 2) ** 2;
    return 2 * EARTH_R_KM * Math.asin(Math.min(1, Math.sqrt(s)));
}

const fmtCoord = (v, pos, neg) =>
    v == null ? '—' : `${Math.abs(v).toFixed(2)}° ${v >= 0 ? pos : neg}`;

const fmtAge = (date, t) => {
    if (!date) return null;
    const hours = (Date.now() - date.getTime()) / 3600000;
    if (hours < 1) return t('tracker.ageMinutes', { n: Math.max(1, Math.round(hours * 60)) });
    if (hours < 48) return t('tracker.ageHours', { n: Math.round(hours) });
    return t('tracker.ageDays', { n: Math.round(hours / 24) });
};

const Stat = ({ label, value, sub, accent }) => (
    <div>
        <p className="label" style={{ margin: 0 }}>{label}</p>
        <p className="figure" style={{ margin: '5px 0 0', color: accent ?? '#fff' }}>
            {value}
        </p>
        {/* Reserved whether or not this reading has a footnote, so the eight
            cells stay the same height and the two rows keep their baselines. */}
        <p style={{
            margin: '3px 0 0', minHeight: '1.4em',
            fontSize: 'var(--fs-tiny)', color: 'var(--text-quaternary)',
        }}>
            {sub ?? ''}
        </p>
    </div>
);

/**
 * One spacecraft in the picker. Doubles as the legend — the dot is the same
 * colour it is drawn in on the globe, so there is nothing to cross-reference.
 */
const SatelliteChip = ({ def, fix, selected, onSelect }) => {
    const { t, bodyName, num } = useI18n();
    const live = !!fix;
    return (
        <button
            type="button"
            onClick={() => onSelect(def.id)}
            aria-pressed={selected}
            className="flex items-center gap-2 rounded-full focus-ring flex-shrink-0"
            style={{
                paddingBlock: 7, paddingInlineStart: 11, paddingInlineEnd: 14,
                background: selected ? `rgba(${hexToRgb(def.color)},0.16)` : 'rgba(255,255,255,0.05)',
                border: `1px solid ${selected ? `rgba(${hexToRgb(def.color)},0.42)` : 'rgba(255,255,255,0.12)'}`,
                cursor: 'pointer',
                opacity: live ? 1 : 0.45,
                transition: 'background 200ms ease, border-color 200ms ease, opacity 200ms ease',
            }}
        >
            <span style={{
                width: 8, height: 8, borderRadius: 999, flexShrink: 0,
                background: def.color,
                boxShadow: selected ? `0 0 8px ${def.color}` : 'none',
            }} />
            <span style={{
                fontSize: '0.8rem', fontWeight: 700,
                color: selected ? '#fff' : 'rgba(255,255,255,0.72)',
            }}>
                {bodyName(def.shortName)}
            </span>
            <span className="num-run" style={{ fontSize: '0.68rem', color: 'var(--text-tertiary)', fontVariantNumeric: 'tabular-nums' }}>
                {live ? t('tracker.km', { km: num(Math.round(fix.altitude)) }) : '—'}
            </span>
        </button>
    );
};

// The chip backgrounds need the colour with an alpha, and the palette is hex
function hexToRgb(hex) {
    const n = parseInt(hex.slice(1), 16);
    return `${(n >> 16) & 255},${(n >> 8) & 255},${n & 255}`;
}

const SatelliteView = () => {
    const { t, bodyName, countryName, num } = useI18n();
    const navigate = useNavigate();
    const [searchParams, setSearchParams] = useSearchParams();

    // Which craft is being followed lives in the URL, so a view of Hubble is a
    // link someone can send rather than a place you have to navigate back to.
    const requested = searchParams.get('sat');
    const selectedId = satelliteById(requested) ? requested : DEFAULT_SATELLITE;
    const select = (id) => setSearchParams(id === DEFAULT_SATELLITE ? {} : { sat: id }, { replace: true });

    const { satellites, selected, track, status } = useSatelliteTracking(selectedId);
    const def = satelliteById(selectedId);

    const [follow, setFollow] = useState(true);
    const [observer, setObserver] = useState(null);
    const [geoError, setGeoError] = useState(null);

    // ── Hand-off arrival ──────────────────────────────────────────────────
    // Mirrored out of utils/trackerEntry.js rather than held here, for the
    // usual reason in this codebase: the sequence starts in a component that
    // has already been unmounted by the time this one mounts.
    const reduceMotion = useReducedMotion();
    const cardSlotRef = useRef(null);
    const cardRef = useRef(null);
    const [trkPhase, setTrkPhase] = useState(() => getTrackerPhase());
    const [settleBox, setSettleBox] = useState(null);
    useEffect(() => subscribeTracker(() => setTrkPhase(getTrackerPhase())), []);

    const arriving = trkPhase === HANDOFF || trkPhase === SETTLING;
    const settling = trkPhase === SETTLING;

    // Measure the card's resting rect — the slot holds it in the column while
    // the card itself is lifted out to full bleed, so this is where it lands.
    //
    // The timer that ends the arrival is set first, and nothing about it is
    // conditional on the measuring working. It used to sit behind an early
    // return that also covered a missing ref, which made "could not measure"
    // and "the page never comes back" the same branch — the card stays lifted
    // out of the column, the slot holding its place stays empty, and the only
    // way out of it is a reload. A settle that cannot be measured has to
    // degrade to a cut, not to that.
    useEffect(() => {
        if (trkPhase !== SETTLING) return;
        const ms = reduceMotion ? 0 : SETTLE_MS;
        const done = setTimeout(() => { setTrackerPhase(IDLE); setSettleBox(null); }, ms + 60);

        // A frame late on purpose. This phase is set from another component
        // the moment the cross-fade ends, which can be while this page is
        // still on its first layout, and a rect read in that tick is not the
        // one the card actually comes to rest at.
        const frame = requestAnimationFrame(() => {
            const slot = cardSlotRef.current?.getBoundingClientRect();
            // Measured against the lifted card's own box rather than the
            // window. `position: fixed; inset: 0` and `window.innerHeight` are
            // the same number only on a browser whose toolbars don't overlap
            // the viewport — iOS Safari is exactly where they part company —
            // and a clip resolved against the wrong one of the two lands the
            // globe's window somewhere the card isn't, leaving a hole in the
            // column where the card should be. The box the clip applies to is
            // the box to measure.
            const box = cardRef.current?.getBoundingClientRect();
            if (!slot || !box || slot.height < 120 || box.height < 120) return;
            setSettleBox({
                top: slot.top - box.top, left: slot.left - box.left,
                right: box.right - slot.right, bottom: box.bottom - slot.bottom,
                scale: slot.height / box.height,
                dx: (slot.left + slot.width / 2) - (box.left + box.width / 2),
                dy: (slot.top + slot.height / 2) - (box.top + box.height / 2),
            });
        });
        return () => { clearTimeout(done); cancelAnimationFrame(frame); };
    }, [trkPhase, reduceMotion]);

    // Leaving mid-arrival must not stick the next one in a half-settled
    // state, and an arrival is the one time this page owns a global phase.
    useEffect(() => () => {
        if (getTrackerPhase() !== IDLE) setTrackerPhase(IDLE);
    }, []);

    // The outside edge of an arrival, measured from this page's own mount
    // rather than from any phase inside it. The sequence's own worst case is
    // about 2.4s — a hand-off that waits out the globe-ready timeout, then a
    // full settle — so anything still lifted at 3.5s is not an animation, it
    // is a page stuck with its globe out of the column and a hole where the
    // card belongs. Every timer inside the sequence is one this cannot rely
    // on; this one is held by the component that has something to lose.
    useEffect(() => {
        if (getTrackerPhase() === IDLE) return;
        const cap = setTimeout(() => setTrackerPhase(IDLE), 3500);
        return () => clearTimeout(cap);
    }, []);

    // The scroll position has to be the one the rect was measured at, and an
    // arrival is also the one case where the page is revealed from behind a
    // full-bleed globe rather than scrolled to.
    useEffect(() => {
        if (arriving) window.scrollTo({ top: 0, behavior: 'instant' });
    }, [arriving]);

    const settleMs = reduceMotion ? 0 : SETTLE_MS;
    const clipStart = 'inset(0px 0px 0px 0px round 0px)';
    const cardClip = settling && settleBox
        ? `inset(${settleBox.top}px ${settleBox.right}px ${settleBox.bottom}px ${settleBox.left}px round var(--radius-card))`
        : clipStart;
    const globeTransform = settling && settleBox
        ? `translate(${settleBox.dx}px, ${settleBox.dy}px) scale(${settleBox.scale})`
        : 'translate(0px, 0px) scale(1)';

    // Tick once a second so the elements-age readout stays honest
    const [, setNow] = useState(Date.now());
    useEffect(() => {
        const iv = setInterval(() => setNow(Date.now()), 1000);
        return () => clearInterval(iv);
    }, []);

    const locate = () => {
        if (!navigator.geolocation) { setGeoError(t('tracker.geoUnsupported')); return; }
        setGeoError(null);
        navigator.geolocation.getCurrentPosition(
            (p) => setObserver({ lat: p.coords.latitude, lon: p.coords.longitude }),
            (err) => setGeoError(t(err.code === 1 ? 'tracker.geoDenied' : 'tracker.geoFailed')),
            { timeout: 10000, maximumAge: 60000 },
        );
    };

    const distanceKm = useMemo(() => {
        if (!observer || !selected) return null;
        return haversine(observer, { lat: selected.lat, lon: selected.lon });
    }, [observer, selected]);

    const nearest = useNearestCountry(selected?.lat, selected?.lon);
    const overhead = nearest != null && nearest.km < 75;

    // Within its own footprint is the honest test for "you could see it go over"
    const inRange = distanceKm != null && selected?.footprintKm != null
        && distanceKm < selected.footprintKm;

    const elementsAge = fmtAge(selected?.elementsEpoch, t);
    const statusLabel = t(status === 'error' ? 'tracker.statusError'
        : status === 'loading' ? 'tracker.statusLoading'
        : status === 'partial' ? 'tracker.statusPartial' : 'tracker.statusLive');
    // The compass letters double as the hemisphere suffix on a coordinate.
    const N = t('sky.north'), S = t('sky.south'), E = t('sky.east'), W = t('sky.west');
    const statusOk = status === 'ready';

    return (
        <>
            {debugRequested() && <TrackerDebug slotRef={cardSlotRef} cardRef={cardRef} />}
            <div style={{
                position: 'relative',
                // z-index here is a stacking context, so everything the
                // arrival layers below is scoped to it — which is the whole
                // reason it has to be lifted as a block. At its resting 1 the
                // full-bleed globe sits under the app header (z-50) and under
                // the reveal below no matter what number either of them
                // carries, because both of those are resolved against this
                // one, not against the page.
                zIndex: arriving ? 260 : 1,
                minHeight: 'var(--app-vh, 100vh)', paddingTop: 'var(--s-10)',
            }}>
                {/* Under the globe, over the page: what the settle reveals
                    the page out of. Inside this div rather than beside it, so
                    it is in the same stacking context as the card that has to
                    cover it. Without it the chrome would simply be there, at
                    full strength, the instant the clip uncovered it. */}
                {arriving && (
                    <div
                        aria-hidden="true"
                        style={{
                            position: 'fixed', inset: 0, zIndex: 240,
                            background: '#000', pointerEvents: 'none',
                            opacity: settling ? 0 : 1,
                            transition: `opacity ${settleMs}ms ease`,
                        }}
                    />
                )}
                {/* .spine — the same column the header above and the catalog
                    on the home route sit on. */}
                <div className="spine" style={{ paddingBottom: 'var(--s-10)' }}>

                    {/* ── Header ── */}
                    <PageHeader
                        // navigate('/') rather than back, the same choice
                        // NightSkyPage makes and for the same reason: the
                        // solar system remounts unfocused, finds the exit
                        // state the hand-off left behind, and pulls the
                        // camera back out from Earth instead of cutting to a
                        // wide shot. It is also the only sane answer for
                        // someone who arrived here on a shared link.
                        onBack={() => navigate('/')}
                        backLabel={t('tracker.back')}
                        title={t('tracker.title')}
                        subtitle={t('tracker.subtitle', { name: bodyName(def.shortName), norad: def.norad })}
                        trailing={(
                            <span
                                className="flex items-center gap-1.5"
                                style={{
                                    fontSize: 'var(--fs-label)', fontWeight: 700,
                                    letterSpacing: 'var(--tr-label)',
                                    textTransform: 'uppercase', padding: '6px var(--s-3)',
                                    borderRadius: 'var(--r-full)',
                                    background: status === 'error' ? 'rgba(255,90,80,0.14)'
                                        : statusOk ? 'rgba(80,220,140,0.14)' : 'rgba(255,200,60,0.14)',
                                    border: `1px solid ${status === 'error' ? 'rgba(255,90,80,0.30)'
                                        : statusOk ? 'rgba(80,220,140,0.30)' : 'rgba(255,200,60,0.30)'}`,
                                    color: status === 'error' ? '#ff8a80' : statusOk ? '#6ee7a0' : '#ffd166',
                                }}
                            >
                                <span style={{
                                    width: 6, height: 6, borderRadius: 999, background: 'currentColor',
                                    animation: statusOk ? 'issPulse 2s ease-in-out infinite' : 'none',
                                }} />
                                {statusLabel}
                            </span>
                        )}
                    />

                    {/* ── Which spacecraft ── */}
                    {/* The picker is the legend. Each chip carries the colour its
                        dot is drawn in and its current altitude, so choosing one
                        and reading the globe are the same action. */}
                    <div
                        className="flex items-center gap-2 mb-3"
                        style={{ overflowX: 'auto', paddingBottom: 2 }}
                        role="group"
                        aria-label={t('tracker.choose')}
                    >
                        {SATELLITES.map(s => (
                            <SatelliteChip
                                key={s.id}
                                def={s}
                                fix={satellites.find(f => f.id === s.id)}
                                selected={s.id === selectedId}
                                onSelect={select}
                            />
                        ))}
                    </div>

                    {/* ── Globe ── */}
                    {/* The slot is what keeps the column's layout still: on a
                        hand-off arrival the card is lifted out to position:
                        fixed for the settle, and without something holding its
                        height here everything below would jump up and back. */}
                    <div
                        ref={cardSlotRef}
                        style={{ position: 'relative', height: 'clamp(340px, 56vh, 620px)' }}
                    >
                    <div
                        ref={cardRef}
                        className={arriving ? undefined : 'glass'}
                        style={{
                            position: arriving ? 'fixed' : 'absolute',
                            inset: 0,
                            zIndex: arriving ? 250 : undefined,
                            overflow: 'hidden',
                            padding: 0,
                            // Black, not glass, while it is the whole screen:
                            // a translucent blurred panel over the entire
                            // viewport is not what the shot cuts to.
                            background: arriving ? '#000' : undefined,
                            clipPath: arriving ? cardClip : undefined,
                            transition: settling
                                ? `clip-path ${settleMs}ms ${SETTLE_EASE}`
                                : undefined,
                        }}
                    >
                        <div
                            style={{
                                width: '100%', height: '100%',
                                transformOrigin: 'center center',
                                transform: arriving ? globeTransform : undefined,
                                transition: settling
                                    ? `transform ${settleMs}ms ${SETTLE_EASE}`
                                    : undefined,
                            }}
                        >
                        <SatelliteGlobe
                            satellites={satellites}
                            selectedId={selectedId}
                            track={track}
                            follow={follow}
                            observer={observer}
                            onUserTakeOver={() => setFollow(false)}
                        />
                        </div>

                        {status !== 'ready' && satellites.length === 0 && (
                            <div style={{
                                position: 'absolute', inset: 0, display: 'flex',
                                alignItems: 'center', justifyContent: 'center',
                                color: 'var(--text-tertiary)', fontSize: '0.85rem', pointerEvents: 'none',
                            }}>
                                {t(status === 'error' ? 'tracker.unreachable' : 'tracker.fetching')}
                            </div>
                        )}

                        {/* Overlay controls */}
                        <div style={{
                            position: 'absolute', top: 12, insetInlineEnd: 12, display: 'flex', gap: 8,
                            opacity: arriving ? 0 : 1,
                            pointerEvents: arriving ? 'none' : 'auto',
                            transition: `opacity ${settleMs}ms ease`,
                        }}>
                            <button
                                onClick={() => setFollow(f => !f)}
                                aria-pressed={follow}
                                className="flex items-center gap-1.5 rounded-full focus-ring"
                                style={{
                                    padding: '6px 12px', fontSize: 10, fontWeight: 700,
                                    letterSpacing: '0.08em', textTransform: 'uppercase',
                                    background: follow ? 'rgba(80,220,140,0.16)' : 'rgba(0,0,0,0.45)',
                                    border: `1px solid ${follow ? 'rgba(80,220,140,0.32)' : 'rgba(255,255,255,0.16)'}`,
                                    color: follow ? '#6ee7a0' : 'rgba(255,255,255,0.75)',
                                    backdropFilter: 'blur(12px)',
                                    WebkitBackdropFilter: 'blur(12px)',
                                    cursor: 'pointer',
                                }}
                            >
                                <Crosshair style={{ width: 12, height: 12 }} />
                                {follow
                                    ? t('tracker.following', { name: bodyName(def.shortName) })
                                    : t('tracker.freeLook')}
                            </button>
                        </div>

                        <p style={{
                            position: 'absolute', bottom: 10, insetInlineStart: 14, margin: 0,
                            fontSize: 10, color: 'rgba(255,255,255,0.35)', pointerEvents: 'none',
                            opacity: arriving ? 0 : 1,
                            transition: `opacity ${settleMs}ms ease`,
                        }}>
                            {t('tracker.orbitCaption', { name: bodyName(def.shortName) })}
                        </p>
                    </div>
                    </div>

                    {/* ── Telemetry for the selected craft ── */}
                    {/* A fixed four-column grid, not `auto-fit minmax(130px,
                        1fr)`. There are eight readings, and auto-fit resolved
                        to seven columns at the width this panel actually gets —
                        so the eighth wrapped onto a row of its own and sat
                        there alone looking like an afterthought. Four columns
                        divide eight exactly, at every window width. */}
                    <div
                        className="glass stat-grid"
                        style={{ marginTop: 'var(--s-4)', padding: 'var(--s-6)' }}
                    >
                        <Stat label={t('tracker.latitude')} value={t.digits(fmtCoord(selected?.lat, N, S))} />
                        <Stat label={t('tracker.longitude')} value={t.digits(fmtCoord(selected?.lon, E, W))} />
                        <Stat
                            label={t('tracker.nearestCountry')}
                            value={nearest ? countryName(nearest.name) : '—'}
                            sub={
                                nearest == null ? null
                                : overhead ? t('tracker.overhead')
                                : t('tracker.kmAway', { km: num(Math.round(nearest.km)) })
                            }
                            accent={overhead ? '#6ee7a0' : undefined}
                        />
                        <Stat
                            label={t('tracker.altitude')}
                            value={selected ? t('tracker.km', { km: num(Math.round(selected.altitude)) }) : '—'}
                            sub={selected
                                ? t('tracker.horizon', { km: num(Math.round(selected.footprintKm)) }) : null}
                        />
                        <Stat
                            label={t('tracker.speed')}
                            value={selected?.velocity != null
                                ? t('tracker.kmPerSec', { v: selected.velocity.toFixed(2) }) : '—'}
                            sub={selected?.velocity != null
                                ? t('tracker.kmPerHour', { v: num(Math.round(selected.velocity * 3600)) }) : null}
                        />
                        <Stat
                            label={t('tracker.sunlight')}
                            value={
                                <span className="flex items-center gap-1.5">
                                    {selected?.sunlit
                                        ? <Sun style={{ width: 15, height: 15 }} />
                                        : <Moon style={{ width: 15, height: 15 }} />}
                                    {selected == null ? '—'
                                        : t(selected.sunlit ? 'tracker.daylight' : 'tracker.eclipsed')}
                                </span>
                            }
                            accent={selected?.sunlit ? '#ffd166' : '#9db4ff'}
                        />
                        <Stat
                            label={t('tracker.period')}
                            value={selected?.periodMinutes
                                ? t('tracker.minutes', { n: selected.periodMinutes.toFixed(1) }) : '—'}
                            sub={selected?.periodMinutes
                                ? t('tracker.orbitsPerDay', { n: (1440 / selected.periodMinutes).toFixed(1) }) : null}
                        />
                        <Stat
                            label={t('tracker.elements')}
                            value={elementsAge ?? '—'}
                            sub={t('tracker.elementsSource')}
                        />
                    </div>

                    {/* ── Live video, for the one satellite that has any ── */}
                    <LiveFeed satellite={def} />

                    {/* ── Observer ── */}
                    <div className="glass" style={{ marginTop: 16, padding: 20 }}>
                        <div className="flex flex-wrap items-center justify-between gap-4">
                            <div style={{ minWidth: 0 }}>
                                <p style={{ margin: 0, fontSize: 9, fontWeight: 800, letterSpacing: '0.12em', textTransform: 'uppercase', color: 'var(--text-tertiary)' }}>
                                    {t('tracker.distanceFromYou')}
                                </p>
                                {observer ? (
                                    <>
                                        <p className="num-run" style={{ margin: '3px 0 0', fontSize: '1.35rem', fontWeight: 700, color: '#fff', fontVariantNumeric: 'tabular-nums' }}>
                                            {distanceKm != null
                                                ? t('tracker.km', { km: num(Math.round(distanceKm)) }) : '—'}
                                        </p>
                                        <p style={{ margin: '2px 0 0', fontSize: 11, color: 'var(--text-tertiary)' }}>
                                            {t('tracker.groundDistance', {
                                                name: bodyName(def.shortName),
                                                lat: fmtCoord(observer.lat, N, S),
                                                lon: fmtCoord(observer.lon, E, W),
                                            })}
                                            {inRange && t('tracker.aboveHorizon')}
                                        </p>
                                    </>
                                ) : (
                                    <p style={{ margin: '3px 0 0', fontSize: '0.85rem', color: 'var(--text-secondary)' }}>
                                        {geoError ?? t('tracker.shareLocation', { name: bodyName(def.shortName) })}
                                    </p>
                                )}
                            </div>
                            <div className="flex items-center gap-2 flex-wrap">
                                <button
                                    onClick={() => navigate(`/object/${def.catalogId}`)}
                                    className="flex items-center gap-1.5 rounded-xl font-bold focus-ring"
                                    style={{
                                        padding: '10px 14px', fontSize: '0.8rem',
                                        background: 'rgba(255,255,255,0.06)',
                                        border: '1px solid rgba(255,255,255,0.14)',
                                        color: 'rgba(255,255,255,0.85)', cursor: 'pointer',
                                    }}
                                >
                                    {t('tracker.about', { name: bodyName(def.shortName) })}
                                    <ArrowUpRight className="flip-rtl" style={{ width: 14, height: 14 }} />
                                </button>
                                <button
                                    onClick={locate}
                                    className="flex items-center gap-2 rounded-xl font-bold focus-ring"
                                    style={{
                                        padding: '10px 16px', fontSize: '0.8rem',
                                        background: 'rgba(255,209,102,0.14)',
                                        border: '1px solid rgba(255,209,102,0.28)',
                                        color: '#ffd166', cursor: 'pointer', flexShrink: 0,
                                    }}
                                >
                                    <MapPin style={{ width: 15, height: 15 }} />
                                    {t(observer ? 'tracker.updateLocation' : 'tracker.useLocation')}
                                </button>
                            </div>
                        </div>
                    </div>

                    <p style={{ marginTop: 14, fontSize: 11, color: 'var(--text-tertiary)', textAlign: 'center' }}>
                        {t('tracker.footnote')}
                    </p>
                </div>
            </div>
        </>
    );
};

export default SatelliteView;
