// The sub-solar point — the latitude and longitude the Sun is directly
// overhead at — from the standard low-precision solar position formulas.
// Declination plus an equation-of-time correction; well inside a pixel at any
// size either caller draws the Earth.
//
// This lives on its own because two scenes have to agree on it exactly.
// SatelliteGlobe.jsx draws its terminator from it, and SolarSystem3D.jsx
// orients Earth by it for the tracker hand-off (utils/trackerEntry.js): the
// whole transition works by both scenes putting this one point dead centre of
// the frame, so a second copy of the formula that drifted by a degree would
// show up as the planet twitching at the cut.
export function subsolar(date) {
    const start = Date.UTC(date.getUTCFullYear(), 0, 0);
    const dayOfYear = (date.getTime() - start) / 86400000;
    const g = (357.529 + 0.98560028 * dayOfYear) * Math.PI / 180;
    const decl = 23.44 * Math.sin((2 * Math.PI * (dayOfYear - 81)) / 365.24) * Math.PI / 180;
    const eot = 229.18 * (0.000075 + 0.001868 * Math.cos(g) - 0.032077 * Math.sin(g)
        - 0.014615 * Math.cos(2 * g) - 0.040849 * Math.sin(2 * g)); // minutes
    const utcMinutes = date.getUTCHours() * 60 + date.getUTCMinutes() + date.getUTCSeconds() / 60;
    const lon = -((utcMinutes + eot) / 4 - 180);
    return { lat: (decl * 180) / Math.PI, lon };
}

/**
 * Equirectangular lat/lon (degrees) → a point on a three.js SphereGeometry of
 * the given radius, written into `out`.
 *
 * The convention both scenes share: +Y is the north pole, +X is lat 0/lon 0,
 * -Z is lon 90°E. SatelliteGlobe.jsx places every marker with it and
 * SolarSystem3D.jsx's sky dive already relies on matching it, so a point named
 * in degrees means the same piece of ground in either scene.
 */
export function latLonToVec3(lat, lon, radius, out) {
    const la = (lat * Math.PI) / 180;
    const lo = (lon * Math.PI) / 180;
    return out.set(
        radius * Math.cos(la) * Math.cos(lo),
        radius * Math.sin(la),
        -radius * Math.cos(la) * Math.sin(lo),
    );
}
