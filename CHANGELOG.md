# Changelog

## Versioning

`MAJOR.MINOR.PATCH` — read as **main version . big patch . minor patch**.

- **MAJOR** — a release that changes what the site *is*: a new mode of
  exploring, a redesign, a rewrite people would notice immediately.
- **MINOR** ("big patch") — a substantial feature or a body of work: the time
  control, the ISS tracker, an overhaul of how something is rendered.
- **PATCH** ("minor patch") — fixes, tuning, and small additions that improve
  what is already there without adding a new capability.

Every release is a commit titled with its version. The version in
`frontend/package.json` matches the newest entry here; keep them in step.

---

## 2.0.1

- **The scale toggle is no longer buried under the time control.** It sat on
  the same row, to the left of the catalog pill, which is where the expanded
  time control reaches at ordinary window widths — around 500px of control
  anchored bottom-left, against a pill centred at half the viewport. It stacks
  above the pill now, on every screen, where nothing else is competing for the
  space.

  The same measurement showed the time control had been overlapping the catalog
  pill too, on anything under about 1,280px, since well before this. It now
  opens expanded only where there is room for it and starts folded otherwise.

- **The time control collapses on any screen**, not just a phone. Collapsed it
  is a small pill showing the date, or "Live"; expanded it is the scrubber. It
  is a wide thing lying across the bottom of the scene, and sometimes you want
  to look at the scene.

## 2.0.0

- **True distances.** A toggle beside the way in to the catalog spreads the
  solar system out to its real proportions and eases the camera back to watch
  it happen. Earth's ring stays where it is and everything beyond it leaves:
  Jupiter from 190 units to 500, Neptune from 340 to 2,887, Pluto to 3,790. The
  inner planets collapse into a knot around the Sun that you cannot pick apart
  without zooming in, which is the honest picture and the whole point.

  The corner has said "*not to scale" since the beginning. It now says which
  half is true — distances are, and the bodies are still drawn far too large,
  because at true scale Earth is four thousandths of a unit across and there
  would be nothing on screen at all. That is worth stating rather than
  demonstrating.

  It costs no geometry. Every position in the scene was already a direction
  times a radius, so switching layouts is a matter of which radius, and a body,
  its orbit ring and its share of a belt move together because they share the
  factor.

- Three things do not follow from one multiplication, and getting them wrong
  was visible: an orbit ring is a tube, and scaling it fattens the tube along
  with the path — 0.28 units to 2.59 at Pluto's factor — so rings are rebuilt
  at the radius they settle on; the belts' instanced rocks are moved rather
  than scaled, or a Kuiper boulder ends up wider than Neptune; and the belts
  map AU onto scene units affinely, so each particle is remapped through its
  own radius rather than by one factor that would have quietly put the asteroid
  belt at 2.48–2.92 AU while the caption claimed it was to scale.

- Labels in the home view now stand aside rather than stacking when two bodies
  land on the same pixel — which true distances make routine, since half the
  planets end up inside one knot. Moons are exempt: focused on a planet they
  are close together by nature and are the thing being looked at.

## 1.8.0

- **What's up tonight.** `/tonight` asks where you are and answers the question
  you actually ask outdoors: which planets are above your horizon right now,
  how high, and which way to face. Each one gets a compass point, an altitude
  in plain words and in degrees, its current magnitude, whether that is a
  naked-eye, binocular or telescope proposition, and when it sets. Anything
  below the horizon is listed with the time it comes up.

  Above that is the sky drawn as a panorama — north at both ends, the horizon
  along the bottom, straight up at the top. A round star chart is the
  traditional shape and the wrong one here: the question is not what the sky
  looks like, it is which way to turn and how far up, and laid out flat that is
  an x and a y. Two planets close together is the interesting case rather than
  the awkward one, so labels that would collide step clear and keep a leader
  line back to their dot.

  The site already knew where everything was; this is the same ephemeris asked
  from the ground rather than from the Sun.

