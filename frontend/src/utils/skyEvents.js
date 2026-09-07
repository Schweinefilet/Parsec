import * as Astronomy from 'astronomy-engine';

// What is worth going outside for, between now and a year from now.
//
// The site has had a clock that reaches ten years either way and nothing to
// point it at. This is the other half: the handful of moments where something
// actually happens, computed from the same ephemeris everything else uses, so
// the scrubber has somewhere to go and the sky page has a future as well as a
// present.
//
// Selection is the work here, not computation. A year holds fifty-two moon
// quarters and twenty-six lunar apsides, and a list of ninety things is a list
// nobody reads. Each event carries a rank so the page can lead with the
// eclipse and keep the full moons underneath.
//
// The whole scan is around 30ms on a laptop and a few hundred on a slow phone,
// which is why it is a pure function over a window: run it once, keep the
// answer, and never put it near a render loop.

/** 3 leads the page, 2 is worth knowing, 1 is the regular rhythm of the sky. */
export const RANK = { headline: 3, notable: 2, routine: 1 };

const DAY_MS = 86400000;
// Eclipses visible from one spot are rare enough that a year's window would
// usually come back empty, and "no eclipse for you" is a worse answer than
// "yours is in 2027". Solar eclipses get a longer horizon than everything else.
const ECLIPSE_HORIZON_DAYS = 2200;
// Every loop is bounded. A search that fails to advance would otherwise spin.
const MAX_PER_KIND = 40;

// Opposition is the best night of the year for any of them, but only three are
// something you can then walk outside and see. Uranus sits at magnitude 5.7 at
// its very best and Neptune at 7.8, so theirs is a date for someone with
// binoculars rather than a headline.
const OUTER = [
    { body: 'Mars', naked: true },
    { body: 'Jupiter', naked: true },
    { body: 'Saturn', naked: true },
    { body: 'Uranus', naked: false },
    { body: 'Neptune', naked: false },
];
const INNER = ['Mercury', 'Venus'];

// Peak nights, which barely move from year to year, and the rate a good one
// delivers. Not computed — a shower is a date in the calendar, not a solution
// to an equation — but they are among the few sky events most people have
// actually heard of, so leaving them out would be strange.
const SHOWERS = [
    { name: 'Quadrantids', month: 1, day: 3, zhr: 110 },
    { name: 'Lyrids', month: 4, day: 22, zhr: 18 },
    { name: 'Eta Aquariids', month: 5, day: 6, zhr: 50 },
    { name: 'Perseids', month: 8, day: 12, zhr: 100 },
    { name: 'Orionids', month: 10, day: 21, zhr: 20 },
    { name: 'Leonids', month: 11, day: 17, zhr: 15 },
    { name: 'Geminids', month: 12, day: 14, zhr: 150 },
    { name: 'Ursids', month: 12, day: 22, zhr: 10 },
];

const ECLIPSE_WORD = {
    total: 'Total', annular: 'Annular', partial: 'Partial', penumbral: 'Penumbral',
};

const at = (d) => (d instanceof Date ? d : d?.date ?? null);

/**
 * Sky events between `from` and `days` later, most notable kinds first.
 *
 * @param {{lat:number, lon:number}|null} where  the observer, for anything
 *        that depends on standing somewhere — chiefly solar eclipses
 */
