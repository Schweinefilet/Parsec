import { describe, it, expect } from 'vitest';
import { heliocentricDistanceAU } from '../hooks/useHorizons';
import { moonPhaseDays, moonPhaseName, computeDistanceSeries, fmtKm, fmtDays } from './astroFormatters';
import { proceduralTexture, hasProfile } from './proceduralTextures';
import { buildSpacecraft, hasSpacecraftModel } from './spacecraftModels';
import { OBJECTS } from '../data/objectCatalog';

describe('deep-space probe distances', () => {
    // Anchors are real Horizons state vectors; these assert the model still
    // reproduces them rather than drifting when someone edits the table.
    it('matches the pinned Horizons anchor at the epoch', () => {
        const at = new Date(Date.UTC(2026, 0, 1));
        expect(heliocentricDistanceAU('voyager1', at)).toBeCloseTo(169.255, 3);
        expect(heliocentricDistanceAU('voyager2', at)).toBeCloseTo(141.714, 3);
        expect(heliocentricDistanceAU('new-horizons', at)).toBeCloseTo(63.576, 3);
    });

    it('reproduces the second Horizons sample five years on', () => {
        const at = new Date(Date.UTC(2031, 0, 1));
        // Independently queried from Horizons: 186.9 / 157.6 / 77.8 AU
        expect(heliocentricDistanceAU('voyager1', at)).toBeCloseTo(186.9, 0);
        expect(heliocentricDistanceAU('voyager2', at)).toBeCloseTo(157.6, 0);
        expect(heliocentricDistanceAU('new-horizons', at)).toBeCloseTo(77.8, 0);
    });

    it('keeps the craft in the right order and always receding', () => {
        const now = new Date();
        const later = new Date(now.getTime() + 365 * 86400000);
        for (const id of ['voyager1', 'voyager2', 'new-horizons']) {
            expect(heliocentricDistanceAU(id, later)).toBeGreaterThan(heliocentricDistanceAU(id, now));
        }
        expect(heliocentricDistanceAU('voyager1', now))
            .toBeGreaterThan(heliocentricDistanceAU('voyager2', now));
        expect(heliocentricDistanceAU('voyager2', now))
            .toBeGreaterThan(heliocentricDistanceAU('new-horizons', now));
    });

    it('returns null for anything not modelled', () => {
        expect(heliocentricDistanceAU('hubble')).toBeNull();
    });
});

describe('astro formatters', () => {
    it('keeps the moon phase inside one lunation', () => {
        const d = moonPhaseDays();
        expect(d).toBeGreaterThanOrEqual(0);
        expect(d).toBeLessThan(29.54);
    });

    it('names a phase for every point in the cycle', () => {
        for (let d = 0; d < 29.5; d += 0.25) {
            expect(moonPhaseName(d)).toBeTruthy();
        }
    });

    it('builds a distance series that is finite throughout', () => {
        const pts = computeDistanceSeries(1.524, 686.97, 365, 0);
        expect(pts.length).toBeGreaterThan(10);
        for (const p of pts) {
            expect(Number.isFinite(p.value)).toBe(true);
            expect(Number.isFinite(p.time)).toBe(true);
        }
    });

    it('formats distances and durations', () => {
        expect(fmtKm(1500)).toBe('1.5K km');
        expect(fmtKm(null)).toBe('—');
        expect(fmtDays(30)).toBe('30.00 d');
        expect(fmtDays(800)).toContain('yr');
    });
});

describe('procedural textures', () => {
    it('is deterministic for a given body', () => {
        const a = proceduralTexture('io', '#d8b06a', 'rocky');
        const b = proceduralTexture('io', '#d8b06a', 'rocky');
        // Same key returns the same cached texture rather than repainting
        expect(a).toBe(b);
    });

    it('has a hand-authored profile for the notable bodies', () => {
        for (const id of ['io', 'europa', 'ganymede', 'callisto', 'titan',
            'enceladus', 'triton', 'iapetus', 'pluto', 'ceres', 'mimas']) {
            expect(hasProfile(id), `${id} lost its profile`).toBe(true);
        }
    });

    it('still produces a texture for a body with no profile', () => {
        expect(proceduralTexture('made-up-moon', '#888888', 'rocky')).toBeTruthy();
    });

    it('paints every moon and small body in the catalog without throwing', () => {
        const painted = OBJECTS.filter(o => ['moons', 'dwarf-planets', 'asteroid'].includes(o.category));
        for (const o of painted) {
            expect(() => proceduralTexture(o.id, '#888888', 'rocky')).not.toThrow();
        }
    });
});

describe('spacecraft models', () => {
    it('has a builder for each craft the catalog shows in the viewer', () => {
        for (const id of ['hubble', 'jwst', 'voyager1', 'voyager2', 'new-horizons',
            'chandra', 'tiangong', 'mir', 'sputnik1']) {
            expect(hasSpacecraftModel(id), `${id} has no model`).toBe(true);
        }
    });

    it('builds a normalised, centred group', () => {
        for (const id of ['hubble', 'jwst', 'voyager1', 'sputnik1']) {
            const { group, geometries, materials } = buildSpacecraft(id);
            expect(group.children.length).toBeGreaterThan(0);
            expect(geometries.length).toBeGreaterThan(0);
            expect(materials.length).toBeGreaterThan(0);
            // Everything the builder created must be disposable by the caller
            for (const g of geometries) expect(typeof g.dispose).toBe('function');
            for (const m of materials) expect(typeof m.dispose).toBe('function');
        }
    });

    it('falls back to a generic satellite for an unknown id', () => {
        const { group } = buildSpacecraft('nope');
        expect(group.children.length).toBeGreaterThan(0);
    });
});