- **Your location is remembered, and stays on your device.** A page whose point
  is "come back tomorrow night" cannot ask permission every time. It is kept in
  this browser, rounded to two decimals — the sky does not change measurably
  across a kilometre, so the rest of a GPS fix is precision with no use and no
  business being stored — and nothing is sent anywhere. There is a button to
  forget it.

## 1.7.0

- **Compare two bodies at true relative size.** `/compare` puts any two objects
  with a real physical size side by side, drawn to scale, with the headline
  ratio under them: Jupiter is 11.2× wider than Earth, and 1,326 Earths would
  fit inside it. Below that, every statistic the two share, aligned label by
  label. It is the one view on the site where nothing is compressed, which is
  what the note under the discs says — the "not to scale" apology on the solar
  system view now has somewhere to point.

  The sizes come from the catalog's own prose rather than a second field added
  beside it, because two copies of a number drift and the one on screen is the
  one people would notice was wrong. That means parsing "71,492 km", "~715 km",
  "2.38 R⊕", "1.380 RJup", "3.5–8.5 m", "58 cm", and Haumea's
  "1,960 × 1,518 × 996 km" — triaxial, and needing the geometric mean of its
  semi-axes rather than whichever number a regex reaches first. 52 of the 70
  objects come through. Light-years are refused on purpose: Andromeda beside
  Earth is not a comparison, it is a rounding error.

  Volume is an oblate spheroid, not a cube of the width ratio. Jupiter's
  catalog radius is equatorial and Jupiter is 6.5% flattened, so cubing it
  claims 1,413 Earths fit inside where the accepted figure is 1,321.

## 1.6.1

- **Every orbit path in the scene now behaves the same way.** The Voyager
  tracks were the exception: permanently coloured, at their own opacity, and
  the only paths that did not answer to the pointer at all. They are white and
  faint like the planets' rings now, and hovering the spacecraft brightens the
  track and turns it the craft's colour — the same opacity change the rings
  have always had, driven by the same code rather than a second path beside it.

- **A hovered orbit ring picks up a little of its planet's colour.** Half
  strength, so Saturn's ring reads as Saturn's without becoming a second gold
  object next to the planet. The Voyager tracks go the whole way to their
  colour instead, since out there is nothing beside them to compete with.

- Focusing an object now hides the Voyager tracks along with every other orbit
  path, which is the consistency that was asked for, and clears any hover tint
  left behind on the way in.

## 1.6.0

- **The tracker is a satellite tracker now, not an ISS page with two extra
  dots.** Every spacecraft is an entry in one list, and picking one is the whole
  interaction: a row of chips above the globe, each carrying the colour its dot
  is drawn in and its current altitude, so the legend and the control are the
  same thing. Choosing one moves the camera to it, draws its orbit, and swings
  the entire telemetry panel over to it. The selection lives in the URL —
  `/satellites?sat=hubble` is a link you can send.

  The ISS used to be the exception: its own feed, its own hook, its own half of
  the page, with the others bolted alongside. It is now an ordinary row in
  `data/trackedSatellites.js`, and adding a fourth spacecraft is adding a line.

- **One source, so every spacecraft has every reading.** Positions all come
  from CelesTrak elements through SGP4 now, including the ISS. The two things
  the old single-satellite feed gave away for free are computed instead:
  sunlight from a cylindrical shadow test against the Sun's direction, and the
  footprint from the horizon distance at that altitude. The panel gained
  orbital period, footprint and the age of the element set, and lost "updated
  3 seconds ago", which was never quite true — the underlying data was always
  a TLE a few hours old, and that is what it says now.

  Because the sum is local it costs nothing to repeat, so every satellite
  updates every second, and selecting one draws a full revolution of its orbit
  immediately rather than accumulating a tail while you watch it.