export function findEvents(where = null, { from = new Date(), days = 365, limit = 40 } = {}) {
    const until = new Date(from.getTime() + days * DAY_MS);
    const events = [];
    const push = (e) => { if (e.at && e.at >= from) events.push(e); };
    const within = (d) => d && d <= until;

    // ── Solar eclipses, as seen from where the person is ──────────────────
    if (where) {
        try {
            const observer = new Astronomy.Observer(where.lat, where.lon, 0);
            const found = Astronomy.SearchLocalSolarEclipse(from, observer);
            const when = at(found?.peak?.time);
            const horizon = new Date(from.getTime() + ECLIPSE_HORIZON_DAYS * DAY_MS);
            if (when && when <= horizon) {
                const pct = Math.round((found.obscuration ?? 0) * 100);
                push({
                    id: `solar-${when.toISOString()}`,
                    kind: 'solar-eclipse',
                    rank: RANK.headline,
                    at: when,
                    title: `${ECLIPSE_WORD[found.kind] ?? 'Solar'} eclipse of the Sun`,
                    detail: pct > 0
                        ? `${pct}% of the Sun covered from where you are`
                        : 'Visible from your location',
                });
            }
        } catch { /* a location the search cannot resolve is not a crash */ }
    }

    // ── Lunar eclipses, which anyone on the night side can see ────────────
    try {
        let e = Astronomy.SearchLunarEclipse(from);
        for (let i = 0; i < MAX_PER_KIND && within(at(e?.peak)); i++) {
            const when = at(e.peak);
            // A penumbral eclipse is a barely perceptible shading; listing it
            // beside a total one would be overselling it.
            const notable = e.kind !== 'penumbral';
            push({
                id: `lunar-${when.toISOString()}`,
                kind: 'lunar-eclipse',
                rank: notable ? RANK.headline : RANK.routine,
                at: when,
                title: `${ECLIPSE_WORD[e.kind] ?? ''} lunar eclipse`.trim(),
                detail: notable
                    ? 'The Moon passes through Earth’s shadow — visible wherever it is up'
                    : 'A faint shading of the Moon, easy to miss',
            });
            e = Astronomy.NextLunarEclipse(e.peak);
        }
    } catch { /* leave the kind out rather than the whole list */ }

    // ── Oppositions: the night a planet is up all night and at its best ───
    for (const { body, naked } of OUTER) {
        try {
            // Zero, not 180. SearchRelativeLongitude measures the angle
            // between Earth and the planet as seen from the Sun, so for an
            // outer planet opposition is 0 and 180 is solar conjunction. With
            // 180 this listed every planet on the one night it is lost in the
            // glare and called it "at its brightest, rises at sunset" — and
            // dropped Mars entirely, its conjunction falling outside the year.
            const when = at(Astronomy.SearchRelativeLongitude(body, 0, from));
            if (!within(when)) continue;
            push({
                id: `opp-${body}-${when.toISOString()}`,
                kind: 'opposition',
                rank: naked ? RANK.headline : RANK.notable,
                at: when,
                body,
                title: `${body} at opposition`,
                detail: `Opposite the Sun — ${body} rises at sunset, sets at sunrise, and is at its `
                    + `brightest${naked ? '' : ', though still needs binoculars'}`,
            });
        } catch { /* skip this body */ }
    }

    // ── Greatest elongation: the fortnight Mercury is findable at all ─────
    for (const body of INNER) {
        try {
            let e = Astronomy.SearchMaxElongation(body, from);
            for (let i = 0; i < MAX_PER_KIND && within(at(e?.time)); i++) {
                const when = at(e.time);
                push({
                    id: `elong-${body}-${when.toISOString()}`,
                    kind: 'elongation',
                    rank: RANK.notable,
                    at: when,
                    body,
                    title: `${body} at greatest ${e.visibility} elongation`,
                    detail: `${e.elongation.toFixed(0)}° from the Sun — as far from the glare as it gets, `
                        + `${e.visibility === 'morning' ? 'before dawn' : 'after sunset'}`,
                });
                e = Astronomy.SearchMaxElongation(body, new Date(when.getTime() + DAY_MS));
            }
        } catch { /* skip this body */ }
    }

    // ── Full and new moons, and the perigee ones people call supermoons ───
    const perigees = [];
    try {
        let a = Astronomy.SearchLunarApsis(from);
        for (let i = 0; i < MAX_PER_KIND && within(at(a?.time)); i++) {
            if (a.kind === 0) perigees.push({ at: at(a.time), km: a.dist_km });
            a = Astronomy.NextLunarApsis(a);
        }
    } catch { /* supermoon detection is a bonus, not a requirement */ }

    // A lunar eclipse only ever happens at full moon, so listing both is the
    // same night twice, with the duller of the two second.
    const eclipseNights = events
        .filter(e => e.kind === 'lunar-eclipse')
        .map(e => e.at.getTime());

    try {
        let q = Astronomy.SearchMoonQuarter(from);
        for (let i = 0; i < 60 && within(at(q?.time)); i++) {
            const when = at(q.time);
            const isFull = q.quarter === 2;
            const isNew = q.quarter === 0;
            const eclipsed = isFull && eclipseNights.some(t => Math.abs(t - when) < DAY_MS);
            if ((isFull || isNew) && !eclipsed) {
                // A full moon within a day of a close perigee is the one that
                // gets called a supermoon; it is perhaps 7% wider than average,
                // which is real but far less than the name suggests.
                const near = isFull && perigees.find(p =>
                    Math.abs(p.at - when) < DAY_MS && p.km < 360000);
                push({
                    id: `moon-${when.toISOString()}`,
                    kind: isFull ? 'full-moon' : 'new-moon',
                    rank: near ? RANK.notable : RANK.routine,
                    at: when,
                    title: near ? 'Supermoon' : isFull ? 'Full moon' : 'New moon',
                    detail: near
                        ? `Full moon at perigee, ${Math.round(near.km).toLocaleString()} km away — `
                          + 'about 7% wider than an average full moon'
                        : isFull
                            ? 'Up all night, and bright enough to wash out everything faint'
                            : 'No moon in the sky — the darkest nights of the month',
                });
            }
            q = Astronomy.NextMoonQuarter(q);
        }
    } catch { /* leave the kind out */ }

    // ── Meteor showers ────────────────────────────────────────────────────
    for (const s of SHOWERS) {
        for (const year of [from.getUTCFullYear(), from.getUTCFullYear() + 1]) {
            const when = new Date(Date.UTC(year, s.month - 1, s.day, 2));
            if (!within(when) || when < from) continue;
            push({
                id: `shower-${s.name}-${year}`,
                kind: 'meteor-shower',
                rank: s.zhr >= 80 ? RANK.notable : RANK.routine,
                at: when,
                title: `${s.name} peak`,
                detail: `Up to about ${s.zhr} an hour under a dark sky with the Moon out of the way`,
            });
        }
    }

    // Choose by importance, then present by date. Sorting by date and cutting
    // at the limit fills the list with full moons and drops the eclipse and
    // both oppositions off the end, which is exactly backwards: those are the
    // reason anyone opened the page.
    events.sort((a, b) => b.rank - a.rank || a.at - b.at);
    const kept = events.slice(0, limit);
    kept.sort((a, b) => a.at - b.at);
    return kept;
}

/** Days from now, for a countdown. Negative means it has passed. */
export function daysUntil(when, from = new Date()) {
    return (when.getTime() - from.getTime()) / DAY_MS;
}

/** "in 3 days", "tomorrow", "in 4 months" — a countdown people read. */
export function whenWords(when, from = new Date()) {
    const d = daysUntil(when, from);
    if (d < 0) return 'passed';
    if (d < 1) return 'today';
    if (d < 2) return 'tomorrow';
    if (d < 14) return `in ${Math.round(d)} days`;
    if (d < 60) return `in ${Math.round(d / 7)} weeks`;
    if (d < 400) return `in ${Math.round(d / 30.44)} months`;
    return `in ${(d / 365.25).toFixed(1)} years`;
}
