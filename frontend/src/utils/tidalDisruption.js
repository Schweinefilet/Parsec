// A tidal disruption event: a star that strays too close to a black hole is
// pulled apart by the difference between the hole's pull on its near and far
// sides, and smeared into a stream. Half the stream is bound and comes back;
// the other half is flung away for good.
//
// The star here is a white dwarf and the hole an intermediate-mass one of ten
// thousand suns: the pairing Rosswog, Ramirez-Ruiz & Hix (2009) simulated. A
// Sun-like star round a supermassive hole is the famous kind, but its debris
// swings out fifty times its closest approach and takes weeks to come back; a
// white dwarf round a hole this size is torn apart at 15 M, its debris returns
// within minutes and stays within a few hundred M, and close to the hole the
// relativistic precession of each return is large. All of it fits in one
// picture at its true size.
//
// The debris is a lattice of particles, each moving on its own exact
// Schwarzschild geodesic (timelike, in the hole's equatorial plane). The star
// holds together until it crosses the tidal radius and then lets go: the
// "frozen-in" approximation (Lacy, Townes & Hollenbach 1982; Rees 1988),
// which is what sets the spread of orbital energies. What the particles can't
// do on their own is collide: the returning stream crossing itself, shocking
// and settling into a ring. That is modelled, not simulated: once it has come
// back, each time a bound particle crosses its circularisation radius it
// gives up part of its radial motion as heat, keeping its angular momentum
// (`shockRadial`), so it settles onto the circle that angular momentum
// allows, about twice its pericentre; once round it drifts slowly in.
//
// Units: G = c = M_hole = 1. Lengths in M, times in M (coordinate time, as a
// distant observer counts it).

/** The pair. Masses in suns, the white dwarf's radius in km. */
export const TDE = {
    holeMass: 1e4,
    starMass: 0.6,
    starRadiusKm: 8700,
    // A white dwarf's surface: hot, blue-white.
    starTemp: 25000,
};

const KM_PER_M_SUN = 1.4766; // GM☉/c² in km
const SECONDS_PER_M_SUN = 4.9255e-6; // GM☉/c³ in s

/** One M of length in km, and of time in seconds, for the hole. */
export const M_KM = KM_PER_M_SUN * TDE.holeMass;
export const M_SECONDS = SECONDS_PER_M_SUN * TDE.holeMass;

/** The star's radius in M. */
export const STAR_RADIUS = TDE.starRadiusKm / M_KM;

/**
 * The tidal radius, r_t = R* (M/M*)^⅓: inside it the hole's tidal pull on
 * the star beats the star's own gravity.
 */
export function tidalRadius(rStar = STAR_RADIUS, q = TDE.holeMass / TDE.starMass) {
    return rStar * Math.cbrt(q);
}

/**
 * Angular momentum per unit mass of a parabolic (E = 1) Schwarzschild orbit
 * whose closest approach is rp: L² = 2 rp² / (rp − 2).
 */
export function parabolicL(rp) {
    return Math.sqrt((2 * rp * rp) / (rp - 2));
}

/** A parabolic orbit with less angular momentum than 4M falls in: rp ≤ 4. */
export const CAPTURE_L = 4;

/** Angular momentum of a circular orbit at r: L² = r² / (r − 3). */
export function circularL(r) {
    return r / Math.sqrt(r - 3);
}

/** Energy per unit mass of a circular orbit at r: (1 − 2/r) / √(1 − 3/r). */
export function circularE(r) {
    return (1 - 2 / r) / Math.sqrt(1 - 3 / r);
}

/**
 * Energy and angular momentum per unit mass of a particle at (x, y) with
 * proper velocity (ux, uy) = d(x, y)/dτ, in the plane, Schwarzschild
 * coordinates read as if flat: E² = 1 + u² − 2/r − 2L²/r³.
 */
export function constants(x, y, ux, uy) {
    const r = Math.hypot(x, y);
    const L = x * uy - y * ux;
    const u2 = ux * ux + uy * uy;
    return { E: Math.sqrt(Math.max(1 + u2 - 2 / r - (2 * L * L) / (r * r * r), 1e-12)), L };
}

/**
 * d/dt of the state [x, y, ux, uy] for a particle of energy E: the
 * geodesic's d²x/dτ² = −x/r³ (1 + 3L²/r²), which is the Schwarzschild
 * radial equation exactly, taken to coordinate time with dτ/dt = (1 − 2/r)/E.
 */
