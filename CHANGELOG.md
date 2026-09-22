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

## 5.10.18

**A GitHub icon now sits beside the version number, linking to the repo.**
Bare glyph, no button chrome — just dimmed to match the version text next to
it, brightening on hover.

---

## 5.10.17

**On mobile, "Go back" from a focused object sat too close under the P4RSEC
wordmark.** It's dropped a little further down; desktop is unchanged.

---

## 5.10.16

**The mobile language dropdown is solid now, not sun-bleached.** It hangs
below the burger menu, directly over the 3D scene rather than over other
chrome, and the usual translucent glass let a bright sky wash it out. It's a
near-opaque panel there now; the desktop popover is unchanged.

---

## 5.10.14

**Clicking away from the open language menu no longer left its button stuck
swollen.** `useDockSuspend` (5.10.10) freezes the dock's hover/size state
while a popover is open, but nothing reconciled it once the popover closed
elsewhere on the page, so the button could stay puffed at full magnification
until the cursor crossed the dock again. Resuming now re-checks `:hover` on
the dock and each item against the real cursor position instead of trusting
the frozen state. Verified in headless Chrome: the button returns to its
resting 36px.

---

## 5.10.13

**The count-up exponent from 5.10.12 was invisible, and reversed in Arabic.**
Tailwind's preflight zeroes a `<sup>`'s line-height, which collapsed the
rolling column inside it to 0px and clipped the exponent out of view; it also
lacked the mantissa's left-to-right isolate, so Arabic rendered Jupiter's mass
as 10⁷². Both are fixed and pinned in `CountUpNumber.test.jsx`.

---

## 5.10.12

**Exponents now count up with the rest of a focused body's figures.**
`CountUpNumber`'s wind-up only animated ASCII/locale digits, so a power-of-ten
exponent like the ²⁴ in "5.97 × 10²⁴ kg" sat still while the mantissa rolled.
`tokenize` gained an `exponents` flag that turns a superscript run following a
digit into its own odometer column, winding up on the same clock as the
mantissa; exponent digits stay Western since Arabic-Indic has no superscript
forms. Covered by `CountUpNumber.test.jsx`.

---

## 5.10.11

**On mobile, Language moved to the bottom of the burger menu.** As the first
row it hung its own dropdown (English / Tiếng Việt / العربية) down over the
rows below it — Copy a link, Track a satellite, Night sky. Moved last,
nothing sits under it to overlap.

---

## 5.10.10

**Opening the language dropdown no longer dragged the whole header dock
around as you hovered down the list.** The header's icon row is a
magnifying dock (`FloatingDock.jsx`) driven by a shared `mouseX`; the
language dropdown is a DOM descendant of its own dock button, so hovering it
kept feeding `mouseX`, resizing that item and shifting every button after it
along with the dropdown. `FloatingDock` now exposes `useDockSuspend()`,
freezing `mouseX` and gating every item's hover state while a popover is
open, so nothing resizes mid-hover. Verified over CDP that every icon's
bounding rect stays identical across the sweep.

---

## 5.10.9

**The Compare page is pulled off the site while it gets a visual rework.**
Its route, dock icon and header-menu entry are removed from `App.jsx`,
`AppShell.jsx` and `HeaderMenu.jsx`; `pages/ComparePage.jsx` and its i18n
strings stay in place and still pass their own tests — there's just no path
to it from the running site until it's re-added.

---

## 5.10.8

- **The scene build no longer blocks the opening, so the wordmark scrambles on
  a phone too.** Three earlier releases (5.10.4–5.10.6) worked around a
  phone-only scramble failure without fixing its cause: roughly 2.5s of
  synchronous work at the top of the `SolarSystem3D` setup effect meant the
  compositor never got a commit to run the scramble animation on before the
  block started, so it either froze or was hidden outright. The ~30
  `proceduralSurface()` calls for moons and small bodies are now queued and
  drained one per frame from the render loop, alongside the texture uploads
  that were already spread that way, giving the thread a commit between each
  piece; `assetsSceneReady()` waits on that queue too. Measured in headless
  Chrome at 6× CPU throttle: the worst single task dropped from 5190ms to
  1626ms, with total blocked time roughly unchanged — the work is the same,
  only its interruptibility changed. `holdOffstage`, `markLive` and the
  phone-specific reveal delay are all removed; one code path now runs
  everywhere.

- **And the reel no longer depends on the webfont.** The scramble's row
  height and wind distance were both measured in ems of Montserrat, which
  arrives late on a phone under `display: swap` — so the drum wound to the
  wrong height mid-animation and glyphs landed half out of the window. The
  row height is now derived from a fixed pixel font size, the wind is a fixed
  number of rows, and the cipher glyphs render in the system font stack.
  `will-change: transform` is removed from the drums, since twelve of them
  competing with a live WebGL upload risked iOS silently demoting a layer
  mid-step. `cipherFrames` and `cipherText` gained unit tests for these
  invariants.

---

## 5.10.7

- **The site no longer honours the OS "reduce motion" setting.** A machine
  with that setting on made the opening flight, starfield, dock swell, panel
  slides, number rolls and wordmark scramble all silently skip, reading as
  broken rather than as respecting a preference. `useReducedMotion()` now
  always returns `false`, and the CSS/media-query hooks that keyed off it are
  removed. A deliberate accessibility trade-off: reduced motion is no longer
  honoured from the OS at all.

---

## 5.10.6

- **On a phone the wordmark now waits offstage.** The held-scramble animation
  had been reported wrong twice on real phones despite working on desktop, so
  rather than keep guessing at engine behaviour under load, touch devices now
  render nothing of the wordmark while the scene builds. It fades in over
  420ms once the scene is ready, holds as ciphertext for 140ms, then decodes —
  so the part anyone actually watches runs on a free thread against a
  fully-drawn mark. Desktop is unchanged; the split is `(pointer: coarse)`,
  not a width breakpoint, so a touchscreen laptop with a mouse still gets the
  desktop behaviour.

---

## 5.10.5

- **The held scramble is a reel now, because the stacked-glyph version didn't
  work on iOS.** Six glyphs stacked per letter, each timed by its own
  `animation-delay`, relied on 72 animations agreeing with each other — on a
  phone WebKit dropped or desynced enough of them that letters blinked on and
  off (`EZD6F4` coming and going as `EZ 6 4`, `ZD6F`) instead of cycling.
  Rewritten as a single slot-machine reel per letter: a column of candidate
  glyphs wound past a fixed window with one `steps(6)` transform animation,
  so which glyph shows is a property of what's clipped rather than of several
  animations agreeing — a blank state is no longer possible. Also fixed along
  the way: the drum needed `display: block` (a transform does nothing on an
  inline `<span>`), and the animation is set as longhands rather than a
  shorthand so a missing custom property degrades one property at a time
  instead of dropping the whole declaration.

---

## 5.10.4

- **The wordmark scrambles from the first frame now, in CSS.** 5.10.3 held
  the decode until the scene was ready, which left the ciphertext frozen and
  unmoving for the several seconds beforehand — a scramble should glitch the
  whole time and resolve at the end. Since the main thread is blocked solid
  building the scene during that stretch, the scramble can't be driven from
  JavaScript: `cipherFrames()` now picks six candidate glyphs per character
  up front and a CSS `cipherFlick` animation cycles each into its slot in
  turn, running on the compositor so it keeps going through the blocked
  thread. Each slot gets its own 340–520ms cycle so the letters drift out of
  phase and never visibly loop; no slot may flash the letter it's about to
  become. Reduced motion still returns the settled string immediately.

---

## 5.10.3

- **The opening decode waits for the scene now.** The decode is a real-time
  `setInterval` animation, but it ran during the one stretch where the main
  thread is fully blocked building the scene — profiled at 6× CPU throttle,
  the first two seconds are back-to-back long tasks for procedural painting
  and texture upload, so the decode was skipped almost entirely rather than
  slowed down. The ciphertext now stands still from first paint and only
  starts resolving once `assets.done` fires, which is also when the thread
  frees up — so the ending reads in order: scene ready, word resolves,
  wordmark flies to the header. `DECODE_MS` is back down to 1800ms now that
  it doesn't have to outlast the build.

- **And the opening no longer shows two wordmarks.** The flying mark's gold
  copy is positioned `inset: 0` against its parent, and 5.10.2's placeholder
  parent box was a full-width flex row before the header was measured —
  stretching the gold copy across the viewport while the white copy stayed
  centred, so two wordmarks briefly disagreed. The fallback now shrinks to
  fit the mark at the same centred position the final layout lands on, so the
  swap is invisible.

- **The ciphertext keeps to the wordmark's own letter positions.** It was
  drawn as one string from the box's leading edge, and cipher glyphs are
  different widths from the real letters, so the run visibly crept into place
  as letters landed. Each character now gets its own fixed slot, held open by
  the glyph it will become, so nothing moves during the decode.

- **The telescope holds its place while the wordmark is encrypted.** It used
  to render at zero opacity until the tail of the decode, leaving the mark's
  centre-of-mass wrong for the whole load; it now draws at 0.32 from the
  first frame and resolves the rest of the way with the decode. Still
  outstanding: the ~2.4s of synchronous procedural painting and texture
  upload that makes all of this necessary in the first place.

---

## 5.10.2

- **The flight home is slower.** Backing out of a focused object to the wide
  view took 1.6s, which read as a snap; it's now 2.8s. The fly-in is
  unchanged.

- **Halley is framed by its tails now, not by its nucleus.** Two faults:
  focus distance was scaled by the same true-size shrink factor as the
  nucleus, which for a comet's coma/tail (drawn at scene scale, unaffected by
  true sizes) put the camera essentially inside the tail looking at a speck —
  fixed with a `framingScaleFactor` that keeps the camera's numbers on the
  drawn radius for this one body. And the usual "Sun in shot" framing put the
  tails, which stream anti-sunward, end-on to the camera; Halley is now
  framed broadside, tipped 15° out of that plane, at a distance of 34 instead
  of 14 so the full tail fits in frame.

- **The opening no longer flashes its logo before decoding.** The decode was
  gated on the header's measured box landing, and the hook's resting state
  renders a finished mark — so the first frame after that measurement showed
  the complete logo before the reset-to-ciphertext effect ran. The gate is
  removed and the mark now falls back to a centred layout matching the final
  position, so ciphertext is visible from first paint (cold-load first frame
  moved from ~5166ms to ~1478ms). The decode also now runs 2600ms instead of
  1200, long enough to still be visibly running once the main thread frees
  up.

---

## 5.10.1

- **No more halo on the compared bodies.** Each disc on `/compare` carried an
  outer glow in its category's accent colour; removed by request, since a
  coloured halo around a photograph reads as decoration rather than
  measurement. The inset shadow (the terminator that makes a flat crop read
  as a lit sphere) stays, as does the small-disc branch's offset outline that
  keeps a body like Ceres findable without a glow.

---

## 5.10.0

- **The opening decodes itself.** The loading screen's wordmark now arrives
  as ciphertext and resolves into P4RSEC a letter at a time, after Aceternity
  UI's EncryptedText; the orrery loses its drawn orbits and runs a fifth
  faster. `hooks/useEncryptedText.js` drives one shared decode for both the
  gold and white stacked copies of the flying wordmark so they never show
  different letters mid-cross-fade; the settled string stays in flow
  (invisible) to hold the box open so nothing shifts once a letter lands, and
  the cipher alphabet drops I, J, M and W, which are wide/narrow enough at
  this tracking to make the tail visibly breathe. The logo resolves with the
  last 45% of the decode, on opacity and scale only — a blur would cost a
  per-frame paint at the exact moment the main thread is busiest. Two bugs
  caught by measuring: the decode was starting on mount rather than when the
  mark first rendered (so a slow load only showed its tail), and the handoff
  wasn't waiting for the decode to finish before flying. Both fixed. The
  pre-React boot figure in index.html keeps its ring but loses the drawn
  orbit line, becoming a pulsing centre point instead.

---

## 5.9.16

- **The month rolls too, the figures take longer, and a tucked card goes
  properly back.** Three follow-ups to 5.9.15. The timeline pill's month name
  now rolls like the digits beside it, using a generalized rolling-column
  component that takes the short way round (December → January rolls
  forward); its width tracks the currently-shown name rather than the
  longest of the twelve, so an Arabic date doesn't reserve the width of
  سبتمبر while showing مايو. A focused body's figures now wind up over 1.6s
  instead of 0.9s, staying legible on the way. And the phone's card stack
  recedes much further (0.12 per level, up from 0.06), with depth now
  accumulating per level of coverage, capped at two.

---

## 5.9.15

- **The dock gets its own bar, and numbers roll.** The header dock's six
  controls now sit as bare icons on one shared rounded bar rather than each
  carrying its own scrim/blur, and a button only fills itself in when active;
  magnification grows the box itself rather than scaling the whole subtree,
  which had been ballooning open dropdowns. Its label now hangs off the bar's
  leading edge instead of above/below, since both those spots were already
  taken. New `components/SlidingNumber.jsx` and `CountUpNumber` animate only
  the digits of an already-formatted string — the timeline pill's numbers
  spring to their new value per digit, and a focused body's three stat
  figures count up from zero in one 0.9s sweep. Getting this right for
  Arabic needed three things: matching digits via `Intl.NumberFormat` rather
  than `[0-9]`, wrapping each number in an LTR isolate so digit runs don't
  get reordered, and having a counting column chase `floor(v/place)` rather
  than `v/place` so a wheel never sits mid-transition on a readable digit.

---

## 5.9.14

