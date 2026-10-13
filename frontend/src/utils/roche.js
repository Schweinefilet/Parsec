// A star overflowing its Roche lobe onto a black hole, for /exotic/roche.
//
// Units: the separation A = 1, total mass 1, orbital angular velocity Ω = 1.
// Everything is worked in the frame turning with the orbit, centre of mass
// at the origin, the donor star on +x and the accretor on −x. q is the mass
// ratio M_donor / M_accretor.
//
// The Roche potential (gravity of two point masses plus the centrifugal
// term) has a saddle between the stars, L1. A star that swells to the
// equipotential through L1 fills its lobe and takes its teardrop shape;
// any further and gas pours through L1 in a thin stream that the Coriolis
// force swings round the accretor, where it circles and spreads into a disk.
//
// At the real size of an X-ray binary (a separation of millions of
// gravitational radii) the hole's own lensing is a few pixels across, so
// this scene is ray marched in flat space. The donor's surface, the stream
// and the disk come from the maths here; `rochePotential` is the shader's
// `roche`, line for line.

export function masses(q) {
    return { md: q / (1 + q), ma: 1 / (1 + q) };
}

/** Donor and accretor x positions, centre of mass at 0. */
export function positions(q) {
    const { md, ma } = masses(q);
    return { xd: ma, xa: -md };
}

/** Roche potential at (x, y, z) in the corotating frame. */
export function rochePotential(x, y, z, q) {
    const { md, ma } = masses(q);
    const { xd, xa } = positions(q);
    const rd = Math.sqrt((x - xd) ** 2 + y * y + z * z);
    const ra = Math.sqrt((x - xa) ** 2 + y * y + z * z);
    return -md / rd - ma / ra - 0.5 * (x * x + y * y);
}

/** Gradient of the potential (the negative of the effective gravity). */
export function rocheGradient(x, y, z, q) {
    const { md, ma } = masses(q);
    const { xd, xa } = positions(q);
    const dd = [x - xd, y, z];
    const da = [x - xa, y, z];
    const rd3 = Math.hypot(...dd) ** 3;
    const ra3 = Math.hypot(...da) ** 3;
    return [
        (md * dd[0]) / rd3 + (ma * da[0]) / ra3 - x,
        (md * dd[1]) / rd3 + (ma * da[1]) / ra3 - y,
        (md * dd[2]) / rd3 + (ma * da[2]) / ra3,
    ];
}

/** The inner Lagrange point: where the x-gradient vanishes between the stars. */
export function l1Point(q) {
    const { xd, xa } = positions(q);
    let lo = xa + 1e-6, hi = xd - 1e-6;
    for (let i = 0; i < 100; i++) {
        const mid = 0.5 * (lo + hi);
        // Just right of the accretor dΦ/dx > 0 (its pull dominates); flip there.
        if (rocheGradient(mid, 0, 0, q)[0] > 0) lo = mid; else hi = mid;
    }
    return 0.5 * (lo + hi);
}

/**
 * Eggleton (1983): the radius of a sphere with the volume of the lobe of the
 * star of mass ratio q (its mass over the other's), good to 1% for any q.
 */
export function eggletonRadius(q) {
    const q3 = Math.cbrt(q);
    return (0.49 * q3 * q3) / (0.6 * q3 * q3 + Math.log(1 + q3));
}

/**
 * Distance from the donor's centre to its lobe's surface along the unit
 * direction `n`: where the potential reaches its L1 value. Bisection; the
 * potential rises monotonically out from the star until the lobe's edge.
 */
export function lobeRadius(n, q, phiL1 = rochePotential(l1Point(q), 0, 0, q)) {
    const { xd } = positions(q);
    let lo = 1e-4, hi = xd - l1Point(q);
    for (let i = 0; i < 60; i++) {
        const mid = 0.5 * (lo + hi);
        const v = rochePotential(xd + mid * n[0], mid * n[1], mid * n[2], q);
        if (v < phiL1) lo = mid; else hi = mid;
    }
    return 0.5 * (lo + hi);
}

