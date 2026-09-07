import { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import {
    ChevronLeft, MapPin, Sun, Moon as MoonIcon, ArrowUpRight, Eye,
    Orbit, Sparkles, Telescope, CalendarDays,
} from 'lucide-react';
import { useObserverLocation } from '../hooks/useObserverLocation';
import { skyView, VISIBILITY_KEY } from '../utils/skyPositions';
import { findEvents, whenWords, daysUntil, RANK } from '../utils/skyEvents';
import { PLANETS } from '../data/solarSystemBodies';
import { useI18n } from '../i18n';

const BODY_COLOR = {
    luna: '#d8d8e0',
    ...Object.fromEntries(PLANETS.map(p => [p.id, p.color])),
};

const EVENT_ICON = {
    'solar-eclipse': Sun,
    'lunar-eclipse': MoonIcon,
    'opposition': Orbit,
    'elongation': Telescope,
    'full-moon': MoonIcon,
    'new-moon': MoonIcon,
    'meteor-shower': Sparkles,
};

// Three weights, because an eclipse and a full moon are not the same news.
const RANK_STYLE = {
    [RANK.headline]: { color: '#ffd166', bg: 'rgba(255,209,102,0.13)', border: 'rgba(255,209,102,0.30)' },
    [RANK.notable]:  { color: '#9db4ff', bg: 'rgba(120,140,255,0.12)', border: 'rgba(120,140,255,0.26)' },
    [RANK.routine]:  { color: 'var(--text-secondary)', bg: 'rgba(255,255,255,0.05)', border: 'rgba(255,255,255,0.11)' },
};

/**
 * One event, with the thing that makes this page more than a calendar: a
 * button that puts the solar system at that instant. Reading that Saturn is
 * at opposition in April tells you less than watching it line up.
 */
const EventRow = ({ event, now, onJump }) => {
    const { t, date, time } = useI18n();
    const fmtDate = (d) => date(d, {
        weekday: 'short', day: 'numeric', month: 'short', year: 'numeric',
    });
    const fmtTime = (d) => (d ? time(d) : null);
    const Icon = EVENT_ICON[event.kind] ?? CalendarDays;
    const style = RANK_STYLE[event.rank] ?? RANK_STYLE[RANK.routine];
    const soon = daysUntil(event.at, now) < 14;

    return (
        <div
            className="flex flex-wrap items-start gap-x-3 gap-y-2"
            style={{ padding: '13px 0', borderTop: '1px solid rgba(255,255,255,0.06)' }}
        >
            <span
                className="flex items-center justify-center flex-shrink-0"
                style={{
                    width: 30, height: 30, borderRadius: 9, marginTop: 1,
                    background: style.bg, border: `1px solid ${style.border}`, color: style.color,
                }}
            >
                <Icon style={{ width: 15, height: 15 }} />
            </span>

            <span style={{ minWidth: 0, flex: '1 1 240px' }}>
                <span className="flex flex-wrap items-baseline gap-x-2">
                    <strong style={{ fontSize: '0.95rem', fontWeight: 700, color: '#fff' }}>
                        {event.title}
                    </strong>
                    <span style={{
                        fontSize: '0.72rem', fontWeight: 700, color: soon ? style.color : 'var(--text-tertiary)',
                        whiteSpace: 'nowrap',
                    }}>
                        {whenWords(event.at, now, t)}
                    </span>
                </span>
                <span style={{ display: 'block', fontSize: '0.82rem', color: 'var(--text-secondary)', marginTop: 2 }}>
                    {event.detail}
                </span>
                <span style={{ display: 'block', fontSize: '0.72rem', color: 'var(--text-tertiary)', marginTop: 3 }}>
                    {fmtDate(event.at)} · {fmtTime(event.at)}
                </span>
            </span>

            <button
                onClick={() => onJump(event)}
                className="flex items-center gap-1.5 rounded-lg font-bold focus-ring flex-shrink-0"
                style={{
                    marginInlineStart: 'auto', padding: '7px 11px', fontSize: '0.74rem',
                    background: 'rgba(255,255,255,0.06)',
                    border: '1px solid rgba(255,255,255,0.13)',
                    color: 'rgba(255,255,255,0.85)', cursor: 'pointer', whiteSpace: 'nowrap',
                }}
            >
                {t('tonight.setClock')}
                <ArrowUpRight style={{ width: 13, height: 13 }} />
            </button>
        </div>
    );
};

/**
 * The sky as a panorama: due north at both ends, the horizon along the bottom,
 * straight up at the top.
 *
 * A round star chart is the traditional shape and the wrong one for the
 * question being asked here, which is not "what does the sky look like" but
 * "which way do I turn and how far up". Laid out flat, the answer is an
 * x-coordinate and a y-coordinate.
 */
const SkyPanorama = ({ bodies }) => {
    const { t, bodyName } = useI18n();
    const W = 720, H = 240, GROUND = 210;
    const x = (az) => (az / 360) * W;
    const y = (alt) => GROUND - (Math.max(0, alt) / 90) * (GROUND - 22);

    // Two planets close together in the sky is the interesting case, not the
    // rare one — a conjunction is exactly what you would go outside to see —
    // and it is also when their labels land on top of each other. Place the
    // brightest first and nudge the rest clear.
    const placed = useMemo(() => {
        const LABEL_W = 58, LABEL_H = 14;
        const taken = [];
        return bodies
            .filter(b => b.up)
            .slice()
            .sort((a, b) => (a.magnitude ?? 99) - (b.magnitude ?? 99))
            .map(b => {
                const cx = x(b.azimuth);
                const cy = y(b.altitude);
                const r = b.magnitude == null ? 4
                    : Math.max(2.5, Math.min(8, 6.5 - b.magnitude * 0.55));
                let ly = cy - r - 6;
                let guard = 0;
                while (guard++ < 10 && taken.some(t =>
                    Math.abs(t.x - cx) < LABEL_W && Math.abs(t.y - ly) < LABEL_H)) {
                    ly -= LABEL_H;
                }
                // Out of room above: drop it under the dot instead
                if (ly < 12) ly = cy + r + 13;
                taken.push({ x: cx, y: ly });
                return { ...b, cx, cy, r, ly };
            });
    }, [bodies]);

    const up = placed;

    return (
        // Not mirrored in a right-to-left layout. This is a picture of the
        // horizon, and north stays where north is; the Arabic labels inside
        // read correctly on their own.
        <div className="ltr-figure" style={{ overflowX: 'auto', overflowY: 'hidden' }}>
            <svg
                viewBox={`0 0 ${W} ${H}`}
                role="img"
                aria-label={t('tonight.skyAria', { count: up.length })}
                style={{ width: '100%', minWidth: 560, display: 'block' }}
            >
                {/* Altitude guides at 30° and 60° */}
                {[30, 60].map(alt => (
                    <g key={alt}>
                        <line x1={0} x2={W} y1={y(alt)} y2={y(alt)}
                            stroke="rgba(255,255,255,0.07)" strokeDasharray="3 5" />
                        <text x={4} y={y(alt) - 4} fill="rgba(255,255,255,0.28)" fontSize={9}>{alt}°</text>
                    </g>
                ))}

                {/* The ground */}
                <line x1={0} x2={W} y1={GROUND} y2={GROUND} stroke="rgba(255,255,255,0.35)" />
                <rect x={0} y={GROUND} width={W} height={H - GROUND} fill="rgba(255,255,255,0.04)" />

                {/* Which way you are facing */}
                {[['sky.north', 0], ['sky.east', 90], ['sky.south', 180],
                  ['sky.west', 270], ['sky.north', 360]].map(([key, az], i) => (
                    <g key={i}>
                        <line x1={x(az)} x2={x(az)} y1={22} y2={GROUND}
                            stroke="rgba(255,255,255,0.07)" />
                        <text x={x(az)} y={H - 8} fill="rgba(255,255,255,0.5)" fontSize={11}
                            fontWeight="700" textAnchor={i === 0 ? 'start' : i === 4 ? 'end' : 'middle'}>
                            {t(key)}
                        </text>
                    </g>
                ))}

                {up.map(b => {
                    const color = BODY_COLOR[b.id] ?? '#ffffff';
                    // A leader line where the label had to move away from its dot
                    const led = Math.abs(b.ly - (b.cy - b.r - 6)) > 2;
                    return (
                        <g key={b.id}>
                            {led && (
                                <line x1={b.cx} y1={b.cy} x2={b.cx} y2={b.ly + 3}
                                    stroke={color} strokeWidth={0.7} opacity={0.35} />
                            )}
                            <circle cx={b.cx} cy={b.cy} r={b.r * 2.6} fill={color} opacity={0.16} />
                            <circle cx={b.cx} cy={b.cy} r={b.r} fill={color} />
                            <text
                                x={b.cx} y={b.ly} fill="rgba(255,255,255,0.9)"
                                fontSize={11} fontWeight="700" textAnchor="middle"
                            >
                                {bodyName(b.name)}
                            </text>
                        </g>
                    );
                })}
            </svg>
        </div>
    );
};

const TonightPage = () => {
    const { t, bodyName, time, num } = useI18n();
    const fmtTime = (d) => (d ? time(d) : null);
    const navigate = useNavigate();
    const { location, error, asking, request, forget } = useObserverLocation();

    // The sky moves; a minute is finer than anyone can act on and coarse
    // enough to cost nothing.
    const [now, setNow] = useState(() => new Date());
    useEffect(() => {
        const iv = setInterval(() => setNow(new Date()), 60000);
        return () => clearInterval(iv);
    }, []);

    const view = useMemo(
        () => (location ? skyView(location, now) : null),
        [location, now],
    );

    const upNow = view?.bodies.filter(b => b.up) ?? [];
    const below = view?.bodies.filter(b => !b.up) ?? [];

    // The calendar costs 40ms cold and 13ms warm, which is nothing once a day
    // and wasteful once a minute — so it is keyed on the date rather than on
    // the clock. Countdowns stay live regardless: whenWords() reads `now` at
    // render, so "in 3 days" becomes "tomorrow" without recomputing anything.
    //
    // Without a location this still runs. A solar eclipse is the one kind
    // that depends on standing somewhere; oppositions, lunar eclipses and
    // meteor showers are the same sky for everyone, and a page that shows
    // nothing until you hand over your position has earned nothing.
    const dayKey = now.toDateString();
    const events = useMemo(
        () => findEvents(location, {
            from: new Date(), days: 365, limit: 12,
            t, name: bodyName, num,
        }),
        // dayKey is the whole point of the dependency list here: it is what
        // holds the result steady across the minute tick and lets it go at
        // midnight. The rule cannot see that because the value is not read.
        // eslint-disable-next-line react-hooks/exhaustive-deps
        [location, dayKey, t, bodyName, num],
    );

    /** Put the solar system at that instant. */
    const jumpTo = (event) => navigate(`/?at=${encodeURIComponent(event.at.toISOString())}`);

    // A year of dates is a reference; a thing happening this fortnight is
    // news, and it is the only reason to open the page twice. Routine events
    // do not qualify — a full moon every month is not something to be told
    // about — so this is the soonest that is at least notable.
    const imminent = events.find(e => e.rank >= RANK.notable && daysUntil(e.at, now) <= 14);

    const eventsPanel = (
        <div className="glass" style={{ marginTop: 16, padding: '4px 20px 16px' }}>
            <div className="flex flex-wrap items-baseline gap-x-3">
                <p style={{ margin: '14px 0 2px', fontSize: 9, fontWeight: 800, letterSpacing: '0.12em', textTransform: 'uppercase', color: 'var(--text-tertiary)' }}>
                    {t('tonight.comingUp')}
                </p>
                <p style={{ margin: '14px 0 2px', fontSize: 11, color: 'var(--text-tertiary)' }}>
                    {t('tonight.comingUpNote')}
                    {!location && t('tonight.comingUpNoLocation')}
                </p>
            </div>
            {imminent && (
                <div
                    className="flex flex-wrap items-center gap-x-2 gap-y-1"
                    style={{
                        margin: '10px 0 2px', padding: '9px 12px', borderRadius: 11,
                        background: RANK_STYLE[imminent.rank].bg,
                        border: `1px solid ${RANK_STYLE[imminent.rank].border}`,
                    }}
                >
                    <span style={{ fontSize: '0.82rem', fontWeight: 700, color: RANK_STYLE[imminent.rank].color }}>
                        {imminent.title} {whenWords(imminent.at, now, t)}
                    </span>
                    <span style={{ fontSize: '0.78rem', color: 'var(--text-secondary)' }}>
                        {imminent.detail}
                    </span>
                </div>
            )}
            {events.length === 0 ? (
                <p style={{ margin: '12px 0 4px', fontSize: '0.85rem', color: 'var(--text-secondary)' }}>
                    {t('tonight.noEvents')}
                </p>
            ) : events.map(e => (
                <EventRow key={e.id} event={e} now={now} onJump={jumpTo} />
            ))}
        </div>
    );

    return (
        <div style={{ position: 'relative', zIndex: 1, minHeight: 'var(--app-vh, 100vh)', paddingTop: 64 }}>
            <div style={{ maxWidth: 1180, margin: '0 auto', padding: '0 16px 40px' }}>

                {/* ── Header ── */}
                <div className="flex items-center gap-3 mb-4">
                    <button
                        onClick={() => navigate(-1)}
                        aria-label={t('tonight.back')}
                        className="flex items-center justify-center rounded-xl focus-ring"
                        style={{
                            width: 36, height: 36, flexShrink: 0,
                            background: 'rgba(255,255,255,0.06)',
                            border: '1px solid rgba(255,255,255,0.14)',
                            color: 'rgba(255,255,255,0.85)', cursor: 'pointer',
                        }}
                    >
                        <ChevronLeft style={{ width: 18, height: 18 }} />
                    </button>
                    <div style={{ minWidth: 0 }}>
                        <h1 style={{ margin: 0, fontSize: 'clamp(1.15rem, 3vw, 1.6rem)', fontWeight: 800, letterSpacing: '-0.02em', color: '#fff' }}>
                            {t('tonight.title')}
                        </h1>
                        <p style={{ margin: '1px 0 0', fontSize: '0.72rem', color: 'var(--text-tertiary)' }}>
                            {location
                                ? t('tonight.from', {
                                    lat: `${Math.abs(location.lat).toFixed(2)}°${t(location.lat >= 0 ? 'sky.north' : 'sky.south')}`,
                                    lon: `${Math.abs(location.lon).toFixed(2)}°${t(location.lon >= 0 ? 'sky.east' : 'sky.west')}`,
                                    time: fmtTime(now),
                                })
                                : t('tonight.subtitle')}
                        </p>
                    </div>
                    {view && (
                        <span
                            className="flex items-center gap-1.5 flex-shrink-0"
                            style={{
                                marginInlineStart: 'auto',
                                fontSize: 10, fontWeight: 700, letterSpacing: '0.08em',
                                textTransform: 'uppercase', padding: '5px 10px', borderRadius: 999,
                                background: view.twilight.dark ? 'rgba(120,140,255,0.14)' : 'rgba(255,200,60,0.14)',
                                border: `1px solid ${view.twilight.dark ? 'rgba(120,140,255,0.30)' : 'rgba(255,200,60,0.30)'}`,
                                color: view.twilight.dark ? '#9db4ff' : '#ffd166',
                            }}
                        >
                            {view.twilight.dark
                                ? <MoonIcon style={{ width: 12, height: 12 }} />
                                : <Sun style={{ width: 12, height: 12 }} />}
                            {t(view.twilight.labelKey)}
                        </span>
                    )}
                </div>

                {!location ? (
                    <div className="glass" style={{ padding: 28, textAlign: 'center' }}>
                        <Eye style={{ width: 26, height: 26, color: 'var(--accent)', margin: '0 auto 10px' }} />
                        <p style={{ margin: 0, fontSize: '1.05rem', fontWeight: 700, color: '#fff' }}>
                            {t('tonight.askTitle')}
                        </p>
                        <p style={{ margin: '6px auto 0', maxWidth: 460, fontSize: '0.85rem', color: 'var(--text-secondary)' }}>
                            {t('tonight.askBody')}
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
                            {t(asking ? 'tonight.asking' : 'tonight.useLocation')}
                        </button>
                    </div>
                ) : null}

                {!location && eventsPanel}

                {location && (
                    <>
                        {/* ── The sky ── */}
                        <div className="glass" style={{ padding: '16px 8px 8px' }}>
                            <SkyPanorama bodies={view.bodies} />
                            <p style={{ margin: '4px 12px 6px', fontSize: 11, color: 'var(--text-tertiary)', textAlign: 'center' }}>
                                {upNow.length === 0
                                    ? t('tonight.nothingUp')
                                    : t('tonight.countUp', { count: upNow.length })}
                                {!view.twilight.dark && upNow.length > 0 && t('tonight.tooBright')}
                            </p>
                        </div>

                        {/* ── Up now ── */}
                        {upNow.length > 0 && (
                            <div className="glass" style={{ marginTop: 16, padding: '4px 20px 14px' }}>
                                <p style={{ margin: '14px 0 2px', fontSize: 9, fontWeight: 800, letterSpacing: '0.12em', textTransform: 'uppercase', color: 'var(--text-tertiary)' }}>
                                    {t('tonight.aboveHorizon')}
                                </p>
                                {upNow.map(b => (
                                    <button
                                        key={b.id}
                                        onClick={() => navigate(`/object/${b.id}`)}
                                        className="w-full flex flex-wrap items-baseline gap-x-3 gap-y-1 focus-ring"
                                        style={{
                                            padding: '11px 0', textAlign: 'start', cursor: 'pointer',
                                            background: 'none', border: 'none',
                                            borderTop: '1px solid rgba(255,255,255,0.06)',
                                        }}
                                    >
                                        <span style={{
                                            width: 9, height: 9, borderRadius: 999, flexShrink: 0,
                                            background: BODY_COLOR[b.id] ?? '#fff',
                                            boxShadow: `0 0 8px ${BODY_COLOR[b.id] ?? '#fff'}`,
                                        }} />
                                        <span style={{ fontSize: '0.95rem', fontWeight: 700, color: '#fff', minWidth: 74 }}>
                                            {bodyName(b.name)}
                                        </span>
                                        <span style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>
                                            {t('tonight.lookAt', {
                                                compass: t('sky.compass')[b.compass],
                                                where: t(b.whereKey),
                                            })}
                                            {' '}<span className="num-run" style={{ color: 'var(--text-tertiary)', fontVariantNumeric: 'tabular-nums' }}>
                                                {t('tonight.degreesUp', { deg: b.altitude.toFixed(0) })}
                                            </span>
                                        </span>
                                        <span className="flex items-center gap-3 flex-shrink-0" style={{ marginInlineStart: 'auto' }}>
                                            {b.id === 'luna' && b.illuminated != null && (
                                                <span style={{ fontSize: '0.75rem', color: 'var(--text-tertiary)' }}>
                                                    {t('tonight.lit', { pct: Math.round(b.illuminated * 100) })}
                                                </span>
                                            )}
                                            <span style={{ fontSize: '0.75rem', color: 'var(--text-tertiary)', fontVariantNumeric: 'tabular-nums' }}>
                                                {t('tonight.mag', { m: b.magnitude?.toFixed(1) ?? '—' })}
                                            </span>
                                            <span style={{
                                                fontSize: '0.68rem', fontWeight: 700, padding: '3px 8px', borderRadius: 999,
                                                background: b.visibility === 'naked-eye' ? 'rgba(80,220,140,0.14)' : 'rgba(255,255,255,0.06)',
                                                border: `1px solid ${b.visibility === 'naked-eye' ? 'rgba(80,220,140,0.28)' : 'rgba(255,255,255,0.12)'}`,
                                                color: b.visibility === 'naked-eye' ? '#6ee7a0' : 'var(--text-secondary)',
                                                whiteSpace: 'nowrap',
                                            }}>
                                                {t(VISIBILITY_KEY[b.visibility])}
                                            </span>
                                            {b.eventAt && (
                                                <span style={{ fontSize: '0.72rem', color: 'var(--text-tertiary)', whiteSpace: 'nowrap' }}>
                                                    {t('tonight.sets', { time: fmtTime(b.eventAt) })}
                                                </span>
                                            )}
                                        </span>
                                    </button>
                                ))}
                            </div>
                        )}

                        {/* ── Not yet ── */}
                        {below.length > 0 && (
                            <div className="glass" style={{ marginTop: 16, padding: '4px 20px 14px' }}>
                                <p style={{ margin: '14px 0 2px', fontSize: 9, fontWeight: 800, letterSpacing: '0.12em', textTransform: 'uppercase', color: 'var(--text-tertiary)' }}>
                                    {t('tonight.belowHorizon')}
                                </p>
                                {below.map(b => (
                                    <div
                                        key={b.id}
                                        className="flex flex-wrap items-baseline gap-x-3"
                                        style={{ padding: '9px 0', borderTop: '1px solid rgba(255,255,255,0.06)' }}
                                    >
                                        <span style={{ fontSize: '0.9rem', fontWeight: 600, color: 'var(--text-secondary)', minWidth: 74 }}>
                                            {bodyName(b.name)}
                                        </span>
                                        <span style={{ marginInlineStart: 'auto', fontSize: '0.78rem', color: 'var(--text-tertiary)' }}>
                                            {b.eventAt
                                                ? t('tonight.rises', { time: fmtTime(b.eventAt) })
                                                : t('tonight.notUpToday')}
                                        </span>
                                    </div>
                                ))}
                            </div>
                        )}

                        {eventsPanel}

                        <div className="flex flex-wrap items-center justify-center gap-2" style={{ marginTop: 16 }}>
                            <button
                                onClick={request}
                                className="flex items-center gap-2 rounded-xl font-bold focus-ring"
                                style={{
                                    padding: '9px 14px', fontSize: '0.8rem',
                                    background: 'rgba(255,255,255,0.06)',
                                    border: '1px solid rgba(255,255,255,0.14)',
                                    color: 'rgba(255,255,255,0.85)', cursor: 'pointer',
                                }}
                            >
                                <MapPin style={{ width: 14, height: 14 }} />
                                {t('tonight.updateLocation')}
                            </button>
                            <button
                                onClick={forget}
                                className="rounded-xl focus-ring"
                                style={{
                                    padding: '9px 14px', fontSize: '0.8rem', fontWeight: 700,
                                    background: 'none', border: '1px solid rgba(255,255,255,0.10)',
                                    color: 'var(--text-tertiary)', cursor: 'pointer',
                                }}
                            >
                                {t('tonight.forget')}
                            </button>
                            <button
                                onClick={() => navigate('/satellites')}
                                className="flex items-center gap-1.5 rounded-xl font-bold focus-ring"
                                style={{
                                    padding: '9px 14px', fontSize: '0.8rem',
                                    background: 'rgba(255,255,255,0.06)',
                                    border: '1px solid rgba(255,255,255,0.14)',
                                    color: 'rgba(255,255,255,0.85)', cursor: 'pointer',
                                }}
                            >
                                {t('tonight.trackSatellite')}
                                <ArrowUpRight style={{ width: 14, height: 14 }} />
                            </button>
                        </div>

                        <p style={{ marginTop: 14, fontSize: 11, color: 'var(--text-tertiary)', textAlign: 'center' }}>
                            {t('tonight.footnote')}
                        </p>
                    </>
                )}
            </div>
        </div>
    );
};

export default TonightPage;
