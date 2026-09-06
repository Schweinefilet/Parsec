# Parsec

An interactive 3D atlas of the solar system. Fly to any planet, moon, dwarf
planet, asteroid or comet, watch them move on real orbits, and track the ISS
live over a rendered Earth.

**Live:** <https://parsec-uo4a.onrender.com/>

**Version 1.4.2.** Releases follow `MAJOR.MINOR.PATCH` — main version, big
patch, minor patch. See [CHANGELOG.md](CHANGELOG.md) for what each level means
and the history; `frontend/package.json` tracks the same number.

## Running it

```bash
cd frontend
npm install
npm run dev      # http://localhost:5173
```

```bash
npm test          # vitest — 107 tests
npm run lint
npm run build     # static bundle in frontend/dist
```

CI runs all three on every push, plus an asset-size budget.

There is no backend — every data source is called directly from the browser.

Optional: put a [NASA API key](https://api.nasa.gov/) in `frontend/.env.local`
as `VITE_NASA_API_KEY` to raise the rate limit on the near-Earth-object counter
in the telemetry ticker. Without one it falls back to `DEMO_KEY`.

## How it fits together

```text
frontend/src/
  components/
    SolarSystem3D.jsx    the main scene: planets, moons, belts, orbits, camera
    IssGlobe.jsx         live ISS globe with a real day/night terminator
    SpacecraftViewer.jsx orbit-controlled viewer for spacecraft models
    ObjectCard.jsx       catalog card, with generated art when no photo exists
    ObjectDetailBody.jsx description + stats + distance chart, shared by
                         the desktop panel and the mobile sheet
    DistanceChart.jsx    inline-SVG distance-over-time chart
    TimeControl.jsx      scrub the whole system through time
  data/
    objectCatalog.js     the 70 objects and their stats — single source of truth
                         for both the catalog and the category nav
    objectImages.js      curated, load-verified NASA image per object
  utils/
    simTime.js            the clock the scene runs on (see "Time")
    orbits.js             real heliocentric + Keplerian position maths
    orbitalMotion.js      moon speed/angle arithmetic (see "Watch out for")
    quality.js            per-device render settings — read this before adding
                          anything expensive to the scene
    proceduralTextures.js painted surface maps for bodies with no photographic
                          texture (Io's sulfur, Europa's linea, Pluto's heart)
    spacecraftModels.js   spacecraft built from primitives, no model downloads
```

### Performance is a feature here

`utils/quality.js` picks a tier from the device and everything expensive reads
from it: texture set, canvas pixel budget, shadow maps, belt density, geometry
detail. This exists because the scene originally shipped 4K maps to every
device, which came to ~395 MB of GPU texture memory — past what mobile Safari
will allocate, so iOS dropped textures or killed the tab rather than warning.

If you add a texture, a light, or per-frame work, put it behind a tier setting.
The numbers worth keeping an eye on: total payload (currently ~7 MB on phones,
~13 MB elsewhere) and canvas pixel count (budgeted, see `pixelRatioFor`).

### Watch out for

**Non-finite numbers in the render loop.** The moons once vanished until you
reloaded because focusing a moonless planet made a speed target `Infinity`,
and `Infinity - Infinity` is `NaN`, which then propagated through every
subsequent frame. `utils/orbitalMotion.js` holds that arithmetic behind
guards, with tests that fail if the guards are removed.

**`HelioVector` returns J2000 *equatorial* coordinates**, not ecliptic. The
scene maps them as `(x, z, y)` and derives the belt plane from two Mars
samples so the belts share a plane with the orbit rings. `orbits.test.js`
pins that ~23.4° tilt, so a frame change can't slip through unnoticed.

### Time

Every position is computed from a date, so making the system explorable in
time only meant changing which date. `utils/simTime.js` holds one simulated
instant and a rate; the render loop reads it each frame *imperatively*, so
dragging the scrubber through a decade never re-renders React.

Two things to know if you touch this:

- Planet positions cost an ephemeris call each, far too much per frame at real
  time, so they refresh once a minute while live and every other frame while
  scrubbing. The switch keys off `isLive()`, not the rate — jumping to another
  date at rate 1 still has to move the planets.
- Moons move two different ways on purpose. Live, the angle is integrated and
  multiplied by a large factor, because a Galilean moon at its true rate is
  motionless to the eye. Scrubbing, the angle is computed absolutely from the
  date, so the system is correct for what is on screen and running time
  backwards puts every moon exactly where it was. `scrubBase` carries the live
  angles across the switch so the two modes join without a jump.

### Positions are real

Planet positions come from [astronomy-engine](https://github.com/cosinekitty/astronomy)
(`HelioVector`), so the layout matches the actual sky for the current date;
orbit rings are sampled from the same source. Dwarf planets, asteroids and
Halley use J2000 Keplerian elements. Distances are compressed for legibility —
hence the "not to scale" note in the corner.

Moon orbits are stylised: spacing and speeds are chosen so a system is readable
when you focus its planet, not to scale.

### Assets

Textures ship at 2K, with a 1K set under `public/textures/1k/` for phones. The
ISS and Vesta meshes are decimated for the web and load during idle time rather
than blocking the first frame. Bodies with no photographic map are painted at
runtime, which costs no download at all.

CI enforces a budget on `public/textures`, `public/models` and `dist`. If you
need to raise it, that should be a deliberate decision rather than a surprise.

### Deployment

Static build, served by Render from `frontend/dist`.

Client-side routing needs the host to hand unknown paths back to the SPA. The
build emits a `404.html` copy of the shell, which makes deep links work
anywhere with no configuration — but they still answer with a 404 *status*,
which link previews and crawlers treat as broken. For a proper 200, set the
rewrite in Render → Settings → Redirects/Rewrites:

    Source /*   Destination /index.html   Action Rewrite

`render.yaml` declares the same rule, but it only applies automatically if the
service was created from a blueprint.