function deriv(s, E, out) {
    const [x, y, ux, uy] = s;
    const r2 = x * x + y * y;
    const r = Math.sqrt(r2);
    const L = x * uy - y * ux;
    const a = -(1 + (3 * L * L) / r2) / (r2 * r);
    const k = (1 - 2 / r) / E;
    out[0] = ux * k;
    out[1] = uy * k;
    out[2] = a * x * k;
    out[3] = a * y * k;
    return out;
}

const k1 = [0, 0, 0, 0], k2 = [0, 0, 0, 0], k3 = [0, 0, 0, 0], k4 = [0, 0, 0, 0];
const tmp = [0, 0, 0, 0];

/**
 * Advance one particle by dt of coordinate time, in place, with RK4 at a
 * step that shrinks with r^3/2 (the local orbital time). Returns false if it
 * crossed the horizon.
 */
export function advance(s, E, dt, accuracy = 0.02) {
    let left = dt;
    while (left > 0) {
        const r = Math.hypot(s[0], s[1]);
        if (r < 2.02) return false;
        const h = Math.min(left, accuracy * Math.pow(r, 1.5) * Math.min(1, (r - 2) / 2 + 0.05));
        deriv(s, E, k1);
        for (let i = 0; i < 4; i++) tmp[i] = s[i] + 0.5 * h * k1[i];
        deriv(tmp, E, k2);
        for (let i = 0; i < 4; i++) tmp[i] = s[i] + 0.5 * h * k2[i];
        deriv(tmp, E, k3);
        for (let i = 0; i < 4; i++) tmp[i] = s[i] + h * k3[i];
        deriv(tmp, E, k4);
        for (let i = 0; i < 4; i++) s[i] += (h / 6) * (k1[i] + 2 * k2[i] + 2 * k3[i] + k4[i]);
        left -= h;
    }
    return Math.hypot(s[0], s[1]) >= 2.02;
}

/**
 * The energy spread the tidal kick gives the debris, Newtonian: across the
 * star, ΔE = R* / r_t² either side of the centre's (Stone, Sari & Loeb 2013).
 * Half the star ends up bound, half not.
 */
export function energySpread(rStar = STAR_RADIUS, rt = tidalRadius(rStar)) {
    return rStar / (rt * rt);
}

/** Semi-major axis of the most bound debris: a = 1 / (2ΔE) = r_t² / 2R*. */
export function mostBoundA(rStar = STAR_RADIUS, rt = tidalRadius(rStar)) {
    return 1 / (2 * energySpread(rStar, rt));
}

/** Its period, in M: Kepler's 2π a^3/2. */
export function mostBoundPeriod(rStar, rt) {
    return 2 * Math.PI * Math.pow(mostBoundA(rStar, rt), 1.5);
}

/**
 * The radius of the circular orbit with angular momentum L (the outer, stable
 * root of L² = r²/(r − 3)): where gas that keeps its angular momentum but
 * loses its eccentricity ends up. For a parabolic orbit it is about 2 r_p.
 * Below the ISCO's L = √12 there is none.
 */
export function circularisationRadius(L) {
    const L2 = L * L;
    const disc = L2 * L2 - 12 * L2;
    return disc > 0 ? (L2 + Math.sqrt(disc)) / 2 : 6;
}

/**
 * The returning stream running into itself: the particle keeps its
 * angular momentum and loses a fraction `kappa` of its radial velocity.
 * Returns the kinetic energy lost per unit mass, which becomes heat.
 */
export function shockRadial(s, kappa) {
    const [x, y, ux, uy] = s;
    const r = Math.hypot(x, y);
    const nx = x / r, ny = y / r;
    const ur = ux * nx + uy * ny;
    s[2] = ux - kappa * ur * nx;
    s[3] = uy - kappa * ur * ny;
    return 0.5 * ur * ur * (1 - (1 - kappa) * (1 - kappa));
}

// ── the event ───────────────────────────────────────────────────────────────

const START_R = 150;
/** The heat the debris starts with: utils/debrisRaster.js debrisTemperature() of it is the star's 25,000 K. */
export const RELEASE_HEAT = 0.057;

