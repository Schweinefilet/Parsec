import { describe, it, expect } from 'vitest';
import {
    QUALITY, QUALITY_ORDER, DEFAULT_QUALITY, lowerQuality, SHOTS, SHOT_ORDER,
    divePose, DIVE_SECONDS, damp, nearestAngle, cameraFrame, clampCamera,
    MIN_DIST, MAX_DIST, hourElsewhere, GRAV_RADIUS_KM, AU_KM,
} from './gargantuaCamera';
import { horizonRadius, iscoRadius, MAX_SPIN } from './kerr';
import { MAX_STEPS } from './gargantuaShaders';

const dot = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];

describe('quality levels', () => {
    it('get strictly more expensive in order and fit the shader loop', () => {
        for (let i = 1; i < QUALITY_ORDER.length; i++) {
            const lo = QUALITY[QUALITY_ORDER[i - 1]];
            const hi = QUALITY[QUALITY_ORDER[i]];
            expect(hi.stepScale).toBeLessThan(lo.stepScale);
            expect(hi.maxSteps).toBeGreaterThan(lo.maxSteps);
            expect(hi.scale).toBeGreaterThanOrEqual(lo.scale);
        }
        for (const q of QUALITY_ORDER) expect(QUALITY[q].maxSteps).toBeLessThanOrEqual(MAX_STEPS);
        expect(QUALITY_ORDER).toContain(DEFAULT_QUALITY);
    });

    it('steps down one level at a time and stops at the bottom', () => {
        expect(lowerQuality('absurd')).toBe('ultra');
        expect(lowerQuality('balanced')).toBeNull();
    });
});

describe('shots', () => {
    it('all exist and keep the camera outside the disk', () => {
        for (const id of SHOT_ORDER) {
            const s = SHOTS[id];
            expect(s, id).toBeTruthy();
            expect(s.spin).toBeLessThanOrEqual(MAX_SPIN);
            expect(s.dist).toBeGreaterThan(iscoRadius(s.spin));
            expect(s.dist).toBeGreaterThanOrEqual(MIN_DIST);
        }
    });

    it('dives monotonically, stays outside the horizon, and fades out at the end', () => {
        const rh = horizonRadius(SHOTS.dive.spin);
        let prev = Infinity;
        for (let t = 0; t <= DIVE_SECONDS; t += 0.5) {
            const p = divePose(t, rh);
            expect(p.dist).toBeLessThanOrEqual(prev + 1e-9);
            expect(p.dist).toBeGreaterThan(rh);
            prev = p.dist;
        }
        expect(divePose(0, rh).fade).toBe(1);
        expect(divePose(DIVE_SECONDS, rh).fade).toBe(0);
        expect(divePose(DIVE_SECONDS, rh).done).toBe(true);
        expect(divePose(DIVE_SECONDS / 2, rh).done).toBe(false);
    });
});

describe('camera maths', () => {
    it('damps towards a target without overshoot, independent of frame rate', () => {
        const once = damp(0, 10, 2, 1);
        let twice = damp(0, 10, 2, 0.5);
        twice = damp(twice, 10, 2, 0.5);
        expect(once).toBeCloseTo(twice, 10);
        expect(once).toBeLessThan(10);
    });

    it('takes the short way round', () => {
        expect(nearestAngle(0.1, 2 * Math.PI - 0.1)).toBeCloseTo(-0.1, 10);
        expect(nearestAngle(3, 3.2)).toBeCloseTo(3.2, 10);
    });

    it('builds an orthonormal frame looking at the hole', () => {
        const f = cameraFrame({ dist: 20, az: 0.7, el: 0.3, roll: 0.2 });
        expect(Math.hypot(...f.pos)).toBeCloseTo(20, 10);
        for (const v of [f.fwd, f.right, f.up]) expect(Math.hypot(...v)).toBeCloseTo(1, 10);
        expect(dot(f.fwd, f.right)).toBeCloseTo(0, 10);
        expect(dot(f.fwd, f.up)).toBeCloseTo(0, 10);
        expect(dot(f.right, f.up)).toBeCloseTo(0, 10);
        expect(dot(f.fwd, f.pos)).toBeCloseTo(-20, 10);
        // Unrolled, up leans towards the spin axis.
        expect(cameraFrame({ dist: 20, az: 0, el: 0.1 }).up[2]).toBeGreaterThan(0.9);
    });

    it('clamps distance and elevation', () => {
        const c = clampCamera({ dist: 0.5, az: 0, el: 3 });
        expect(c.dist).toBe(MIN_DIST);
        expect(c.el).toBeLessThan(Math.PI / 2);
        expect(clampCamera({ dist: 1e6, az: 0, el: 0 }).dist).toBe(MAX_DIST);
    });
});

describe('readouts', () => {
    it('makes one gravitational radius about an AU', () => {
        expect(GRAV_RADIUS_KM / AU_KM).toBeCloseTo(0.99, 2);
    });

    it('names a sensible unit for the time dilation', () => {
        expect(hourElsewhere(1)).toEqual({ value: 60, unit: 'minutes' });
        expect(hourElsewhere(0.25)).toEqual({ value: 4, unit: 'hours' });
        expect(hourElsewhere(1 / 240).unit).toBe('days');
        // The film's Miller's planet: an hour there, seven years here.
        expect(hourElsewhere(1 / (7 * 8766))).toEqual({ value: 7, unit: 'years' });
        expect(hourElsewhere(0)).toBeNull();
    });
});
