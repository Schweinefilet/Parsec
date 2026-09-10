# Parsec

An interactive 3D atlas of the solar system. Fly to any planet, moon, dwarf
planet, asteroid or comet, watch them move on real orbits, scrub the whole
system through time, overlay its gravity, and track the ISS and other
spacecraft live over a rendered Earth. The interface is available in English,
Vietnamese and Arabic.

**Live:** <https://p4rsec.com/> (the `parsec-uo4a.onrender.com` origin still
works)

Releases follow `MAJOR.MINOR.PATCH` — main version, big patch, minor patch. The
current version is the newest heading in [CHANGELOG.md](CHANGELOG.md), which is
also what `frontend/package.json` carries; that file explains what each level
means and holds the full history.

Every commit that changes behaviour ships as a release: a version bump in
`frontend/package.json`, a `CHANGELOG.md` entry, a plain-language line in
`src/data/whatsNew.js` if a visitor would notice, and a commit titled with the
version. [CLAUDE.md](CLAUDE.md) has the full checklist and the things most
likely to bite.

## Running it

```bash
cd frontend
npm install
npm run dev      # http://localhost:5173
```

```bash
npm test          # vitest
npm run lint
npm run build     # static bundle in frontend/dist
```

CI runs all three on every push, plus an asset-size budget on
`public/textures`, `public/models` and `dist`.

There is no backend — every data source is called directly from the browser.

