import { useState, useEffect, useMemo } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { ChevronLeft, MapPin, Crosshair, Sun, Moon, ArrowUpRight } from 'lucide-react';
import SatelliteGlobe from '../components/SatelliteGlobe';
import { useSatelliteTracking } from '../hooks/useSatelliteTracking';
import { useNearestCountry } from '../hooks/useNearestCountry';
import { SATELLITES, DEFAULT_SATELLITE, satelliteById } from '../data/trackedSatellites';

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

const fmtAge = (date) => {
    if (!date) return null;
    const hours = (Date.now() - date.getTime()) / 3600000;
    if (hours < 1) return `${Math.max(1, Math.round(hours * 60))} min old`;
    if (hours < 48) return `${Math.round(hours)} h old`;
    return `${Math.round(hours / 24)} days old`;
};

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

/**
 * One spacecraft in the picker. Doubles as the legend — the dot is the same
 * colour it is drawn in on the globe, so there is nothing to cross-reference.
 */
const SatelliteChip = ({ def, fix, selected, onSelect }) => {
    const live = !!fix;
    return (
        <button
            type="button"
            onClick={() => onSelect(def.id)}
            aria-pressed={selected}
            className="flex items-center gap-2 rounded-full focus-ring flex-shrink-0"
            style={{
                padding: '7px 14px 7px 11px',
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
                {def.shortName}
            </span>
            <span style={{ fontSize: '0.68rem', color: 'var(--text-tertiary)', fontVariantNumeric: 'tabular-nums' }}>
                {live ? `${fix.altitude.toFixed(0)} km` : '—'}
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

    // Tick once a second so the elements-age readout stays honest
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
        if (!observer || !selected) return null;
        return haversine(observer, { lat: selected.lat, lon: selected.lon });
    }, [observer, selected]);

    const nearest = useNearestCountry(selected?.lat, selected?.lon);
    const overhead = nearest != null && nearest.km < 75;

    // Within its own footprint is the honest test for "you could see it go over"
    const inRange = distanceKm != null && selected?.footprintKm != null
        && distanceKm < selected.footprintKm;

    const elementsAge = fmtAge(selected?.elementsEpoch);
    const statusLabel = status === 'error' ? 'No elements'
        : status === 'loading' ? 'Loading'
        : status === 'partial' ? 'Partial' : 'Live';
    const statusOk = status === 'ready';

    return (
        <>
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
                                Satellite Tracker
                            </h1>
                            <p style={{ margin: '1px 0 0', fontSize: '0.72rem', color: 'var(--text-tertiary)' }}>
                                {def.name} · NORAD {def.norad}
                            </p>
                        </div>
                        <span
                            className="ml-auto flex items-center gap-1.5 flex-shrink-0"
                            style={{
                                fontSize: 10, fontWeight: 700, letterSpacing: '0.08em',
                                textTransform: 'uppercase', padding: '5px 10px', borderRadius: 999,
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
                    </div>

                    {/* ── Which spacecraft ── */}
                    {/* The picker is the legend. Each chip carries the colour its
                        dot is drawn in and its current altitude, so choosing one
                        and reading the globe are the same action. */}
                    <div
                        className="flex items-center gap-2 mb-3"
                        style={{ overflowX: 'auto', paddingBottom: 2 }}
                        role="group"
                        aria-label="Choose a spacecraft to follow"
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
                    <div
                        className="glass"
                        style={{
                            position: 'relative',
                            height: 'clamp(340px, 56vh, 620px)',
                            overflow: 'hidden',
                            padding: 0,
                        }}
                    >
                        <SatelliteGlobe
                            satellites={satellites}
                            selectedId={selectedId}
                            track={track}
                            follow={follow}
                            observer={observer}
                        />

                        {status !== 'ready' && satellites.length === 0 && (
                            <div style={{
                                position: 'absolute', inset: 0, display: 'flex',
                                alignItems: 'center', justifyContent: 'center',
                                color: 'var(--text-tertiary)', fontSize: '0.85rem', pointerEvents: 'none',
                            }}>
                                {status === 'error'
                                    ? 'Could not reach the orbital element service.'
                                    : 'Fetching orbital elements…'}
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
                                    backdropFilter: 'blur(12px)',
                                    WebkitBackdropFilter: 'blur(12px)',
                                    cursor: 'pointer',
                                }}
                            >
                                <Crosshair style={{ width: 12, height: 12 }} />
                                {follow ? `Following ${def.shortName}` : 'Free look'}
                            </button>
                        </div>

                        <p style={{
                            position: 'absolute', bottom: 10, left: 14, margin: 0,
                            fontSize: 10, color: 'rgba(255,255,255,0.35)', pointerEvents: 'none',
                        }}>
                            Orbit shown for {def.shortName}, one revolution · Drag to rotate · Scroll to zoom
                        </p>
                    </div>

                    {/* ── Telemetry for the selected craft ── */}
                    <div
                        className="glass"
                        style={{
                            marginTop: 16, padding: 20,
                            display: 'grid', gap: 20,
                            gridTemplateColumns: 'repeat(auto-fit, minmax(130px, 1fr))',
                        }}
                    >
                        <Stat label="Latitude" value={fmtCoord(selected?.lat, 'N', 'S')} />
                        <Stat label="Longitude" value={fmtCoord(selected?.lon, 'E', 'W')} />
                        <Stat
                            label="Nearest country"
                            value={nearest?.name ?? '—'}
                            sub={
                                nearest == null ? null
                                : overhead ? 'Overhead'
                                : `${Math.round(nearest.km).toLocaleString()} km away`
                            }
                            accent={overhead ? '#6ee7a0' : undefined}
                        />
                        <Stat
                            label="Altitude"
                            value={selected ? `${selected.altitude.toFixed(0)} km` : '—'}
                            sub={selected ? `sees ${Math.round(selected.footprintKm).toLocaleString()} km to the horizon` : null}
                        />
                        <Stat
                            label="Speed"
                            value={selected?.velocity != null ? `${selected.velocity.toFixed(2)} km/s` : '—'}
                            sub={selected?.velocity != null
                                ? `${Math.round(selected.velocity * 3600).toLocaleString()} km/h` : null}
                        />
                        <Stat
                            label="Sunlight"
                            value={
                                <span className="flex items-center gap-1.5">
                                    {selected?.sunlit
                                        ? <Sun style={{ width: 15, height: 15 }} />
                                        : <Moon style={{ width: 15, height: 15 }} />}
                                    {selected == null ? '—' : selected.sunlit ? 'Daylight' : 'Eclipsed'}
                                </span>
                            }
                            accent={selected?.sunlit ? '#ffd166' : '#9db4ff'}
                        />
                        <Stat
                            label="Orbital period"
                            value={selected?.periodMinutes ? `${selected.periodMinutes.toFixed(1)} min` : '—'}
                            sub={selected?.periodMinutes
                                ? `${(1440 / selected.periodMinutes).toFixed(1)} orbits a day` : null}
                        />
                        <Stat
                            label="Elements"
                            value={elementsAge ?? '—'}
                            sub="CelesTrak, refreshed 6-hourly"
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
                                            Ground distance to {def.shortName} from {fmtCoord(observer.lat, 'N', 'S')}, {fmtCoord(observer.lon, 'E', 'W')}
                                            {inRange && ' · above your horizon now'}
                                        </p>
                                    </>
                                ) : (
                                    <p style={{ margin: '3px 0 0', fontSize: '0.85rem', color: 'var(--text-secondary)' }}>
                                        {geoError ?? `Share your location to see how far away ${def.shortName} is.`}
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
                                    About {def.shortName}
                                    <ArrowUpRight style={{ width: 14, height: 14 }} />
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
                                    {observer ? 'Update location' : 'Use my location'}
                                </button>
                            </div>
                        </div>
                    </div>

                    <p style={{ marginTop: 14, fontSize: 11, color: 'var(--text-tertiary)', textAlign: 'center' }}>
                        Positions propagated with SGP4 from CelesTrak orbital elements ·
                        Terminator computed from the current sub-solar point ·
                        Nearest country measured against Natural Earth coastlines
                    </p>
                </div>
            </div>
        </>
    );
};

export default SatelliteView;
