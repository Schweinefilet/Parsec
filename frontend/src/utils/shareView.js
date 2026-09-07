// A link to what you are looking at.
//
// Most of the site's state is already in the URL — which object is focused,
// which spacecraft the tracker follows, which two bodies are being compared.
// The 3D scene is the exception: where the camera is, what the clock says and
// whether distances are true all live in memory, so "look at this" was not
// something you could send anyone. This turns those three into query
// parameters and back.
//
// The camera goes in as spherical coordinates about the Sun rather than a
// position, because that is what OrbitControls actually maintains and it
// survives rounding to something short enough to read.

const CAM = 'cam';
const TIME = 'at';
const SCALE = 'scale';

/** The live camera, written by the scene each frame and read when sharing. */
let snapshot = null;

export function setCameraSnapshot(view) {
    snapshot = view;
}

export function getCameraSnapshot() {
    return snapshot;
}

const round = (n, places) => Number(n.toFixed(places));

/**
 * Fold the scene's in-memory state into search params.
 *
 * Anything at its default is left out, so a link to the scene as it opens is
 * just the address — and a link that carries three parameters is carrying
 * three deliberate choices.
 */
export function encodeView({ camera, simDate, trueScale, now = new Date() } = {}) {
    const params = new URLSearchParams();
    if (camera && Number.isFinite(camera.theta)) {
        params.set(CAM, [
            round(camera.theta, 1), round(camera.phi, 1), Math.round(camera.distance),
        ].join('_'));
    }
    // An absolute instant, not an offset: "thirty days ahead" means something
    // different tomorrow, and a link should not drift after you send it.
    if (simDate && Math.abs(simDate.getTime() - now.getTime()) > 60_000) {
        params.set(TIME, simDate.toISOString().slice(0, 16) + 'Z');
    }
    if (trueScale) params.set(SCALE, 'true');
    return params;
}

/** Read back whatever a link carries, ignoring anything malformed. */
export function decodeView(search) {
    const params = new URLSearchParams(search);
    const out = { camera: null, at: null, trueScale: false };

    const cam = params.get(CAM);
    if (cam) {
        const [theta, phi, distance] = cam.split('_').map(Number);
        if ([theta, phi, distance].every(Number.isFinite) && distance > 0) {
            out.camera = { theta, phi, distance };
        }
    }

    const at = params.get(TIME);
    if (at) {
        const d = new Date(at);
        if (!Number.isNaN(d.getTime())) out.at = d;
    }

    out.trueScale = params.get(SCALE) === 'true';
    return out;
}

/**
 * The full link to the current view.
 *
 * Existing params are kept — the tracker's satellite, the compare pair — so
 * this works from any page, and on pages with no camera it simply returns the
 * address you are already at.
 */
export function buildShareUrl({ href, camera, simDate, trueScale, now } = {}) {
    const url = new URL(href);
    const extra = encodeView({ camera, simDate, trueScale, now });
    for (const key of [CAM, TIME, SCALE]) url.searchParams.delete(key);
    for (const [k, v] of extra) url.searchParams.set(k, v);
    return url.toString();
}