Optional: put a [NASA API key](https://api.nasa.gov/) in `frontend/.env.local`
as `VITE_NASA_API_KEY` to raise the rate limit on the near-Earth-object counter
in the telemetry ticker. Without one it falls back to `DEMO_KEY`.

## How it fits together

There is one `<Route path="*">` (`src/App.jsx`) so `AppShell`,
`CategoryBrowser` and `SolarSystem3D` are never remounted while navigating —
that is what preserves the Three.js camera state and lets the exit animation
play. `/satellites`, `/compare` and `/tonight` are the other three routes.

```text
frontend/src/
  App.jsx                the router; AppShell wraps every page (header, search)
  pages/
    CategoryBrowser.jsx  catalog + 3D scene + object detail — the home route
    SatelliteView.jsx    the satellite tracker (/satellites)
    ComparePage.jsx      two bodies side by side at true relative size (/compare)
    TonightPage.jsx      what is above your horizon right now (/tonight)
  components/
    SolarSystem3D.jsx    the main scene: planets, moons, belts, orbits, camera,
                         the focus camera, the gravity overlays (~3k lines)
    SatelliteGlobe.jsx   the tracker's globe: real day/night terminator, orbit
                         path, footprint — any tracked spacecraft, not just ISS
    SpacecraftViewer.jsx orbit-controlled viewer for spacecraft models
    TimeControl.jsx      scrub the whole system through time
    ScenePanel.jsx       the left-edge drawer of scene toggles (distances,
                         gravity, drift) + DriftSliders
    ObjectCard.jsx       catalog card, with generated art when no photo exists
    ObjectDetailBody.jsx description + stats + distance chart, shared by
                         the desktop panel and the mobile sheet
    DistanceChart.jsx    inline-SVG distance-over-time chart
    CoachMark.jsx        first-visit hint callouts (arrow + one line, no box)
    WhatsNew.jsx         the "Version history" panel behind the header version
    LanguagePicker.jsx   the language menu; SystemTitle is the scene's heading
    LiveFeed.jsx / SpaceDataStrip.jsx   the telemetry ticker and its data
  data/
    solarSystemBodies.js the bodies the 3D scene draws, and their layout
    objectCatalog.js     the 70 catalog objects and their stats — source of
                         truth for the catalog and the category nav
    objectImages.js      curated, load-verified NASA image per object
    trackedSatellites.js the spacecraft the tracker follows (one line each)
    whatsNew.js           plain-language release notes for the in-app panel
    systems.js            the systems the atlas can show (one today)
  i18n/                  the translation layer — see "Internationalisation"
  hooks/
    useSatelliteTracking.js  every tracked spacecraft, propagated from TLEs
    useNearViewport.js    gate expensive loads on approaching the viewport
    useObserverLocation.js / useNearestCountry.js / useMediaQuery.js  …
  utils/
    simTime.js            the clock the scene runs on (see "Time")
    scaleMode.js          compressed layout ⇄ true distances, and the transition
    vizMode.js            the gravity overlay mode: off / grid / field lines
    driftControl.js       idle camera drift rates (yaw/pitch/roll), persisted
    assetLoading.js       what the scene is loading, for the loading screen
    orbits.js             real heliocentric + Keplerian position maths
    orbitalMotion.js      moon speed/angle arithmetic (see "Watch out for")
    gravityModel.js       real mass → drawable field weight, for both overlays
    gravityField.js / gravityGrid.js / gravityLines.js   the overlay renderers
    quality.js            per-device render settings — read this before adding
                          anything expensive to the scene
    proceduralTextures.js painted surface maps for bodies with no photographic
                          texture (Io's sulfur, Europa's linea, Pluto's heart)
    spacecraftModels.js   spacecraft built from primitives, no model downloads
    nearestCountry.js     which country the ISS ground point is closest to
    celestrakElements.js  current TLEs, cached — asks once per group (see below)
    probeTracks.js        the Voyagers' flown trajectories, and the radial
                          compression every off-ring position goes through
    objectSize.js         the catalog's prose sizes as numbers, for comparing
    skyPositions.js / skyEvents.js   altitude/azimuth, and the sky calendar
    shareView.js          the scene's camera, clock and layout as a link
    documentHead.js       per-route <title> and canonical link (no SSR)
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

CelesTrak is generous but not infinite, and they will block you for asking
badly — they blocked this site during development, and their message doubles as
the specification: element files are only *checked* for updates every two hours
and most update two or three times a day. So `celestrakElements.js` asks once
per **group** rather than once per satellite, caches to `localStorage` for six
hours so a reload never touches the network, and serves whatever it has when a
fetch fails rather than going blank. A failed group fetch deliberately does not
fall back to per-object requests: answering a block with three more requests is
how you stay blocked.

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

### The scene toggles are module singletons, not React state

`simTime` is the first of a family. The scene is built once inside a
`useEffect` with an empty dependency list, and that effect must never re-run —
so every piece of state the render loop reads each frame lives in a plain
module with a `subscribe`/notify API, read imperatively:

| Module | Holds |
| --- | --- |
| `utils/simTime.js` | the simulated clock and rate |
| `utils/scaleMode.js` | compressed layout ⇄ true distances, mid-transition |
| `utils/vizMode.js` | the gravity overlay: off, warped grid, or field lines |
| `utils/driftControl.js` | idle-drift rates for yaw, pitch and roll (persisted) |
| `utils/assetLoading.js` | which textures and models are still loading |

Each eases its own value — switching layouts or overlays crossfades over a few
hundred milliseconds, which is not twenty-three React renders. The UI controls
(`TimeControl`, `ScenePanel`, `LoadingScreen`) mirror the value into local
state through the matching `subscribeX` so the buttons stay in sync, but the
scene never reads React for any of it. A new toggle of this kind follows the
same shape.

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

### Sharing a view

Most of the site's state is already in the address — the focused object, the
tracked satellite, the compared pair. The 3D scene was the exception: camera,
clock and layout lived only in memory, so "look at this" was not something you
could send. `shareView.js` folds those three into query parameters and back,
and the copy button in the header works from any page (elsewhere the URL is
already complete).

The camera goes in as spherical coordinates because that is what OrbitControls
maintains, and the clock goes in as an absolute instant rather than an offset —
"thirty days ahead" would mean something different tomorrow, and a link should
not drift after you send it. Anything malformed is discarded rather than
applied; links get truncated and hand-edited, and the failure mode of trusting
one is a camera inside the Sun.

### Orbit paths are pixels, not tubes

Orbit rings are `Line2` from three.js's examples, whose width is in **pixels**.
They used to be `TubeGeometry`, which has a radius in scene units — so how thick
a ring looked depended entirely on how far away the camera was. That was
survivable at one camera distance, and at the six-times-further one true
distances asks for, a 0.28-unit tube renders about a tenth of a pixel wide and
vanishes. The Voyager tracks stayed visible throughout precisely because they
were plain lines.

Pixel width also makes scaling a ring exact — there is no tube to fatten with
the path, which is what the 2.0.0 rebuild machinery existed to work around, now
deleted — and costs a good deal less: 512 triangles per ring against a tube's
4,096. `LineMaterial` needs the drawing buffer size to convert pixels to clip
space, so it is updated with the renderer; a stale one makes every ring the
wrong thickness.

### Scale

Every position in the scene is a direction times a radius, which is what makes
`/` able to show true distances at all: switching layouts is a matter of which
radius, and a body, its orbit ring and its share of a belt travel together
because they share the factor. Nothing is resampled from the ephemeris for it.

Two things do *not* follow from a single multiply, and each is handled where it
is described in `SolarSystem3D.jsx`:

- **Belt LOD rocks are instanced meshes.** Scaling the object enlarges the
  rocks with their orbits, which puts Kuiper boulders wider than Neptune on
  screen. The instances are moved instead; their sizes are left alone.
- **The belts map AU onto units affinely**, not proportionally, so no single
  factor can express them. Each particle is remapped through its own radius.

Only distances become true. Bodies keep their drawn sizes, because at true
scale Earth is four thousandths of a unit across and the view would be empty —
a fact better said in words than demonstrated, which is what the corner caption
now does instead of apologising.

### Seeing the gravity

The overlay in `ScenePanel` has two layers, cycled off → warped grid → field
lines. Both act on the same set of bodies from `utils/gravityModel.js`, which
exists because the real numbers do not plot. Planetary mass spans eight orders
of magnitude, so a well depth proportional to mass gives the Sun everything and
every planet nothing; and the scene's radii are already compressed, so real
inverse-square falloff would collapse to a spike at each body. `gravityModel`
maps mass to a drawable "field weight" on a curve that keeps every planet
visible, and the overlays work in that space, not in kilograms.

- **The warped grid** (`gravityGrid.js`) is a `PlaneGeometry` whose vertices
  are pushed down by a Gaussian dimple per body in the vertex shader, with the
  grid lines and a soft per-body window drawn in the fragment shader. Writing
  shader code here: `patch` is a reserved word in GLSL ES (it is why the mask
  variable is called `win`), and a backtick in a shader comment terminates the
  JS template literal the shader lives in.
- **The field lines** (`gravityField.js` + `gravityLines.js`) trace streamlines
  of `g(P) = Σ −G·mᵢ·(P−Pᵢ)/|P−Pᵢ|³` with a fixed-step integrator, tint each
  line toward the colour of the body it flows into, and cap it with a small
  arrowhead at the tip.

Both keep pace with the planets at a year a second because they read body
positions from the same frame the scene just computed.

The idle camera drift (`driftControl.js`) is the other thing `ScenePanel`
exposes: the slow turntable spin the scene has always had, now three signed
rate sliders — yaw, pitch, roll. There are no limits; pitch somersaults over
the poles and roll spins freely, because the camera's up and right vectors are
re-derived every frame and rotated along with it. OrbitControls cannot roll, so
the drift is applied by hand after `controls.update()` as three rotations of
the camera about its target.

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

### Internationalisation

The interface is in English, Vietnamese and Arabic; Arabic lays the page out
right-to-left. There is no i18n library — `src/i18n/translate.js` is forty
lines of key lookup, one `{placeholder}` interpolation form, and
`Intl.PluralRules` for the plural categories. react-i18next is forty kilobytes
to reach the same place on a page that spends its budget on textures.

Two things are being translated, and they are different problems:

- **The interface** — ~200 strings in `src/i18n/locales/{en,vi,ar}.js`, written
  to be translated. `en` is bundled (it is the fallback behind every missing
  key); `vi` and `ar` are dynamic `import()` chunks, so a reader who never
  switches never downloads them. Arabic alone is 28 KB gzipped.
- **The catalog** — 70 objects with a name, a type, a paragraph and ~800 stat
  *values*, which are not sentences ("2,439.7 km", "−180 to 430 °C",
  "Herschel, 1781"). `src/i18n/localizeCatalog.js` and
  `src/i18n/catalog/{ar,vi}.js` handle the value grammar — a number, a unit and
  a qualifier drawn from a small vocabulary — rather than translating free
  text. Catalog numbers stay in Western digits and English grouping.

**Coverage is enforced by generated tests.** `src/i18n/i18n.test.js` fetches
every locale and, for each non-English one, asserts it translates every key
English has and carries none English does not — plus scene-body names, category
labels and the prose checks. A missing key is a caught test failure, not an
English sentence surfacing mid-page. So **adding any `t()` key means adding it
to all three locale files** (and catalog text to both catalog files). Adding a
whole language is a known checklist — `locales/index.js`, a `load.js` loader,
the two locale files, the two catalog files, and a 240-entry country list;
`i18n.test.js` and `countries.test.js` tell you what is still missing.

RTL detail: the `flip-rtl` class (`index.css`) mirrors an icon in the Arabic
layout, but any inline `transform` overrides it, so components that need both
fold the flip into their transform string.

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

Static build, served by Render from `frontend/dist`, with Cloudflare (DNS +
CDN) in front of `p4rsec.com`. Pushing to `main` deploys.

Client-side routing needs the host to hand unknown paths back to the SPA. The
build emits a `404.html` copy of the shell, which makes deep links work
anywhere with no configuration — but they still answer with a 404 *status*,
which link previews and crawlers treat as broken. For a proper 200, set the
rewrite in Render → Settings → Redirects/Rewrites:

    Source /*   Destination /index.html   Action Rewrite

`render.yaml` declares the same rule, but it only applies automatically if the
service was created from a blueprint.

Two things that have bitten before:

- **The repo-root `.gitignore` has a broad `*.txt` rule** from unrelated
  boilerplate. A `.txt` file added under `frontend/public/` (a `robots.txt`,
  say) is silently untracked until it is allow-listed with a `!` line. Run
  `git status` and confirm new static files show as staged.
- **Cloudflare caches at the edge for five minutes.** A path that 404-fell-back
  to the SPA shell before its real file existed stays cached as `text/html`
  until the TTL lapses or the cache is purged. Verify a deploy with a
  cache-buster query (`?cb=…` → `cf-cache-status: MISS`); the clean URL a
  crawler sees can lag.
