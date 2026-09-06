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
