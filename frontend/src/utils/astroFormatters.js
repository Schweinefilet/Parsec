// Formatters for astronomical quantities

export const fmtAU = (au) =>
    au != null ? `${Number(au).toFixed(3)} AU` : '—';

export const fmtKmPerSec = (v) =>
    v != null ? `${Number(v).toFixed(2)} km/s` : '—';

export const fmtKm = (km) => {
    if (km == null) return '—';
    const n = Number(km);
    if (n >= 1e9) return `${(n / 1e9).toFixed(2)}B km`;
    if (n >= 1e6) return `${(n / 1e6).toFixed(2)}M km`;
    if (n >= 1e3) return `${(n / 1e3).toFixed(1)}K km`;
    return `${n.toFixed(0)} km`;
};

export const fmtDays = (days) => {
    if (days == null) return '—';
    const d = Number(days);
    if (d >= 365.25 * 2) return `${(d / 365.25).toFixed(2)} yr`;
    if (d >= 365.25)     return `${(d / 365.25).toFixed(2)} yr`;
    return `${d.toFixed(2)} d`;
};

export const fmtMassEarth = (m) =>
    m != null ? `${Number(m).toFixed(3)} M⊕` : '—';

export const fmtRadiusEarth = (r) =>
    r != null ? `${Number(r).toFixed(3)} R⊕` : '—';

export const fmtMagnitude = (m) => {
    if (m == null) return '—';
    const n = Number(m);
    return n >= 0 ? `+${n.toFixed(1)}` : `${n.toFixed(1)}`;
};

export const fmtLightYears = (ly) => {
    if (ly == null) return '—';
    const n = Number(ly);
    if (n >= 1e9) return `${(n / 1e9).toFixed(2)}B ly`;
    if (n >= 1e6) return `${(n / 1e6).toFixed(2)}M ly`;
    if (n >= 1e3) return `${(n / 1e3).toFixed(1)}K ly`;
    return `${n.toFixed(1)} ly`;
};

// Current moon phase (days into the 29.53-day cycle)
export const moonPhaseDays = (date = new Date()) => {
    const knownNew = new Date(2000, 0, 6, 18, 14, 0);
    const lunarCycle = 29.53058770576;
    const elapsed = (date - knownNew) / (1000 * 60 * 60 * 24);
    return ((elapsed % lunarCycle) + lunarCycle) % lunarCycle;
};

export const moonPhaseName = (phaseDays) => {
    const f = phaseDays / 29.53;
    if (f < 0.025 || f > 0.975) return 'New Moon';
    if (f < 0.25)  return 'Waxing Crescent';
    if (f < 0.275) return 'First Quarter';
    if (f < 0.5)   return 'Waxing Gibbous';
    if (f < 0.525) return 'Full Moon';
    if (f < 0.75)  return 'Waning Gibbous';
    if (f < 0.775) return 'Last Quarter';
    return 'Waning Crescent';
};

// Compute simplified distance-from-Earth time series for a solar system body.
// Uses circular coplanar orbit approximation.
//   a          — semi-major axis in AU
//   periodDays — orbital period in days
//   lookbackDays — how many days back from today to start the series
//   phaseOffset — initial phase offset in radians (staggers planets)
//   stepDays   — data point interval in days
export const computeDistanceSeries = (
    a,
    periodDays,
    lookbackDays = 365,
    phaseOffset = 0,
    stepDays = 5,
) => {
    const nowMs = Date.now();
    const points = [];

    for (let i = -lookbackDays; i <= lookbackDays; i += stepDays) {
        const t = nowMs + i * 86400 * 1000;
        const tDays = i;

        // Earth position (circular, 1 AU, 365.25-day period)
        const earthAngle = (2 * Math.PI * tDays) / 365.25;
        const ex = Math.cos(earthAngle);
        const ey = Math.sin(earthAngle);

        // Body position (circular orbit, semi-major axis a)
        const bodyAngle = phaseOffset + (2 * Math.PI * tDays) / periodDays;
        const bx = a * Math.cos(bodyAngle);
        const by = a * Math.sin(bodyAngle);

        const distAU = Math.sqrt((bx - ex) ** 2 + (by - ey) ** 2);

        points.push({
            time: Math.floor(t / 1000), // Unix seconds — required by lightweight-charts
            value: parseFloat(distAU.toFixed(2)),
        });
    }

    return points;
};
