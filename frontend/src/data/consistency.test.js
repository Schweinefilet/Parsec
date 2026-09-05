import { describe, it, expect } from 'vitest';
import { OBJECTS, getObjectById } from './objectCatalog';
import { PLANETS, MOON_DATA, SMALL_BODIES, ORBITAL_PERIODS } from './solarSystemBodies';

// The catalog (what the panels say) and the scene tables (what you see moving)
// describe the same objects twice. Nothing keeps them honest at runtime, so
// these tests do — a period corrected in one place and not the other is exactly
// the kind of quiet wrongness a reference site should not ship.

/** Pull a number out of a display string like "29.46 years" or "1,188.3 km". */
function numberIn(text) {
    if (typeof text !== 'string') return null;
    const m = text.replace(/,/g, '').match(/-?\d+(\.\d+)?/);
    return m ? parseFloat(m[0]) : null;
}

function statValue(object, label) {
    for (const section of object.stats ?? []) {
        for (const row of section.rows) {
            if (row.label.toLowerCase() === label.toLowerCase()) return row.value;
        }
    }
    return null;
}

describe('scene tables vs catalog', () => {
    it('has a catalog entry for every planet in the scene', () => {
        for (const p of PLANETS) {
            expect(getObjectById(p.id), `no catalog entry for ${p.name}`).toBeTruthy();
        }
    });

    it('has a catalog entry for every moon in the scene', () => {
        for (const m of MOON_DATA) {
            expect(getObjectById(m.id), `no catalog entry for ${m.name}`).toBeTruthy();
        }
    });

    it('has a catalog entry for every small body in the scene', () => {
        for (const b of SMALL_BODIES) {
            expect(getObjectById(b.id), `no catalog entry for ${b.name}`).toBeTruthy();
        }
    });

    it('agrees on planet names', () => {
        for (const p of PLANETS) {
            const o = getObjectById(p.id);
            expect(o.name, `${p.id}: scene "${p.name}" vs catalog "${o.name}"`).toBe(p.name);
        }
    });

    it('agrees on planet orbital periods', () => {
        for (const p of PLANETS) {
            const scenePeriodDays = ORBITAL_PERIODS[p.name];
            const o = getObjectById(p.id);
            const stated = numberIn(statValue(o, 'Orbital Period') ?? o.keyStatValue);
            if (stated == null) continue;
            // Catalog states years for the outer planets, days for the inner ones
            const statedDays = /year/i.test(statValue(o, 'Orbital Period') ?? o.keyStatValue)
                ? stated * 365.25
                : stated;
            expect(
                Math.abs(statedDays - scenePeriodDays) / scenePeriodDays,
                `${p.name}: scene ${scenePeriodDays}d vs catalog ${statedDays}d`,
            ).toBeLessThan(0.02);
        }
    });

    it('agrees on moon orbital periods', () => {
        for (const m of MOON_DATA) {
            if (m.id === 'iss') continue;                  // stated in minutes
            const o = getObjectById(m.id);
            const raw = statValue(o, 'Orbital Period');
            const stated = numberIn(raw);
            if (stated == null) continue;
            const statedDays = /hour/i.test(raw) ? stated / 24
                             : /year/i.test(raw) ? stated * 365.25
                             : stated;
            expect(
                Math.abs(statedDays - m.period) / m.period,
                `${m.name}: scene ${m.period}d vs catalog "${raw}"`,
            ).toBeLessThan(0.02);
        }
    });

    it('orders planets by true distance from the Sun', () => {
        // The compressed display radii must still preserve the real ordering
        for (let i = 1; i < PLANETS.length; i++) {
            expect(
                PLANETS[i].orbitR,
                `${PLANETS[i].name} is drawn inside ${PLANETS[i - 1].name}`,
            ).toBeGreaterThan(PLANETS[i - 1].orbitR);
        }
    });

    it('keeps relative planet sizes in the right order for the gas giants', () => {
        const r = Object.fromEntries(PLANETS.map(p => [p.id, p.r]));
        expect(r.jupiter).toBeGreaterThan(r.saturn);
        expect(r.saturn).toBeGreaterThan(r.uranus);
        expect(r.uranus).toBeGreaterThan(r.neptune);
        expect(r.neptune).toBeGreaterThan(r.earth);
        expect(r.earth).toBeGreaterThan(r.mars);
        expect(r.mars).toBeGreaterThan(r.mercury);
        expect(r.mercury).toBeGreaterThan(r.pluto);
    });
});

describe('catalog facts that are easy to get wrong', () => {
    const radiusKm = (id) => numberIn(statValue(getObjectById(id), 'Equatorial Radius'));

    it('states planet radii that match reality', () => {
        // Published equatorial radii, km
        const known = {
            mercury: 2439.7, venus: 6051.8, earth: 6378.1, mars: 3389.5,
            jupiter: 71492, saturn: 60268, uranus: 25559, neptune: 24764,
        };
        for (const [id, km] of Object.entries(known)) {
            const stated = radiusKm(id);
            if (stated == null) continue;
            expect(Math.abs(stated - km) / km, `${id}: stated ${stated} km, expected ~${km}`)
                .toBeLessThan(0.01);
        }
    });

    it('never states a negative or zero physical quantity', () => {
        for (const o of OBJECTS) {
            for (const section of o.stats ?? []) {
                for (const row of section.rows) {
                    if (!/mass|radius|diameter|period|velocity|gravity|distance/i.test(row.label)) continue;
                    const n = numberIn(row.value);
                    if (n == null) continue;
                    // Temperatures are the only physical rows allowed to be negative,
                    // and they are excluded by the label filter above
                    expect(n, `${o.id}/${row.label} = ${row.value}`).toBeGreaterThan(0);
                }
            }
        }
    });
});
