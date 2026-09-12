import { describe, it, expect } from 'vitest';
import constellationLines from './constellationLines.json';
import { CONSTELLATION_NAMES } from './constellationNames';

// A hand-kept extract (see its own header for why) of a generated file —
// exactly the kind of place a name can quietly drift out of sync.

describe('CONSTELLATION_NAMES', () => {
    it('has all 88 IAU constellations, each once', () => {
        expect(CONSTELLATION_NAMES.length).toBe(88);
        expect(new Set(CONSTELLATION_NAMES.map(([iau]) => iau)).size).toBe(88);
    });

    it('matches constellationLines.json exactly — code and Latin name alike', () => {
        const fromLines = new Map(constellationLines.map(([iau, , native]) => [iau, native]));
        for (const [iau, name] of CONSTELLATION_NAMES) {
            expect(fromLines.get(iau), `constellationLines.json has no "${iau}"`).toBeDefined();
            expect(name, `${iau} name drifted from constellationLines.json`).toBe(fromLines.get(iau));
        }
        expect(CONSTELLATION_NAMES.length).toBe(fromLines.size);
    });
});
