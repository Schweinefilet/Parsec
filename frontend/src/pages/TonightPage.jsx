import { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { ChevronLeft, MapPin, Sun, Moon as MoonIcon, ArrowUpRight, Eye } from 'lucide-react';
import { useObserverLocation } from '../hooks/useObserverLocation';
import { skyView, VISIBILITY_LABEL } from '../utils/skyPositions';
import { PLANETS } from '../data/solarSystemBodies';

const BODY_COLOR = {
    luna: '#d8d8e0',
    ...Object.fromEntries(PLANETS.map(p => [p.id, p.color])),
};

const fmtTime = (d) => d
    ? d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
    : null;

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
        <div style={{ overflowX: 'auto', overflowY: 'hidden' }}>
            <svg
                viewBox={`0 0 ${W} ${H}`}
                role="img"
                aria-label={`Sky chart: ${up.length} bodies above the horizon`}
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
                {[['N', 0], ['E', 90], ['S', 180], ['W', 270], ['N', 360]].map(([label, az], i) => (
                    <g key={i}>
                        <line x1={x(az)} x2={x(az)} y1={22} y2={GROUND}
                            stroke="rgba(255,255,255,0.07)" />
                        <text x={x(az)} y={H - 8} fill="rgba(255,255,255,0.5)" fontSize={11}
                            fontWeight="700" textAnchor={i === 0 ? 'start' : i === 4 ? 'end' : 'middle'}>
                            {label}
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
                                {b.name}
                            </text>
                        </g>
                    );
                })}
            </svg>
        </div>
    );
};

