import { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { ChevronLeft, MapPin, Crosshair, Sun, Moon } from 'lucide-react';
import StarfieldBg from '../components/StarfieldBg';
import IssGlobe from '../components/IssGlobe';
import { useIssPosition } from '../hooks/useIssPosition';

const ISS_NORAD = 25544;
const EARTH_R_KM = 6371;

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

const Stat = ({ label, value, sub, accent }) => (
    <div>
        <p style={{
            margin: 0, fontSize: 9, fontWeight: 800, letterSpacing: '0.12em',
            textTransform: 'uppercase', color: 'var(--text-tertiary)',
        }}>
            {label}
        </p>
        <p style={{
            margin: '3px 0 0', fontSize: '1.05rem', fontWeight: 700,
            color: accent ?? '#fff', fontVariantNumeric: 'tabular-nums', lineHeight: 1.15,
        }}>
            {value}
        </p>
        {sub && (
            <p style={{ margin: '1px 0 0', fontSize: 10, color: 'var(--text-tertiary)' }}>{sub}</p>
        )}
    </div>
);

const SatelliteView = () => {
    const navigate = useNavigate();
    const iss = useIssPosition();
    const [follow, setFollow] = useState(true);
    const [observer, setObserver] = useState(null);
    const [geoError, setGeoError] = useState(null);

    // Tick once a second so "updated Ns ago" stays honest between polls
    const [, setNow] = useState(Date.now());
    useEffect(() => {
        const iv = setInterval(() => setNow(Date.now()), 1000);
        return () => clearInterval(iv);
    }, []);

    const locate = () => {
        if (!navigator.geolocation) { setGeoError('Not supported by this browser'); return; }
        setGeoError(null);
        navigator.geolocation.getCurrentPosition(
            (p) => setObserver({ lat: p.coords.latitude, lon: p.coords.longitude }),
            (err) => setGeoError(err.code === 1 ? 'Permission denied' : 'Could not get location'),
            { timeout: 10000, maximumAge: 60000 },
        );
    };

    const distanceKm = useMemo(() => {
        if (!observer || iss.lat == null) return null;
        return haversine(observer, { lat: iss.lat, lon: iss.lon });
    }, [observer, iss.lat, iss.lon]);

    const secondsAgo = iss.timestamp ? Math.max(0, Math.round((Date.now() - iss.timestamp) / 1000)) : null;
    const isDaylight = iss.visibility === 'daylight';

    return (
        <>
            <StarfieldBg canvasId="starfield-satellites" />

            <div style={{ position: 'relative', zIndex: 1, minHeight: '100vh', paddingTop: 64 }}>
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
                                ISS Live Tracker
                            </h1>
                            <p style={{ margin: '1px 0 0', fontSize: '0.72rem', color: 'var(--text-tertiary)' }}>
                                International Space Station · NORAD {ISS_NORAD}
                            </p>
                        </div>
                        <span
                            className="ml-auto flex items-center gap-1.5 flex-shrink-0"
                            style={{
                                fontSize: 10, fontWeight: 700, letterSpacing: '0.08em',
                                textTransform: 'uppercase', padding: '5px 10px', borderRadius: 999,
                                background: iss.error ? 'rgba(255,90,80,0.14)'
                                    : iss.stale ? 'rgba(255,200,60,0.14)' : 'rgba(80,220,140,0.14)',
                                border: `1px solid ${iss.error ? 'rgba(255,90,80,0.30)'
                                    : iss.stale ? 'rgba(255,200,60,0.30)' : 'rgba(80,220,140,0.30)'}`,
                                color: iss.error ? '#ff8a80' : iss.stale ? '#ffd166' : '#6ee7a0',
                            }}
                        >
                            <span style={{
                                width: 6, height: 6, borderRadius: 999, background: 'currentColor',
                                animation: iss.error || iss.stale ? 'none' : 'issPulse 2s ease-in-out infinite',
                            }} />
                            {iss.error ? 'Offline' : iss.stale ? 'Reconnecting' : 'Live'}
                        </span>
                    </div>

                    {/* ── Globe ── */}
                    <div
                        className="glass"
                        style={{
                            position: 'relative',
                            height: 'clamp(340px, 56vh, 620px)',
                            overflow: 'hidden',
                            padding: 0,
                        }}
                    >
                        <IssGlobe
                            lat={iss.lat} lon={iss.lon} altitude={iss.altitude}
                            trail={iss.trail} follow={follow} observer={observer}
                        />

                        {iss.loading && (
                            <div style={{
                                position: 'absolute', inset: 0, display: 'grid', placeItems: 'center',
                                color: 'var(--text-tertiary)', fontSize: '0.85rem', pointerEvents: 'none',
                            }}>
                                Acquiring position…
                            </div>
                        )}

                        {/* Overlay controls */}
                        <div style={{ position: 'absolute', top: 12, right: 12, display: 'flex', gap: 8 }}>
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
                                    backdropFilter: 'blur(12px)', cursor: 'pointer',
                                }}
                            >
                                <Crosshair style={{ width: 12, height: 12 }} />
                                {follow ? 'Following' : 'Free look'}
                            </button>
                        </div>

                        <p style={{
                            position: 'absolute', bottom: 10, left: 14, margin: 0,
                            fontSize: 10, color: 'rgba(255,255,255,0.35)', pointerEvents: 'none',
                        }}>
                            Drag to rotate · Scroll to zoom
                        </p>
                    </div>

                    {/* ── Telemetry ── */}
                    <div
                        className="glass"
                        style={{
                            marginTop: 16, padding: 20,
                            display: 'grid', gap: 20,
                            gridTemplateColumns: 'repeat(auto-fit, minmax(130px, 1fr))',
                        }}
                    >
                        <Stat label="Latitude" value={fmtCoord(iss.lat, 'N', 'S')} />
                        <Stat label="Longitude" value={fmtCoord(iss.lon, 'E', 'W')} />
                        <Stat
                            label="Altitude"
                            value={iss.altitude != null ? `${iss.altitude.toFixed(0)} km` : '—'}
                        />
                        <Stat
                            label="Speed"
                            value={iss.velocity != null ? `${(iss.velocity / 3600).toFixed(2)} km/s` : '—'}
                            sub={iss.velocity != null ? `${Math.round(iss.velocity).toLocaleString()} km/h` : null}
                        />
                        <Stat
                            label="Sunlight"
                            value={
                                <span className="flex items-center gap-1.5">
                                    {isDaylight
                                        ? <Sun style={{ width: 15, height: 15 }} />
                                        : <Moon style={{ width: 15, height: 15 }} />}
                                    {iss.visibility ? iss.visibility[0].toUpperCase() + iss.visibility.slice(1) : '—'}
                                </span>
                            }
                            accent={isDaylight ? '#ffd166' : '#9db4ff'}
                        />
                        <Stat
                            label="Updated"
                            value={secondsAgo == null ? '—' : secondsAgo < 2 ? 'Just now' : `${secondsAgo}s ago`}
                            sub="Polls every 5s"
                        />
                    </div>

                    {/* ── Observer ── */}
                    <div className="glass" style={{ marginTop: 16, padding: 20 }}>
                        <div className="flex flex-wrap items-center justify-between gap-4">
                            <div style={{ minWidth: 0 }}>
                                <p style={{ margin: 0, fontSize: 9, fontWeight: 800, letterSpacing: '0.12em', textTransform: 'uppercase', color: 'var(--text-tertiary)' }}>
                                    Distance from you
                                </p>
                                {observer ? (
                                    <>
                                        <p style={{ margin: '3px 0 0', fontSize: '1.35rem', fontWeight: 700, color: '#fff', fontVariantNumeric: 'tabular-nums' }}>
                                            {distanceKm != null ? `${Math.round(distanceKm).toLocaleString()} km` : '—'}
                                        </p>
                                        <p style={{ margin: '2px 0 0', fontSize: 11, color: 'var(--text-tertiary)' }}>
                                            Ground distance from {fmtCoord(observer.lat, 'N', 'S')}, {fmtCoord(observer.lon, 'E', 'W')}
                                            {distanceKm != null && distanceKm < 2000 && ' · overhead soon'}
                                        </p>
                                    </>
                                ) : (
                                    <p style={{ margin: '3px 0 0', fontSize: '0.85rem', color: 'var(--text-secondary)' }}>
                                        {geoError ?? 'Share your location to see how far away the station is.'}
                                    </p>
                                )}
                            </div>
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
                                {observer ? 'Update location' : 'Use my location'}
                            </button>
                        </div>
                    </div>

                    <p style={{ marginTop: 14, fontSize: 11, color: 'var(--text-tertiary)', textAlign: 'center' }}>
                        Position data from wheretheiss.at · Terminator computed from the current sub-solar point
                    </p>
                </div>
            </div>
        </>
    );
};

export default SatelliteView;