- **Fixed the camera slowly zooming itself in.** Following a target meant
  lerping toward a point at the same distance from Earth's centre — but the
  straight line between two points on a sphere is a chord, so each frame lost a
  little altitude and the view crept inward until it hit the zoom limit. With
  one satellite and a small swing it was slow enough to miss. Switching
  spacecraft is a much larger swing, and it became a plainly wrong shot of a
  globe that no longer fitted the frame.

## 1.5.7

- **The tracker follows Tiangong and Hubble as well as the ISS**, each a dot in
  its own colour at its own altitude, with a legend under the globe naming them
  and their heights.

  Getting their positions was the whole job. wheretheiss.at, which the ISS
  already uses, turns out to serve exactly one satellite — ask it for anything
  else and it returns 404. N2YO covers the full catalog and answers `curl`
  quite happily, but sends no `Access-Control-Allow-Origin` header, so a browser
  refuses to read the reply; and on a static site its key would sit in the
  public bundle with an hourly quota anyone could spend.

  So the arithmetic happens here instead. CelesTrak serves current orbital
  elements with CORS headers and no key at all, and SGP4 — the propagator those
  elements are defined against — turns a set into a position. Propagating the
  ISS's own elements this way lands within half a kilometre of the live
  wheretheiss.at fix and 30 m in altitude, which is unsurprising, since that
  service is doing the same sum; checked against N2YO, all three agree to about
  seven kilometres, which at 7.6 km/s is under a second of clock difference.

  It costs one request per satellite every six hours rather than one per tick,
  so positions are recomputed every second rather than every five, and the
  propagator arrives as its own 11.5 KB chunk that only this page fetches. The
  ISS keeps its own feed: it is what the page is built around, and that feed
  reports sunlight and footprint, which elements alone do not give you.

## 1.5.6

- **The scene no longer hitches for the first minute on a phone.** It was not
  the network, and it was not the download size — both had been dealt with in
  1.5.3. A texture only reaches the GPU the first time something using it is
  actually drawn, and that upload, with its mipmaps, is a stall. So the stalls
  were arriving one at a time, whenever a body first rotated into view, for as
  long as it took the camera to sweep past all thirty-odd of them — and then
  everything was resident and it ran perfectly. Profiled on a throttled phone
  profile, five textures were still being uploaded more than eighteen seconds
  in, the last at forty-two. They are now pushed to the GPU deliberately, two
  per frame, so it is all done inside the first couple of seconds and spread
  thinly enough not to drop a frame. Textures uploaded after eighteen seconds:
  five before, none after.

- **The catalog was loading photographs for cards nobody had scrolled to.**
  Not all seventy — only the open category, and `loading="lazy"` was on them —
  but browsers choose their own margin for that and choose it generously, so
  seven images came down during the scene's first seconds, several of them
  1280px square. Around 30 MB of decoded pixels competing with the scene for
  memory on a device that has little to spare. `useNearViewport` now gates the
  `<img>` on an IntersectionObserver with a margin we pick, so nothing is
  fetched until its card is nearly on screen: seven images and 30 MB before,
  two and 8 MB after, and all eight still there by the time you have scrolled
  to them.

## 1.5.5

- **The Voyager tracks are the paths the spacecraft actually flew.** They were
  a straight line from the Sun's direction out to the marker, with the near end
  redrawn every frame from wherever Earth happens to be — so the launch point
  wandered a full orbit each year, as though the mission had set off from a
  different place every few weeks. Both tracks now start where Earth was on
  their launch day in 1977 and stay there.

  In between they follow the trajectory each craft flew, sampled from JPL
  Horizons and baked into `data/voyagerTracks.json`. Every bend in them is a
  real gravity assist. Voyager 2 is the one that did the Grand Tour — Jupiter,
  Saturn, Uranus, Neptune — and Voyager 1 did not: it traded Uranus and Neptune
  for a close pass of Titan at Saturn, which threw it up out of the plane of the
  planets, which is why its track climbs away and never comes back down. The
  test suite checks both halves of that: each craft passes within a planet's own
  drawn radius of every planet it used, and Voyager 1 stays over 100 units clear
  of the two it didn't.

  The geometry is built once and never rewritten. Scrubbing the clock only
  changes how much of it is drawn, plus the final vertex, which is pinned to
  the marker so the line always ends exactly at the spacecraft.