- **The header's buttons are a dock.** On desktop, the row of header controls
  now swells toward the pointer, macOS-dock style, via a `FloatingDock.jsx`
  adapted from Aceternity UI — the nearest button grows to ~1.25× with
  neighbours easing up, falling to nothing 90px out. Unlike the original,
  this dock takes the existing buttons as children rather than rendering a
  fixed link list, since these controls have varied behaviour (dropdown,
  clipboard, router links, toggle). Pointer-only; touch keeps the burger
  menu, and `prefers-reduced-motion` gets the plain row. Adds `motion`
  (framer-motion's successor) as a dependency.

---

## 5.9.13

- **The timeline pill keeps one width.** Its readout column used to grow with
  longer month names or Arabic-Indic numerals, resizing the whole pill as you
  scrubbed. It's now a fixed width on both the expanded and collapsed pill,
  with the offset line ellipsized if a locale runs long.

---

## 5.9.12

- **Two `/sky` chrome bugs on phones, and a disclaimer for the mode that
  causes them.** The constellation readout was fixed at the top, colliding
  with the header on narrow viewports since `/sky` never scrolls into the
  header's opaque scrim — moved down to clear it. The AR toggle overlapped
  the back button's text at the same fixed offset — it now stacks below it
  instead. The compass dial's lubber line dropped its stem, since the rim
  triangle already reads the heading on its own. And since AR is the cause
  of the rough edges above, the permission card now warns that the feature
  is early and can drift or misalign labels.

---

## 5.9.11

- **Confirmed fixed on the phone that had it, and the diagnostic comes back
  out.** `TrackerDebug.jsx`, `debugFlag.js`, `?debug=1` and the renderer's
  telemetry hook are removed now that the fix is confirmed. 5.9.10 shipped
  two changes at once and the confirmation can't tell them apart, so both
  stay: the tracker card keeps `.glass` for the whole arrival (avoiding a
  backdrop-filter landing on an ancestor of a live WebGL canvas mid-arrival,
  which is what actually broke it in WebKit), and its render object is still
  rebuilt when the arrival ends as a belt-and-braces reload-in-miniature.
  Worth remembering: this was WebKit-only and tied to a phone's
  `vh`/`innerHeight` gap from its URL bar, invisible to headless Chrome —
  three releases went out on screenshot-based theories before the real
  readout found it on its second try.

---

## 5.9.10

- **`.glass` — and the backdrop-filter it carries — was being added to the
  globe's card at the exact moment the arrival ended, on an element already
  holding a live WebGL canvas.** Adding a `backdrop-filter` to an ancestor of
  a composited canvas is a known way to lose that child's layer geometry in
  WebKit: the canvas kept compositing against its old full-bleed rectangle
  while every JS-side measurement read correct, so the globe rendered in the
  wrong place with nothing obviously wrong in the numbers. The card now keeps
  `.glass` for the whole arrival, with the lifted look expressed as a
  `[data-lifted]` state instead — so the class, filter and radius never
  change, only the paint does — and its render object is dropped and rebuilt
  when the arrival ends as an extra safeguard.

---

## 5.9.9

- **The tracker's empty band is inside the canvas, not around it — the globe
  was drawing into a corner of a correctly sized canvas.** The 5.9.8 debug
  readout showed the card, slot and canvas all correctly sized, but the
  picture inside the canvas sat in its lower half — a viewport fault
  invisible to headless Chrome, which doesn't split `vh` from
  `window.innerHeight` the way a phone with a URL bar does (a 41px gap, 56%
  of 736, was the actual culprit). `fit()` now reads the size back off the
  WebGL context itself rather than trusting the value it asked for, since a
  browser can hand back a smaller drawing buffer than the canvas or leave the
  GPU viewport on a stale rectangle when three.js thinks nothing changed. The
  debug readout gained the buffer size, GPU viewport rect, and camera
  aspect/distance/target to catch this class of bug directly next time.

---

## 5.9.8

- **An arrival at the tracker can no longer outlive the page it arrives on,
  and there is now a way to see what the phone is actually measuring.** Three
  releases had gone after the same reported empty-band-above-the-globe fault
  from screenshots alone, unable to reproduce it in headless Chrome. The
  arrival now has a hard outside edge (3.5s) measured from the tracker page's
  own mount, independent of any timer inside the sequence, so a stuck
  sequence can't leave the globe permanently lifted out of the column.
  `SatelliteGlobe` also now clears any canvas left in its mount before adding
  a new one, since a dead stacked canvas produces the same symptom. A
  temporary `?debug=1` readout (`TrackerDebug.jsx`) was added to see the
  phase, viewport, and every canvas's rect and drawing buffer directly from
  the affected phone, since guessing had used up its turns.

---

## 5.9.7

- **The globe kept the size of the whole screen after flying into the
  Satellite Tracker, drawing full-bleed inside a card a third that height,
  fixed only by a reload.** The arrival lifts the card to `position: fixed`,
  full-bleed, and the globe sizes itself to whatever box it's in; when the
  card returns to the column, `SatelliteGlobe` only heard about the resize
  via a `ResizeObserver` — the one size change in the app with no window
  resize or user action behind it, and the only one left to a single notice.
  A `fit()` function now re-measures and resizes the renderer, canvas box and
  camera aspect from three separate call sites (the observer, the tracker
  phase transition, and once every 30 frames of the running loop), so a
  dropped notice can't strand it. Reproduced by stubbing `ResizeObserver` to
  a no-op: canvas came to rest at 390×844 inside a 350×473 card before the
  fix, 348×471 after.

---

## 5.9.6

- **A card being covered in the phone's detail sheet now shrinks as it goes,
  so it reads as tucked underneath the next one rather than cropped by it.**
  5.9.5 put the outgoing card behind its neighbour but left it full size,
  which still read as a cut. Each pinned card now scales down (1 to 0.94) by
  however much the next card has covered, anchored at its own top edge,
  capped so nothing shrinks below two levels of coverage. Driven from
  `hooks/useCardStack.js` outside React via rAF; off under
  `prefers-reduced-motion`.

- **Arriving at the Satellite Tracker via the ISS-card flight could leave the
  globe stranded outside its card until reload.** Two bugs in the settle
  sequence: the timer that ends the arrival sat after an early return that
  also covered a missing-ref case, so a failed measurement left the page
  permanently lifted; and the clip-path was resolved against
  `window.innerWidth/innerHeight` rather than the lifted card's own box,
  which disagree on iOS Safari when toolbars overlap the viewport. Both
  fixed — the end timer is now unconditional and the clip measures the card
  directly.

---

## 5.9.5

- **The cards in a phone's detail sheet now stack instead of being sliced off
  at its top edge.** Scrolling used to carry each card straight out of the
  scroller, cutting a description mid-line. Cards now pin to the top of the
  sheet via plain `position: sticky`, with the next card riding up over it in
  document order — no z-index needed. Pinned cards get an opaque tint instead
  of translucent glass, since glass over a pinned neighbour smeared its text.
  A `.detail-stack-flow` class opts the stats panel and the ISS's "Track
  live" button out of pinning, since either would strand content or cut
  through a card behind it. Desktop is untouched.

---

## 5.9.3

- **The mobile description panel now opens 2.5s after focusing a body, down
  from 4s.** That margin only needs to clear the scene's longest flight
  (2.4s at true sizes); desktop is unchanged at 1.5s.

- **Combed through `CHANGELOG.md`.** Six runs of small, single-topic
  releases chasing the same bug or tuning the same feature are now told as
  one entry apiece, with their version-number ranges preserved in the
  combined heading.

---

## 5.9.2

- **The tracker transition worked once per page load and then stalled.**
  `TrackerHandoff` latches a flag to stop `navigate()` firing more than once
  per hand-off, but the latch lived in an effect that only re-ran on a
  reduced-motion change — so it was never cleared, and every visit after the
  first flew to Earth and then froze on the hand-off frame. Now cleared when
  the phase returns to `idle`.

- **The focused-body view and the night sky get the tracker's back
  control.** Both had a bare chevron icon; both now use the shared
  `.page-back` "‹ GO BACK" control, with its accessible name matching its
  visible text and its inset following `--scene-inset`.

---

## 5.9.1

- **The flight to the tracker goes straight to Earth, and is now one motion
  rather than three.** 5.9.0 routed the hand-off through the ISS with a hold
  and a pull-back; the hold was a weak beat since the station at true sizes
  is a speck, often on the night side, and wasn't even where the tracker's
  own marker would place it. Arming now navigates straight to
  `/object/earth` with the fly-in's landing pose overridden to the hand-off's,
  so it's one continuous movement with nothing to hold on.

- **A camera arc that could send Earth out of frame entirely.** Arming while
  already focused on Earth sweeps camera direction under its own power
  between two nearly-antiparallel poses; interpolating by
  `lerp().normalize()` passes through the zero vector near the midpoint,
  sending the direction anywhere. Now swept as a slerp rotation, well-defined
  even at 180°, with orientation re-derived from the camera's actual position
  each frame rather than slerped between the two endpoints' look-at
  quaternions.

---

## 5.9.0

- **The Satellite Tracker is no longer a page you cut to — it is a place you
  fly.** Requesting the tracker now arms a cinematic instead of a route swap:
  the camera flies to the ISS, holds briefly, pulls back until Earth fills
  the frame while the station dissolves out, and the last solar-system frame
  is held up as the route changes underneath it — the tracker's globe comes
  up full-bleed behind that still, already drawing the same picture, then
  cross-fades and eases into its card. The two renderers are made to match on
  three things: size (both draw Earth's disc at the same angular fraction of
  frame, via `utils/trackerEntry.js`'s `FRAME_FRACTION`), orientation and
  lighting (both centre on the true sub-solar point, computed independently
  by each side from the same new `utils/subsolar.js` so they can't drift
  apart), and roll (both put north at screen-up). The return trip needed no
  new machinery, since navigating to `/object/iss` already triggers the
  scene's existing unmount-while-focused exit animation.

- **The tracker's Earth was rendering at about a third of the brightness it
  should.** Its surface maps were tagged `SRGBColorSpace`, but the globe's
  shader writes `gl_FragColor` directly without re-encoding on the way out,
  so the maps came out dark and desaturated — fixed by leaving them untagged,
  matching the solar system's own Earth.

- **Clouds on the tracker's globe.** It was missing the cloud layer the
  solar-system Earth always mixes in; added.

- **Moons leave trails while you are focused on their planet.** Each moon of
  a focused planet now draws a tapering arc of its orbit, sampled backward
  from its live angle along the same parametric circle the moon's path
  already is — no search needed, and it stays exact at any true-size factor.
  Span is a fixed share of the orbit so Phobos and Iapetus draw comparable
  arcs.

- **The intro screen lost the glow behind the wordmark.** The soft radial
  wash behind the orrery's centre is removed; the rings and wordmark now sit
  on plain black.

---

## 5.8.4

- **Earth and Venus lost their atmosphere glow.** Both carried a translucent
  halo sphere outside their surface mesh; removed, so both now render as a
  plain sphere like every other planet.
- **Arabic numerals switched to Arabic-Indic (٠١٢٣) everywhere but scientific
  exponents.** Arabic had deliberately stayed on Western digits since 4.x
  because catalog values carry Unicode superscript exponents with no
  Arabic-Indic form. That tradeoff is now resolved the other way: the
  locale's `numerals` setting flips to `arab`, converting everything built
  through the shared translator and formatters, plus a few hand-built
  strings (ISS coordinates, the data ticker, chart axes). Exponents and
  catalog designations with digits (`NGC 224`, `M31`) stay Western, since
  they're names, not measurements.

---

## 5.8.3

- **Montserrat, everywhere the interface reads left-to-right.** The font
  stack used to lead with the OS default (SF Pro, Segoe UI), so the same
  page looked like different software depending on platform. Montserrat now
  loads from Google Fonts and leads the stack for English and Vietnamese,
  with the old system stack as the pre-webfont fallback; Arabic is
  untouched, since Montserrat has no Arabic glyphs.

---

## 5.8.2

- **The scale disclaimer moved to the top of the screen, on desktop.** It
  sat bottom-right, then bottom-centre since 5.7.0; by request it now sits
  top-right, under the icon buttons rather than competing with the transport
  and catalog chip for the bottom row. Phone keeps the original bottom
  corner, since the compact heading sits close enough to the top there for a
  wide title to collide with it.

---

## 5.8.1

- **Fixed: focusing anything at true distances and sizes could land the
  camera nowhere near it.** 5.8.0 made that layout the default, exposing
  three gaps in the fly-in distance formula that only mattered at extreme
  scale-down: the landing distance could fall inside the camera's near
  clipping plane and clip the body out entirely; dwarf planets and asteroids
  had no true-distance-aware starting position on a direct link; and moons
  had no starting position at all, aiming a direct link at the scene origin.
  All three fixed at the root — the fly-in distance now floors against the
  body's true radius, small bodies get a true-distance-aware starting
  position at creation, and a new bootstrap pass positions every moon
  correctly before the render loop's first frame.

- **A Satellite Tracker button in the header**, beside the night-sky and
  compare icons. `/satellites` already existed; nothing in the header
  pointed at it.

---

## 5.8.0

- **The scene now opens at true distances and true sizes, at the owner's
  request.** `scaleMode.js` now defaults to stage 2 (true distances + sizes)
  on every fresh load instead of compressed, with the first frame already at
  rest rather than animating in. This surfaced a real bug: the fly-in
  distance formula scales down with a body's shrinking radius, and at true
  scale that factor could land the camera inside its own near clipping
  plane, clipping the whole body out of frame — Mars landed the camera 0.018
  units out against a 1-unit near plane. Both the initial fly-in and a
  settle pass triggered by a stage change are now floored at
  `camera.near * 2.2`.

- **The scene drawer's tab lost its box.** 5.7.0 had put it in a boxed rail;
  reverted to bare chevrons on request, with legibility carried by a
  drop-shadow and an opacity lift on hover instead of a background plate.

- **Liquid glass is back.** 5.7.0's panel-unification pass had thinned every
  `.glass` surface well past the "Liquid Glass" look the site had before;
  fill and border opacity are restored brighter than the original values,
  paired with a stronger, more saturated blur, as one shared token family so
  every `.glass` surface moves together.

---

## 5.7.1

- **The loading screen is an orrery now.** The old wordmark/bar/list layout
  read as unfinished; it's now four tilted 3D orbit rings (69°, matching the
  solar-system camera's own tilt) with a body travelling each, drawn around
  the wordmark standing where the Sun goes. Each body sits inside a wrapper
  running its ring's rotation in reverse, which is what keeps it facing the
  viewer instead of smearing into an arc.

- **It is also a progress readout.** The four bodies light amber as the load
  passes each orbit's quarter, and the bar animates on `scaleX` rather than
  `width` to avoid a relayout per texture — everything on this screen
  animates on `transform`/`opacity` only, since it's shown while the main
  thread is saturated building the scene.

- **Something now paints before the bundle does.** `index.html` now carries
  inline CSS drawing the same black background and one pulsing ring in the
  orrery's exact position, so there's no seam when React mounts and removes
  it.

- **The handover choreography.** The readout fades, the orrery swells and
  dissolves, and the wordmark flies last into the header's exact position —
  landing pixel-identical to the header's own copy. Reduced motion holds the
  rings still, one per quadrant, and skips the flight.

- **Two headless-Chrome verification traps, now written down in
  CLAUDE.md.** Headless Chrome reports `prefers-reduced-motion: reduce` by
  default, which this app honours, so screenshots of animations show them
  already finished; and capture timing has to be driven off the page's own
  `performance.now()`, not the script's clock, since navigation and
  screenshot overhead can drift the two by most of a second.

---

## 5.7.0

- **A design system, and one column for the whole interface to stand on.**
  The header, catalog, ticker and scene chrome each sat on a different left
  edge (0, 20px, 32px, 160px+32px). Everything now lands on one `.spine`
  container matching the `max-w-7xl` `<main>`, plus a `--scene-inset` for
  chrome floating over the full-bleed scene — the wordmark, catalog heading,
  card edges, page titles and the time transport now share one vertical line
  on both sides.

- **One scale per dimension, instead of a value per call site.** Type had
  run to roughly twenty ad-hoc sizes, radii to eight, motion to nine
  durations across three easing curves. `src/index.css` now opens with one
  shared scale — space, spine, radius, type, motion, surfaces, elevation,
  colour — that components draw from. The two families of translucent
  surface (scene chrome vs. page panels) are now single recipes
  (`--chrome-*`, `--panel-*`) instead of four or five hand-written
  near-duplicates.

- **The bottom of the scene is a bar now, with an anchor at each end.** The
  time transport, catalog chip and "not to scale" caption used to sit at
  three different offsets; they now share one baseline on the spine, with
  the caption centred as a caption between the other two rather than
  colliding with the transport at common window widths.

- **The focused-object annotations line up.** The body's name and its three
  flanking figures were two independently-stacking flex columns, misaligned
  by about 15px; now one grid sharing row tracks, so the name and the first
  figure share a baseline.

- **The telemetry ticker is a band rather than a card that has been cut
  off.** It ran full width while carrying a full border-radius, so only two
  corners were ever visible; it now has hairlines top and bottom with a
  masked fade at each end and short centred rules between cells.

- **The compare table uses its width.** Its `1fr auto 1fr` rows put the
  fixed-width label in the middle, crowding both values toward the centre;
  the label column is now fixed instead, giving each value its own column
  under a sticky header.

- **The satellite tracker's telemetry no longer orphans a reading.** Eight
  figures in an auto-fit grid resolved to seven columns at the panel's
  actual width, wrapping the eighth alone; now a fixed four columns, which
  divides evenly.

- **Removed "What's up tonight" (`/tonight`).** The page, route, nav entry
  and locale strings are gone — its flat-panorama readout overlapped what
  `/sky`'s dome already offers — saving 37 kB off the main bundle. Old links
  fall through to the solar system rather than breaking; the underlying
  `utils/skyEvents.js` calendar stays, unused, since nothing about it was
  page-specific.

- **Fixed: the tracker's and "tonight" page's back buttons announced
  themselves as `"tonight.back"`** — a missing locale key falling through to
  its own dotted identifier, caught because that key became visible text in
  this release.

- **Smaller things.** Cards now hold a 4:3 photo frame; the scene drawer's
  tab is a pull handle instead of floating chevrons; `PageHeader`'s back
  control gets its own row; the focus ring no longer forces a 10px radius on
  rounder controls; category tabs show their object count in a chip.

---

## 5.6.1

- **A diagnostic readout for the AR compass, behind `?debug=ar`.** Testing
  against the real Moon showed a constant 1–3° offset to the left — a shape
  of error that rules out both a field-of-view mismatch (which would grow
  toward the edges) and magnetic declination (which would be 10–30° in North
  America). What's left is likely ordinary phone magnetometer error, which
  iOS itself rates at 10–15° accuracy. Rather than guess at another fix,
  `?debug=ar` now overlays every stage of the heading pipeline — raw sensor
  reading, rotation-derived bearing, reconciled anchor, declination,
  calibration, final heading — alongside the Moon's true azimuth and the
  signed difference, to tell sensor error apart from a projection bug next
  time.

---

## 5.6.0

- **Time can run backward now, not just fast-forward.** The rewind button
  used to clamp at real time; it now continues into reverse through the same
  ladder fast-forward already had (a week, a month, a year a second), since
  `simTime.js` already supported negative rates and only the transport
  lacked a way to reach them. Buttons relabelled "Rewind"/"Fast-forward."
- **Focusing an object now resets the clock to real time.** Flying to a
  planet at a fast-forwarded rate showed it arriving as a streak. The rate
  now resets to 1× the moment you focus anything and restores your previous
  rate on leaving; switching between two already-focused bodies doesn't
  reset again.
- **The timeline pill now collapses and expands on its own**, folding to its
  small chip when you focus an object so it doesn't compete with the view,
  and unfolding when you leave — still manually toggleable at any point. The
  collapse/expand is a real FLIP width animation now rather than an instant
  swap, after two failed attempts: one relying on two rAFs for paint
  separation (no guaranteed boundary between them), and one measuring the
  target width while still pinned to the old, larger size (which
  `scrollWidth` can't report smaller than). The working version measures the
  target width first, before pinning anything.

---

## 5.5.3

- **Planet trails go back to a hairline.** The extra width from 5.5.2 is
  reverted on request; the length increase (~15% of orbit vs. 9%) stays.
  Back to a one-pixel `THREE.Line` with the taper in colour rather than
  width, dropping `Line2`/`LineGeometry`/`LineMaterial` from the bundle
  (main chunk 691 kB → 674 kB). Third attempt at fat lines in this
  codebase, third reversion — recorded in the README.

- **One line from 5.5.2 is deliberately kept:** the trails still skip
  frustum culling, since three computes a bounding sphere once from
  whatever the buffer holds at creation and a geometry the render loop
  keeps rewriting ends up tested against a stale bound.

---

## 5.5.2

- **Planet trails are thicker and longer.** A `THREE.Line` is always a 1px
  hairline regardless of `linewidth`, so the trails now use three's `Line2`
  fat-line machinery at 2.4 CSS pixels — previously tried and reverted
  twice elsewhere (gravity field lines, orbit rings) but viable here
  because a short arc gives hard edges little to read against. Length goes
  from 9% to 15% of the orbit, drawn on half as many points to avoid
  overlapping fat-line quads blending twice into visible beads. Geometries
  are written in place rather than through `setPositions()`/`setColors()`
  to avoid rebuilding the whole buffer every scrub frame, and trails now
  skip frustum culling like the belts and probe tracks already do.

- **README fix:** the "Orbit paths" section wrongly claimed the rings are
  `Line2`; they've been tubes since the rebuild machinery landed. Rewritten
  to match, with the trail's opposite conclusion explained.

---

## 5.5.1

- **The Sun's glare now scales with the Sun.** It had held a constant
  screen-pixel size (`LensflareElement.size`), which looks right for a
  camera but wrong when zooming out leaves a full-size starburst on a
  distant dot. `sunFlareScale()` now re-reads the Sun's angular radius
  every frame via `Lensflare.onBeforeRender` and scales every element from
  its authored size, working in angle so the effect stays
  viewport-independent. Clamped at both ends — the floor keeps a small,
  distinct glint at true sizes, where the honest multiplier would otherwise
  fade the flare (the scene's only marker of where the Sun is) to nothing.

---

## 5.5.0

- **The camera really does pan away on its own if you leave it alone, and
  the reason is the roll slider.** Idle pitch had no limit, on the
  assumption that up/right are re-derived live each frame so nothing could
  break — but the corrector that quietly rolls the camera back toward level
  whenever the roll slider sits centred was built for fractional-degree
  errors, and a camera carried over a pole is upside-down relative to world
  up, handing it a ~180° error it then drove hard at — feeding a tumble
  instead of settling. Pitch is now a pendulum (`pitchPendulum`, in
  `utils/driftControl.js`) that eases to zero and reverses around 70° of
  elevation, so the level-correction is never handed more than a fraction of
  a degree.

- **The Roll slider is gone**, on request — only yaw and pitch remain. A
  roll value left in `localStorage` by an older version is ignored rather
  than treated as corrupt.

- **The fly-in now frames the Sun at true distances too, and much further
  round to the left — on desktop.** Angle widened from 12°/35° to 28° off
  axis at 61° round, using the extra headroom a 16:9 frame's wide horizontal
  half-angle allows; gated to desktop and wider aspects, since a portrait
  phone would simply crop the Sun off.

- **Focusing a planet on a phone no longer jolts.** Two causes: the detail
  sheet opened at 1.5s, landing inside the fly-in (up to 2.4s at true sizes)
  and competing with it — now delayed to 4s on phone. And the camera-raise
  offset that makes room for the sheet was applied in a single frame instead
  of eased — now eased over roughly the same second the panel takes.

- **The Sun's lens-flare throws rays now.** Eleven spikes at varied,
  deliberately uneven angles and lengths are added to the existing
  halo/streak/ghosts, composited additively; the ghost chain is spread
  wider with two large dim discs at either end. Still all procedural canvas
  work, nothing per-frame.

---

## 5.4.0

- **Rebuilt AR mode's orientation on the one rotation the sensors actually
  describe, instead of three angles pulled out of it separately.** Every
  previous version of `utils/deviceOrientation.js` derived heading, altitude
  and roll independently, and each was wrong in its own way: heading was
  mirrored (reading `alpha` directly instead of `360 - alpha`, since alpha
  is counter-clockwise about the up axis while compass bearings run
  clockwise), altitude was inverted and then patched with a literal
  `ALTITUDE_OFFSET = -180` that composed to a phone held level reporting
  -180° pitch, and roll was simply never computed, so the overlay only
  lined up while the phone was perfectly upright. The rewrite composes the
  spec's own device→ENU rotation (`Rz(alpha)·Rx(beta)·Ry(gamma)`) and reads
  heading, altitude and roll off it together via
  `camera.rotation.set(altitude, -azimuth, roll, 'YXZ')`. This also removes
  rather than patches the instability the 5.3.x releases kept chasing: near
  beta = ±90° (the AR holding pose), (alpha, gamma) pairs can read very
  differently for the same physical attitude, but the rotation composed
  from them is the same either way — so reassembling it first makes the
  singularity stop mattering, and every confidence gate and pole-freeze
  from 5.3.x is removed as unnecessary. The `devicemotion` accelerometer
  path from 5.3.1 is also gone, since it existed only to dodge this
  instability and had its own sign-convention disagreement between iOS and
  Android. iOS's `webkitCompassHeading` is kept, but now only as a
  slowly-smoothed anchor for the whole rotation's north reference rather
  than a direct substitute.

- **AR now renders through the same lens the camera is looking through.**
  AR had used the same fixed 55° field of view as the drag-around dome,
  15–20% narrower than what the phone camera actually shows, so overlay
  error grew toward the screen edges. `utils/arCamera.js` now derives the
  real vertical FOV from the video frame and viewport dimensions (including
  the `object-fit: cover` crop), assuming a fixed 78° diagonal for the
  camera's own optics since there's no web API to read it.

- **Verified end to end in a browser, not just in unit tests**, using
  headless Chrome with a fake camera and CDP-driven orientation overrides —
  an upright phone at alpha=0/90/270 now reads correct headings, and a new
  end-to-end test reconstructs the camera from three reported sensor values
  and checks it against a known device orientation, which every prior
  broken version would have failed despite passing its own component
  tests.

---

## 5.3.4 – 5.3.13

- **Ten releases chasing one sign error in AR mode, none of which fixed
  it.** Each reported a different symptom of the same underlying bug
  (mirrored heading, an inverted altitude with a -180° offset bolted on)
  and flipped another sign in `utils/deviceOrientation.js` without removing
  the root cause — 5.3.9 reversed the screen motion, 5.3.12 reversed it
  back. Not worth reading individually; every symptom they chased is
  explained and fixed in 5.4.0. Version numbers preserved here since
  `package.json` and the commit history carry them.

---

## 5.3.3

- **Chrome was noticeably darker than Safari, and not just in the main
  scene.** The main solar-system view already had the fix (explicit
  `outputColorSpace` plus `LinearToneMapping`/`toneMappingExposure`, from
  4.6.6/4.6.7); auditing every other `WebGLRenderer` in the app found three
  more missing some or all of it — the satellite globe, the night sky, and
  the (currently unshipped) spacecraft viewer — now all carrying the same
  two lines. Also audited every `CanvasTexture` for the same
  untagged-color-space bug; a few thin additive overlays (lens-flare,
  ring-glow) were left alone since tagging them wasn't established to be
  correct. Verified in headless Chrome for the three fixed views; Safari
  itself needs confirming on the reporter's own Mac.

---

## 5.3.2

- **Fixed AR mode's altitude reading straight up/down backwards**, reported
  immediately after 5.3.1 moved altitude onto raw accelerometer gravity to
  escape a real Euler-angle instability. The bug was one level up:
  `accelerationIncludingGravity`'s sign convention is a well-documented
  point of cross-browser confusion, and only a real device report could
  catch it. One sign flipped, re-verified against the same hand-worked
  cases.
- **Trails are on by default now**, by request. Surfaced a minor gap: the
  orbit ring's trails-on dimming and the trail's own visibility were only
  ever set from inside functions that a hover/focus/toggle already called,
  never at startup — invisible while trails defaulted off, now fixed by
  calling it once per planet at creation.

---

## 5.3.1

- **The Sun's lens-flare now shows on phones too.** It had been disabled on
  the `low` quality tier as an untested precaution; it's the same technique
  `medium` already runs fine, and `medium` covers plenty of real phones.
- **AR mode no longer responds to drag at all.** It used to also nudge a
  manual calibration offset, which read as the scene fighting its own
  sensor input; AR is sensor-driven only now.
- **Fixed AR mode's altitude tracking losing its footing near the top of
  its range.** `DeviceOrientationEvent`'s Euler decomposition is documented
  to become unstable and jump near beta = ±90° — this app's own default AR
  holding pose, not an edge case. Native apps avoid this with a
  hardware-fused quaternion the web has no equivalent for on iOS, so
  altitude is now derived instead from raw accelerometer gravity
  (`accelerationIncludingGravity`) when available, with the old formula as
  fallback. Heading, which needs a raw magnetometer the web doesn't
  expose, is unchanged. Not yet confirmed against the real device that
  reported the bug.
- **Trail-visibility tuning**, from direct feedback on 5.3.0: the plain
  orbit ring now dims to about a third of its brightness while trails are
  on, and focusing a planet now hides only that planet's own trail rather
  than every trail in the scene.

---

## 5.3.0

- **Planets can leave a trail behind them on their orbit.** A new "Trails"
  toggle puts a short, fading arc (9% of the orbit) behind each planet,
  tinted its hover colour, tapering to nothing at the tail. Built from the
  same 256-point orbit sample the static ring already draws rather than a
  recorded position history, so it's instantly the right shape and length
  when toggled on. The taper is colour only, not width, since plain WebGL
  lines are always 1px — this codebase already tried and reverted fat lines
  for the gravity overlay. Verified with a temporary debug hook confirming
  vertex count, head position and colour ramp, then a pixel-level check
  sampling actual rendered trail pixels.

---

## 5.2.7

- **The Sun now lands upper-left, not dead centre above the body, when
  focusing anything at true distances + sizes — and every focusable body
  gets this framing now, not just planets.** The 5.2.0 fix offset the
  camera along an axis that reduces to almost exactly world-up for a
  near-ecliptic body, landing the Sun at screen "12 o'clock" and reading as
  an eclipse rather than a shared frame. The offset now blends in a
  horizontal component too, moving the Sun to "10 o'clock," and the
  treatment is extended from planets-only to every non-probe, non-Sun body.
  Confirmed in headless Chrome across five bodies; small bodies at higher
  orbital inclinations shift by a smaller margin than planets, a real
  consequence of the fixed reference axis rather than a bug.

---

## 5.2.6

- **Fixed the ISS's selection ring dwarfing Earth (and the Moon) at true
  distances + sizes.** The billboard ring was built once at a fixed size
  that never scaled down as bodies shrank toward true proportion, so it
  ended up several orders of magnitude too large. Now scaled by the same
  factor the ISS model itself uses; its orbit-path line had the same bug,
  less visibly, and is fixed the same way.
- **The orbit-path fade from 5.2.5 now takes about twice as long** (~1.2s
  instead of ~0.6s) to reach a body's resting opacity.

---

## 5.2.5

- **Orbit paths now fade out when you focus a body, instead of vanishing
  on the same frame.** `orbitAtRest()`/`orbitHovered()` used to write
  straight to material opacity/colour, so focusing anything snapped every
  ring in the scene invisible on the same frame — now they only set a
  target, and a per-frame step eases toward it (~90% of the way there in a
  quarter second).
- **Stashed the "What's up tonight" nav icon** from both the desktop
  header and mobile menu — not deleted, just no longer linked to from
  navigation.

---

## 5.2.4

- **Fixed the night sky lurching mid-drag on a phone.** `/sky`'s
  look-around handler tracked "am I dragging" as a plain flag rather than
  which touch started the drag, so a second incidental touch mid-gesture (a
  palm edge, a second finger) reset the drag's reference point without
  ending the first touch's drag — the next move then measured against the
  wrong origin, reading as a lurch. Fixed by tracking the actual pointer ID
  and ignoring other pointers until it lifts.

---

## 5.2.3

- **Fixed: leaving the night sky flew back down onto a focused Earth
  instead of reversing the dive out.** The back button called
  `navigate(-1)`, popping browser history back onto the `/object/earth`
  entry the entry cinematic itself had pushed underneath `/sky` —
  replaying an ordinary focus fly-in instead of reversing the dive. Now
  navigates straight to `/`, letting the scene's existing
  unmount-while-focused exit animation (built for React Router remounts)
  reverse the dive naturally.
- **Reworked the night sky's compass pointer, and fixed why it read as
  lopsided.** It was a fixed triangle that only sat beside "N" at heading
  zero; redrawn as a lubber line straddling the rim with a short stem, the
  way a real ship's or aircraft's compass marks the current heading
  against a rotating card.
- **AR mode: the sky tracking the phone should no longer feel jumpy in
  bursts and laggy in between.** Both symptoms were the same bug: heading/
  altitude smoothing was a flat 15%-per-event average, which bakes in a
  different effective response time depending on how bunched or spread
  real sensor events happen to arrive. Smoothing is now weighted by real
  elapsed time between samples, and the camera update moved off the raw
  sensor callback onto the render loop.

---

## 5.2.2

- **Fixed: focusing a distant body used to visibly centre on the Sun
  before swinging round to the actual target.** The camera's look-at point
  was lerped through raw 3D space from wherever `controls.target` last
  idled — which eases toward the origin, i.e. the Sun — so any fresh focus
  from the idle view routed through the Sun mid-flight. Replaced with a
  quaternion slerp between two orientations that both already look at the
  target.
- **True distances + sizes: focusing a planet now frames the Sun in shot,
  off to one side**, the same treatment the probes already had, since a
  true-sized planet dwarfed by its true-distance orbit could otherwise
  land the camera looking at empty sky.
- **The same true-sizes flight now takes 2.4s instead of 1.2.** A
  20,000×-plus zoom in the old duration read as a flinch.
- **Fixed: Saturn's ring shadow covered half the ring instead of the strip
  actually behind the planet, at true sizes.** The shadow shader's radius
  uniform was set once to the drawn 3.56-unit radius and never updated, so
  at true sizes every ring point fell inside the now wildly stale test
  radius. Now updated every frame alongside Saturn's live position.

---

## 5.2.1

- **Fixed: flying to a true-size body felt like it slammed to a stop.** The
  fly-in eased raw camera position linearly, which decelerates smoothly in
  absolute units but compresses nearly all of the perceptually relevant
  closing into the last few frames once a landing distance is thousands of
  times closer than the start (Earth's is ~23,000×). Distance now eases in
  log space instead, closing by the same ratio at every step of progress,
  which reads as a landing rather than a lurch. Falls back to a plain lerp
  if either endpoint sits on the target. Only visible where the zoom ratio
  is large; ordinary compressed-layout focusing is unchanged.

---

## 5.2.0

- **True sizes, as a third setting on the distances toggle.** The layout
  control is now a three-stage cycle — compressed → true distances → true
  distances *and* sizes. Stage three puts the entire scene on one scale
  (1.56 million km/unit), where nearly every body falls below a pixel and
  orbit rings are what's left to navigate by; there's no minimum dot size
  propping anything up, since that emptiness is the honest picture. Focusing
  a body still grows it to its real proportions.
- Real radii come from `objectCatalog.js` directly rather than a
  duplicated table, with named fallbacks for the handful of bodies the
  catalog states in an unparseable shape (Haumea's three axes, Halley's
  nucleus, the ISS).
- Hitboxes and probe markers don't shrink with true size, for the same
  reason labels don't — they're wayfinding, not scale claims.
- Focus framing scales down by the same factor as the body, and re-settles
  from a stored distance once a stage transition and any in-flight fly-in
  have both finished, so a deep link straight into stage three still lands
  correctly.
- Shared links carry the new stage as `scale=sizes`, alongside the
  existing `scale=true`.

---

## 5.1.9

- **The focused-object overlay steps aside for the /sky dive.** The
  cinematic reaches Earth by focusing it, which used to bring the whole
  focus UI along — description card, stats, hint, back button, and the
  phone's detail sheet peek. All of it now fades or slides out for the
  length of a dive, mirrored into state the same way scale and viz mode
  already are.
- **Re-timed the dive so it reads as a descent.** The approach and the turn
  used to share one progress value, so the view swung off the planet a
  third of the way in and spent its last 1.5s pointed at empty space; the
  turn now holds off until the descent is under way, and the camera lands
  on the same look direction `/sky` itself opens at.
- **The curtain now starts while the camera is still moving**, beginning
  its fade as the view comes level with the horizon rather than waiting for
  motion to finish, removing the dead beat at the end.
- Hover height at the end of the dive is bounded by the camera's near
  plane, stopping at 0.85 Earth radii above the surface.

---

## 5.1.7 – 5.1.8

- **A camera lens-flare on the Sun, added and then brought under control.**
  5.1.7 added a proper glare via three.js's own `Lensflare` — halo, streak,
  ghost elements, drawn on canvas the same way surfaces already are —
  gated to medium/high quality tiers. One bug fixed on the way in: the
  Sun's own opaque sphere failed the flare's occlusion probe against
  itself, rendering it at ~3% visibility, fixed with `depthWrite: false`.
  It shipped far too hot — a 420px halo blowing out the Sun's own texture —
  so 5.1.8 dimmed the halo, streak and ghosts substantially and replaced
  the streak's hard-edged rectangle with a proper squashed radial gradient.
  It also replaced the `depthWrite: false` fix (which had let background
  stars draw over the Sun's disc) with repositioning the flare each frame
  onto the camera-to-Sun line just clear of the surface, restoring normal
  depth behaviour.

---

## 5.1.6

- **Fixed: a focused planet's description card was blocking clicks on
  whatever was behind it, across the full width of the screen.** The
  panel's outer box was full-viewport-width `position: absolute` with only
  an inner wrapper centring the visible card, and neither had a
  `pointer-events` override — so the invisible margin on either side of
  the card absorbed clicks meant for the scene canvas behind it, silently,
  for as long as the description was open (which is by default). Fixed by
  moving the width constraint onto the outermost box and setting
  `pointer-events: none` there (and on the padding wrapper), `auto` only on
  the visible card — the same pattern the header already uses.

---

## 5.1.5

- **A first-visit hint for the new burger menu.** 5.1.4's mobile header
  collapse traded five always-visible icons for one that now needs
  discovering; a coach mark ("Language, sharing and more") now points at it
  once, mobile only, following the same stored-flag/no-nag convention every
  other coach mark in the app uses. Opening the menu yourself ends the hint
  immediately and persists that.

---

## 5.1.4

- **Fixed the mobile header overflowing, by collapsing its icon row into a
  burger menu.** At a ~390px viewport the six header buttons plus wordmark
  measurably overflowed the header's width on every route. Below the
  mobile breakpoint the first five collapse behind a `Menu` icon; search
  stays its own always-visible button since it already replaces the row
  with a full-width input when opened. New `components/HeaderMenu.jsx`
  mirrors `LanguagePicker`'s own dropdown shape rather than the
  edge-anchored drawers used elsewhere. Desktop is unchanged. Verified in
  headless Chrome, including RTL, which needed no RTL-specific code.

---

## 5.1.3

- **Fixed AR's look-down "drag" — the view froze at -10° instead of
  following the phone down.** `skyRotation.js`'s altitude floor exists so
  the drag-around dome can't run past its rendered ground into empty
  space; AR's real camera feed has no such floor, but shared the same
  clamp. `setLookDirection()` now takes an optional altitude range, with
  AR's device-orientation path passing -90°/90° instead of the dome's
  default -10°/90°.

---

## 5.1.0 – 5.1.2

- **An AR constellation viewer for /sky, built in three milestones.** The
  goal: point a phone at the real sky and see constellation lines, names,
  and Sun/Moon/planet markers line up live via the device's own compass and
  tilt — "compass AR," not WebXR, since iOS Safari has no `immersive-ar`
  support. Milestone 1 (5.1.0) shipped the capability gate, permission flow
  and camera compositing, not yet sensor-driven. Milestones 2–3 (5.1.1)
  made it compass-driven: `utils/deviceOrientation.js` converts
  `DeviceOrientationEvent` into the same azimuth/altitude the drag control
  already accepts, preferring iOS's `webkitCompassHeading`, falling back
  through `deviceorientationabsolute` to a calibrated relative `alpha`,
  with magnetic declination corrected via `magvar`. Two real bugs were
  caught by testing: a mirrored heading formula, and headless Chrome's
  orientation emulation dispatching an all-null event before real values
  arrive. Milestone 4 (5.1.2) added a halo behind each marker for
  visibility against bright sky, boosted constellation-line opacity for use
  over a real camera feed, capped the star count to the low-tier budget
  regardless of device tier, and made AR portrait-only with a rotate nudge.
  Built and shipped without a real-device round trip past milestone 1,
  since the compass-permission path has no headless-Chrome equivalent.

---

## 5.0.13

- **The timeline pill's date is now a picker, not just a readout.**
  Clicking it opens the browser's own calendar via `showPicker()` on a
  hidden `<input type="date">` behind the visible locale-formatted text;
  picking a day keeps the simulated clock's existing hour rather than
  zeroing to midnight, and is bounded to the scrubber's own ±10-year range.
  The pill also now shows hours-and-minutes at all times rather than only
  while live, so "Live" no longer has to carry the time of day on its own.

---

## 5.0.12

- **The timeline pill is back on /sky.** 5.0.2 removed it outright, but
  `simTime.js` is a site-wide singleton — a date scrubbed on the
  solar-system page (or on an earlier /sky visit) carried into the night
  sky with nothing on screen to explain or reset it. Restored
  `<TimeControl />` in `NightSkyPage.jsx`.

---

## 5.0.11

- **The Milky Way skysphere was too small for true distances.** Fixed at
  8,000 units for the compressed layout, it left the camera outside it once
  true distances put the Voyagers at 16,000+ units — and a `BackSide`
  material only draws from inside, so crossing that boundary blacked out
  the whole backdrop. Scaled up to 24,000 units over the same transition
  that drives `controls.maxDistance`, with the far clipping plane moved out
  to match.

---

## 5.0.7 – 5.0.10

- **Four releases finding the real shape of the /sky compass HUD.** 5.0.7
  dropped the always-zero "Roll" line and stopped the N/E/S/W letters
  tipping with the dial by counter-rotating them in their own inner span;
  5.0.8 fixed that span breaking centring (a descendant selector matching
  the new span and handing it unanchored absolute positioning — narrowed to
  a direct-child selector). 5.0.9 redesigned the dial around a sweeping
  needle, misreading the actual problem — a heading/altitude text box that
  never reserved its own width, so digit-count changes shifted the whole
  column left, reading as "the compass moving." 5.0.10 reverted the needle
  redesign and fixed the real bug: the stats box now reserves a fixed
  character width.

---

## 5.0.6

- **The exit animation ended clean, then twitched — a sudden roll, on
  every single return home.** Two bugs, both from state that kept quietly
  drifting while idle drift was suspended (during any focus or exit)
  without ever being reset. `camera.up` stayed frozen at whatever small
  residual roll it held the instant a planet was clicked, and the exit's
  roll-error check compared it against a viewing direction that had
  usually changed completely by return — reading a stale sub-degree
  residual as real error and yanking the camera level over a few frames.
  Fixed by resetting `camera.up` to level the moment an exit begins.
  Separately, `driftEase` — the ramp that fades idle drift back in — kept
  advancing every frame regardless of whether drift was actually visible,
  so a focus+exit round trip (which easily outlasts its ~1s ramp) let it
  silently finish in the background, causing drift to resume at full
  strength in one frame instead of easing in. Now only advances while idle
  drift can actually apply.

---

## 5.0.5

- **The 5.0.3 exit animation snapped at the very start; now it doesn't.**
  `exitPhase === 1` set `controls.minDistance = 30` unconditionally from
  the first frame, but the cubic ease driving distance starts slow by
  design — so `controls.update()`'s own unconditional clamp to
  `minDistance` silently overrode the eased value with a hard floor until
  the animation caught up, reading as a snap. `minDistance` now tracks the
  animation's own in-flight distance each frame instead of jumping to its
  final value up front.

---

## 5.0.4

- **The night sky's star density now starts at 50%, not 100%.** A first
  visit used to show the full tier budget of stars immediately; the full
  sky is still one slider drag away.

---

## 5.0.3

- **The zoom-out back to the solar system, from a focused planet, is one
  motion now instead of two.** It used to hand off from a fixed-speed
  pull-back to a separately-eased "fly to the sun" stage, with a visible
  seam between them. A first attempt tried freezing one direction at the
  start (as the sky-entry dive does), but that direction is, for most
  planets, also nearly the direction from the Sun through the planet —
  landing the just-abandoned planet directly between camera and Sun on
  arrival. The fix keeps the old stage's self-correcting approach —
  recomputing direction fresh every frame from the live camera position —
  but drives it as one continuous cubic ease instead of two stitched
  animations.

---

## 5.0.2

- **Three more /sky requests.** The timeline pill no longer shows on /sky,
  removed outright since the page is meant to be looked at rather than
  scrubbed (the clock itself, a site-wide singleton, is unaffected).
  Constellations are now searchable from the header search bar by Latin
  name or IAU code, via a new small always-bundled
  `data/constellationNames.js` kept separate from the full lazy-loaded line
  geometry; picking a result lands on `/sky?con=<iau>`. And 5.0.0/5.0.1's
  dive-and-turn is one eased motion now instead of two stitched ones,
  removing the seam between approach and turn by sharing a single
  `skyApproachProgress`.

---

## 5.0.1

- **Four fixes and one addition, reported directly from using both /sky
  features.** The constellation hover highlight from 4.10.0 never actually
  drew, since its line mesh's frustum-cull bounding sphere was computed
  once against an empty buffer on first frame and never recomputed — fixed
  by skipping the cull test, the same fix already used for gravity lines
  and probe tracks. The constellation info card now lists its named stars
  (locale-aware, capped at eight) instead of just the brightest one. The
  5.0.0 dive-and-turn snapped at the end, since nothing held the camera
  during the ~460ms curtain fade and OrbitControls reclaimed it, snapping
  back to a wide Earth view before the curtain hid it — fixed by holding
  the camera at its final frame until the component unmounts. And a
  constellation's own connected stars now render 50% larger than magnitude
  alone would give them, matched by exact `[ra, dec]` key lookup against
  the line-strip endpoints rather than a fuzzy search.

---

## 5.0.0

- **A cinematic way into /sky.** Clicking the star icon used to be a flat
  route change; it now flies the solar-system camera to Earth, dives to
  your saved location, turns around, and hands off to /sky behind a
  curtain-fade — driven by a new `utils/skyEntry.js` phase machine that
  survives the route change itself. It's the first time the app hands a
  camera between two separate Three.js scenes, which is why this is a
  major version. Reachable from anywhere once location is granted; without
  it, navigation stays instant.
---

## 4.10.0

- **The night sky gets a compass, a natural-looking ground, and clickable
  constellations.** Three fixes/additions to `/sky`, reported directly from
  using it: the ground hemisphere below the horizon used to borrow the sky's
  own colours (a bright, saturated blue at midday, mirroring `DAY_SKY`
  exactly), which read as "the ground is blue" rather than "the ground
  catches a little light from the sky" — it now ramps through its own
  warm, desaturated palette (a real amber glow at dusk/dawn, a neutral dark
  warm-gray by day, never blue), and the horizon-glow band is a lot
  narrower, so it reads as a glow *at* the horizon rather than a wash over
  most of the visible ground.

  - **An orientation HUD**: a small rotating compass dial plus a
    heading/altitude/roll readout, top corner (mirrors to the other corner
    in Arabic, no JS branching — pure CSS logical properties). Roll has no
    control in this scene at all and reads a static 0°, included anyway so
    the HUD says so plainly rather than silently dropping the one number
    that never changes.
  - **Constellations are hoverable and clickable**, the way a planet is in
    the solar-system view: hovering brightens the figure under the cursor
    (highlighting its own line segments, rewritten only on hover-change, not
    every frame) and clicking pans the view smoothly to it and opens a small
    info card — name, IAU code, how many catalog stars fall inside it, and
    its brightest named star, when it has one. The hit-test is the
    constellation's *true* IAU boundary (`Astronomy.Constellation()` fed the
    cursor's own ray, the same conversion the "what am I looking at"
    crosshair already used for the camera's forward direction) rather than
    an approximate radius around the drawn figure — more forgiving to click,
    and no new geometry to test against.

---

## 4.9.0

- **The night sky gets a settings drawer, a way home, and a first-visit
  hint.** Phase 3 of `/sky`, closing out the plan 4.7.0 opened: a
  `ScenePanel`-style edge drawer (`NightSkyPanel.jsx`, the same drawer the
  solar-system scene already uses, down to the CSS) holding three controls
  — constellation lines on/off, twinkle on/off, and a star-density slider —
  all backed by a new `utils/nightSkySettings.js` singleton, persisted to
  `localStorage` and read once a frame the way every other render-loop
  toggle in this codebase is. Density costs nothing extra to compute: it
  re-slices the catalog that's already loaded and already magnitude-sorted,
  client-side, no new data and no network round-trip.

  - A **"Look north" button** resets the view to `skyRotation.js`'s own
    default azimuth/altitude — verified pixel-for-pixel against the scene's
    own fresh-load framing, not just "looks about right."
  - A **first-visit `CoachMark`** points at the drawer's closed tab, its
    own `p4rsec.coachSky` flag rather than the solar-system scene's
    `p4rsec.coach` — seeing one scene's hint says nothing about having seen
    this one's different drawer.
  - `/tonight` gained a "See the sky in 3D" CTA into `/sky`, closing the
    loop the plan asked for between the flat readout and the immersive
    scene.
  - **A real layout bug, caught and fixed:** `AppShell.jsx`'s `<main>`
    centres page content at up to 1280px wide, which was quietly shifting
    the *entire* `/sky` page — the back button, the drawer, everything —
    about 80px off the true edge since Phase 1 shipped, not just something
    Phase 3 introduced. `CategoryBrowser.jsx` had already solved this exact
    problem for its own full-bleed viewport; `NightSkyPage.jsx` now uses
    the same fix (`width: 100vw` plus *both* margins set to
    `calc(-50vw + 50%)`, not just one — a single margin over-constrains the
    box and CSS silently drops the trailing one, on the wrong side
    depending on LTR/RTL).
  - A dim Milky Way band and a tap-a-star info card were both on the
    original plan's Phase 3 polish list and are deliberately **not** in
    this release: the band needs an actual texture asset and a
    light-pollution-aware blend worth doing properly rather than looking
    cheap, and a real info card needs per-star facts this catalog doesn't
    carry yet. Both are a cleaner follow-up than a rushed version of
    either here.

  This closes the `/sky` feature's three-phase plan: real stars and
  constellations at your real location (4.7.0), the real clock and the Sun,
  Moon and planets sharing the dome (4.8.0), and now the controls to make
  it comfortable to actually live in (4.9.0).

---

## 4.8.0

- **The night sky knows the time, the planets, and what you're looking at.**
  Phase 2 of `/sky`, on the foundation 4.7.0 laid: the same clock
  `TimeControl` scrubs on the solar-system page now turns this sky too —
  `utils/simTime.js` is one singleton, not scoped to a route, so winding
  time back there winds the stars back here — and the Sun, Moon and the
  seven other planets now share the dome as small colour-coded points,
  positioned the same way `/tonight`'s own alt-az readout is, labelled the
  same way the constellations are.

  - **88 translated constellation names**, Arabic and Vietnamese, sourced
    and cross-checked against ar.wikipedia.org and vi.wikipedia.org's own
    constellation lists rather than guessed — six of them (the ones this
    site already had occasion to translate, as "which constellation is
    this galaxy in" labels elsewhere in the catalog) checked to match what
    was already shipped, so the same constellation reads the same word
    everywhere on the site. Keyed by IAU code, not by name — a name isn't a
    stable key across three languages the way "Ori" is.
  - **"What am I looking at"**, top and centre: `Astronomy.Constellation()`,
    the official IAU boundary lookup, fed the camera's own look direction
    converted back to sky coordinates via the inverse — the transpose, for
    a pure rotation — of the same matrix the stars turn by. No new data for
    this at all.
  - Constellation and body names are plain DOM nodes, positioned
    imperatively every frame exactly the way `SolarSystem3D.jsx`'s own
    planet and moon labels are, not React state — decluttered the same
    way too, dropping whichever label loses a spot already taken.
  - Caught two real bugs building this, both worth naming: `simNow()`
    returns a raw millisecond number by design (so a 60Hz loop isn't
    forced to allocate a Date every frame it doesn't need one), and passing
    that number straight to `astronomy-engine` where a `Date` belongs
    produced a wonderfully specific crash — `Object is too distant for
    light-travel solver` — instead of merely wrong output. And the
    Sun/Moon/planet markers rendered nothing at all, from any angle, at
    any size, because their geometry's bounding sphere was computed once
    from an all-zero initial position buffer and never recomputed as the
    real positions came in every frame after — a stale zero-radius sphere
    sitting exactly on the camera, silently frustum-culling nine points
    forever. `frustumCulled = false` on nine points costs nothing.

---

## 4.7.1

- **README caught up to `/sky`.** A new "The night sky" section (the
  coordinate pipeline, the two datasets and their licenses, the camera and
  ground technique), and the file map gained `NightSkyPage.jsx`,
  `NightSky3D.jsx`, `skyRotation.js` and `skyCatalog.js` — same posture as
  4.6.4: a subsystem this size gets its README section in the same
  release, and this one shipped a turn late rather than not at all.

---

## 4.7.0

- **The night sky, from where you're standing.** A new scene — `/sky`,
  lazily loaded, nothing about it reaches anyone who doesn't click the new
  star icon in the header — puts you on the ground looking up, instead of
  outside the solar system looking in. Real stars, real constellation
  figures, oriented to your actual location and the actual time, right now.
  Drag to look around; scroll to zoom; arrow keys work too.

  - **8,920 real stars**, from the HYG database (Hipparcos + Yale Bright
    Star + Gliese), down to magnitude 6.5 — the same "dark-sky" naked-eye
    ceiling `/tonight`'s own visibility labels already use. **674 line
    segments** across all 88 IAU constellations, from Stellarium's western
    sky-culture data, joined to HYG on their shared Hipparcos numbers. Both
    sources are CC BY-SA; credited in the scene itself.
  - Every star is a fixed J2000 direction, converted once at load and never
    touched again. What moves is one 3×3 rotation a frame — built from the
    observer's location and the real time via `astronomy-engine`'s own
    `Rotation_EQJ_HOR` — uploaded as a shader uniform, so 8,920 points and
    674 line segments turn with the sky as a side effect of the ordinary
    draw call rather than 8,920 individual position updates. A dedicated
    test pins the whole pipeline against independent `Astronomy.Horizon()`
    calls for five real stars at three latitudes, to six decimal places.
  - Point size follows Pogson's ratio — five magnitudes is a hundredfold in
    flux — so Sirius reads as unmistakably brighter than a star at the
    limit, not merely a shade bigger. Stars fade out within a couple of
    degrees of the horizon rather than popping off; the ground below it is
    a tinted hemisphere that ramps from the real Sun's current altitude
    (the same twilight boundaries `/tonight` uses) at the horizon to near
    black at the nadir.
  - Camera position never changes — only its rotation, so there's no
    parallax to get wrong. Quality tiers apply the same way they do
    everywhere else on the site: a phone gets 2,000 stars and no twinkle, a
    desktop the full catalog.

---

## 4.6.7

- **The scene is a flat 30% brighter.** `renderer.toneMapping` was
  `NoToneMapping` (three's default), under which `toneMappingExposure` does
  nothing at all — the exposure multiply lives inside the tonemapping shader
  chunk, which a `NoToneMapping` renderer never includes. Switched to
  `LinearToneMapping` (a plain exposure multiply, no filmic contrast curve to
  fight) at `1.3`. Lifts the Sun, every planet and moon, the rings, the sky and
  the orbit rings uniformly; Earth's day/night shader is raw GLSL outside
  three's material system and doesn't participate, so it holds steady rather
  than blowing out. Applied everywhere, not just Chrome — safer than trying to
  detect a browser to treat it differently, and 4.6.6 already brought Chrome
  and Safari closer together than they were.

---

## 4.6.6

- **The Sun, planets, moons and Saturn's rings were washed out — worse in
  Chrome than Safari.** Two gaps in the same family as the Milky Way brightness
  split fixed back in 4.4.1, just never pulled for anything besides the sky:
  the renderer never explicitly assigned `outputColorSpace`, which is the only
  thing that actually pins the canvas's drawing-buffer colour space — Chrome
  and Safari can (and did) disagree on the unset default, especially on a
  wide-gamut display, shifting the *entire* scene's brightness against itself
  between browsers; and every real photographic texture (`sun.jpg`, each
  planet's map, `saturn_ring.png`, the moons) loaded untagged, so three.js
  decoded the bytes as already-linear and re-encoded them again on output —
  a double gamma pass that reads as pale and flat everywhere, not just on the
  one body a complaint happened to name. Both are now set explicitly. Left
  alone: Earth's day/night/clouds shader, which samples its textures directly
  in custom GLSL rather than through three's material pipeline and would need
  its own compensating decode if tagged — a separate, riskier change than this
  one, and Earth wasn't reported as part of the problem.

---

## 4.6.5

- **`/favicon.ico` was serving the app shell, not an icon.** With no file at
  that path, the SPA's catch-all rewrite handed every fetcher a `200 text/html`
  page instead of a 404 or an image — invisible in a browser, which follows the
  `<link>` tags and never asks, but not to a search engine's favicon crawler,
  which asks for that path directly. There is now a real multi-resolution
  `favicon.ico` (16/32/48 px) and a 96×96 PNG, both wired in as fallbacks
  behind the SVG (which stays the primary icon everywhere that reads it). This
  is a bet on why Google search still shows the old ringed-planet icon for this
  site days after 4.6.2 replaced it with the telescope — worth ruling out
  regardless, since search engines resolve favicons by their own rules, not by
  rendering the page.

---

## 4.6.4

- **A `CLAUDE.md` for anyone — or anything — arriving at the codebase cold.**
  A one-page orientation: what the site is, where things live, the
  release-per-commit workflow, and the handful of rules that are not obvious
  from reading the files (the render loop is not React; every `t()` key needs
  all three locales; the belt tilt derives from Mars samples on purpose). The
  README is refreshed alongside it — the live URL is `p4rsec.com`, the file map
  matches what is actually there, the satellite globe is no longer called
  `IssGlobe`, and there are new sections on the scene-toggle singletons, the
  gravity overlay and camera drift, and internationalisation.

---

## 4.6.3

- **The camera rides along with a focused body through a time change.** With a
  planet, moon or probe focused, scrubbing the clock — or pressing the
  timeline's "back to now", which winds the planets home over five seconds —
  used to leave the camera pinned in space, watching its subject shrink and
  slide out of frame. It now follows the body frame for frame, so the framing
  you set is the framing you keep, all the way there and back. Dragging to
  orbit the body still works throughout.

---

## 4.6.2

- **The favicon is the wordmark's telescope now** — the same lucide glyph,
  white on the dark rounded square, replacing the ringed planet. Adds a proper
  180×180 `apple-touch-icon.png` for the iOS home screen (the tab icon stays
  the SVG).

---

## 4.6.1

- The version panel is titled **"Version history"** (the subtitle is gone).
- The first-visit settings hint disappears the moment you open the drawer.
- The first-visit speed hint points its arrow straight at the fast-forward
  button.
- **Arabic: the rewind and fast-forward buttons swap sides and mirror.** In a
  right-to-left layout the past is to the right, so rewind moves there and the
  two arrow glyphs flip with it. Play/pause stays put. The first-visit hints
  land correctly in the mirrored layout too.

---

## 4.6.0

- **A "what's new" panel.** Clicking the version number in the header opens a
  curated, plain-language history of what has changed on the site —
  `data/whatsNew.js`, newest first, with the current release marked. It is a
  visitor's view; the full engineering log stays in this file. English entries,
  translated frame.
- **The first-visit hints lost their box.** They are just an arrow and a line
  of text now, over the scene like the object labels, shown one after the
  other and each pinned to its control by measuring it (so they centre and
  keep a clear gap). A plain time-out no longer marks them seen, so someone
  who glanced away gets another chance next visit.

---

## 4.5.0

- **First-visit hints.** The first time someone drags the scene around, two
  small callouts appear one after the other — one pointing at the time
  controls ("Speed up or rewind time"), one at the scene-settings drawer
  ("Gravity overlays, camera drift, and scale — all in here"). Tap to move on;
  each also times out on its own. Shown once, then never again (a flag in the
  browser). Scrolling to the catalog or opening an object ends the run early.

---

## 4.4.2 – 4.4.5

- **Four rounds of tuning the warped-grid gravity overlay.** The full sheet
  came back as a ghost: rather than clipping the grid to a disc around each
  body, the whole sheet draws again, but outside those windows it drops to a
  faint grey (`gridPatch.outAlpha`, later brightened 0.14 → 0.32) while the
  body windows keep their colour and full strength. The grid also thins by
  half at true distances, where the far emptier layout was reading the
  compressed density as clutter.

  The Sun's well went through two shapes on the way to its final one: first
  a spike rather than a crater at true distances (depth still growing with
  the layout, `sunWellTrueScale` 3.4, radius growing far less), then gentler
  still — the depth multiplier dropped to 2.3 so the wall grows into a
  broad deep bowl instead of a near-vertical spike. One change didn't
  survive along the way: putting the grid plane on the analytic ecliptic
  obliquity looked right on paper but not on screen, and was reverted in
  the same run — the Mars-sample-derived plane is what actually matches how
  the orbit rings sit in the default view.

---

## 4.4.1

- **Default drift is ~30% quicker** — the out-of-the-box yaw and pitch step up
  from 0.15 / 0.11 to 0.195 / 0.143.
- **Warped grid:** a touch denser than before, and the cell size now holds
  constant out to true distances instead of a window showing four huge
  squares. The Sun's dimple is retuned — narrower and much deeper, a proper
  puncture.
- **Milky Way sky brightness.** The sky plate was untagged, so it was decoded
  as linear data and re-lightened on output, and — the reason it looked
  blown-out in Safari but faint in Chrome — WebGL was left free to stretch it
  into a P3 Mac display's gamut in Safari only. It is tagged sRGB now: correct
  brightness, and identical between browsers.

---

## 4.4.0

- **The warped grid is now a window, not a whole sheet.** Instead of one
  endless plane, the grid is drawn only in a disc around each body — a view
  onto that body's dimple. The disc's radius tracks the well's own size (and
  so, roughly, the body's mass): the Sun's window dwarfs Pluto's. Tuned by
  `WEIGHT_CONFIG.gridPatch`.
- **"Explore the catalog" gets the liquid-glass treatment** — the frosted
  white fill, the border, the specular edge and the drop shadow the app's
  cards use — instead of a flat black chip.
- The scene-drawer chevron's two arrowheads swap weight: the heavier one now
  sits on the far side from the screen edge.

---

## 4.3.5 – 4.3.7

- **The scene-drawer tab settled into its final shape over three small
  passes.** First it lost its box entirely — no pill, no border, no
  backdrop, just the chevron sitting a little in from the edge and bobbing
  with the focused-object sheet's own `scrollPromptBob` while closed,
  exactly like that handle. Then the bob was turned to run left–right, the
  way the chevron actually points, instead of up–down. Then nudged a few
  pixels further off the edge.

---

## 4.3.4

- **The scene-drawer tab is the focus-view pull handle exactly, laid on its
  side** — the same doubled `ChevronDown`, same overlap, same widening, same
  two opacities, just turned a quarter turn to read as » / «.
- **The version tag drops into line with the wordmark** instead of riding above
  its cap height.

---

## 4.3.3

- **Labels keep up with a drag.** The floating body names project against the
  camera's world matrix, which the renderer only refreshes *after* the labels
  are placed — so during a drag or a zoom every label trailed a frame behind
  its body and only snapped true when the motion stopped. The matrix is now
  refreshed just before the labels are positioned.
- **The version tag moves beside the wordmark** rather than under it.
- **The scene drawer's tab gets the double-chevron** from the focused-object
  pull handle — a bright arrowhead over a dim one — instead of a single glyph.

---

## 4.3.2

- **The field-line arrowheads move to the tip.** They sat partway along each
  line; now each one caps the line where it meets the body, so the picture is
  a ring of arrows pointing into every mass.
- **The build version shows under the wordmark** — a small `v4.3.2` tucked
  beneath P4RSEC in the header.

---

## 4.3.1

- **Back to a hairline field line.** The wider line from 4.3.0 is reverted —
  the field lines are a one-pixel `gl.LINES` batch again, and the per-line
  alpha goes back with it. The per-body tint and the arrowheads stay; only the
  width changed back. Drops the `LineSegments2` dependency and the canvas
  `resolution` plumbing that came with it.

---

## 4.3.0

- **The gravity field lines now read as a field.** Three changes to the
  field-line overlay:
  - **Each line is tinted the colour of the body it flows into** — the Sun's
    gold, Earth's blue, Mars' rust, Uranus' cyan — the same tints the orbit
    rings take on hover. Which body a streamline belongs to comes out of the
    tracer now (the stop sphere it crosses), so a line that arcs from a planet
    across to the Sun is coloured for the Sun, where it ends.
  - **The lines are drawn wider.** They were a one-pixel hairline on every
    platform, which read as a grey haze; they now have real width
    (three's `LineSegments2`), so the picture is lines and not fog. Per-line
    alpha comes down to match — a fat line over additive blending piles up
    fast where the streamlines converge.
  - **Each line carries one small arrowhead** partway along, pointing the way
    the field flows — into the mass. The barb sits in the plane of the line's
    own curve so it mostly faces the camera rather than turning edge-on.
- Measured on the test machine: still a flat ~60 fps in field-line mode; the
  retrace cost is unchanged (the tracer does the same work, the arrowheads are
  a handful of extra segments per line).

---

## 4.2.1

- **The timeline opens expanded on a phone.** It used to start as a compact
  date chip everywhere but a roomy desktop; on a phone, where it is the main
  way to scrub through time and the expanded control is already narrow, it now
  starts open. The mid-width desktop band still opens on request — expanded
  there, it runs into whatever is centred on screen.

---

## 4.2.0

- **Scene controls fold into an edge drawer.** Drift on/off, the yaw/pitch/roll
  sliders, compressed/true distances and the gravity overlay used to fan out
  along the bottom as a row of pills — one more each release. On desktop they
  now live in a panel against the leading edge of the scene, collapsed by
  default behind a small chevron tab, so the hero view is clean and there is
  somewhere for the next toggle to go. *Explore the catalog* stays exactly
  where it was, centred at the bottom.
- The drawer sits above the floating body labels and is near-opaque, so it
  covers them cleanly when it is open over their side of the view (the whole
  right half in the default framing — the leading edge in a right-to-left
  layout). It hides with the rest of the hero chrome once the page scrolls or
  an object is focused; the toggle states themselves are untouched.
- The phone keeps its own treatment — the same toggles folded behind one
  button up the start edge — because a left drawer fights the thumb there.
- Internally: the drift sliders are now a shared `DriftSliders` component, used
  both by the new desktop drawer and the phone's existing popover.

---

## 4.1.4

- **Gentler default drift.** The out-of-the-box yaw and pitch are halved again
  (0.15 and 0.11 of full) — the idle motion is now barely there. Anyone who
  has already touched the sliders keeps their own setting; Reset gives the new
  values.

---

## 4.1.3

- **Three times as many field lines.** `fieldLines` runs 15–72 per body now
  (was 5–24), ~390 lines total — the field topology reads properly, each body
  a clear sink. Line opacity drops to compensate for the additive pile-up
  where they converge; the phone tier thins back to roughly the old count.
  Retrace is ~5.5 ms on the test machine (was ~1.8), still comfortably inside
  a frame, and the adaptive frame-skip already covers a fast scrub.

---

## 4.1.0 – 4.1.2

- **Idle drift became something you can shape, in three passes.** A panel
  next to the Drifting pill opened three sliders over the scene's always-on
  slow turn — yaw, pitch, roll: yaw is the turntable spin, pitch swings the
  elevation, roll leans the whole scene and swings back (accumulated per
  frame and rotated onto the camera after OrbitControls has had its say,
  since OrbitControls itself keeps the horizon level by design and unwound
  to level whenever it is set back to centre, drift is held still, or the
  pointer is on a body). Each slider is a signed rate and the settings
  persist; "Held still" still stops everything in one click.

  It shipped dead to the touch: the toolbar the sliders sit in is
  `pointer-events: none` so a drag that misses a pill still orbits the
  scene, and the drift popover's own trigger opted back in but never
  re-enabled events for its own body — fixed the same release cycle.

  Then reworked three things at once: the labels, which project against the
  camera, were drifting a frame stale because roll was applied after that
  frame's projection had already run; pitch and roll ran between soft stops
  and bounced off them, replaced with free rotation about the camera's own
  axes (pitch somersaults right over the poles, roll spins all the way
  round, and `controls.update` reads the drifted position back as its orbit
  so a drag still picks up cleanly); and the top of each slider's range was
  halved, since a fully cranked drift read as a fairground ride rather than
  a slow tumble.

---

## 4.0.3

- **Field lines were traced backwards.** Gravity only attracts, but the
  streamlines ran the other way — every line left its seed body and fled to
  the scene edge, a picture of a *repelling* field. The field vector g(P) was
  right (it points at the masses); the integrator stepped against it, from a
  `sign: -1` default put there on a wrong mental model of what a gravity field
  line is. Now it steps along g, and 100% of lines converge on a body and
  terminate at its stop-sphere (was 0%), 0% run to the bounds (was 100%).
- Seeding reworked to suit the corrected direction: each body's lines start on
  a sphere sized to its distance from the Sun — a fraction of its own share of
  space — so the lines are a visible length at true distances instead of
  collapsing to a spark, and the fade now brightens toward the body a line
  falls into rather than away from it. The corrected trace is also ~40% fewer
  RK4 steps (lines converge instead of running the whole scene), so the
  retrace is cheaper, not dearer, than the earlier measurement.

---

## 4.0.2

- **The Sun keeps its well at true distances.** The distance term that widens
  the outer planet wells so they survive the zoom-out never touched the Sun —
  it is fixed at the origin — so at true scale the Sun's small fixed pit was
  losing the steepness contest to the flung-out gas giants. It now grows with
  the layout by its own factor (both dimensions equally, so the wall slope is
  the one the compressed tuning set — just larger), and the planet wells
  deepen a little less on the way out. Compressed mode is unchanged.

---

## 4.0.1

- **The Sun's gravity well is deeper and steeper.** Wall slope is depth over
  sigma, so `gridDepth.max` went up (34 → 48) and `gridRadius.max` down
  (58 → 48), with a steeper `gamma` on each so the change lands on the Sun
  and not the planets — at the Sun's mass parameter the gamma does nothing,
  but by Jupiter it has pulled the curve back down, so the gas giants stay
  the tight pinch-points they were.

---

## 4.0.0

- **You can see the gravity now.** A new control on the scene — cycled off →
  warped grid → field lines — lays a visualisation of the solar system's
  gravity over the top of it.

  - **Warped grid** is the embedding-diagram picture: a sheet in the ecliptic
    plane, dimpled downward under every body. The height field is
    `y(x,z) = -Σ mᵢ·exp(-((x-xᵢ)²+(z-zᵢ)²)/rᵢ²)`, summed in a vertex shader
    over a 192×192 mesh, so the sheet deforms live as the planets move with
    no geometry rebuilt — only the uniform values change. The Sun's funnel
    dominates; Jupiter and the ice giants sit as their own pinch-points.
  - **Field lines** traces streamlines of `g(P) = Σ -G·mᵢ·(P-Pᵢ)/|P-Pᵢ|³`
    out from a sphere around each body — RK4 with a step that shrinks toward a
    mass and stretches across open space, so a line never punches through a
    planet. It is a CPU trace (≈130 lines, ~3 ms) and re-runs only when a body
    has actually moved, not on a clock — so it keeps pace with the planets
    even at a year per second and costs nothing at all when time is live.
  - Both read one shared model. Real planetary mass spans eight orders of
    magnitude, so it is mapped through a clamped log to a small visual range
    — every constant of that mapping is in one `WEIGHT_CONFIG` object. Real
    distance is left to the radial compression the scene already applies to
    position, with a layout-gated correction that only wakes up at true
    distances, where a fixed-size well would otherwise vanish on the vast
    sheet.
  - It fades away when you fly into a body, crossfades between the two modes,
    and honours the phone tier with a coarser grid and fewer field lines.
    Measured flat 60 fps in every mode on the test machine, including field
    lines at the fastest time rate.

---

## 3.9.1

- **The served HTML carries an `<h1>` now.** The app has always rendered a
  screen-reader-only heading on the home view — the scene has no visible title
  by design — but it was client-rendered, so a crawler that reads the HTML
  before the bundle executes (Bing Webmaster Tools flagged this) found none. A
  copy of it now sits inside `#root` in `index.html`; React replaces the whole
  of `#root` on mount, so the static one and the app's one never coexist, and
  every rendered page still has exactly one `<h1>`.

- **Vietnamese sits above Arabic in the language menu.** Just the order in the
  locale table — English, Tiếng Việt, العربية.

---

## 3.9.0

- **"Back to now" winds the scene home.** Pressing it used to reset the *rate*
  to live but leave the planets sitting at whatever date the scrub had reached
  — they only caught up on the next sixty-second refresh, or the moment you
  touched another control. Now the clock eases from wherever it is parked back
  to the present over five seconds, on an ease that starts and ends gently, and
  the planets, moons, probes and small bodies walk back with it. The scrubber
  slides home, the date counts down, and the button re-arms as "live" when it
  lands.

  - **The frame the clock rejoins the present gets a guaranteed position
    update.** This is the actual fix for the stale-planets bug: whether the
    return was a five-second wind-back or an instant jump, the scene now
    settles every body exactly onto the live date on the handover frame rather
    than trusting the throttled refresh to get there eventually.
  - **Moons settle onto the live date too.** They were computed absolutely from
    the simulated date while scrubbing and integrated forward while live, and
    an instant return left them resuming from the scrubbed phase. The handover
    now lands them where the present implies before the live integrator takes
    over.
  - **Reduced motion skips the travel.** `prefers-reduced-motion: reduce` gets
    the same destination with no animation — an instant reset.
  - **Grabbing any transport control mid-glide cancels it** without jumping the
    clock, and a second press of "Back to now" while it is still winding snaps
    the rest of the way.

  `simTime.js` gains `glideToNow()` alongside the instant `resetToNow()`, and
  `isGliding()`; `isLive()` reports false for the duration of a wind-back,
  which is what keeps the scene animating through it.

---

## 3.8.23

- **The atlas speaks Vietnamese.** The whole interface and the whole catalog —
  seventy object names, thirty-six types, the stat labels, seventy
  descriptions, the eight hundred stat values under them, and the two hundred
  and forty countries the ISS tracker can name. Vietnamese is written in the
  Latin alphabet and reads left to right, so none of the right-to-left work
  Arabic needed applies here; this is a translation, not a re-layout.

  The classical bodies take their Vietnamese names — Mặt Trời, Sao Kim, Sao
  Hỏa, Mặt Trăng — and so do the deep-sky objects a reader is likely to know:
  Andromeda is Thiên hà Tiên Nữ, Orion is Lạp Hộ, the constellations are their
  Sino-Vietnamese names. Moons and dwarf planets named in the last two
  centuries — Io, Titan, Makemake — keep the international spelling, which is
  what Vietnamese-language astronomy writing does with them. Catalogue
  designations stay in Latin for the same reason they do everywhere else.

- **Counted nouns lose their plural.** Vietnamese has no grammatical number:
  "1 ngày" and "5 ngày" are the same word. Every plural table in the locale
  carries the single CLDR category the language uses, and `selectPlural`
  returns a plain string whatever the count — so the same key that inflects
  five ways in Arabic and two in English does nothing at all here, which is
  correct.

- **Two coverage tests learned about Latin-script locales.** "Leaves no Latin
  script in a translated country name" and "has a name for every scene body"
  both assumed a translated string stops looking like its English source. For
  Vietnamese it legitimately does not — "Brazil" is "Brazil", "Io" is "Io" —
  so the country check is skipped for a Latin-script locale, and the body check
  asks only whether an entry exists rather than whether it differs. A new
  `bodyNameExists` in `localizeCatalog.js` backs the second one. Numbers keep
  their English grouping (`1,750`, not `1.750`) to match the stat values that
  pass through the sweep untouched.

---

## 3.8.22

- **The site tells crawlers who it is now.** `og:url`, `og:image` and
  `twitter:image` still pointed at the `onrender.com` host the site was first
  deployed to rather than `p4rsec.com`, so a shared link's preview and its
  canonical origin disagreed with where the site actually lives. All three now
  name `p4rsec.com`, and a static `<link rel="canonical">` joins them — the
  route-aware one that `documentHead.js` maintains at runtime is still the one
  a JS crawler sees, this is the value in the shipped HTML.

- **A sitemap and a robots.txt.** `public/robots.txt` allows everything and
  points at `public/sitemap.xml`, which lists the one indexable URL — the SPA
  serves the same shell for every route, so a per-page sitemap would be listing
  the same document forty times. `robots.txt` had to be un-ignored: the repo's
  `.gitignore` carries an unrelated `*.txt` catch-all.

---

## 3.8.21

- **Hovering a body's label now does what hovering the body does.** Since the
  labels became buttons you could click a name to fly there, but the pointer
  passing over the text — a DOM element beside the canvas, not on it — never
  reached the raycast that lights the orbit ring, holds the idle drift, and
  slows a hovered moon. A small bridge routes the label's `mouseenter` /
  `mouseleave` (and `focus` / `blur`, so a keyboard gets the same feedback as
  it tabs through) into that same state, keyed on the body's id.

---

## 3.8.20

- **A focused object stopped breaking on a landscape phone.** Turned sideways, a
  phone is wider than the mobile breakpoint but far too short for the desktop
  focused-object layout — a description panel across the top, stat annotations
  down each side, all assuming a tall window — so the panel landed on top of the
  name and the orbital period. That layout now switches to the bottom sheet on
  any viewport under 520px tall, not just under 768px wide.

- **The lone-card void is a phone-only thing now.** The min-height that lets a
  one-object category scroll its heading up on a phone was also padding a single
  small card out over a full screen of black on the desktop grid. Desktop skips
  it.

---

## 3.8.19

- **Four more catalog images weren't of their subject.** Apophis was a
  Goldstone/Green Bank radar strip with "Mar 8 / Mar 9 / Mar 10" along the
  bottom; Bennu was an annotated particle-ejection figure; TRAPPIST-1e was a
  planet-density scatter plot; New Horizons was a solar-system map of where it
  had drifted. Apophis and Bennu fall back to the designed cover art now;
  TRAPPIST-1e is the seven planets rendered as spheres; New Horizons is the
  spacecraft at Pluto; and Voyager 2, which had a heliosphere cross-section,
  now shares Voyager 1's render — they are the same craft.

- **A NEO's diameter stopped being printed twice in its own header.** The phone
  identity card showed the key stat and the first physical row, which for an
  asteroid are both the diameter — "~370 m / DIAMETER" beside "~370 m (0.37 km)
  / DIAMETER". The second is dropped when it repeats the first's label.

---

## 3.8.18

- **"Explore the catalog" overshot the heading.** It scrolled a full viewport
  down, but on a phone the scene is shorter than that, so you landed halfway
  down the card list with the category name and count scrolled off the top. It
  now lands with the heading just under the header, the same anchor a category
  switch uses.

- **A spacecraft's operator stopped being the first thing you read twice.** The
  phone identity card showed the key stat plus the first "Physical" row, which
  for a spacecraft is the operator — repeated immediately below in its own
  stats card. The identity card now shows just the key stat for spacecraft.

---

## 3.8.17

- **The standalone pages share one header now.** The tracker, compare and
  "tonight" each carried their own copy of a back button beside a two-line
  title block — which on a phone wedged the button against the title. The new
  `PageHeader` drops the row to one line, `[back] [title] [status]`, with the
  subtitle on its own line aligned under the title, and the title free to
  truncate rather than wrap into the button.

- **Compare stopped printing each diameter three times.** The size under each
  disc ("12,742 km across") repeated the picker above it and the sentence
  below, and under a two-pixel Earth it wrapped onto three lines. Just the name
  now.

---

## 3.8.16

- **Two catalog images weren't of their subject.** Deimos was a THEMIS
  thermal-analysis figure — a grey VIS thumbnail next to a false-colour
  temperature grid and a "110–200 K" scale bar — and JWST was a close-up of a
  NIRCam detector cradled in gloved hands. Both read as broken images on a
  card. Deimos is now the MRO HiRISE colour view; JWST is the segmented primary
  mirror mid-assembly at Goddard.

- **The phone's view-options popover stayed open behind the fade.** Opening it
  and then scrolling to the catalog or focusing an object left it expanded, so
  it sprang back the next time the hero returned. It folds away on either now.

---

## 3.8.15

- **Search on a phone was unusable.** The field opened at half the bar width,
  overlapping the wordmark, and the results list — clamped to ~200px — wrapped
  every entry into a two- to four-line block with the category badge floating
  in the middle of the text. On a phone the wordmark now steps aside, the field
  takes the whole bar, and each result is one truncated line with the badge
  pinned to the end.

- **The catalog held its place when you switched category.** Tapping a shorter
  category — Moons (23) to Stars (1) — let the page collapse under your scroll
  position and dumped you back onto the 3D scene, to swipe past all over again.
  Category changes now anchor the heading just under the header, and a
  one-object category is given enough height to sit there.

- **The 23rd moon was being clipped.** The catalog's `max-height` was a fixed
  4000px cap for a collapse animation that is never actually seen; the moon
  list had grown past it and `overflow: hidden` was cutting off everything
  after roughly the fifteenth. The cap is gone.

---

## 3.8.14

- **The phone's scene controls stack up the start edge now.** "Explore the
  catalog" shared the bottom row with the time control, which — once expanded —
  covered it completely; you had to collapse the clock to find the way into the
  catalog. Everything now stacks above the time control against the start edge:
  the view-options button and its two toggles, then the catalog pill, then the
  clock. All left-aligned rather than floating centred.

- **Media transport reads left-to-right in Arabic too.** Rewind, pause,
  fast-forward were reversed by the right-to-left flow, so a left-pointing
  rewind icon sat on the right of the pause button and fast-forward on the
  left. The transport is a video-player control, not a sentence — it now holds
  `direction: ltr` like the scrubber it drives, so the icons point the way they
  move. It still sits at the start edge of the control, which in Arabic is the
  right.

---

## 3.8.13

- **The README claimed version 1.5.2.** It has been at 3.x for a long time, and
  the line asserted `frontend/package.json` "tracks the same number" while the
  two had drifted more than a whole major version apart. The README no longer
  hardcodes a version — it points at the newest CHANGELOG heading, which is the
  number `package.json` actually carries. The stale "107 tests" is now 333, and
  `utils/documentHead.js` joins the file map.

---

## 3.8.12

- **The phone hero was three rows of controls deep.** Drift and scale toggles
  on one row, the clock and the catalog pill on another, the category bar under
  that — over a scene that was already letterboxed. On a phone the two toggles
  now fold behind one small button that expands them on tap; it goes gold when
  either is set to something other than its default, so a changed setting still
  shows without being open. Desktop is unchanged — it has the room to fan both
  pills off the end of the catalog pill.

---

## 3.8.11

- **The floating labels are buttons now.** They were `pointer-events: none`
  decoration — you could click the planet's dot but not its name, and in the
  compressed home view that dot is a few pixels across. Each label is a real
  button that flies to its body, so the name is a target, and a keyboard can
  tab through Mercury, Venus, Earth… and press Enter to go there — the 3D scene
  had no keyboard path into it before. `pointer-events` stays off the button so
  a drag that starts on a label still orbits the scene; the text span opts back
  in as the click target, and neither touches keyboard focus.

---

## 3.8.10

- **The category bar says how many objects each tab holds.** Thirteen tabs, and
  four of them — Stars, Comets, Historical, Asteroids — hold one or two objects,
  which you only found out by scrolling the bar and tapping. A small count now
  sits beside each label ("Moons 23", "Comets 1"), and the whole tab reads
  "Moons — 23 objects" to a screen reader.

---

## 3.8.9

- **A shared link has a preview card now.** The markup already declared
  `twitter:card = summary_large_image` but there was no image to go with it, so
  a link to the site unfurled as a bare title and a line of text. `og-image.png`
  is a 1200×630 card in the site's own idiom — the wordmark, the tagline, a
  ringed planet bleeding off the edge — wired up as `og:image` / `twitter:image`
  with width, height and alt, alongside the `og:url` that was also missing.

---

## 3.8.8

- **Every route now has its own `<title>` and a canonical link.** There is no
  server render, so index.html's one title — "P4RSEC — Explore the Solar System
  in 3D" — was what a browser tab, a bookmark and a shared link showed for the
  ISS tracker, the compare view, and every one of the seventy object pages
  alike, and no page declared a canonical URL at all, so a preview domain or a
  local mirror competed with the real site for the same content. `AppShell`
  keeps both in step with the route: "Saturn — P4RSEC", "What's up tonight —
  P4RSEC", "Moons — P4RSEC", canonicalised to the matching path. It re-composes
  in the reader's language, which is the job it took over from the i18n
  provider.

---

## 3.8.7

- **The catalog cards dropped their category badge.** Every card in the grid is
  already filtered to one category, so a "PLANETS" tag on all eight planets, a
  "MOONS" tag on all twenty-three moons, only ever repeated the tab overhead.
  The card keeps its name, type and figures; the search results, where the
  badge does disambiguate, are untouched.

---

## 3.8.6

- **Compare stopped shearing the larger body off flat.** On a narrow screen the
  bigger disc was sized to almost the full width of the card, and the card
  clips its overflow — so the glow, and at the far end the disc's own edge, met
  a hard vertical line down the side and read as a clipped planet rather than a
  big one. The stage now reserves a margin either side of the pair and the
  outer glow is capped lower, so Jupiter beside Earth and the Sun beside
  Jupiter both sit clear of the edge.

---

## 3.8.5

- **"What's up tonight" stopped repeating its one button twelve times.** Every
  row in the year-ahead list carried a "Set the clock to it" pill, which is a
  lot of button for a reference list. The row itself is the target now — a
  wider hit area and one accessible label — with a corner arrow that lifts on
  hover or focus to say so.

---

## 3.8.4

- **A `?tab=` that named no category quietly served Stars.** The default was
  written twice — `'planets'` where the tab strip reads it, and a fall-through
  to the first tab in the list where the catalog does — so a stale or
  hand-edited link like `?tab=comets` (the plural; the real id is `comet`)
  landed on the one-object Stars page instead of the eight planets. One
  `resolveTab` now answers for both: a value that names a real category passes
  through, anything else becomes Planets.

---

## 3.8.3

- **The category bar followed you onto pages that have no catalog.** The tracker,
  the compare view and "what's up tonight" all showed the thirteen-tab
  strip along the bottom — on a phone always, on desktop the moment you
  scrolled — with a tab lit up as though it meant something there. Tapping one
  threw you back to the solar system with no warning. The bar now belongs to the
  catalog and nowhere else, and the space it was reserving at the foot of those
  pages goes back to the content.

---

## 3.8.2

- **The tracker names countries in Arabic.** All 240 of them. This was the last
  English left on an Arabic page, and the only place a name reaches the screen
  from a data file rather than a string table — which is exactly why it
  survived a complete translation of everything else.

  Natural Earth's labels are shortened for a map: "Dem. Rep. Congo",
  "Bosnia and Herz.", "Antigua and Barb.". That is an English cartographic
  convention rather than a name, and Arabic has no equivalent, so these are the
  ordinary names written out — جمهورية الكونغو الديمقراطية, not an abbreviation
  of it. The stat tile has room.

  A test asserts the land table and the translation are the same set in both
  directions: a country added to the data without a name fails, and so does a
  name left behind after one is renamed upstream.

- **Israel's land points are labelled Palestine.** An editorial decision by the
  site's author, applied in `scripts/build-land-points.mjs` as a documented
  rename rather than an edit to the generated table, so it survives the next
  regeneration and reads as a decision rather than as a quirk of the upstream
  data. Natural Earth ships the two as separate features; they are now merged
  into one entry covering 29.7°–33.1°N, so the tracker reports Palestine for
  the whole territory in every language. 241 entries became 240. Neighbouring
  countries are unaffected — Beirut still answers Lebanon, Amman Jordan, Cairo
  Egypt.

  The build script gained the merge step this needed: points are now collected
  per display name rather than per feature, so two features sharing a label
  become one country rather than two entries that answer identically.

---

## 3.8.1

- **The skip link was sitting in the corner of every page.** Making it
  direction-aware, it was written as `inset-inline-start: -9999px` followed by
  `left: auto`, the second line intended as a reset of the physical rule it
  replaced. In a left-to-right page those two *are the same property*, the later
  declaration wins, and `auto` parks an absolutely positioned element at its
  static position. So the link that exists to be invisible until focused was
  visible, in English, on every page. Both rules are logical now, and a test
  reads the stylesheet for the general case — a logical inset declared
  alongside the physical property it resolves to — because jsdom does no layout
  and this class of bug cannot be caught by rendering.

- **The drift and scale toggles sat on top of the time control in Arabic.**
  They hang off the end of the centred catalog pill, away from the corner the
  time control is anchored to — but "away" was written as `left: 100%`, and the
  time control had already moved to the other side. Both are logical now, so
  the two layouts are mirror images rather than a collision.

- **The time control's collapse arrow points at the corner it collapses into.**
  Along with the back buttons and the outward-link arrows. Rewind and
  fast-forward deliberately do not turn around: they point along the timeline,
  and the timeline runs the same way in every language.

- **The annotations flanking a focused body were still in English.** They read
  `label` and `value` straight off the catalog, which `localizeObject` keeps in
  English on purpose — a section and a row have to stay identifiable by a name
  that does not move, so the translated pair sits beside them. Saturn came out
  as زُحل, عملاق غازي and 29.46 سنة, with MASS and EQUATORIAL RADIUS underneath.
  The focused view had no test at all; it has one now, and it fails on exactly
  this.

- **The telemetry ticker's hemisphere letters are words.** N and W are not
  universal; an Arabic reader gets ش and غ.

---

## 3.8.0

- **The atlas speaks Arabic.** The whole interface, and the whole catalog:
  seventy object names, thirty-six types, a hundred and seventy-five stat
  labels, seventy descriptions, and the eight hundred stat values underneath
  them. Names follow what Arabic astronomy already calls these things rather
  than transliterating the English — عطارد, الزهرة, المريخ, المشتري, زحل have
  had Arabic names for a thousand years, and Andromeda is المرأة المسلسلة.
  Bodies named in the last two centuries have no Arabic name to find and are
  transliterated, which is what Arabic-language astronomy writing does with
  them too. Catalogue designations stay in Latin: TRAPPIST-1e and NGC 5195 are
  identifiers, and rendering an identifier in Arabic script destroys the only
  thing it is for.

  The page flips to right-to-left with it. That is mostly free — flex rows
  reverse, text aligns to the start edge, the bidi algorithm handles a Latin
  designation inside an Arabic sentence — and the rest is the part that is not:

  - **Letter-spacing is switched off.** Arabic is a joined script, and tracking
    inserts gaps *between joined letters*, which does not read as airy but as
    a word coming apart. The wordmark opts back in, because P4RSEC is Latin
    whatever surrounds it.
  - **Signed numbers are isolated.** "−180 to 430 °C" draws as "180−" in a
    right-to-left paragraph: the bidi algorithm calls a minus sign neutral, so
    it resolves to the right of its digits. Every signed figure is now wrapped
    in the Unicode isolate characters that exist for this.
  - **The full-bleed scene got its second margin.** `width: 100vw` with only a
    `margin-left` is over-constrained, and CSS resolves that by discarding the
    *end* margin — the right one in English, the left one in Arabic. It worked
    in one language and slid the entire 3D view eighty pixels off the edge in
    the other.
  - **The sky panorama and the telemetry ticker stay left-to-right.** They are
    pictures of physical space, not writing; north stays where north is.

- **Counted nouns agree with their numbers.** Arabic uses five plural
  categories where English uses two: one day is يوم, two is the dual يومان,
  three to ten take the plural أيام, eleven to ninety-nine take يومًا, and
  every decimal — "87.97 days" — takes a sixth form again. None of that is
  reachable by appending an s, so every counted noun goes through
  `Intl.PluralRules`. The same machinery covers the time scrubber's "3 days
  ago" and the sky calendar's countdown.

- **Word order belongs to the language.** Anywhere a sentence carries two
  slots it is one key with two placeholders, not two fragments concatenated:
  English writes "3 days ago" and Arabic writes "قبل ٣ أيام", and a template
  that hard-codes the English order silently exports it to everywhere else.
  Dates are reordered the same way — "April 13, 2029" reads "13 أبريل 2029".

- **Compass points are spelled out rather than abbreviated.** English builds
  "NNE" from three initials; Arabic cannot, because شمال and شرق both begin
  with ش, so a letter compass would be ambiguous in exactly the situation it
  exists for — telling someone which way to turn.

- **Figures stay in Western digits.** Arabic has two digit sets in live use,
  and CLDR's default for `ar` is Arabic-Indic. This atlas sets Western anyway,
  for reasons specific to what is on the screen: the catalog's values carry
  Unicode superscripts (1.989 × 10³⁰ kg) with no Arabic-Indic equivalent, so a
  switch would set half of every mass in one digit set and half in the other,
  and Arabic-language scientific writing overwhelmingly uses Western figures.
  One line in `locales/index.js` revisits the decision.

- **Search still answers to the English name.** Someone reading the Arabic
  interface knows the planet as Jupiter about as often as المشتري — it is what
  the literature and half of school science use — so both names are scored,
  and results are ordered with the reader's own collation rather than by byte.

- **Languages load on demand.** Arabic is 27 KB gzipped of strings and catalog,
  and an English reader should not download it to be told it exists. Each
  locale is its own chunk; the main bundle dropped from 211 KB to 186 KB
  gzipped, and it stays there however many languages follow. English is the
  one exception, because it is the fallback behind every missing key.

- **Nothing is drawn until the chosen language is in hand.** The alternative is
  a page that renders in English and repaints in Arabic a moment later, right
  side to left side. English is bundled, so this costs the common case nothing.

- **No i18n library.** What was needed is key lookup, one interpolation form
  and CLDR plural categories. `Intl.PluralRules` is already in every browser
  this site requires and the rest is a hundred lines; react-i18next is forty
  kilobytes to reach the same place, on a page that spends its budget on
  textures.

  Coverage is a test rather than a promise: every key, every object name and
  description, every type, stat label, section and category is asserted
  present in each language, placeholders are checked to match across
  languages, and a sweep over all eight hundred stat values fails on any
  English prose that survived translation. That last one is what catches the
  value nobody thought about.

---

## 2.1.3

- **The tracker's follow button says what is actually happening.** Dragging or
  scrolling the globe already took the camera off the spacecraft — that is what
  it is for — but the button went on reading "Following Hubble" regardless, so
  pressing it did nothing you could see and there was no way back to following.
  It flips to "Free look" the moment you take the camera, and pressing it hands
  the camera back.

  Keyed on the camera actually moving during an interaction, not on the
  interaction starting: OrbitControls fires its `start` event on any pointer
  down, so a click on the globe that never moves would otherwise have switched
  following off by itself.

## 2.1.2

- **Orbit paths stay visible in true distances.** They were `TubeGeometry`,
  whose thickness is measured in scene units, so how heavy a ring looked
  depended entirely on where the camera was. At the six-times-further distance
  true distances asks for, a 0.28-unit tube renders about a tenth of a pixel
  wide and disappears. The Voyager tracks stayed visible through all of it
  because they were plain lines — which was the clue.

  The rings are now pixel-width lines, so one is the same weight at any zoom
  and in either layout. Three side effects, all good: scaling a ring is exact
  again, since there is no tube around the path to fatten with it; the whole
  hide-and-rebuild dance 2.0.0 needed to work around that is deleted; and a
  ring costs 512 triangles where a tube cost 4,096, which on sixteen of them is
  the sort of saving that matters on a phone.

## 2.1.1

- **Focusing a planet or the Sun no longer parks the camera on its nose.**
  Jupiter filled about three fifths of the frame at the old distance and read
  as being right on top of you; it now sits at four and a half radii rather
  than three and a half, and the Sun a little further out too. Moons and small
  bodies are untouched — their framing was tuned separately, and the flat
  offset that suits a planet pushes a tiny object much too far away.

- **Planets are clickable in true distances.** A hitbox was a fixed number of
  scene units, so how easy something was to hit depended entirely on where the
  camera happened to be. That was survivable while the camera lived at one
  distance; with true distances it sits six times further out and everything
  but the Sun and Jupiter became impossible to catch. Hitboxes now hold a
  roughly constant angular size, so a planet is the same target whichever
  layout you are in and however far you have zoomed — measured across both
  layouts, every planet now answers the pointer from 12-15px off centre, where
  before the small ones answered from nowhere at all.

- **The scale toggle names a layout on both sides.** It read "To scale" one way
  and "True distances" the other — a verb and a noun, and "To scale" was
  ambiguous about which state it was describing. It is now "Compressed
  distances" and "True distances", which reads as one setting with two values.

## 2.1.0

- **A link to what you are looking at.** The copy button in the header folds
  the scene's camera, clock and layout into the address, so a view of the
  planets as they will stand during the 2027 eclipse is something you can send
  someone. It works from every page; the tracker, the comparison and the sky
  view already carried their state in the URL and simply keep it.

  The clock goes in as an instant rather than an offset — "thirty days ahead"
  would mean something different tomorrow and a link should not drift after you
  send it — and anything malformed in an incoming link is discarded rather than
  applied, because links get truncated and hand-edited and the failure mode of
  trusting one is a camera inside the Sun.

- **Two more objects have real photographs**: Kepler-22b, using the Kepler
  mission's own artist concept of that planet, and Sputnik 1, a full-scale
  mockup photographed at the 1975 Paris Air Show — the flight article re-entered
  in 1958, so a mockup is what a photograph of Sputnik 1 can be.

  The other thirteen stay on generated art, and that turns out to be the right
  answer rather than a backlog. NASA's library was searched again for every one
  of them and mostly has nothing at all: no hits for Haumea, Makemake, Pallas,
  Tiangong, 51 Pegasi b, K2-18b, HD 209458 b, GJ 1214 b, 3122 Florence or
  1994 PC1. "Proteus" returns an experimental aircraft and "Sputnik" returns
  Pluto's Sputnik Planum. What it does have is generic concept art — a "hot
  Jupiter artist concept", a "super-Earth artist concept" — which is not used
  on purpose: those are pictures of other planets, and captioning one as
  GJ 1214 b would be the same failure as the celebrating scientists the
  original curation was written to avoid. All 57 curated URLs were re-checked
  and none are broken.

## 2.0.2

- **The tracker asked CelesTrak for elements badly enough to get blocked.**
  One request per satellite, repeated on every single page load, no cache. They
  returned 403 with a message that doubles as the specification: element files
  are only checked for updates every two hours, most orbital data updates two
  or three times a day, "please check your scripts to ensure they are operating
  properly."

  It now asks once per *group* rather than once per satellite — three
  spacecraft in two groups is two requests instead of three, and it stays two
  however many more get added to those groups. Results are cached in
  `localStorage` for six hours, so a reload does not go near the network at
  all: measured cold it makes two requests, and warm it makes none.

- **A block, or being offline, no longer empties the page.** Whatever elements
  are cached get used however old they are, and the panel already shows their
  age, so the reading is honest rather than absent. Verified while actually
  blocked: three spacecraft tracked, zero requests, "11 h old" on screen.

- A failed group request no longer falls back to asking for each satellite
  individually. That turned two rejected requests into five, which is how you
  stay blocked rather than how you recover from one. The fallback remains for
  the case it was meant for — a satellite that has moved out of its group —
  where the group reply arrived and simply did not contain it.

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