/**
 * The whole event for a penetration factor β = r_t / r_p: the star coming in
 * on a parabolic orbit, held together until the tidal radius, then a
 * `nAlong` × `nAcross` lattice of debris, each particle on its own geodesic.
 * Chains run along the lattice's first axis (the star's radius towards the
 * hole when it let go, so ordered by energy): neighbours along a chain stay
 * neighbours along the stream, which is how it is drawn.
 */
export function createEvent(beta, { nAlong = 161, nAcross = 7 } = {}) {
    const rt = tidalRadius();
    const rp = Math.max(rt / beta, 4.05);
    const L = parabolicL(rp);
    // Start inbound at START_R: u_φ = L/r, ṙ from E = 1.
    const r0 = START_R;
    const urad = -Math.sqrt(Math.max(1 - (1 - 2 / r0) * (1 + (L * L) / (r0 * r0)), 0));
    // Rotate so that pericentre comes out roughly facing the camera's start.
    const ang = 2.2;
    const cos = Math.cos(ang), sin = Math.sin(ang);
    const cm = [r0 * cos, r0 * sin, urad * cos - (L / r0) * sin, urad * sin + (L / r0) * cos];
    const n = nAlong * nAcross;
    return {
        beta, rt, rp, L,
        time: 0, // M since the start
        released: null, // time of the release
        cm,
        cmE: 1,
        cmPassed: false,
        n, nAlong, nAcross,
        state: new Float64Array(n * 4),
        E: new Float64Array(n),
        weight: new Float64Array(n),
        heat: new Float64Array(n),
        passes: new Uint8Array(n),
        lastUr: new Float64Array(n),
        // Which side of its circularisation radius it was on; whether it has
        // been out to apocentre and come back.
        side: new Int8Array(n),
        returning: new Uint8Array(n),
        // 1 in the debris, 0 swallowed, 2 flown off.
        alive: new Uint8Array(n),
        swallowed: 0,
        escaped: 0,
    };
}

/** Hold the star together: the lattice rides on the centre of mass. */
function release(ev) {
    const [x, y, ux, uy] = ev.cm;
    const r = Math.hypot(x, y);
    const rx = x / r, ry = y / r;
    // In the plane, square to the radius.
    const tx = -ry, ty = rx;
    const R = STAR_RADIUS;
    let total = 0;
    for (let i = 0; i < ev.nAlong; i++) {
        const a = -1 + (2 * i) / (ev.nAlong - 1);
        for (let j = 0; j < ev.nAcross; j++) {
            const k = j * ev.nAlong + i;
            const bMax = Math.sqrt(Math.max(1 - a * a, 0));
            const b = ev.nAcross > 1 ? (-1 + (2 * j) / (ev.nAcross - 1)) * bMax : 0;
            const px = x + R * (a * rx + b * tx);
            const py = y + R * (a * ry + b * ty);
            const s = ev.state;
            s[4 * k] = px; s[4 * k + 1] = py; s[4 * k + 2] = ux; s[4 * k + 3] = uy;
            ev.E[k] = constants(px, py, ux, uy).E;
            // A uniform sphere seen face-on: column depth ∝ √(1 − a² − b²),
            // over the lattice's own spacing across (∝ bMax). Streams like
            // this one fragment under their own gravity into clumps
            // (Coughlin & Nixon 2015): a lumpiness fixed to each particle,
            // so the clumps travel with the gas.
            const clump = 0.55 + 0.45 * Math.sin(i * 0.37 + 1.3) * Math.sin(i * 0.113 + 0.4 + j * 0.2)
                + 0.25 * Math.sin(i * 1.71 + j);
            const w = Math.sqrt(Math.max(1 - a * a - b * b, 0)) * bMax * Math.max(clump, 0.08);
            ev.weight[k] = w;
            total += w;
            ev.alive[k] = 1;
            ev.lastUr[k] = -1;
            // It leaves at the star's own temperature, and cools as the
            // stream expands (heat decays below).
            ev.heat[k] = RELEASE_HEAT;
        }
    }
    for (let k = 0; k < ev.n; k++) ev.weight[k] /= total || 1;
    ev.released = ev.time;
}

/** Radial velocity sign of particle k. */
function radialVelocity(s, k) {
    return s[4 * k] * s[4 * k + 2] + s[4 * k + 1] * s[4 * k + 3];
}

