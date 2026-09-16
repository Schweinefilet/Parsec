import { describe, it, expect } from 'vitest';
import { arVerticalFov, ASSUMED_DIAGONAL_FOV } from './arCamera.js';

const RAD2DEG = 180 / Math.PI;

/** The angle a full frame of this size spans, given the assumed diagonal. */
function fullFrameVertical(w, h, diagonalFov = ASSUMED_DIAGONAL_FOV) {
    const focal = (Math.hypot(w, h) / 2) / Math.tan((diagonalFov / 2) / RAD2DEG);
    return 2 * Math.atan((h / 2) / focal) * RAD2DEG;
}

describe('arVerticalFov', () => {
    it('returns the frame\'s own vertical angle when the view matches its aspect', () => {
        // Nothing is cropped, so the answer is the whole frame's height.
        expect(arVerticalFov({
            videoWidth: 480, videoHeight: 640, viewWidth: 240, viewHeight: 320,
        })).toBeCloseTo(fullFrameVertical(480, 640), 6);
    });

    it('keeps the full height when a taller viewport crops the sides', () => {
        // A 9:19.5 phone screen showing a 3:4 portrait stream: `cover` fits
        // the height and loses the edges, so the vertical angle is untouched.
        const fov = arVerticalFov({
            videoWidth: 480, videoHeight: 640, viewWidth: 390, viewHeight: 844,
        });
        expect(fov).toBeCloseTo(fullFrameVertical(480, 640), 6);
    });

    it('narrows when a wider viewport crops the top and bottom instead', () => {
        const full = fullFrameVertical(640, 480);
        const fov = arVerticalFov({
            videoWidth: 640, videoHeight: 480, viewWidth: 844, viewHeight: 390,
        });
        expect(fov).toBeLessThan(full);
        // 844x390 is wider than 4:3, so the visible slice is 390/(844/640)
        // = 295.7 of the frame's 480 rows.
        expect(fov).toBeCloseTo(
            2 * Math.atan((390 / (844 / 640) / 2)
                / ((Math.hypot(640, 480) / 2) / Math.tan((ASSUMED_DIAGONAL_FOV / 2) / RAD2DEG)))
            * RAD2DEG,
            6,
        );
    });

    it('is wider than the 55-degree dome default for a typical phone hold', () => {
        // The whole point of the change: a phone's back camera shows more sky
        // than the fixed value AR used to render at, which is what pushed
        // things near the edge of the screen out of place.
        const fov = arVerticalFov({
            videoWidth: 480, videoHeight: 640, viewWidth: 390, viewHeight: 844,
        });
        expect(fov).toBeGreaterThan(60);
        expect(fov).toBeLessThan(75);
    });

    it('scales with the assumed lens rather than ignoring it', () => {
        const box = { videoWidth: 480, videoHeight: 640, viewWidth: 390, viewHeight: 844 };
        const narrow = arVerticalFov({ ...box, diagonalFov: 60 });
        const wide = arVerticalFov({ ...box, diagonalFov: 90 });
        expect(narrow).toBeLessThan(wide);
    });

    it('returns null until the video reports a size, rather than a NaN camera', () => {
        expect(arVerticalFov({
            videoWidth: 0, videoHeight: 0, viewWidth: 390, viewHeight: 844,
        })).toBeNull();
    });

    it('returns null for a viewport that has not been laid out yet', () => {
        expect(arVerticalFov({
            videoWidth: 480, videoHeight: 640, viewWidth: 0, viewHeight: 0,
        })).toBeNull();
    });

    it('rejects a nonsensical lens instead of producing a degenerate camera', () => {
        const box = { videoWidth: 480, videoHeight: 640, viewWidth: 390, viewHeight: 844 };
        expect(arVerticalFov({ ...box, diagonalFov: 0 })).toBeNull();
        expect(arVerticalFov({ ...box, diagonalFov: 180 })).toBeNull();
        expect(arVerticalFov({ ...box, diagonalFov: -10 })).toBeNull();
    });
});