- **Both Voyagers were sitting 23.4° off the plane they belong to.** The pinned
  state vectors they were placed from were in ecliptic coordinates, which is
  what Horizons returns by default, while the rest of the scene runs on
  astronomy-engine's equatorial ones. Both are three numbers in AU and both
  plot without complaint, so nothing looked broken — the spacecraft were just
  in the wrong direction. Position now comes from the same baked ephemeris as
  the track, in the frame the scene actually uses.

- **One radial scale for the whole scene.** The planets are drawn on fixed
  rings — Earth at 96 units, Neptune at 340 rather than the 30× Earth its real
  distance would ask for — while the probes used their own linear scale, so
  nothing that travelled between the two could be placed consistently in both.
  `sceneRadiusForAU` now derives that compression from the planets themselves
  (a new `au` alongside each `orbitR`), and everything off a ring reads it.
  Voyager 1's marker barely moves; Voyager 2's sits a little further out than
  it did, in correct proportion to Voyager 1 for the first time.

- The tracks are drawn brighter than the orbit rings they cross, where before
  they sat below them. A line with two ends carries nothing you need to look
  at; this one is the shape of the mission.

## 1.5.4

- **The ISS tracker now names the country the station is nearest to**, beside
  the latitude and longitude it already showed, with the distance under it —
  or "Overhead" when the ground point is inside that country or just off its
  coast.

  The obvious way to do this is a reverse-geocoding call, and it does not work:
  the station is over water about seven tenths of the time, and that is exactly
  when the question is worth asking. wheretheiss.at will answer "which country
  is at this coordinate" and returns `"??"` for every point at sea. *Nearest*
  is a different question from *over*, and only the first one usually has an
  answer, so the site carries the land geometry to answer it itself.

  `src/data/landPoints.json` holds 15,840 points sampled from Natural Earth's
  coastlines and country interiors — coastlines because they decide the answer
  from out at sea, interiors so a point in the middle of Kazakhstan reads as
  Kazakhstan overhead rather than a border a few hundred km away. Checked
  against the full-resolution polygons over 250 random points in the station's
  latitude band it names the right country 99% of the time; for points genuinely
  over land it reports them a mean of 39 km away. Near a land border it can name
  the neighbour, which is why the readout says "Overhead" rather than a
  precise-looking small number.

  The table is loaded with a dynamic `import()`, so it is a ~21 KB chunk that
  only the tracker page fetches — the home view is unchanged, and the main
  bundle grew by under 1 KB. `scripts/build-land-points.mjs` regenerates it.

- **The trail is the orbit now, not the ground track.** It was drawn on the
  surface, so it read as a shadow the station cast rather than the path it
  flew, and it ended below the marker instead of meeting it. Each fix now
  carries its altitude and is drawn at it, so the trail runs through space and
  joins the dot exactly, with the drop line showing how far up that is.

  It also keeps an orbit's worth of fixes rather than twenty minutes'. At one
  fix every five seconds that is 1,112 of them for the station's 92.7-minute
  period, so leaving the page open draws a whole circuit instead of a short
  tail. Worth knowing what you are looking at: the globe is drawn in Earth's
  frame, so each pass comes round west of the last one — the Earth turned
  underneath — rather than retracing one closed ring.

- **The station on the globe is a green dot now**, not a little modelled body
  with solar panels. At this globe size it was only a few pixels across, so the
  model read as a speck with an odd outline rather than as a spacecraft — and
  being lit by the same sun as the Earth beneath it, it dimmed to nothing
  whenever the station crossed into night, which is exactly when you are
  looking for it. The dot ignores the scene lights, so it is the same green
  wherever the station is. It keeps the halo that makes it findable against the
  bright day side.