/** Volume-equivalent radius of the donor's lobe, by quadrature over the sphere. */
export function lobeVolumeRadius(q, nTheta = 48, nPhi = 96) {
    const phiL1 = rochePotential(l1Point(q), 0, 0, q);
    let vol = 0;
    for (let i = 0; i < nTheta; i++) {
        // Gauss–Chebyshev-ish midpoints in cos θ, with the pole on +x, the
        // axis pointing at L1, so the pointed tip is resolved best.
        const mu = -1 + (2 * (i + 0.5)) / nTheta;
        const st = Math.sqrt(1 - mu * mu);
        for (let j = 0; j < nPhi; j++) {
            const ph = (2 * Math.PI * (j + 0.5)) / nPhi;
            const n = [-mu, st * Math.cos(ph), st * Math.sin(ph)];
            vol += lobeRadius(n, q, phiL1) ** 3 / 3;
        }
    }
    vol *= (2 / nTheta) * ((2 * Math.PI) / nPhi);
    return Math.cbrt((3 * vol) / (4 * Math.PI));
}

/**
 * The gas stream: a parcel let go from just past L1 towards the accretor and
 * followed under the Roche potential and the Coriolis force,
 *   a = −∇Φ − 2Ω × v.
 * Stops on reaching `rStop` from the accretor, at its closest approach, or
 * after `maxT`. Returns the path as `count` points evenly spaced along it.
 */
export function streamPath(q, { count = 48, rStop = 0.05, dt = 1e-4, maxT = 3 } = {}) {
    const { xa } = positions(q);
    const lx = l1Point(q);
    let x = [lx - 1e-3, 0, 0];
    let v = [-0.01, 0, 0];
    const raw = [x.slice()];
    const acc = (p, u) => {
        const g = rocheGradient(p[0], p[1], p[2], q);
        return [-g[0] + 2 * u[1], -g[1] - 2 * u[0], -g[2]];
    };
    let t = 0;
    let rMin = Infinity;
    for (; t < maxT; t += dt) {
        // RK4 on (x, v).
        const a1 = acc(x, v);
        const x2 = x.map((p, i) => p + 0.5 * dt * v[i]), v2 = v.map((p, i) => p + 0.5 * dt * a1[i]);
        const a2 = acc(x2, v2);
        const x3 = x.map((p, i) => p + 0.5 * dt * v2[i]), v3 = v.map((p, i) => p + 0.5 * dt * a2[i]);
        const a3 = acc(x3, v3);
        const x4 = x.map((p, i) => p + dt * v3[i]), v4 = v.map((p, i) => p + dt * a3[i]);
        const a4 = acc(x4, v4);
        x = x.map((p, i) => p + (dt / 6) * (v[i] + 2 * v2[i] + 2 * v3[i] + v4[i]));
        v = v.map((p, i) => p + (dt / 6) * (a1[i] + 2 * a2[i] + 2 * a3[i] + a4[i]));
        raw.push(x.slice());
        const ra = Math.hypot(x[0] - xa, x[1], x[2]);
        if (ra > rMin && ra < 0.5) break; // past periastron: it would circle from here
        rMin = Math.min(rMin, ra);
        if (ra < rStop) break;
    }
    // Resample evenly along the path: the parcel crawls away from L1 and
    // races near the accretor, so even time steps bunch up at the start.
    const cum = [0];
    for (let i = 1; i < raw.length; i++) {
        cum.push(cum[i - 1] + Math.hypot(raw[i][0] - raw[i - 1][0], raw[i][1] - raw[i - 1][1], raw[i][2] - raw[i - 1][2]));
    }
    const total = cum[cum.length - 1];
    const points = [];
    let j = 0;
    for (let i = 0; i < count; i++) {
        const s = (total * i) / (count - 1);
        while (j < cum.length - 2 && cum[j + 1] < s) j++;
        const f = cum[j + 1] > cum[j] ? (s - cum[j]) / (cum[j + 1] - cum[j]) : 0;
        points.push(raw[j].map((p, k) => p + Math.min(f, 1) * (raw[j + 1][k] - p)));
    }
    return { points, rMin, end: x, endVelocity: v, length: total };
}

/**
 * Jacobi constant per unit mass, ½v² + Φ: conserved along the stream in the
 * rotating frame. The tests hold the integrator to it.
 */
export function jacobi(x, v, q) {
    return 0.5 * (v[0] ** 2 + v[1] ** 2 + v[2] ** 2) + rochePotential(x[0], x[1], x[2], q);
}

/**
 * Lubow & Shu (1975) as fitted by Ulrich & Burger: the stream's closest
 * approach to the accretor, r_min ≈ 0.0488 q^−0.464, for 0.05 < q < 1.
 */
export function lubowShuMin(q) {
    return 0.0488 * Math.pow(q, -0.464);
}

/** The accretion disk's outer edge: tidal truncation, about 0.6 of the accretor's lobe. */
export function diskOuterRadius(q) {
    return 0.6 * eggletonRadius(1 / q);
}
