import { describe, it, expect, afterEach } from 'vitest';
import { quality, texturePath, pixelRatioFor, __setTier } from './quality';

const TIERS = ['low', 'medium', 'high'];

afterEach(() => __setTier(null));

describe('tier settings', () => {
    it('defines every setting the renderer reads, for every tier', () => {
        for (const tier of TIERS) {
            __setTier(tier);
            const q = quality();
            for (const key of [
                'texturePath', 'maxPixelRatio', 'pixelBudget', 'shadows',
                'planetSegments', 'moonSegments', 'skySegments',
                'beltParticles', 'beltLOD', 'beltLODRotate', 'skyTexture',
                'heroTextureSize', 'minorTextureSize', 'antialias', 'starCount',
            ]) {
                expect(q, `${tier} is missing ${key}`).toHaveProperty(key);
            }
            expect(q.beltParticles.asteroid).toBeGreaterThan(0);
            expect(q.beltParticles.kuiper).toBeGreaterThan(0);
        }
    });

    it('gets cheaper as the tier drops', () => {
        const read = (tier) => { __setTier(tier); return quality(); };
        const low = read('low'), med = read('medium'), high = read('high');

        expect(low.pixelBudget).toBeLessThan(med.pixelBudget);
        expect(med.pixelBudget).toBeLessThan(high.pixelBudget);
        expect(low.beltParticles.asteroid).toBeLessThan(high.beltParticles.asteroid);
        expect(low.planetSegments).toBeLessThan(high.planetSegments);
        expect(low.heroTextureSize).toBeLessThanOrEqual(high.heroTextureSize);
        // Shadow maps are the big mobile cost and must be off at the bottom tier
        expect(low.shadows).toBe(false);
        expect(high.shadows).toBe(true);
        expect(low.beltLOD).toBe(false);
    });

    it('drops the Milky Way sphere on phones and gives desktop the 8K map', () => {
        const read = (tier) => { __setTier(tier); return quality(); };
        // A full-screen backdrop is the worst case for a mobile GPU's fill rate
        expect(read('low').skyTexture).toBeNull();
        expect(read('medium').skyTexture).toBe('milky_way.jpg');
        expect(read('high').skyTexture).toBe('8k/milky_way.jpg');
    });

    it('sends the low tier to the small texture set', () => {
        __setTier('low');
        expect(texturePath('mars.jpg')).toBe('/textures/1k/mars.jpg');
        __setTier('high');
        expect(texturePath('mars.jpg')).toBe('/textures/mars.jpg');
    });
});

describe('pixelRatioFor', () => {
    const withDpr = (dpr, fn) => {
        const original = window.devicePixelRatio;
        Object.defineProperty(window, 'devicePixelRatio', { value: dpr, configurable: true });
        try { return fn(); } finally {
            Object.defineProperty(window, 'devicePixelRatio', { value: original, configurable: true });
        }
    };

    it('never drops below 1', () => {
        __setTier('low');
        // Absurdly large surface — the budget would ask for well under 1
        expect(withDpr(3, () => pixelRatioFor(5000, 4000))).toBe(1);
    });

    it('never exceeds the tier cap', () => {
        __setTier('low');
        expect(withDpr(3, () => pixelRatioFor(320, 500))).toBeLessThanOrEqual(1.5);
    });

    // The iPad case: fine GPU, but 820x1180 at DPR 2 is ~3.9M fragments
    it('keeps a tablet-sized surface inside the pixel budget', () => {
        __setTier('medium');
        const dpr = withDpr(2, () => pixelRatioFor(820, 1180));
        const pixels = 820 * 1180 * dpr * dpr;
        expect(pixels).toBeLessThanOrEqual(quality().pixelBudget * 1.02);
    });

    it('leaves a small phone surface at the tier cap', () => {
        __setTier('low');
        // 390x844 at 1.5 is only ~0.74M, comfortably inside the budget
        expect(withDpr(3, () => pixelRatioFor(390, 844))).toBeCloseTo(1.5, 5);
    });

    it('handles a zero-sized container without dividing by zero', () => {
        __setTier('high');
        expect(Number.isFinite(withDpr(2, () => pixelRatioFor(0, 0)))).toBe(true);
    });
});