- The drifting starfield backdrop is stashed for now. `StarfieldBg` is still in
  the tree and unchanged; both call sites are commented out and marked
  `STASHED StarfieldBg`, so `grep -rn "STASHED StarfieldBg" src` finds the four
  lines to uncomment.

## 1.5.3

- **The iPhone first load no longer takes minutes.** Two separate causes, both
  of which only really hurt on a phone.

  The object labels were React state rebuilt on every frame: ~18 elements
  reconciled and re-laid-out at 60 Hz, each pass preceded by a
  `getBoundingClientRect()` — a read that forces a synchronous layout. Measured
  on a throttled phone profile, that was 360 forced layouts in six seconds, one
  per frame, for text that had usually moved a fraction of a pixel. A desktop
  absorbs it. A phone does not: the main thread never went idle, so everything
  waiting for a gap between frames — texture decodes, model parsing, every
  `requestIdleCallback` — queued behind it. The labels are now plain DOM nodes
  the render loop moves with a composited `transform`, and React is told only
  when the *set* of labels changes, which is when the focus does. Same
  forced-layout count, measured the same way: zero.

  The other half was payload. Phones were downloading the ISS mesh (2.8 MB) and
  Vesta's (1.9 MB) with the scene, for two objects that are a few pixels across
  from the home view — 7.5 MB in total where the rest of the site needs 2.7 MB.
  Vesta now keeps the painted sphere every other small body gets. A sphere is
  the wrong shape for the ISS, so that model is fetched the moment you fly to
  it instead. Halley's nucleus is small enough to keep everywhere, but it waited
  for no one; it now loads during idle time like the rest.

- **No Milky Way on a phone or tablet held upright.** Phones never had it — a
  full-screen backdrop is the worst case for a mobile GPU's fill rate, and it is
  the one thing you are always looking past. Portrait tablets did. A tall narrow
  window shows a sliver of the map stretched over the full height of the screen,
  so the band that makes it read as the Milky Way sits off the top and bottom
  edges: you paid the fill rate for grey fog. Turn the same tablet sideways and
  it comes back, without a reload. The sphere is built the first time it is
  actually wanted, so a tablet that starts in portrait never downloads the map.

## 1.5.2

- Removed the middle-dot (·) separators from the home-view hint text and the
  time control's readout — "Drag to orbit · Scroll to zoom · Click any object to
  explore" and "1w/s · 30 days ahead" read as comma-joined phrases now.
- Moved the "Explore the catalog" pill down onto the same row as the time
  control, rather than stacked in its own row above it.

## 1.5.1