const TonightPage = () => {
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

    return (
        <div style={{ position: 'relative', zIndex: 1, minHeight: 'var(--app-vh, 100vh)', paddingTop: 64 }}>
            <div style={{ maxWidth: 1180, margin: '0 auto', padding: '0 16px 40px' }}>

                {/* ── Header ── */}
                <div className="flex items-center gap-3 mb-4">
                    <button
                        onClick={() => navigate(-1)}
                        aria-label="Go back"
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
                            What&rsquo;s up tonight
                        </h1>
                        <p style={{ margin: '1px 0 0', fontSize: '0.72rem', color: 'var(--text-tertiary)' }}>
                            {location
                                ? `From ${Math.abs(location.lat).toFixed(2)}°${location.lat >= 0 ? 'N' : 'S'}, ${Math.abs(location.lon).toFixed(2)}°${location.lon >= 0 ? 'E' : 'W'} · ${now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`
                                : 'The planets above you, and which way to look'}
                        </p>
                    </div>
                    {view && (
                        <span
                            className="ml-auto flex items-center gap-1.5 flex-shrink-0"
                            style={{
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
                            {view.twilight.label}
                        </span>
                    )}
                </div>

                {!location ? (
                    <div className="glass" style={{ padding: 28, textAlign: 'center' }}>
                        <Eye style={{ width: 26, height: 26, color: 'var(--accent)', margin: '0 auto 10px' }} />
                        <p style={{ margin: 0, fontSize: '1.05rem', fontWeight: 700, color: '#fff' }}>
                            Where are you standing?
                        </p>
                        <p style={{ margin: '6px auto 0', maxWidth: 460, fontSize: '0.85rem', color: 'var(--text-secondary)' }}>
                            Which planets are above your horizon depends entirely on where you are.
                            Your location stays in this browser — the sky is worked out on your device,
                            and nothing is sent anywhere.
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
                            {asking ? 'Asking…' : 'Use my location'}
                        </button>
                    </div>
                ) : (
                    <>
                        {/* ── The sky ── */}
                        <div className="glass" style={{ padding: '16px 8px 8px' }}>
                            <SkyPanorama bodies={view.bodies} />
                            <p style={{ margin: '4px 12px 6px', fontSize: 11, color: 'var(--text-tertiary)', textAlign: 'center' }}>
                                {upNow.length === 0
                                    ? 'Nothing above your horizon right now'
                                    : `${upNow.length} above the horizon · the bar is the view all the way round, from north back to north`}
                                {!view.twilight.dark && upNow.length > 0
                                    && ' · the sky is still too bright for the fainter ones'}
                            </p>
                        </div>

                        {/* ── Up now ── */}
                        {upNow.length > 0 && (
                            <div className="glass" style={{ marginTop: 16, padding: '4px 20px 14px' }}>
                                <p style={{ margin: '14px 0 2px', fontSize: 9, fontWeight: 800, letterSpacing: '0.12em', textTransform: 'uppercase', color: 'var(--text-tertiary)' }}>
                                    Above the horizon
                                </p>
                                {upNow.map(b => (
                                    <button
                                        key={b.id}
                                        onClick={() => navigate(`/object/${b.id}`)}
                                        className="w-full flex flex-wrap items-baseline gap-x-3 gap-y-1 focus-ring"
                                        style={{
                                            padding: '11px 0', textAlign: 'left', cursor: 'pointer',
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
                                            {b.name}
                                        </span>
                                        <span style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>
                                            Look <strong style={{ color: '#fff' }}>{b.compass}</strong>, {b.where}
                                            {' '}<span style={{ color: 'var(--text-tertiary)', fontVariantNumeric: 'tabular-nums' }}>
                                                ({b.altitude.toFixed(0)}° up)
                                            </span>
                                        </span>
                                        <span className="ml-auto flex items-center gap-3 flex-shrink-0">
                                            {b.id === 'luna' && b.illuminated != null && (
                                                <span style={{ fontSize: '0.75rem', color: 'var(--text-tertiary)' }}>
                                                    {Math.round(b.illuminated * 100)}% lit
                                                </span>
                                            )}
                                            <span style={{ fontSize: '0.75rem', color: 'var(--text-tertiary)', fontVariantNumeric: 'tabular-nums' }}>
                                                mag {b.magnitude?.toFixed(1) ?? '—'}
                                            </span>
                                            <span style={{
                                                fontSize: '0.68rem', fontWeight: 700, padding: '3px 8px', borderRadius: 999,
                                                background: b.visibility === 'naked-eye' ? 'rgba(80,220,140,0.14)' : 'rgba(255,255,255,0.06)',
                                                border: `1px solid ${b.visibility === 'naked-eye' ? 'rgba(80,220,140,0.28)' : 'rgba(255,255,255,0.12)'}`,
                                                color: b.visibility === 'naked-eye' ? '#6ee7a0' : 'var(--text-secondary)',
                                                whiteSpace: 'nowrap',
                                            }}>
                                                {VISIBILITY_LABEL[b.visibility]}
                                            </span>
                                            {b.eventAt && (
                                                <span style={{ fontSize: '0.72rem', color: 'var(--text-tertiary)', whiteSpace: 'nowrap' }}>
                                                    sets {fmtTime(b.eventAt)}
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
                                    Below the horizon
                                </p>
                                {below.map(b => (
                                    <div
                                        key={b.id}
                                        className="flex flex-wrap items-baseline gap-x-3"
                                        style={{ padding: '9px 0', borderTop: '1px solid rgba(255,255,255,0.06)' }}
                                    >
                                        <span style={{ fontSize: '0.9rem', fontWeight: 600, color: 'var(--text-secondary)', minWidth: 74 }}>
                                            {b.name}
                                        </span>
                                        <span className="ml-auto" style={{ fontSize: '0.78rem', color: 'var(--text-tertiary)' }}>
                                            {b.eventAt ? `rises ${fmtTime(b.eventAt)}` : 'not up today'}
                                        </span>
                                    </div>
                                ))}
                            </div>
                        )}

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
                                Update location
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
                                Forget it
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
                                Track a satellite
                                <ArrowUpRight style={{ width: 14, height: 14 }} />
                            </button>
                        </div>

                        <p style={{ marginTop: 14, fontSize: 11, color: 'var(--text-tertiary)', textAlign: 'center' }}>
                            Positions computed on your device from your latitude and longitude ·
                            Altitudes include atmospheric refraction · Magnitudes are current, not average
                        </p>
                    </>
                )}
            </div>
        </div>
    );
};

export default TonightPage;