/**
 * Advance the event by dt (M). `kappa` is the fraction of non-circular
 * motion a returning particle loses at pericentre; `inflow` the timescale
 * (M) on which ring gas drifts in.
 */
export function stepEvent(ev, dt, { kappa = 0.45, inflow = 60000, rMax = 1400 } = {}) {
    ev.time += dt;
    if (ev.released == null) {
        advance(ev.cm, ev.cmE, dt);
        const r = Math.hypot(ev.cm[0], ev.cm[1]);
        // It lets go at the tidal radius, or at pericentre if it only grazes it.
        const ur = radialVelocity(ev.cm, 0);
        if ((ur < 0 && r <= ev.rt) || (ur >= 0 && r <= ev.rt * 1.05)) release(ev);
        return ev;
    }
    const s = ev.state;
    const one = [0, 0, 0, 0];
    for (let k = 0; k < ev.n; k++) {
        if (ev.alive[k] !== 1) continue;
        for (let i = 0; i < 4; i++) one[i] = s[4 * k + i];
        if (!advance(one, ev.E[k], dt)) {
            ev.alive[k] = 0;
            ev.swallowed += ev.weight[k];
            continue;
        }
        const r = Math.hypot(one[0], one[1]);
        // Only unbound debris leaves for good; bound debris swinging past
        // the edge of the picture is still coming back.
        if (r > rMax && ev.E[k] >= 1) {
            ev.alive[k] = 2;
            ev.escaped += ev.weight[k];
            continue;
        }
        const ur = one[0] * one[2] + one[1] * one[3];
        // Pericentre: moving in a moment ago, out now. Apocentre: the other
        // way round, and from then on it is returning.
        if (ev.lastUr[k] < 0 && ur >= 0) ev.passes[k] = Math.min(ev.passes[k] + 1, 250);
        if (ev.lastUr[k] > 0 && ur <= 0) ev.returning[k] = 1;
        // Crossing its circularisation radius on the way back: the stream
        // there is running into the stream that went before it.
        const L = one[0] * one[3] - one[1] * one[2];
        const side = r > circularisationRadius(Math.abs(L)) ? 1 : -1;
        if (ev.returning[k] && ev.E[k] < 1 && side !== ev.side[k] && ev.side[k] !== 0) {
            ev.heat[k] += shockRadial(one, kappa);
            ev.E[k] = constants(one[0], one[1], one[2], one[3]).E;
        }
        ev.side[k] = side;
        // Gas gone round drifts in, losing angular momentum to viscosity.
        // Round: hardly moving radially, and its energy within a whisker of
        // a circular orbit's here (an eccentric orbit passes through the
        // local circular energy somewhere on every lap, so that alone isn't).
        const nx = one[0] / r, ny = one[1] / r;
        const u = one[2] * nx + one[3] * ny;
        if (ev.returning[k] && r > 3.5 && Math.abs(u) * r < 0.05 * Math.abs(L)
            && Math.abs(ev.E[k] - circularE(r)) < 0.002) {
            const f = 1 - dt / inflow;
            // Shrink the tangential part only.
            one[2] = u * nx + (one[2] - u * nx) * f;
            one[3] = u * ny + (one[3] - u * ny) * f;
            ev.E[k] = constants(one[0], one[1], one[2], one[3]).E;
            ev.heat[k] += (0.5 * dt) / inflow;
        }
        ev.lastUr[k] = ur;
        // Shock heat radiates away over a few orbits.
        ev.heat[k] *= Math.exp(-dt / 6000);
        for (let i = 0; i < 4; i++) s[4 * k + i] = one[i];
    }
    return ev;
}

/** Fractions of the star bound, swallowed and flown off. */
export function debrisBudget(ev) {
    let bound = 0, leaving = 0;
    for (let k = 0; k < ev.n; k++) {
        if (ev.alive[k] !== 1) continue;
        if (ev.E[k] < 1) bound += ev.weight[k];
        else leaving += ev.weight[k];
    }
    return { bound, leaving: leaving + ev.escaped, swallowed: ev.swallowed };
}

/**
 * The star's shape while it holds together: stretched along the line to the
 * hole by the tide, (r_t/r)³ of the way to breaking, squeezed the other two
 * ways to keep its volume. Returns the stretch factor along the radius.
 */
export function tidalStretch(r, rt) {
    const x = Math.min(Math.pow(rt / r, 3), 1);
    return 1 + 0.8 * x;
}