- Fixed the gap in the telemetry ticker's scroll loop. It duplicated its 7
  cells exactly once and wrapped at half that width — seamless only if one
  copy is at least as wide as the bar, but the bar spans the full viewport
  width on any normal desktop window, far wider than 7 short cells. Past the
  end of the two copies the scrolled window ran into empty track before the
  wrap point arrived, which showed as dead space after the last cell ("Sol
  Wind") until the loop caught back up. The copy count is now measured
  against the container and kept just ahead of what the width needs, on any
  screen from a phone to an ultrawide monitor.

## 1.5.0

- **Imagery for objects the scene cannot place.** 27 of the 70 objects have no
  body in the 3D view — every exoplanet and deep-sky target, the near-Earth
  asteroids, and the spacecraft without a scene position. Their pages showed a
  faded starfield with panels floating over nothing. They now show the curated
  photograph where the planet would have been, or the generated cover art for
  the twelve NASA has no usable image of, with the name and key figures
  flanking it as they do for a planet.
- Scene membership is now read from the scene itself rather than guessed from
  an object's category. The old test called Andromeda "in scene" and then
  focused the camera on nothing.
- The time scrubber is hidden on those pages, where it has nothing to move.

## 1.4.3

- The Voyager tracks now run from Earth rather than the Sun. They launched from
  here, and a line out of the Sun read as if they had been flung from it.
- Lifted the home hints clear of the time control. The control is bottom-left
  and the hints are centred, so on a narrower laptop window they collided.
- On desktop the description and the stats sheet are now independent: focusing
  an object slides the description down and leaves the stats collapsed, and the
  description stays put whether or not you expand them. Reading about an object
  no longer costs you the view of it. Mobile is unchanged — it has one panel,
  and it still opens fully.

## 1.4.2

- Removed the offset caption that appeared under the time control while
  dragging the scrubber. The pill already reads out the same thing.

## 1.4.1

- Scaled the Voyager markers down. They were sized to hold a constant angular
  size, which sounds right but means the world size grows without limit — from
  the default view, over a thousand units out, the halo had grown to rival the
  Sun. The scaling is now capped well under Neptune's radius, so they read as
  markers at any zoom while staying legible when focused.

## 1.4.0

Interstellar probes, a time control, and a rebuild of the rocky surfaces.

- **Time control.** Scrub the whole system through time: six rates from live to
  a year per second in either direction, pause, a ten-year scrubber, and a
  reset. Planets follow the clock; moons switch from their stylised live motion
  to true rates so scrubbing is exact and reversible.
- **Voyager 1 and 2 in the scene**, at their real positions from JPL Horizons
  state vectors, with outbound tracks and screen-constant markers. The
  standalone spacecraft model viewer is stashed for now.
- **Rocky surfaces rebuilt** around a shared Luna recipe — broad tonal regions,
  craters at five scales laid largest-first, and a real bump map so relief
  catches the light. Replaces the flat, uniformly-pitted look.
- The telemetry ticker scrolls again regardless of the system's reduce-motion
  setting; stopping it hid readings rather than just calming the page.
- Small bodies no longer participate in shadow mapping, which was darkening
  them to near-black for nothing.

## 1.3.0

- Milky Way sphere dropped on phones; desktop gets the full 8K map back.
- Halley's coma shells removed and its nucleus held still while focused.
- Mobile re-centres a focused object once the detail sheet is collapsed.
- Category tabs centre on wide windows instead of packing to the left.

## 1.2.0

Launch readiness: adaptive rendering, tests, and accessibility.

- **Per-device quality tiers.** Texture set, canvas pixel budget, shadows, belt
  density and geometry detail now scale with the device. Mobile texture memory
  fell from ~395 MB (past what mobile Safari will allocate) to ~35 MB, and the
  iPhone payload from 28.9 MB to 7.2 MB.
- **Test suite** — 125 tests over the render-loop arithmetic, orbital maths,
  catalog integrity, quality tiers and components, plus CI running lint, tests,
  build and an asset budget on every push.
- The catalog is reachable on a phone: the category bar no longer hides behind
  a scroll gesture the canvas swallows.
- Hidden controls are `inert`, so keyboard users no longer tab through 13
  invisible category buttons.
- Deep links (`/object/…`, `/satellites`) load instead of 404ing.
- A top-level error boundary, and recovery from WebGL context loss.

## 1.1.0

Content and correctness.

- Painted surfaces for the 25 bodies with no photographic map, drawn from each
  one's real characteristics; six "textures" turned out to be saved 404 pages.
- Curated, load-verified NASA imagery for 55 objects, replacing a live search
  that returned photos of people at NASA HQ for "Mars".
- A real ISS tracker: live position on a 3D globe with ground track and a true
  day/night terminator.
- Procedural spacecraft models, replacing `.glb` files that were never shipped.
- Assets cut from 212 MB to 21 MB on first load.

## 1.0.0

First release considered complete: the 3D solar system, the object catalog,
search, and detail views.

---

### Earlier

Development builds `0.1.x`–`0.3.0`, before the versioning convention above was
settled. Notable: `0.2.2` fixed moons disappearing until a reload, `0.2.4`
added Halley's Comet, `0.3.0` was the first performance and mobile pass.
