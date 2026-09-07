# Parsec

An interactive 3D atlas of the solar system. Fly to any planet, moon, dwarf
planet, asteroid or comet, watch them move on real orbits, and track the ISS
live over a rendered Earth.

**Live:** <https://parsec-uo4a.onrender.com/>

**Version 1.5.2.** Releases follow `MAJOR.MINOR.PATCH` — main version, big
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
    nearestCountry.js     which country the ISS ground point is closest to
    probeTracks.js        the Voyagers' flown trajectories, and the radial
                          compression every off-ring position goes through
    objectSize.js         the catalog's prose sizes as numbers, for comparing
    skyPositions.js       altitude and azimuth from where the viewer is standing
    scaleMode.js          compressed layout ⇄ true distances, and the transition
    useNearViewport.js    gate expensive loads on approaching the viewport
    useSatelliteTracking.js  every tracked spacecraft, propagated from TLEs
```

### Performance is a feature here

`utils/quality.js` picks a tier from the device and everything expensive reads
from it: texture set, canvas pixel budget, shadow maps, belt density, geometry
detail. This exists because the scene originally shipped 4K maps to every
device, which came to ~395 MB of GPU texture memory — past what mobile Safari
will allocate, so iOS dropped textures or killed the tab rather than warning.

If you add a texture, a light, or per-frame work, put it behind a tier setting.
The numbers worth keeping an eye on: total payload (currently ~2.7 MB on phones,
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

**Textures reach the GPU when something using them is first drawn**, not when
they finish loading. The upload and its mipmaps are a stall, so left alone the
scene hitches every few seconds as bodies rotate into view and then runs
perfectly once they are all resident — "laggy for a minute, then fine", which
reads like a slow network and is not. `SolarSystem3D` walks the `textures` list
a couple per frame calling `renderer.initTexture`, which pays that cost up front
and thinly. If you add a texture, put it in that list.

**`loading="lazy"` is the browser's judgement, not yours.** The catalog sits a
screen below the 3D scene, and its cards carry megapixel photographs — seven of
them, 30 MB of decoded pixels, were being fetched during the scene's first
seconds for cards nobody had scrolled to. `useNearViewport` gates the `<img>`
on an IntersectionObserver instead, so the margin is ours.

**Cubing a width ratio is not a volume ratio.** Jupiter's catalog radius is
equatorial, and Jupiter is 6.5% flattened, so cubing it says 1,413 Earths fit
inside — where every textbook says 1,321. `objectSize.js` carries flattening
for the bodies that spin fast enough to bulge and computes an oblate spheroid;
everything else is a sphere, which for a moon it may as well be.

**Lerping between two points at the same radius does not keep the radius.**
The tracker's camera followed its target by lerping toward a point the same
distance from Earth's centre — but a straight line between two points on a
sphere is a chord, so every frame of following lost a little altitude, and the
camera crept inward until it hit `minDistance`. It went unnoticed while there
was one satellite to follow and the swing was small; picking a different one is
a much bigger swing, and it became obvious. The fix is a `setLength` after the
lerp.

**A "where is it now" API you can call from a browser is rarer than it looks.**
Adding Tiangong and Hubble to the tracker took three attempts. wheretheiss.at,
which the ISS uses, serves exactly one satellite — everything else 404s. N2YO
covers the whole catalog and answers `curl` happily, but sends no
`Access-Control-Allow-Origin`, so a browser will not read the response, and on
a static site its key would ship in the bundle with a quota anyone could spend.
What works is doing the sum here: CelesTrak serves current TLEs with CORS and
no key, and SGP4 turns one into a position. Checked against the live ISS fix it
lands within half a kilometre, and against N2YO for all three within about
seven — which at 7.6 km/s is well under a second of clock difference.

Doing it locally is also what makes the tracker work for more than one
spacecraft. A position costs nothing, so everything updates every second rather
than every five, a whole orbit can be drawn the instant you pick something
instead of accumulating while you watch, and adding a fourth satellite is a
line in `data/trackedSatellites.js`. Sunlight and footprint, which the old
single-satellite feed handed over for free, are computed in
`useSatelliteTracking.js` — a cylindrical shadow test and a horizon distance.

**Two coordinate frames that look identical until they don't.**
`HelioVector` returns J2000 *equatorial*; JPL Horizons hands you J2000
*ecliptic* unless you ask for `REF_PLANE='FRAME'`. Both are three numbers in
AU, both plot fine, and mixing them tilts one against the other by 23.4° —
which is what had happened to the pinned Voyager state vectors, leaving both
spacecraft sitting well off the plane they belong to with nothing obviously
wrong on screen. The check that would have caught it is the one
`probeTracks.test.js` now makes: at a gravity assist the spacecraft and the
planet are in the same place, so the two have to agree to within a planet's
drawn radius, and a frame error shows up as a gap of about 77 units instead
of one.

**React state written from the render loop.** The object labels used to be
`useState` rebuilt every frame: ~18 elements reconciled and re-laid-out at
60 Hz, each pass preceded by a `getBoundingClientRect()` that forced a
synchronous layout. On a desktop that only wastes a budget nothing else was
using. On a phone it left the main thread no gap between frames, and
everything that needs one — texture decodes, model parsing, every
`requestIdleCallback` — waited behind it, which is what made a first load
take minutes rather than seconds. Labels are now plain DOM nodes moved with a
composited `transform`; React hears only when the *set* of labels changes.
Anything that has to move every frame belongs outside React, the same way
`simTime` does.

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

The Voyager tracks are the trajectories the spacecraft actually flew, sampled
from JPL Horizons and baked into `data/voyagerTracks.json` — every bend in them
is a real gravity assist. Voyager 2 is the one that did the Grand Tour;
Voyager 1 traded Uranus and Neptune for a close pass of Titan, which is why its
track leaves the plane of the planets after Saturn and never returns to it.

Anything not drawn on a ring goes through `sceneRadiusForAU`, which is built
from the `au`/`orbitR` pair on each planet, so a trajectory running from Earth's
ring out past Neptune's is squeezed exactly as the rings are and passes through
the planets it flew by. `probeTracks.test.js` pins that: change a ring radius
without changing its `au` and it fails.

### Scale

Every position in the scene is a direction times a radius, which is what makes
`/` able to show true distances at all: switching layouts is a matter of which
radius, and a body, its orbit ring and its share of a belt travel together
because they share the factor. Nothing is resampled from the ephemeris for it.

Three things do *not* follow from a single multiply, and each is handled where
it is described in `SolarSystem3D.jsx`:

- **Orbit rings are tubes.** Scaling one is exact for the path and wrong for
  the tube around it — at Pluto's factor a 0.28-unit line becomes 2.59 units
  thick. They are hidden while the planets move and rebuilt at the radius they
  came to rest at, from the points they were first built from.
- **Belt LOD rocks are instanced meshes.** Scaling the object enlarges the
  rocks with their orbits, which puts Kuiper boulders wider than Neptune on
  screen. The instances are moved instead; their sizes are left alone.
- **The belts map AU onto units affinely**, not proportionally, so no single
  factor can express them. Each particle is remapped through its own radius.

Only distances become true. Bodies keep their drawn sizes, because at true
scale Earth is four thousandths of a unit across and the view would be empty —
a fact better said in words than demonstrated, which is what the corner caption
now does instead of apologising.

### What's up tonight

`/tonight` answers the question you ask outdoors rather than the one the rest of
the site answers: not where a planet is in the solar system, but whether it is
above *your* horizon, how high, and which way to face. Same ephemeris, different
frame — `Astronomy.Horizon` turns a position and an observer into an altitude
and an azimuth, and `skyPositions.js` is arranged around that one call.

The chart is a panorama rather than the traditional round star map, because the
question is not "what does the sky look like" but "which way do I turn and how
far up", and laid out flat the answer is a pair of coordinates.

The location is kept in `localStorage`, rounded to two decimals. A page whose
point is "come back tomorrow night" cannot ask permission every time, and the
sky does not change measurably across the kilometre that rounding costs — so
the rest of a GPS fix is precision with no use and no business being stored.
Nothing is sent anywhere; the positions are computed on the device.

### Compare

`/compare?a=jupiter&b=earth` puts two bodies side by side at true relative
size — the one place on the site where nothing is compressed, which is why the
note under it says so.

Sizes come from parsing the catalog's own prose (`objectSize.js`): "71,492 km",
"~715 km", "2.38 R⊕", "58 cm", and Haumea's "1,960 × 1,518 × 996 km", which is
triaxial and needs the geometric mean rather than whichever number the regex
reaches first. Reading the rows rather than adding a second radius field is
deliberate — two copies of a number drift, and the one on screen is the one
people would notice was wrong. `objectSize.test.js` pins the parse for the
whole catalog, including an ordering check that would fail if a unit were
misread. Light-years are excluded on purpose: Andromeda beside Earth is not a
comparison.

### Assets

Textures ship at 2K, with a 1K set under `public/textures/1k/` for phones.
Bodies with no photographic map are painted at runtime, which costs no
download at all.

The ISS (2.8 MB) and Vesta (1.9 MB) meshes are decimated for the web and still
dominate the payload, so the phone tier (`heavyModels: false`) does not fetch
them with the scene. Vesta keeps a painted sphere, which is what every other
small body gets anyway. A sphere is the wrong shape for the ISS, so that model
is fetched the moment you focus it instead. Everywhere else both load during
idle time rather than blocking the first frame.

`src/data/landPoints.json` is the odd one out: 15,840 coastline and interior
points sampled from Natural Earth (public domain), which the ISS tracker uses
to name the nearest country. It is loaded with a dynamic `import()` so it lands
as its own ~21 KB chunk that only that page fetches. Regenerate it with
`node scripts/build-land-points.mjs`, which documents the sampling and the
accuracy it buys.

A reverse-geocoding API cannot answer this question, which is why the table
exists: the station is over water about seven tenths of the time, and
wheretheiss.at's own coordinate endpoint returns `"??"` for every point at sea.
"Nearest" and "over" are different questions, and only the first has an answer
most of the time.

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
