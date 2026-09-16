// Matching the rendered camera's field of view to the real one behind it.
//
// Pointing the phone in exactly the right direction still puts Orion in the
// wrong place if the virtual camera and the physical one disagree about how
// much sky fits on the screen. Orientation errors shift the whole overlay
// together; a field-of-view mismatch stretches it about the centre, so the
// crosshair can be dead on while something near the edge sits several
// degrees out. AR mode used to render at the same fixed 55 degrees the
// drag-around dome uses, which on a typical phone is 15-20% narrower than
// what the camera is actually showing.
//
// There is no web API for a camera's field of view — `getSettings()` gives
// resolution, never optics — so one assumption has to be made, and this
// makes it as portable as possible by pinning the *diagonal* angle rather
// than the horizontal or vertical one. Diagonal FOV is what survives a
// change of aspect ratio: phone rear "main" cameras cluster tightly around
// a 26mm-equivalent lens whichever way the frame is cropped, so the same
// number describes a 4:3 stream and a 16:9 one, while their horizontal
// angles differ by a lot. Everything else here is exact given that: a
// pinhole model turns the diagonal into a focal length in pixels, and
// `object-fit: cover` cropping is plain arithmetic on top.
//
// Being approximately right beats being fixed at 55: a wrong-by-10% FOV
// misplaces a star at the edge of a phone screen by about a degree, where
// the old fixed value misplaced it by five or more.

const DEG2RAD = Math.PI / 180;
const RAD2DEG = 180 / Math.PI;

/**
 * Diagonal field of view, in degrees, assumed for a phone's back camera.
 * Sits in the middle of the range modern handsets report for their main
 * (non-ultrawide) rear lens, which runs roughly 75-82 degrees.
 */
export const ASSUMED_DIAGONAL_FOV = 78;

/**
 * The vertical FOV, in degrees, that a three.js PerspectiveCamera needs in
 * order to line up with a `object-fit: cover` video of `videoWidth` x
 * `videoHeight` filling a `viewWidth` x `viewHeight` box.
 *
 * `cover` scales the frame by whichever factor is larger and centre-crops
 * the rest, so the visible slice of the video — and therefore the angle the
 * screen actually spans — depends on both aspect ratios, not just the
 * camera's own.
 *
 * Returns null when any input is missing or not yet known (a <video> reports
 * 0 x 0 until its metadata loads), so the caller can leave the camera alone
 * rather than render a frame at NaN degrees.
 */
export function arVerticalFov({
    videoWidth, videoHeight, viewWidth, viewHeight,
    diagonalFov = ASSUMED_DIAGONAL_FOV,
}) {
    if (!(videoWidth > 0) || !(videoHeight > 0)) return null;
    if (!(viewWidth > 0) || !(viewHeight > 0)) return null;
    if (!(diagonalFov > 0) || diagonalFov >= 180) return null;

    // Pinhole model, square pixels: one focal length in pixels describes the
    // whole frame, and it is fixed by the diagonal alone.
    const diagonal = Math.hypot(videoWidth, videoHeight);
    const focalPx = (diagonal / 2) / Math.tan((diagonalFov / 2) * DEG2RAD);

    const scale = Math.max(viewWidth / videoWidth, viewHeight / videoHeight);
    // Clamped to the frame itself: `cover` can only ever crop, so a rounding
    // wobble must not claim to show more video than exists.
    const visibleHeightPx = Math.min(videoHeight, viewHeight / scale);

    return 2 * Math.atan((visibleHeightPx / 2) / focalPx) * RAD2DEG;
}
