import * as Astronomy from 'astronomy-engine';

// Where the planets are in the sky from where you are standing, right now.
//
// The scene elsewhere on this site is heliocentric — it shows where things are
// in the solar system. This is the other question, and the one you ask when you
// walk outside: what is above the horizon, how high, and which way do I face.
// Same ephemeris, different frame: astronomy-engine turns a position and an
// observer into an altitude and an azimuth, and everything here is arranged
// around that one call.

/** What the tracker follows, in the order they sit out from the Sun. */
export const SKY_BODIES = [
    { body: 'Moon',    id: 'luna',    name: 'Moon' },
    { body: 'Mercury', id: 'mercury', name: 'Mercury' },
    { body: 'Venus',   id: 'venus',   name: 'Venus' },
    { body: 'Mars',    id: 'mars',    name: 'Mars' },
    { body: 'Jupiter', id: 'jupiter', name: 'Jupiter' },
    { body: 'Saturn',  id: 'saturn',  name: 'Saturn' },
    { body: 'Uranus',  id: 'uranus',  name: 'Uranus' },
    { body: 'Neptune', id: 'neptune', name: 'Neptune' },
];

/**
 * Azimuth in degrees to one of the sixteen compass points, as an index.
 *
 * An index rather than a name, because the names are not composable across
 * languages: English builds "NNE" from three initials, and Arabic cannot —
 * شمال and شرق both begin with ش, so a letter compass would be ambiguous in
 * exactly the situation it exists for, which is telling someone which way to
 * turn. Each locale spells all sixteen out; see `sky.compass`.
 */
export function compassIndex(azimuth) {
    const a = ((azimuth % 360) + 360) % 360;
    return Math.round(a / 22.5) % 16;
}

/**
 * How dark it is, from the Sun's altitude.
 *
 * The conventional boundaries: the Sun is up, or it is within 6° of the horizon
 * and you can still read outside, or 12°, or 18°, past which the sky is as dark
 * as it will get. Planets do not need real darkness — Venus is visible in broad
 * daylight if you know where to look — but faint ones do.
 */
export function twilightPhase(sunAltitude) {
    if (sunAltitude > -0.833) return { phase: 'day', labelKey: 'sky.twilightDay', dark: false };
    if (sunAltitude > -6) return { phase: 'civil', labelKey: 'sky.twilightCivil', dark: false };
    if (sunAltitude > -12) return { phase: 'nautical', labelKey: 'sky.twilightNautical', dark: false };
    if (sunAltitude > -18) return { phase: 'astronomical', labelKey: 'sky.twilightAstronomical', dark: true };
    return { phase: 'night', labelKey: 'sky.twilightNight', dark: true };
}

/**
 * What it takes to see something of this brightness.
 *
 * The naked-eye limit is about magnitude 6 under a genuinely dark sky and
 * nearer 4 from a town, so the boundary is drawn where it stops being a
 * reasonable claim rather than at the textbook number.
 */
export function visibilityFor(magnitude) {
    if (magnitude == null || !Number.isFinite(magnitude)) return 'unknown';
    if (magnitude <= 4.5) return 'naked-eye';
    if (magnitude <= 6.5) return 'dark-sky';
    if (magnitude <= 10) return 'binoculars';
    return 'telescope';
}

export const VISIBILITY_KEY = {
    'naked-eye': 'sky.visibilityNakedEye',
    'dark-sky': 'sky.visibilityDarkSky',
    binoculars: 'sky.visibilityBinoculars',
    telescope: 'sky.visibilityTelescope',
    unknown: 'sky.visibilityUnknown',
};

/** Plain words for an altitude, because degrees are not how people look up. */
export function altitudeKey(altitude) {
    if (altitude < 0) return 'sky.altBelow';
    if (altitude < 10) return 'sky.altJustAbove';
    if (altitude < 30) return 'sky.altLow';
    if (altitude < 60) return 'sky.altHigh';
    return 'sky.altOverhead';
}

function riseSet(body, observer, date, up) {
    try {
        // A day is enough to find the next one for anything that rises at all;
        // null comes back for a body that is circumpolar or never up, and both
        // are answers rather than failures.
        const found = Astronomy.SearchRiseSet(body, observer, up ? -1 : +1, date, 1);
        return found ? found.date : null;
    } catch {
        return null;
    }
}

/**
 * The sky from one place at one moment.
 *
 * @param {{lat:number, lon:number}} where
 * @param {Date} date
 */
export function skyView(where, date = new Date()) {
    const observer = new Astronomy.Observer(where.lat, where.lon, 0);

    const sunEq = Astronomy.Equator('Sun', date, observer, true, true);
    const sunHz = Astronomy.Horizon(date, observer, sunEq.ra, sunEq.dec, 'normal');
    const twilight = { ...twilightPhase(sunHz.altitude), sunAltitude: sunHz.altitude };

    const bodies = SKY_BODIES.map((entry) => {
        const eq = Astronomy.Equator(entry.body, date, observer, true, true);
        const hz = Astronomy.Horizon(date, observer, eq.ra, eq.dec, 'normal');
        let magnitude = null;
        let illuminated = null;
        try {
            const ill = Astronomy.Illumination(entry.body, date);
            magnitude = ill.mag;
            illuminated = ill.phase_fraction;
        } catch { /* a body without an illumination model is still a position */ }

        const up = hz.altitude > 0;
        return {
            ...entry,
            altitude: hz.altitude,
            azimuth: hz.azimuth,
            compass: compassIndex(hz.azimuth),
            magnitude,
            illuminated,
            up,
            visibility: visibilityFor(magnitude),
            whereKey: altitudeKey(hz.altitude),
            // For something up, when it goes; for something down, when it comes
            eventAt: riseSet(entry.body, observer, date, up),
        };
    });

    // Up first, brightest first — the order you would actually go looking in.
    bodies.sort((a, b) => {
        if (a.up !== b.up) return a.up ? -1 : 1;
        if (a.up) return (a.magnitude ?? 99) - (b.magnitude ?? 99);
        return (b.altitude) - (a.altitude);   // below: closest to rising first
    });

    return { twilight, bodies, sun: { altitude: sunHz.altitude, azimuth: sunHz.azimuth } };
}
