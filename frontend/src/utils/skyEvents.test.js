import { describe, it, expect } from 'vitest';
import * as Astronomy from 'astronomy-engine';
import { findEvents, whenWords, daysUntil, RANK } from './skyEvents';

const LONDON = { lat: 51.48, lon: -0.13 };
const FROM = new Date('2026-09-07T00:00:00Z');
const kinds = (evts) => [...new Set(evts.map(e => e.kind))].sort();
const of = (evts, kind) => evts.filter(e => e.kind === kind);

describe('findEvents', () => {
    const year = findEvents(LONDON, { from: FROM, days: 365, limit: 60 });

    it('returns a readable list, not everything the sky does', () => {
        // A year holds 52 moon quarters and 26 apsides on its own; a list of
        // ninety is a list nobody reads.
        expect(year.length).toBeGreaterThan(10);
        expect(year.length).toBeLessThanOrEqual(60);
    });

    it('is in date order and starts no earlier than asked', () => {
        for (let i = 1; i < year.length; i++) {
            expect(year[i].at.getTime()).toBeGreaterThanOrEqual(year[i - 1].at.getTime());
        }
        expect(year[0].at.getTime()).toBeGreaterThanOrEqual(FROM.getTime());
    });

    it('gives every event the fields the page renders', () => {
        for (const e of year) {
            expect(typeof e.id, e.kind).toBe('string');
            expect(e.at instanceof Date).toBe(true);
            expect(e.title.length, e.id).toBeGreaterThan(0);
            expect(e.detail.length, e.id).toBeGreaterThan(0);
            expect([RANK.headline, RANK.notable, RANK.routine]).toContain(e.rank);
        }
    });

    it('gives every event a distinct id', () => {
        expect(new Set(year.map(e => e.id)).size).toBe(year.length);
    });

    it('finds the kinds worth going outside for', () => {
        expect(kinds(year)).toEqual(expect.arrayContaining([
            'full-moon', 'meteor-shower', 'opposition',
        ]));
    });

    it('puts the planets at opposition, not at conjunction', () => {
        // Anchored on elongation rather than on a date, because a date anchor
        // is what let this ship wrong: the dates were "checked independently"
        // against the same call with the same mistaken argument, so they
        // agreed perfectly and were six months out. Elongation is the thing
        // opposition actually means — the planet opposite the Sun in the sky —
        // and a conjunction cannot score near 180° by accident.
        const opps = of(findEvents(LONDON, { from: FROM, days: 400, limit: 80 }), 'opposition');
        expect(opps.length).toBeGreaterThanOrEqual(4);
        for (const e of opps) {
            const { elongation } = Astronomy.Elongation(e.body, e.at);
            expect(elongation, `${e.body} on ${e.at.toISOString().slice(0, 10)}`)
                .toBeGreaterThan(170);
        }
        // And the published dates, now that they mean something.
        const on = (body) => opps.find(e => e.body === body)?.at.toISOString().slice(0, 10);
        expect(on('Saturn')).toBe('2026-10-04');
        expect(on('Jupiter')).toBe('2027-02-11');
        expect(on('Mars')).toBe('2027-02-19');
    });

    it('finds the eclipse that is actually visible from where you are', () => {
        // 2027-08-02 is the long total eclipse; from London it is a 42%
        // partial. An eclipse nobody at this location can see is not an event
        // for this location.
        const solar = of(findEvents(LONDON, { from: FROM, days: 365, limit: 80 }), 'solar-eclipse');
        expect(solar).toHaveLength(1);
        expect(solar[0].at.toISOString().slice(0, 10)).toBe('2027-08-02');
        expect(solar[0].detail).toMatch(/4[0-9]% of the Sun/);
        expect(solar[0].rank).toBe(RANK.headline);
    });

    it('looks past the window for a solar eclipse, since a year usually has none', () => {
        // Somewhere the next one is years out. "No eclipse for you" is a worse
        // answer than "yours is in 2028".
        const sydney = findEvents({ lat: -33.87, lon: 151.21 }, { from: FROM, days: 120, limit: 80 });
        const solar = of(sydney, 'solar-eclipse');
        if (solar.length) expect(solar[0].at.getTime()).toBeGreaterThan(FROM.getTime());
    });

    it('does not oversell a penumbral lunar eclipse', () => {
        const all = findEvents(LONDON, { from: FROM, days: 500, limit: 90 });
        for (const e of of(all, 'lunar-eclipse')) {
            if (/penumbral/i.test(e.title)) expect(e.rank).toBe(RANK.routine);
            else expect(e.rank).toBe(RANK.headline);
        }
    });

    it('works with no location, minus the things that need one', () => {
        const anywhere = findEvents(null, { from: FROM, days: 365, limit: 60 });
        expect(anywhere.length).toBeGreaterThan(10);
        expect(of(anywhere, 'solar-eclipse')).toHaveLength(0);
        expect(of(anywhere, 'full-moon').length).toBeGreaterThan(0);
    });

    it('does not headline an opposition you cannot see', () => {
        // Uranus peaks at magnitude 5.7 and Neptune at 7.8. Their opposition is
        // a real date and not a thing you can walk outside and look at.
        const all = findEvents(LONDON, { from: FROM, days: 400, limit: 90 });
        const opps = of(all, 'opposition');
        for (const e of opps) {
            const expected = ['Mars', 'Jupiter', 'Saturn'].includes(e.body)
                ? RANK.headline : RANK.notable;
            expect(e.rank, e.body).toBe(expected);
        }
        expect(opps.find(e => e.body === 'Neptune').detail).toMatch(/binoculars/);
    });

    it('keeps the headlines when the list is trimmed', () => {
        // Sorting by date and cutting at the limit fills the list with full
        // moons and drops the eclipse and both oppositions off the end.
        const tight = findEvents(LONDON, { from: FROM, days: 365, limit: 12 });
        expect(tight).toHaveLength(12);
        expect(of(tight, 'solar-eclipse')).toHaveLength(1);
        expect(of(tight, 'opposition').length).toBeGreaterThanOrEqual(2);
        // The property, rather than a restatement of the ranks: nothing the
        // trim dropped outranks anything it kept. Run the same window without
        // a meaningful limit and every headline in it has to have survived.
        const full = findEvents(LONDON, { from: FROM, days: 365, limit: 200 });
        const headlines = full.filter(e => e.rank === RANK.headline);
        expect(headlines.length).toBeGreaterThanOrEqual(4);
        const keptIds = new Set(tight.map(e => e.id));
        for (const e of headlines) expect(keptIds.has(e.id), e.title).toBe(true);
        const lowest = Math.min(...tight.map(e => e.rank));
        for (const e of full) {
            if (!keptIds.has(e.id)) expect(e.rank, e.title).toBeLessThanOrEqual(lowest);
        }
        // and it still reads in date order
        for (let i = 1; i < tight.length; i++) {
            expect(tight[i].at.getTime()).toBeGreaterThanOrEqual(tight[i - 1].at.getTime());
        }
    });

    it('does not list a full moon and the eclipse happening on it', () => {
        // A lunar eclipse only ever happens at full moon
        const all = findEvents(LONDON, { from: FROM, days: 700, limit: 120 });
        for (const e of of(all, 'lunar-eclipse')) {
            const sameNight = of(all, 'full-moon')
                .filter(f => Math.abs(f.at - e.at) < 86400000);
            expect(sameNight, e.at.toISOString()).toHaveLength(0);
        }
    });

    it('honours the window and the limit', () => {
        const short = findEvents(LONDON, { from: FROM, days: 30, limit: 5 });
        expect(short.length).toBeLessThanOrEqual(5);
        // Solar eclipses are the deliberate exception to the window
        for (const e of short.filter(x => x.kind !== 'solar-eclipse')) {
            expect(daysUntil(e.at, FROM)).toBeLessThanOrEqual(31);
        }
    });

    it('finishes fast enough to run on a phone', () => {
        // Around 30ms on a laptop. It is a pure function computed once and
        // kept, never anywhere near a render loop, but a runaway search would
        // show up here.
        const t0 = performance.now();
        findEvents(LONDON, { from: FROM, days: 365, limit: 60 });
        expect(performance.now() - t0).toBeLessThan(1500);
    });
});

describe('whenWords', () => {
    it('counts down the way people say it', () => {
        const now = new Date('2026-09-07T12:00:00Z');
        const on = (d) => whenWords(new Date(now.getTime() + d * 86400000), now);
        expect(on(0.2)).toBe('today');
        expect(on(1.2)).toBe('tomorrow');
        expect(on(5)).toBe('in 5 days');
        expect(on(21)).toBe('in 3 weeks');
        expect(on(90)).toBe('in 3 months');
        expect(on(800)).toBe('in 2.2 years');
        expect(on(-3)).toBe('passed');
    });
});
