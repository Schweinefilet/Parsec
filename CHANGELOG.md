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

## 5.10.11

**On mobile, Language moved to the bottom of the burger menu.** It was the
first row in `HeaderMenu.jsx`'s dropdown, so opening its own language list
(English / Tiếng Việt / العربية) hung it down over the rows below —
Copy a link, Track a satellite, Night sky — visually overlapping them. Nothing
sits under Language now that it's last, so its dropdown has clear room to
extend downward.

---

## 5.10.10

**Opening the language dropdown no longer drags the whole header dock around
as you hover down the list.** The header's icon row is a magnifying dock
(`FloatingDock.jsx`): every button's size tracks a shared `mouseX`, published
as a spring so nearby icons swell toward the pointer. The language picker's
dropdown hangs off its button as `position: absolute`, but it is still a DOM
descendant of that button's dock item — so hovering the language list, or
just the button underneath it, kept feeding `mouseX`, resizing that very item
and, since the row is anchored from one edge, shifting every button after it
along with the dropdown itself. Moving toward the top of the list swelled the
dock; moving toward the bottom shrank it back, dragging the open dropdown
sideways either way.

`FloatingDock` now exposes `useDockSuspend()`: while `LanguagePicker`'s
dropdown is open, it freezes `mouseX` for the whole dock, so no item's target
size moves regardless of where the pointer wanders. That alone wasn't quite
enough — `useTransform`'s derived values re-read each item's live
`getBoundingClientRect()` on every render of the item that owns them, not
only when `mouseX` changes, so a *different* icon's hover state flipping
could still nudge its own size mid-freeze and shift the row. Gating each
item's hover state on the same suspended flag stops every other icon from
re-rendering at all while one item's popover is open, so nothing has a
chance to catch up mid-freeze. Verified over CDP in headless Chrome: sweeping
the cursor across the open dropdown, and separately roaming it across the
other four dock icons, now leaves every item's `getBoundingClientRect()`
byte-for-byte identical across the whole sweep.

---

## 5.10.9

**The Compare page is pulled off the site while it gets a visual rework.**
Its route, dock icon and header-menu entry are removed from `App.jsx`,
`AppShell.jsx` and `HeaderMenu.jsx`, but `pages/ComparePage.jsx` and its
`compare.*`/`nav.compare*` i18n strings stay in place untouched — the page
still mounts fine in its own tests, there is just no longer a path to it from
the running site. Bringing it back is re-adding the route and the two links.

---

## 5.10.8

- **The scene build no longer blocks the opening, so the wordmark scrambles on
  a phone too.** Three releases have now been spent on the held scramble not
  working on a touch device — 5.10.4 built it, 5.10.5 rebuilt it as a reel when
  iOS blinked the letters, and 5.10.6 gave up and hid the wordmark until the
  scene was ready. All three were working around the same thing, which 5.10.3
  had already named and left open: roughly two and a half seconds of
  synchronous work at the top of the `SolarSystem3D` setup effect.

  The part that was missed each time is that a compositor animation only runs
  on the compositor once the main thread has *committed* it there. The loading
  screen mounts and the build begins immediately afterwards, so on a slow
  device the reel's layers never got their promoting commit before the block
  started — the animation then did not run at all until the block ended, which
  is exactly when it was no longer wanted. Partial commits across the six slots
  give some letters moving and some standing still, which is the shape of what
  was reported from a phone both times.

  So the ~30 `proceduralSurface()` calls for the moons and the small bodies are
  queued and drained one per frame from the render loop, next to the texture
  uploads that were already spread that way. This does not make the work
  shorter and is not meant to: the point is that the thread now reaches a
  commit between each piece of it. A body waiting its turn is a sphere in its
  own flat colour, which is already what it falls back to when a texture
  request fails, and it is all happening underneath the loading screen.
  `assetsSceneReady()` waits on the queue as well as on the network, so the
  screen cannot lift off a scene of flat-coloured moons.

  Measured in headless Chrome at 6× CPU throttle, a 390px viewport and a cold
  cache — the same probe that produced the 5.10.3 numbers. Before: one long
  task of **5190ms** starting at 865ms, six frames painted in the first six
  seconds, the reel mounted in one of them and sitting on a single position.
  After: the worst task is **1626ms** and the block is in pieces, thirteen
  frames are painted, the reel is mounted in eight of them and moves through
  seven distinct positions. Total blocked time is barely changed (5788ms →
  5184ms), which is the expected result and the whole argument: the work is the
  same, it is the interruptibility that was missing. Three separate loads
  screenshotted mid-build read `KF8RXZ`, `DU5Q8F` and `7T1OPL` — six slots,
  no blanks.

  With that fixed the phone has no reason to differ, so `holdOffstage`,
  `markLive`, the `revealed` state and the 420ms/140ms reveal are all gone.
  One code path everywhere, and the wordmark is on screen scrambling from the
  loading screen's first paint again.

- **And the reel no longer depends on the webfont.** Two things about it were
  measured in ems of a font that arrives over the network: the window was the
  slot's own line box, and the drum was wound by `translateY(-100%)` of its own
  height. Montserrat is fetched from Google Fonts with `display: swap`, so on a
  phone it lands *during* the scramble and changes both of them underneath an
  animation the engine has already promoted — and a percentage transform is not
  re-resolved on a composited layer. The glyphs go on being wound by the old
  height and land half out of the window, which is not a scramble, it is a row
  of letters with holes in it.

  The row height is now `calc(1em * 1.5)` — derived from the font *size*, which
  is a fixed 17px, and from nothing else — and the wind is six of those rows
  rather than a percentage. The cipher glyphs are set in the system stack as
  well, since there is nothing to gain by waiting on a webfont to draw six
  characters that are about to be thrown away. The slot's hidden spacer keeps
  Montserrat and goes on carrying the width, so the mark's measured box is
  untouched and the flight still lands pixel-identical on the header's own
  wordmark. The window is centred on the slot's line box rather than filling
  it, which also stops Arabic's taller line-height dragging the row height
  around.

  `will-change: transform` comes off the drums. It is a standing request for a
  layer and there are twelve of them on screen at once, over a live WebGL
  canvas mid-upload, next to the orrery's own layers; iOS demotes past its cap
  silently, and a demoted `steps()` reel freezes mid-step — a glyph half out of
  the window rather than the letter standing still the design allows for. The
  animation promotes the element on its own for as long as it is running.

  `cipherFrames` and `cipherText` get the unit tests they never had: six glyphs
  a slot, never the letter the slot will become, no repeat back to back or
  across the loop's seam, and a decode that settles left to right and never
  comes loose again.

---

## 5.10.7

- **The site no longer honours the OS "reduce motion" setting.** A Windows PC
  with animation effects switched off reports `prefers-reduced-motion: reduce`
  to Chrome, and the site obeyed it: the opening flight was skipped, the
  starfield froze, the dock stopped swelling, panels stopped sliding, numbers
  stopped rolling and the wordmark never scrambled. That made the site look
  broken on a machine where the setting had been flipped for unrelated
  reasons, so it is now ignored everywhere.

  `useReducedMotion()` returns `false` unconditionally (the call sites are
  untouched, so every reduced branch is simply dead), `StarfieldBg` no longer
  reads the media query, and the three CSS blocks that keyed off it are gone:
  the boot-orrery still, the global duration collapse in `index.css`, and the
  boot-dot rule in `index.html`.

  This is a deliberate accessibility trade-off. Anyone who genuinely needs
  reduced motion no longer gets it from the OS.

---

## 5.10.6

- **On a phone the wordmark now waits offstage.** The held scramble is CSS so
  that it can run while the main thread cannot, and on a desktop it does. On a
  phone it has now been reported wrong twice — first as letters blinking rather
  than cycling, then, after the reel replaced the stack of layers, as still not
  right. Whatever an engine is doing with a dozen little animations at the
  exact moment it is also compiling shaders and uploading thirty textures, the
  answer is not to keep guessing at it from a laptop.

  So on a touch device nothing of the wordmark is drawn while the scene is
  being built: the orrery turns, the bar fills, the middle of the screen is
  empty. When the scene reports ready the mark fades in over 420ms, stands
  there as ciphertext for a further 140, and only then decodes. There is
  nothing to get wrong in an empty middle, and every frame of the decode —
  which is the part anybody actually came for — now happens on a thread that
  has finished building the scene and against a wordmark that is already fully
  on screen. The fade and the decode are deliberately not overlapped: the whole
  of the decode should play at full strength, not the last 85% of it.

  Desktop is untouched and keeps scrambling from the loading screen's first
  paint. The split is `(pointer: coarse)` rather than a width — a phone or a
  tablet is what this is about, and a half-width browser window on a desktop is
  not. A touchscreen laptop with a mouse reports `fine` and gets the desktop
  behaviour, correctly.

  The reel is not rendered at all while the mark is offstage. A dozen
  compositor animations nobody can see, running through the busiest two seconds
  of the load, is exactly the kind of thing this release is trying to stop
  doing.

---

## 5.10.5

- **The held scramble is a reel now, because the stack of glyphs did not work
  on iOS.** Reported from a phone: the wordmark did not scramble, it flashed.
  Each letter sat on one glyph and blinked on and off — `EZD6F4` coming and
  going as `EZ 6 4`, `ZD6F`, `EZD F4` — so the opening read as a word with
  holes in it rather than as ciphertext.

  The mechanism it had was six glyphs stacked in each character's slot, each
  taking the slot for a sixth of the cycle by way of its own `animation-delay`.
  That is six animations per letter that have to agree with each other about
  whose turn it is, and seventy-two of them across the two stacked copies of
  the mark. Whatever WebKit did with them — dropped the delays, accelerated
  some and left the rest to a main thread that was blocked, gave up on the
  count — the visible result is the same shape of failure, and it is a shape
  the design allows: if the layers disagree, the slot can show nothing.

  So there is nothing left to disagree. Each slot's candidates are stacked into
  a column and wound past a window one glyph tall, slot-machine fashion: one
  transform animation per letter, twelve in total, `steps(6)` through exactly
  the drum's own height so each glyph lands squarely in the window. Which glyph
  is showing is now a property of what the window is clipping rather than of
  several animations agreeing, so a blank is not a state this can be in. The
  worst an engine that declines to run the animation can produce is a letter
  standing still, which is what 5.10.3 looked like.

  The window is the slot's own line box, top and bottom, so the row inside it
  shares the settled glyph's baseline at whatever line-height the page is set
  in — Arabic sets taller. It overhangs the slot by half an em at each end,
  because the slot is only as wide as the letter it will become and a window
  clipped to that would shave the wider cipher glyphs. Measured against the
  header's own wordmark: slot 14.92 × 25.5, reel 31.92 × 25.5 at the slot's
  top, drum 153 tall for six rows of 25.5, the glyph's 20px content area
  sitting inside the 25.5 row with 2.75 to spare at each end.

  One thing caught on the way, in Chrome, before any of this reached a phone:
  a `<span>` is an inline box, a transform does nothing to one, and an inline
  box wrapping block children has no height to be wound through either. The
  drum is `display: block`. And the animation is set as longhands rather than
  the shorthand — a shorthand carrying a `var()` is parsed at computed-value
  time and takes the whole declaration with it if any part of the substitution
  does not fit, where the longhands degrade one at a time: a missing `--cycle`
  leaves the reel turning at 400ms and a missing `--phase` leaves the letters
  starting together, and both of those are still a scramble.

---

## 5.10.4

- **The wordmark scrambles from the first frame now, in CSS.** 5.10.3 held the
  decode back until the scene was ready, which fixed the decode and left the
  ciphertext standing perfectly still for the several seconds before it — one
  frozen scramble, which reads less like an encrypted word than like a page
  that has stopped. It should be glitching the whole time and resolving at the
  end, and that is what it does.

  The scramble could not be moved to the same timer the decode uses, for the
  reason the decode was held in the first place: the stretch it covers is the
  stretch where the main thread is blocked solid building the scene, and
  nothing driven from JavaScript paints during it. So it is not driven from
  JavaScript. `cipherFrames()` picks a fixed set of six candidate glyphs per
  character up front, `EncryptedText` stacks all six in the character's slot,
  and a CSS `cipherFlick` animation gives each one the slot for a sixth of the
  cycle in turn. Opacity animations run on the compositor, so they keep going
  through a blocked main thread — which is exactly why the orrery on the same
  screen has never stuttered. Verified frame by frame off a CDP screencast at
  6× CPU throttle: 610ms, 676ms and 1816ms into the load, deep inside two long
  tasks of 1.4s and 1.0s, the wordmark reads `ZG1H8R`, `QC69YT` and `XG1OOH`.

  Each slot gets its own cycle length, 340–520ms, so the six drift out of phase
  within the first turn and the word never visibly loops even though each
  letter does. No slot may show the letter it is going to become: a slot that
  flashes its own answer mid-scramble reads as a letter that landed and then
  came loose. The per-glyph rate works out at 57–87ms against the decode's
  55ms, close enough that the handover from CSS to the cipher — at the moment
  the scene reports ready — is not visible as a change of pace.

  The hook's held state is `shown: null` rather than a frozen string, which is
  what tells `EncryptedText` to draw the stack instead of a single glyph. Six
  characters times six layers times the two stacked copies of the flying mark
  is seventy-two spans of one character each; the screencast holds 60fps
  throughout. Reduced motion never reaches any of it — the hook still returns
  the settled string from the first frame there.

---

## 5.10.3

- **The opening decode waits for the scene now.** 5.10.0 moved the ciphertext
  to the loading screen's first paint, which is the right place for it to
  *appear* and the wrong place for it to *run*. The decode is a real-time
  animation driven from a `setInterval` on the main thread, and the stretch it
  was running in is the one stretch of the session where that thread cannot
  deliver a frame: building the scene blocks it solid. Profiled in headless
  Chrome at 6× CPU throttle, a phone-sized viewport and a cold cache, the first
  two seconds of the load are two long tasks of 1.4s and 1.0s back to back —
  roughly a second of `proceduralSurface` painting thirty moons and small
  bodies, then a second of `texSubImage2D` pushing them to the GPU. A decode
  measured against the clock does not slow down inside a gap like that, it is
  skipped: it ran to three painted frames out of forty-seven, the middle one
  1.9 seconds after the one before it. On a real phone it is not seen at all.

  So the decode is held. The ciphertext still stands there from the first
  paint — full length, going nowhere — and starts resolving when `assets.done`
  says the last texture has landed and the scene has drawn with it, which is
  also the moment the main thread comes free. The handoff already waited for
  the decode to settle, so the ending now reads in order: the scene reports
  ready, the word comes good, the wordmark flies to the header. Same probe, and
  the decode draws thirty-seven frames across its full length with nothing
  dropped.

  It can be brisk again as well. `DECODE_MS` had been stretched to 2600 purely
  to try to outlast the build; at 1800 it settles before the three-second
  minimum on any warm load, so the screen is on for exactly as long as it was.

- **And the opening no longer shows two wordmarks.** The flying mark is two
  stacked copies — white underneath, gold over the top, cross-fading on opacity
  because colour cannot be composited — and the gold one is positioned with
  `inset: 0` against whatever box its parent has. 5.10.2 gave that parent, for
  as long as the header's own box has not been measured yet, a full-width flex
  row. So the white copy was centred as a flex item and the gold copy was
  stretched across the whole viewport and then scaled by 1.9 about its centre,
  which put its lettering off the left-hand edge of the screen. Two wordmarks,
  one centred and one adrift, until `home` landed and collapsed the box back
  onto the mark — and on a phone `home` lands behind that same two-second
  block, so that was the whole of the opening.

  The fallback shrinks to fit the mark now, exactly as the header-box layout
  does: pinned to the centre of the viewport and pulled back by half its own
  size. Both layouts put the mark's centre in the same place to the pixel, so
  the swap stays invisible and there is only ever one wordmark. The hero
  transform is measured off `documentElement.clientWidth/Height` rather than
  `window.innerWidth/Height` while we are here — a fixed element is laid out
  against the layout viewport, and `innerHeight` is the *visual* one, shorter
  than the layout viewport by however much of a phone's URL bar is showing.

- **The ciphertext keeps to the wordmark's own letter positions.** The overlay
  was one string drawn from the box's leading edge over the settled text. Its
  glyphs are not the widths of the letters they stand in for, so the run was a
  few pixels wider or narrower than the wordmark and hung off one side, then
  crept back as letters landed — the text visibly sliding into place rather
  than decoding in it. Each character now gets its own slot, held open by the
  glyph it will become, with whatever the cipher currently says drawn over that
  slot from its centre. Nothing moves for the whole decode, and the line stays
  on the centre it started on.

- **The telescope holds its place while the wordmark is encrypted.** It is
  drawn at 0.32 from the first frame and resolves the rest of the way with the
  tail of the decode, instead of not being drawn at all until then. The mark is
  centred as a whole — icon, gap and lettering — so an icon rendered at zero
  leaves its space empty and puts the lettering half an icon's width to the
  right of the progress bar and the orrery it shares a centre line with. That
  was tolerable when it lasted the back half of a decode. It is not when it
  lasts the entire load.

  Still outstanding, and the reason all of this was needed: the ~2.4s of
  synchronous procedural painting and texture upload at the top of the
  `SolarSystem3D` setup effect. Nothing on screen depends on the main thread
  during it — the orrery is a CSS transform animation and runs on the
  compositor throughout — but the page is frozen, and the fix is to drain that
  work off the critical path rather than to keep working around it.

---

## 5.10.2

- **The flight home is slower.** Backing out of a focused object to the wide
  view took 1.6 seconds, which read as a snap rather than as a movement. It is
  now 2.8. The motion itself is unchanged — one cubic ease-in-out carrying the
  pull-back and the recentring on the Sun together — it simply has time to be
  watched. The fly-in stays where it was, 1.2 seconds ordinarily and 2.4 at
  true sizes: going somewhere should feel eager and coming back should not.

- **Halley is framed by its tails now, not by its nucleus.** Two separate
  faults, both of which put the camera somewhere useless.

  The first was the distance. Every focus distance in the scene is scaled by
  how much the body itself shrank when true sizes came on, which is right for
  a planet and catastrophic here: Halley's coma and tails are built at the
  scene's drawn scale and true sizes never touches them, so only the nucleus
  moved — from 0.11 units to about three millionths of one. The framing
  followed it down and landed the camera four ten-thousandths of a unit out,
  inside a seventeen-unit ion tail, looking at a speck. `framingScaleFactor`
  is the fix: for this one body the camera's numbers — the distance flown to,
  the floor under it, the near plane, how close a reader may zoom — stay on
  the drawn radius at every stage. The nucleus still shrinks honestly, which
  is the point of stage 2. It is just no longer what decides where you stand.

  The second was the angle. At true distances and true sizes a focused body is
  framed with the Sun in shot, over the shoulder and off to one side, which is
  the right instinct for a rock at the far end of an empty orbit. For a comet
  it is exactly wrong: the tails stream anti-sunward, so that framing put the
  camera on the tail's own axis and seventeen units of ion tail came at the
  lens end-on, reading as a smear across the corner of the frame. Halley is
  framed broadside instead, off to the side of the Sun-comet line, tipped 15°
  out of that plane so the dust tail's curve reads as a curve. The tails then
  lie across the screen's horizontal — the axis with the most room on any
  landscape window — at their full length, with the nucleus at one end. Giving
  up the Sun in shot is worth it: this is the one view that says "comet".

  The distance went from 14 to 34 to go with it. The camera looks at the
  nucleus, so the tail has to fit in *half* the frame; at a 45° vertical field
  the horizontal half-extent is about 0.66 of the distance, which puts the far
  tip inside the right-hand edge with a little room left over.

- **The opening no longer flashes its logo before decoding.** The telescope
  appeared at full strength for a single frame, then vanished and eased in
  again properly behind the last of the ciphertext. The decode was gated on
  `home` — the header's measured box, which is what the flying wordmark is
  laid out on — and the hook's resting state is *settled*, so the first frame
  after that measurement landed rendered a finished mark and the effect that
  resets it to ciphertext only ran after that frame had painted.

  Removing the gate fixes it, and fixes something larger at the same time.
  Measuring `home` needs a commit, and on a cold load the main thread is busy
  enough building the scene that the one it needed landed nearly three seconds
  in — the whole decode sat behind that, so the ciphertext appeared late and
  was over almost as soon as it arrived. Measured in headless Chrome with the
  cache disabled: the wordmark's first frame moved from 5166ms to 1478ms, and
  it is ciphertext with the logo at zero rather than the finished mark.

  What made the gate necessary was that the mark was not rendered at all until
  `home` existed. It now falls back to a centred row that puts it in exactly
  the place the header-box transform puts it, so the swap when `home` arrives
  is invisible and the decode is on screen from the loading screen's first
  paint. A load that somehow never measures a box now ends with the mark
  fading out on the spot rather than with no mark ever having appeared.

  The decode also runs for 2600ms rather than 1200. It is measured against the
  clock rather than counted in frames, and this screen is on during the one
  stretch of the session where the main thread is least able to deliver a
  frame. A short decode spends most of itself inside one of those gaps and
  what finally paints is the tail of it. At 2600 it is still running when the
  thread comes back up, so the wordmark is seen to decode rather than seen to
  have decoded.

---

## 5.10.1

- **No more halo on the compared bodies.** Each disc on `/compare` carried an
  outer glow in its category's accent colour — by request, gone: a coloured
  halo around a photograph of a planet reads as decoration, and the two discs
  on that page are a measurement.

  Only the outer shadow goes. The `inset` half of the same `box-shadow` is a
  terminator, and it is what makes a flat crop of a photograph read as a body
  lit from one side rather than as a circle of texture, so it stays.

  The small-disc branch was *entirely* glow — a hard 6px bloom that existed to
  keep something like Ceres beside Jupiter findable at two pixels. Removing it
  loses nothing, because the disc under 6px already carries an offset outline
  that marks it without lighting it up; checked against Jupiter/Ceres, where
  Ceres comes out at 2px and still reads. The margin reserved either side of
  the pair stays as it was: it was protecting the halo *and* the disc's own
  edge from the card's `overflow: hidden`, and the edge is reason enough.

---

## 5.10.0

- **The opening decodes itself.** The loading screen's wordmark now arrives as
  ciphertext and resolves into P4RSEC a letter at a time, after Aceternity UI's
  EncryptedText; the orrery has lost its drawn orbits and runs a fifth faster.

  The cipher and the markup are separate — `hooks/useEncryptedText.js` and
  `components/EncryptedText.jsx` — because the flying wordmark is two stacked
  copies, a gold one over a white one, cross-fading on opacity across the
  flight. Two components each running their own scramble would land different
  letters on the same frame and the cross-fade would show it, so one hook runs
  the decode and both copies draw the same frame of it. It is at full length
  from the first frame rather than typing itself on, which is both the effect
  asked for and what stops the wordmark growing across the screen while the
  scene behind it is loading.

  The settled string stays in flow, invisible, holding the box open while the
  ciphertext is laid over it from the same leading edge. So a letter that has
  decoded cannot shift again, only the undecoded tail moves, and the last frame
  of the decode occupies exactly the space the plain text that replaces it
  will — which the flight depends on, since it ends by clearing a transform and
  expecting to be pixel-identical to the header's own mark. The cipher alphabet
  drops I, J, M and W for the same reason: at the wordmark's tracking, glyphs
  that wide or narrow make the tail visibly breathe.

  The logo resolves with the last 45% of the wordmark rather than being there
  from the start, on opacity and scale alone. A blur would say "diffuse" more
  literally and is a paint property; every frame of it would land on the main
  thread at the one moment it is busiest building the scene.

  Two things the first cut got wrong, both found by measuring rather than
  looking. The decode was starting on mount, but the mark is laid out on the
  header's measured box and is not rendered until that measurement lands — which
  on a cold load is a second or two in, behind the scene build — so what
  actually appeared on screen was the last third of a decode that had run
  invisibly. It now starts when the mark does. And the handoff was not waiting
  for it: `MIN_ON_SCREEN_MS` is counted from the navigation, so a fast set of
  assets called the flight while letters were still turning over. It now waits
  for the decode, except on the failsafe path, which stays unconditional because
  it exists for the case where nothing else will fire.

  The orbits: `.boot-ring` keeps its box, which is what carries the bodies round
  and what `--boot-drop` measures the readout against, and loses only the line
  it painted. index.html's pre-React figure was that same ring, drawn so the
  first paint has no seam with what React mounts — with the orbits gone it would
  have become the one thing on the screen that vanished on mount instead of
  being joined, so it is now a pulsing point at the centre the wordmark decodes
  on top of. Periods are the old set times 0.8, with every negative delay
  re-solved from `delay = 2 - dur × (angle / 360 + n)`: they are what hold the
  four bodies one per quadrant at t = 2s, and a duration changed without them
  collapses the figure back into a spoke.

---

## 5.9.16

- **The month rolls too, the figures take longer, and a tucked card goes
  properly back.** Three follow-ups to 5.9.15, all by request.

  The pill's month name now rolls like the digits beside it. The rolling column
  was only ever a stack of ten glyphs by accident of what it was built for — it
  is now a stack of *n* items, which the digits use with ten and the month uses
  with twelve, taking the short way round so December → January rolls forward by
  one rather than back through the year. Its width comes from the name currently
  showing rather than the longest of the twelve, so an Arabic date does not
  reserve the width of سبتمبر while displaying مايو.

  Finding the month in an already-formatted date needs no parsing: the twelve
  names are generated with the same `Intl` options `date()` used, so they are the
  exact strings in the text. A locale whose month names carry digits opts out —
  Vietnamese's are "Tháng 9", "Tháng 10", where the part that changes is already
  a digit and already rolls, and swallowing it into a word would take that away
  and swing the column's width about besides.

  A focused body's figures now wind up over 1.6s instead of 0.9s, which leaves
  the higher columns legible on the way rather than a blur.

  The phone's card stack recedes much further: 0.12 per level where the whole
  effect used to be 0.06, since a card covered by the next one was reading as
  cropped rather than as tucked behind. Depth also accumulates now — a card with
  two cards over it sits a step further back than one with a single card over it,
  capped at two levels so nothing shrinks away to nothing. That part only shows
  on the longer spacecraft sheets: a planet's three-card sheet has one card
  opted out of pinning, which leaves exactly one that can recede, so the first
  level has to carry the effect on its own. Still transform-only and still
  top-anchored, which is what keeps `useCardStack`'s own measurements readable.

---

## 5.9.15

- **The dock gets its own bar, and numbers roll.** Two things, both of them
  motion work in the header and the scene.

  The dock from 5.9.14 now looks like the thing it was modelled on, which
  supersedes that entry's description of it. The six controls are bare round
  icons sitting on one rounded bar — the scrim, the hairline and the blur that
  each button used to carry individually now belong to the bar, which is also
  what keeps the blur un-nested over the live canvas. A button draws its own
  fill only when it is *on*: the page you are looking at (the three route links
  read `pathname`), a panel you have opened, a link you just copied. An icon
  magnifies to 58px and grows out of the bar evenly top and bottom, which is a
  real width/height on the box rather than a `scale()` — a transform took the
  whole subtree with it and ballooned the language dropdown along with the
  button that opened it.

  Its label hangs off the bar's leading edge rather than above or below the
  hovered icon. Above is off-screen in a 56px header, and below is taken:
  `.scene-note`, the "everything to scale" footnote, is deliberately parked in
  that exact corner on desktop, and a label under the icons covered it outright.

  `components/SlidingNumber.jsx` is new and exports two readouts, after
  motion-primitives' component of that name. The timeline pill takes
  `<SlidingNumber>`, where each digit springs to its new value by the shortest
  route. A focused body's three figures take `<CountUpNumber>`, where every
  number winds up from zero in one 0.9s sweep. Neither takes a number — they
  take the already-formatted string and animate only the digits in it, so a
  superscript exponent holds still while its mantissa counts, and the caller
  keeps its `Intl` formatting.

  Three things had to be got right that are invisible in English. Digits are
  matched by asking `Intl.NumberFormat` for the locale's own ten, not by testing
  `[0-9]`, or the Arabic pill would have sat unanimated. Every number is wrapped
  in a left-to-right isolate, because splitting digits into inline-blocks turns
  each one into a neutral the paragraph reorders — Arabic first rendered ١٩
  سبتمبر ٢٠٢٦ as "٩١ سبتمبر ٦٢٠٢", and once that was isolated per run, "١.٨٩٨"
  still came out "٨٩٨.١" until a number's own decimal and thousands marks were
  folded into the run with it. And a counting column chases `floor(v / place)`
  rather than `v / place`: a geared odometer reads 898 with its hundreds wheel
  98% of the way to a 9, which on screen is just an unreadable number, and did
  in fact render Jupiter's mass as "1.9₀8 × 10²⁷ kg".

  The rolling column holds all ten glyphs at once, so it is `aria-hidden` behind
  a visually hidden copy of the real string — which is also what keeps these
  values findable by text. Reduced motion gets the plain string from both, since
  index.css zeroing CSS durations does not reach a spring. The pill's fixed
  width from 5.9.13 is unaffected; it was measured through a full minute of
  ticks and never moved.

---

## 5.9.14

- **The header's buttons are a dock.** On desktop the row of controls in the top
  right — language, copy link, tracker, night sky, compare, search — now swells
  toward the pointer, macOS-dock style: the nearest button grows to about 1.25×
  and its neighbours ease up with it, falling off to nothing 90px out. It is
  Aceternity UI's FloatingDock reshaped for this header. Theirs takes a list of
  `{ title, icon, href }` and renders every entry as a link, which these are not
  (a dropdown, a clipboard button, three router links, a toggle), so
  `components/FloatingDock.jsx` takes the buttons as children and wraps each in
  a DockItem. The buttons keep their own markup, handlers and state; the dock
  only decides how big they are. The magnification is the wrapper's width plus a
  scale on its content, so neighbours are pushed apart instead of overlapped and
  the header's fixed 56px height never moves.
  Pointer only — a touch has no "near" — and `prefers-reduced-motion` gets the
  plain row, since a spring is JS and `index.css` zeroing CSS durations does not
  reach it. The dock has no backdrop-filter of its own: each button already
  carries one, and stacking a filter inside a filter over the live canvas is the
  trap 5.9.10 backed out of. On a phone nothing changes; the burger menu stays.
  Adds `motion` (the framer-motion successor) as a dependency, for the springs.

---

## 5.9.13

- **The timeline pill keeps one width.** Its readout column was a `minWidth`, so
  it grew whenever the date, the clock or the "rate · offset" line got longer —
  a longer month name, or Arabic-Indic numerals, which run wider than Latin
  digits — and the whole pill resized as you scrubbed. The column is now a fixed
  width (150px, 96px on a phone) that cannot shrink, with the date and clock
  spread across it and the offset line clipped with an ellipsis if a locale runs
  long. The collapsed pill's date gets the same treatment: a fixed, centred
  minimum width with tabular numerals.

---

## 5.9.12

- **Two `/sky` chrome bugs on phones, and a disclaimer for the mode that
  causes them.** The "what am I looking at" constellation readout sat fixed
  at `top:16px`, dead-centre — on a narrow viewport that ran it straight
  into the header's wordmark and version number, since `/sky` never
  scrolls and so never gets the opaque scrim that header otherwise picks up
  past `scrollY 40`. It now sits at `top:68px`, clear of the header, in
  line with the page's own back button and AR toggle.

  That AR toggle had its own overlap: fixed 68px in from the same edge as
  the back button, on the same row, it happily sat on top of "Go back"'s
  own text — even in English, let alone a longer translation — since
  nothing reserved it that space. It now stacks below the back button
  instead of beside it, so it never has to guess how wide that text is.

  The compass dial's lubber line (`.sky-compass-needle`) drops the thin
  stem it grew reaching toward the centre; the triangle sitting on the rim
  reads the heading marker on its own.

  And since AR mode's rough edges are the reason two of the above existed
  in the first place: the permission card now says so — an amber line
  underneath the usual camera/compass explainer, warning that the feature
  is early and can drift or misalign labels.

---

## 5.9.11

- **Confirmed fixed on the phone that had it, and the diagnostic comes back
  out.** `components/TrackerDebug.jsx`, `utils/debugFlag.js`, the `?debug=1`
  flag and the renderer's telemetry hook are all gone; everything they were
  holding up stays.

  5.9.10 shipped two changes at once and the confirmation cannot tell them
  apart, so both stay: the card keeps `.glass` for the whole arrival with the
  lifted look as a `[data-lifted]` state, and its render object is dropped and
  rebuilt when the arrival ends. The first is the one with a mechanism behind
  it — a backdrop-filter arriving on an ancestor of a live WebGL canvas, which
  is what makes WebKit composite that child against geometry it no longer has
  — and the second is a reload in miniature, which was the only thing curing
  it before. Neither costs anything on a page that is already changing every
  property it touches.

  Also kept, from the releases that missed: the arrival's 3.5s outside edge,
  so it can never outlive the page it arrives on; `fit()` taking the renderer's
  size off the context rather than trusting the number it asked for, with the
  viewport forced through three's cache; the stale-canvas clear; and the frame
  loop's own size check. None of them were this fault, all of them are
  failures the tracker's arrival could otherwise still have.

  Worth keeping in mind next time: the fault was invisible to headless Chrome
  because it is WebKit-only and because that phone's `vh` and `innerHeight`
  differ by the height of its URL bar (736 against 695 — a slot of 412px gave
  it away). Three releases went out on theories reasoned from a screenshot and
  all three were wrong. The readout found it on its second screenshot.

---

## 5.9.10

- **`.glass` — and the backdrop-filter it carries — was being added to the
  globe's card at the exact moment the arrival ended, on an element already
  holding a live WebGL canvas.** The second readout closed off everything
  inside the renderer: `dbuf 526x615`, `glvp 0,0 526x615` (the GPU drawing
  into the whole buffer), `cam a0.86 d7.78 t0.00` (right aspect, right
  distance, aimed at Earth's centre), `frames` climbing. Correct canvas,
  correct GL state, camera on the origin — and the globe still drawn into the
  bottom of the frame. Nothing inside the canvas explains that, which leaves
  how the canvas is *composited*.

  The card's class was `arriving ? undefined : 'glass'`, so the whole of
  `.glass` — background, border, shadow, and a `backdrop-filter: blur(22px)`
  — landed on the card in the same commit that put it back in the column.
  Adding a backdrop-filter to an ancestor of a composited canvas is a known
  way to lose that child's layer geometry in WebKit: the canvas keeps
  compositing against the rectangle it had while the card was full-bleed, so
  every measurement reads correct and the picture is drawn somewhere else. A
  direct load never hit it because the card carries the filter from its first
  paint, and a reload cures it because the layer tree is built again — which
  is the shape of the report exactly, in both browsers on that phone, since
  both are WebKit.

  The card now keeps `.glass` for the whole arrival and the lifted look is a
  `[data-lifted]` state on it, so the class, the filter and the radius never
  change; only the paint does. Belt to those braces, the card's render object
  is dropped and rebuilt when the arrival ends — the cheap version of the
  reload that was curing it.

  The readout gains what would separate this from the other possibility if it
  is still wrong: `elementFromPoint` down the card (is something painting over
  the globe, or is the globe's own layer drawn wrong), the scissor box, and
  the renderer's own idea of its size, fov and view offset.

---

## 5.9.9

- **The tracker's empty band is inside the canvas, not around it — the globe
  was drawing into a corner of a correctly sized canvas.** The readout shipped
  in 5.9.8 came back from the phone and settled it in one line. Everything the
  last three releases went after is right: `phase idle`, `card 20,237 353x412
  absolute` sitting exactly on `slot 20,237 353x412`, `mount 351x410`, one
  canvas at `351x410`, no clip. The arrival ends properly, the card lands where
  it belongs, the canvas fills it. The picture *in* the canvas occupies its
  lower half.

  That is a viewport fault, and the same readout shows why this end could never
  see it: `win 393x695` against a slot of 412px, which is 56% of **736** — the
  page's `vh` and the window's own height differ by 41px on that phone, the
  height of its URL bar. Headless Chrome doesn't split those two numbers, so
  the arrival is measured and drawn against one consistent viewport here and
  two different ones there.

  `fit()` now takes the size back off the context instead of trusting the one
  it asked for. Two things go wrong otherwise and both draw the scene into a
  corner: a browser can hand back a smaller drawing buffer than the canvas it
  is attached to, leaving three's viewport describing a rectangle the buffer
  does not have; and three only issues `gl.viewport()` when the value differs
  from the one it remembers issuing — a record that survives the buffer
  underneath it being swapped, so the GPU can be left on the previous frame's
  rectangle while three is satisfied that it isn't. The viewport is now set
  from `drawingBufferWidth/Height`, set to something else and straight back so
  the call actually reaches the GPU, and the camera's aspect comes from the
  same two numbers. A buffer that changes without the element changing — which
  nothing announces — is caught by the same check the frame loop already runs.

  The readout grew the three lines that would have found this on day one:
  the context's buffer size, the rectangle the GPU is actually drawing into,
  and the camera's aspect, distance and target, with a frame counter to say
  whether the loop is running at all. `?debug=1` still turns it on, and it
  still comes out once this is confirmed fixed.

---

## 5.9.8

- **An arrival at the tracker can no longer outlive the page it arrives on,
  and there is now a way to see what the phone is actually measuring.** Three
  releases have gone at the tracker's empty-band-above-the-globe fault from one
  screenshot, and it is still there on the reporter's phone — in both Chrome
  and Safari, on every arrival from the solar system, and never on a direct
  load. Headless Chrome at the same viewport lands the card correctly every
  time, which means the fault is in numbers this end cannot see. Guessing at
  them has had its three turns.

  What is a real fix, whatever the cause: the arrival now has an outside edge
  measured from the tracker page's own mount rather than from any phase inside
  the sequence. The sequence's worst case is about 2.4s — a hand-off that waits
  out the globe-ready timeout, then a full settle — so anything still lifted at
  3.5s is not an animation but a page stuck with its globe out of the column
  and a hole where the card belongs. Every timer inside the sequence is one
  this cannot rely on; this one is held by the component with something to
  lose. Verified by dropping the settle's own timer and watching the cap
  recover the page.

  Also: `SatelliteGlobe` now clears any canvas left in its mount before adding
  its own. A dead canvas from a previous run of the effect, stacked above the
  live one, pushes the globe down its card behind a band of nothing, looks
  exactly like a sizing fault, and survives everything but a reload — which
  fits the report precisely enough to be worth closing off.

  And the diagnostic: `?debug=1` on any page turns on a readout over the
  tracker (`components/TrackerDebug.jsx`, `utils/debugFlag.js`) printing the
  phase, the viewport as the browser reports it, the slot's rect, the card's
  rect and position, the mount's box, and every canvas in the card with its
  drawing buffer. Remembered for the tab, since the page that needs it is one
  the hand-off navigates to rather than one anybody types. **Temporary — both
  files and the flag come out once the fault is found.**

  Ruled out along the way, each by reproducing the state and comparing it to
  the report: a settle stuck mid-phase (letterboxes the globe left and right,
  not top), and a stale canvas the `ResizeObserver` never corrected (fixed in
  5.9.7 and confirmed live in the deployed bundle, symptom unchanged).

---

## 5.9.7

- **The globe kept the size of the whole screen after flying into the
  Satellite Tracker, so it drew a full-bleed frame inside a card a third that
  height: a band of empty black with the planet sitting low and cropped under
  it, which nothing but a reload put right.** 5.9.6 went after the settle's
  clip-path on the strength of the same screenshot and did not touch this. The
  reporter's own reading — "the container is the wrong size, and reloading is
  what makes it resize" — was the right one, one level down: the card was
  always the right size, the canvas inside it was not.

  The arrival lifts the card out of the column to `position: fixed`, full
  bleed, and the globe sizes itself to the box it is in — so during the
  arrival that box is the viewport. When the settle ends and the card goes
  back into the column, the box shrinks to the card, and `SatelliteGlobe`
  heard about that exclusively through a `ResizeObserver`. Where that notice
  doesn't arrive, nothing else ever measured again: not switching satellites,
  not the live fixes coming in every second, nothing except a reload, which
  builds a new renderer at the card's size. It is the one size change in the
  app that no window resize and no user action stands behind, and it is the
  only one that was left to a single notice.

  Reproduced by stubbing `ResizeObserver` to a no-op before the app loads and
  flying in from the ISS card: the canvas comes to rest at 390x844 inside a
  350x473 card, which is the reported picture exactly. With the fix, under the
  same stub, it comes to rest at 348x471.

  The fix is one `fit()` that reads the element and sizes the renderer, the
  canvas's box and the camera's aspect from that single measurement, called
  from three places instead of one: the `ResizeObserver`, the tracker phase
  itself (over the beat the card's transition takes), and once every 30 frames
  of the loop that was already running. Two layout reads a second, at the top
  of a frame about to render anyway, is nothing beside a page that can only be
  fixed by reloading it.

---

## 5.9.6

- **A card being covered in the phone's detail sheet now shrinks as it goes,
  so it reads as tucked underneath the next one rather than cropped by it.**
  5.9.5 put the outgoing card behind its neighbour but left it full size, and
  two cards at the same size with one ending in a straight edge still looks
  like a cut. Each pinned card is now scaled down by however much of it the
  next card has covered — 1 to 0.94 over the first 120px of coverage, anchored
  at its own top edge, so the strip of it still showing narrows as it sinks.

  `hooks/useCardStack.js`, outside React the way anything that moves with the
  scroll has to be: the transform is written to the node inside a rAF off a
  passive scroll listener, with a ResizeObserver on the column for the changes
  that move cards without the sheet having been scrolled (switching the stats
  panel's tab is the common one). It is off under `prefers-reduced-motion` —
  the cards still stack, they just stop receding.

  Two measurement notes, both load-bearing. `transform-origin: top center` is
  what makes the card's own `rect.top` safe to read back while it is scaled;
  and coverage is measured against `offsetHeight`, not `rect.height`, because
  the latter is the *scaled* height and feeding it into the next frame's
  arithmetic is a loop that settles on the wrong number. The stacked cards
  also drop their `backdrop-filter` now: they composite over an opaque base,
  so the blur was a per-frame cost for a picture nobody can see — and these
  cards are re-rastered on every frame of a scroll now that they scale.

- **Arriving at the Satellite Tracker through the flight from the ISS card
  could leave the globe stranded outside its card, with an empty band in the
  column where the card belongs, until the page was reloaded.** Reported from
  an iPhone, where it happened on every arrival.

  The settle lifts the globe card out of the column to `position: fixed`, full
  bleed, and eases a clip-path down onto the rect its slot is holding open.
  Two things about how that was written could strand it there.

  The timer that ends the arrival sat *after* an early return that also
  covered a missing ref, which made "could not measure the slot" and "the page
  never comes back" the same branch — nothing else ever sets the phase back to
  idle, so the card stays lifted and the slot stays empty. The timer is now set
  first and is unconditional; a settle that cannot be measured degrades to a
  cut, which is what it should always have done.

  And the clip was resolved against `window.innerWidth/innerHeight` while it
  applies to the lifted card's own box. Those are the same number only on a
  browser whose toolbars don't overlap the viewport, and iOS Safari is exactly
  where the two part company — mix them and the globe's window lands somewhere
  the card isn't. It now measures the card's box directly, so the two cannot
  disagree, and it measures a frame later, since the phase can be set while the
  page is still on its first layout.

  Not reproducible in headless Chrome at 390x844 — the arrival lands correctly
  there before and after — so this is the failure mode being removed rather
  than a confirmed repro being fixed. Verified in Chrome that the flight still
  settles onto the card exactly and that the resting page is unchanged.

---

## 5.9.5

- **The cards in a phone's detail sheet now stack instead of being sliced off
  at its top edge.** Scrolling the sheet used to carry each card straight out
  of the scroller, so a description was cut through the middle of a line and
  the severed half sat over the planet behind it. Each card now pins to the
  top of the sheet and the next card rides up over it — the outgoing card goes
  *behind* its neighbour rather than through the edge — and scrolling back up
  lifts each one off the stack again in reverse.

  It is plain `position: sticky` on the sheet's direct children
  (`.detail-stack` in `index.css`), with no z-index anywhere: positioned
  siblings already paint in document order, which is the order a stack wants.
  Two things had to come with it. The cards are translucent glass, and glass
  over a pinned card is a smear of somebody else's text, so inside the stack
  the same tint composites over the sheet's own base (`--sheet-base`) and the
  card reads as solid while keeping its border, shadow and exact fill. And
  `ObjectDetailBody` gained a `flush` prop that drops its column wrapper, since
  otherwise its description, stats and footnote reach the sheet as one block
  and would pin as one.

  `.detail-stack-flow` opts an element out of pinning, for the two cases where
  pinning is wrong: the stats panel, which on a narrow screen can be taller
  than the sheet and would strand its own lower rows below the fold with no
  way to scroll to them, and the ISS card's "Track the ISS live" button, which
  at 50px would park at the top of the sheet permanently and cut the 189px
  card behind it through the middle of a line. Both still ride over the stack
  — `position: relative` is what keeps them painting above the pinned cards
  rather than under them the way an unpositioned box would.

  Desktop is untouched: the stack is applied only in the compact layout, which
  is the only one that shows the description inside the sheet at all. Verified
  in headless Chrome at 390×844 across the ISS (the deepest stack: identity,
  spacecraft, button, description, stats), Earth, Mimas (which carries the
  painted-surface footnote) and Mars in Arabic.

---

## 5.9.3

- **The mobile description panel now opens 2.5s after focusing a body,
  down from 4s.** That 4s was set to clear the true-sizes fly-in, the
  scene's longest flight at 2.4s, with room to spare — 1.5s had landed the
  panel's own lift on top of the tail of that flight. 2.5s keeps that same
  margin over 2.4s while cutting the wait nearly in half; desktop, where
  the description doesn't move the camera, is unchanged at 1.5s.

- **Combed through `CHANGELOG.md`.** Six runs of small, single-topic
  releases — chasing the same bug or tuning the same feature across
  several patch versions — are now told as one entry apiece:
  `4.1.0 – 4.1.2` (the idle-drift sliders), `4.3.5 – 4.3.7` (the
  scene-drawer tab's final shape), `4.4.2 – 4.4.5` (the warped-grid
  overlay's tuning), `5.0.7 – 5.0.10` (the /sky compass HUD), `5.1.0 – 5.1.2`
  (the AR constellation viewer's three milestones) and `5.1.7 – 5.1.8` (the
  Sun's lens-flare). Nothing outside those runs changed; the version
  numbers are preserved in each combined heading the same way `5.3.4 –
  5.3.13` already did it.

---

## 5.9.2

- **The tracker transition worked once per page load and then stalled.** Every
  visit after the first flew to Earth, came to rest on the hand-off frame —
  camera pinned, page chrome hidden — and stopped there. The route never
  changed, and the only way out was a reload.

  `TrackerHandoff` latches a flag when it starts a hand-off, because 'handoff'
  stays the phase for the length of the dissolve and without the latch the
  `navigate()` would fire on every notification during it. The latch lives in
  the effect's closure, and the effect only re-runs when the reduced-motion
  preference changes — so it was set on the first trip and never cleared. The
  second trip's notification hit the guard and returned, having done nothing,
  while the scene sat holding the pose it had correctly arrived at. It is now
  cleared when the phase returns to 'idle', which is why that case is handled
  in the same callback rather than in a second effect of its own.

  Verified by driving three round trips without a reload, and by confirming
  the previous build fails the same test on the second.

- **The focused-body view and the night sky get the tracker's back control.**
  Both carried a circular icon button with nothing but a chevron in it — over
  a planet that reads as scene furniture rather than as the way out. Both now
  use `.page-back`, the plain "‹ GO BACK" the tracker and compare pages
  already share.

  Two details came with it. The accessible name is now the visible text
  instead of a fuller phrase that did not contain it, which is the WCAG
  "label in name" trap; the longer wording stays as the tooltip. And the
  night sky's copy moves from a hard-coded 20px to `--scene-inset`, so it
  lands on the same spine as the wordmark above it — as a 38px icon pill it
  sat far enough off that edge to look deliberate, but as text it just looked
  misaligned.

---

## 5.9.1

- **The flight to the tracker goes straight to Earth, and is now one motion
  rather than three.** 5.9.0 routed the hand-off through the ISS: fly to the
  station, hold on it for half a second, then pull back until Earth filled the
  frame. The hold was the weak beat — at true sizes the station is a few
  metres across and, as often as not, over the night side, so the shot paused
  on something there was nothing to see of. It also bought less than it looked
  like it did, because the station in this scene sits on a decorative circular
  orbit at an arbitrary phase rather than on live elements, so it was never in
  the place the tracker's own marker would be anyway.

  Arming now navigates to `/object/earth`, and rather than flying there and
  correcting, **the fly-in is told where to land**: the focus block's own
  landing spot and arrival orientation are overridden with the hand-off pose,
  and Earth's turn to face its own Sun is eased across that same flight's
  progress. So there is one continuous movement from wherever the camera was
  to a frame the globe can be dissolved into — no second beat, and nothing to
  hold on. The pull-back, the station fade and the hold are all gone with it.

- **A camera arc that could send Earth out of frame entirely.** Arming while
  already focused on Earth is the one case with no focus change to override,
  so it sweeps to the pose under its own power — and that start point is the
  ordinary focused framing, which puts the Sun at ten o'clock and the camera
  very nearly over the night side. The two ends of the sweep were therefore
  close to antiparallel, and interpolating the camera's direction by
  `lerp().normalize()` passes through the zero vector around halfway: the
  normalise then returned an arbitrary direction and the planet left the frame
  for the middle third of the move. The direction is now swept as a rotation
  (`setFromUnitVectors` into a slerp), which is well defined even at exactly
  180°.

  The orientation along that arc is also now re-derived from where the camera
  actually is each frame, instead of slerped between the look-at quaternions
  of the two ends. Those two agree only at the ends; halfway round an arc this
  wide the interpolated orientation is no longer aimed at what both ends are
  aimed at, and Earth slid toward the edge of the frame and back. The roll is
  still delivered, by sweeping the up vector along the same arc.

---

## 5.9.0

- **The Satellite Tracker is no longer a page you cut to — it is a place you
  fly.** Asking for the tracker, from the header icon, the burger menu or the
  "Track the ISS live" button on the station's own card, now arms a cinematic
  instead of swapping the route. The camera flies to the ISS, holds on it for
  half a second, then pulls back over two seconds until Earth fills the frame;
  the station dissolves out as it goes and the last frame of the solar system
  is captured and held up while the route changes underneath it. The tracker's
  globe comes up behind that still, full-bleed, already drawing the same
  picture — and the two cross-fade. There is no black beat anywhere in it: at
  no point is the screen showing anything but Earth. The globe then eases out
  of full bleed and settles into its card as the page is revealed around it.

  It is a dissolve between two different renderers, two different scenes and
  two different cameras, so the frames have to be made to match rather than
  hoped to. Three things are arranged for that, and the arrangement is the
  whole trick:

  - **Size.** `utils/trackerEntry.js` holds `FRAME_FRACTION`, the share of the
    vertical field of view Earth's disc spans — read off the globe's own
    long-standing framing, a 38° camera at 3.89 Earth radii. The solar scene
    solves `handoffDistance()` for the same fraction at its own 45°, which
    puts it at 3.30 radii. Both ends then draw the disc at the same size
    whatever the viewport.
  - **Orientation and lighting, from one constraint.** Both scenes centre the
    frame on the real sub-solar point. The solar side gets there by turning
    Earth so that point faces its own Sun and then flying the camera down the
    sun line — one rotation that buys both halves at once, because the ground
    at the centre of the frame is then the sub-solar point (the same
    continents the globe centres) *and* the disc is fully lit with the
    terminator on the limb (the same lighting). Choosing either one on its own
    would have cost the other.
  - **Roll.** Both put Earth's north pole at screen-up.

  Neither side hands the other any coordinates: the sub-solar point is derived
  from the clock, so both compute it independently and agree. `utils/subsolar.js`
  is new and exists precisely so there is one formula rather than two that
  could drift.

  The return trip needed no new machinery. Because the sequence arms by
  navigating to `/object/iss`, the scene unmounts focused, which is the
  condition the existing exit animation already looks for — the tracker's back
  button goes to `/` rather than back through history, and the solar system
  pulls the camera out from where the hand-off left it.

- **The tracker's Earth was rendering at about a third of the brightness it
  should.** Its three surface maps were tagged `SRGBColorSpace`, so three
  decoded them to linear on the way in — but the globe's shader writes
  `gl_FragColor` itself, without the chunk that would re-encode them on the
  way out, so linear values went to the framebuffer raw and the planet came
  out dark and desaturated. The solar system's Earth has always left the same
  three maps untagged, which is the pair of wrongs that makes a right; the
  globe now does the same. This was invisible for as long as the two were
  never on screen together, and unmissable the moment they were.

- **Clouds on the tracker's globe.** It drew the day and night maps but not
  the cloud layer, the third of the set the solar scene has always used.
  Added, mixed in exactly the way that scene mixes it — a dissolve between a
  clouded Earth and a clear one is a dissolve you can see.

- **Moons leave trails while you are focused on their planet.** Each moon of
  the focused body now draws a tapering arc of the orbit behind it, in its own
  colour, the same idea as the planet trails one level down and under the same
  toggle. Built by sampling the parametric circle backwards from the moon's
  live angle rather than from a baseline point list — a moon's path here *is*
  that circle, so there is no nearest-sample search to do and the arc stays
  exact at any true-size factor. The span is a fixed share of the orbit rather
  than a fixed number of samples, so Phobos at 7.7 hours and Iapetus at 79
  days draw the same shape. Only the focused planet's moons draw one, and the
  moon you are actually looking at hides its own, matching what the planet
  trails already do on focus.

- **The intro screen lost the glow behind the wordmark.** The orrery's centre
  carried a soft warm radial wash for the mark to stand in. Gone; the rings
  and the wordmark now sit on plain black.

---

## 5.8.4

- **Earth and Venus lost their atmosphere glow.** Both planets carried a
  translucent halo sphere — a soft blue rim on Earth, a dim gold one on Venus
  — sitting just outside their surface mesh. Removed outright; both bodies now
  render as a plain sphere like every other planet.
- **Arabic numerals switched to Arabic-Indic (٠١٢٣) everywhere but scientific
  exponents.** The atlas had deliberately kept Arabic in Western digits since
  4.x, specifically because the catalog's mass and luminosity values carry
  Unicode superscript exponents (`1.989 × 10³⁰ kg`) that have no Arabic-Indic
  form — switching the digit set would have split a single number across two
  scripts. That tradeoff is now resolved the other way: the locale's
  `numerals` setting flips to `arab`, which converts every value built through
  the shared translator and number/date formatters, plus a handful of places
  that build a display string by hand instead (the ISS tracker's coordinates,
  the space-data ticker, chart axis labels). Catalog designations that happen
  to contain digits — `NGC 224`, `M31`, `G2V` — stay in Western digits on
  purpose, the same as the exponents: they are names, not measurements, and
  are typed and searched the same way in every language.

---

## 5.8.3

- **Montserrat, everywhere the interface reads left-to-right.** The `*`
  font stack used to lead with the OS default (SF Pro on Apple, Segoe UI
  on Windows), which meant the same page looked like a different piece of
  software depending on what it was viewed on. Montserrat now loads from
  Google Fonts (variable weight, 300–800) and sits first in that stack, so
  English and Vietnamese render in the same typeface everywhere; the old
  system stack stays as the fallback for the moment before the webfont
  arrives. Arabic is untouched — Montserrat has no Arabic glyphs, and the
  `:root[lang="ar"] *` rule already overrides the plain `*` rule by
  specificity, so it keeps rendering in SF Arabic / Segoe UI / Noto Sans
  Arabic as before.

---

## 5.8.2

- **The scale disclaimer moved to the top of the screen, on desktop.** It sat
  in the bottom-right corner, then centred on the bottom bar since 5.7.0; by
  request it now sits top-right instead, clear of the header, a footnote to
  the icon buttons sitting directly above it rather than a third thing
  competing with the transport and the catalog chip for the bottom row.
  Phone keeps the original bottom corner — SystemTitle's compact heading
  sits close enough to the top there (74px, against 88px on desktop) that a
  wide title can reach into that corner on a narrow screen, which is exactly
  what happened the first time this was tried at every width.

---

## 5.8.1

- **Fixed: focusing anything at true distances and sizes could land the
  camera nowhere near it.** 5.8.0 made that layout the site's default, and
  the fly-in distance formula that had always run underneath it —
  deliberately scaled down by the same factor a body's radius shrinks by, so
  a body keeps filling the same fraction of the frame at any scale — had
  never been exercised at the far end of that scale before. Three separate
  gaps opened up there, all specific to a body small enough for the ratio to
  matter:

  The fly-in's landing distance could fall closer than the camera's own near
  clipping plane, which does not render a very small planet, it clips the
  whole body out of the frustum — an object page could open onto a
  completely empty scene. Dwarf planets and asteroids (Ceres, Vesta, Pallas…)
  had no correct starting position at all on a direct link straight to their
  page: their only placement ran on the compressed layout, one frame after
  the code that aims a fresh fly-in already needs it, so the flight aimed at
  wherever that placement happened to leave them rather than anywhere
  Ceres actually was. Moons had the same gap, one step worse — nothing
  placed a moon anywhere before its own per-frame update, so a direct link to
  one aimed at the scene origin instead.

  All three are fixed at the root: the fly-in distance is now floored
  against the body's own true radius rather than against a stale read of the
  camera's near plane (which does not update until a frame after a fresh
  focus needs it); dwarf planets and asteroids get a true-distance-aware
  starting position at creation instead of a compressed one; and moons —
  which had no starting position at all — get one from a new bootstrap pass
  that positions every body correctly for the current scale once, before the
  render loop's first frame, the same way an existing pass already
  bootstraps every body's size. A focused Mars, Ceres or the Moon now lands
  close and clearly framed, the way any of them always did before 5.8.0;
  Jupiter and Earth, which happened not to trip any of the three gaps,
  render exactly as they did before this release.

- **A Satellite Tracker button in the header**, beside the night-sky and
  compare icons — desktop between the copy-link and night-sky buttons,
  mobile's menu in the same position. `/satellites` existed already; nothing
  in the header pointed at it.

---

## 5.8.0

- **The scene now opens at true distances and true sizes, at the owner's
  request.** `scaleMode.js`'s three stages — compressed, true distances, true
  distances and sizes — used to default to compressed on every fresh page
  load, nothing here persists a visitor's choice, so the module's own default
  *is* the site's default. It now starts at stage 2 outright (`distFrom`,
  `distTo`, `sizeFrom` and `sizeTo` all begin at 1, with `startedAt` already
  past its own transition window), so the very first frame is the resting
  state rather than an animated arrival at it. A shared-view link still
  overrides it, same as before.

  That surfaced a real bug rather than just a starker home view: focusing any
  body smaller than the Sun landed the camera *inside* its own near clipping
  plane. The fly-in distance is `focusDistDrawn * lastFocusSizeF` — deliberately
  scaled down by the same factor a body's radius is, so it keeps filling the
  same fraction of the frame it always did as it shrinks toward its true size
  — and for a body drawn at true scale that factor is on the order of a
  thousandth. Mars landed the camera roughly 0.018 units from a planet with
  nothing rendering closer than 1 unit; the whole body was clipped out of the
  frustum, and its object page opened onto an empty scene. The same formula
  runs a second time, unguarded, when a stage change lands while something is
  already focused, so both the initial fly-in and that settle pass are now
  floored at `camera.near * 2.2` — just enough to clear the plane, since
  floored any further out only shrinks an already-tiny body further. A
  terrestrial planet is still a near-invisible speck at true scale — that is
  the stage doing exactly what it says on the tin — but it is now an honest
  speck rather than a rendering bug wearing its costume. Gas giants clear the
  floor with real margin: Jupiter still reads as a small textured disc.

- **The scene drawer's tab lost its box.** 5.7.0 put it on a rail flush to the
  window edge, reasoning a bare glyph over a black scene read as a stray mark
  rather than a control. Asked to take the box back off regardless — it read
  as chrome sitting on top of the scene rather than as part of it — so it is
  bare chevrons again, legibility carried by a drop-shadow behind the ink and
  an opacity lift on hover/focus instead of a background plate.

- **Liquid glass is back.** The same 5.7.0 pass that unified every hand-rolled
  translucent panel into one `--panel-*`/`.glass` recipe also, as a side
  effect, thinned it a good deal past the "iOS 26 Liquid Glass" look the site
  had before — fill opacity roughly halved (0.08 → 0.045), border opacity
  roughly halved again (0.18 → 0.09) — which was most visible on the
  focused-object description card, a glass pane sitting directly over the
  scene. `--panel-bg`, `--panel-bg-hover`, `--panel-border`, `--panel-border-hi`
  and `--specular` are now brighter than the original values, not just restored
  to them, paired with a stronger, more saturated blur (`saturate(170%)` over
  the original `saturate(50%)`) that lifts the colour of whatever sits behind
  the pane instead of dulling it. One token family, so every `.glass` surface
  site-wide picks it up together rather than the description card getting a
  one-off fix that drifts from everything else again.

---

## 5.7.1

- **The loading screen is an orrery now.** It is the first thing anyone sees
  and it was a wordmark, a two-pixel bar, and a five-name list set flush left
  inside a centred column — the one ragged edge on an otherwise symmetrical
  screen, which is what made the opening of the site look unfinished. It is
  now a set of four tilted orbit rings with a body travelling each, drawn
  around the wordmark standing where the Sun goes, with the progress readout
  centred beneath them.

  The rings are real 3D — a circle turned on its X axis rather than an ellipse
  drawn by hand — so the foreshortening is genuine and a body going round one
  follows the perspective on its own. The tilt is 69°, close to the angle the
  solar-system scene's own camera looks down on the ecliptic at, so the
  picture agrees with the one that replaces it.

  Keeping a body facing the viewer takes two undos, not one, and missing the
  second is what made the first attempt render them as smeared arcs: the ring
  contributes a fixed `rotateX`, the orbit contributes a rotation that changes
  every frame, and no static transform can cancel a moving one. Each body
  therefore sits inside a wrapper running the very same animation in reverse
  off the same duration and delay — exact inverses at every instant — leaving
  only the fixed tilt for the body itself to undo.

- **It is also a progress readout.** The four bodies light amber in turn as
  the load passes each orbit's quarter of the total, so the whole system is
  lit at the moment the screen says READY and the wordmark leaves. The bar
  animates on `scaleX` rather than `width`, since width is a layout property
  and the one thread that cannot afford a relayout per texture is the one
  building the scene.

  Everything on this screen animates on `transform` and `opacity` only. That
  is not a general tidiness point here: this screen is shown at the exact
  moment the main thread is saturated decoding textures and uploading to the
  GPU, and compositor-driven animation is the only kind that keeps its frame
  rate through a main thread that is fully blocked.

- **Something now paints before the bundle does.** Until this release the
  opening moment of the site was an empty black window for as long as ~200 KB
  of JavaScript took to arrive, parse and mount — on a slow connection,
  several seconds of nothing, which reads as a page that has failed rather
  than one that is coming. `index.html` now carries a few lines of inline CSS
  that draw the same black and one faint pulsing ring in the exact position
  the orrery's innermost orbit appears, so there is no seam when React mounts:
  the ring is simply joined by the rest of the figure. It lives inside `#root`,
  so React removes it on mount with nothing to remember.

- **The handover choreography.** The readout fades and drops away, the orrery
  swells and dissolves as though the view were moving forward through the
  orbits into the scene behind them, the black lifts underneath, and the
  wordmark flies last into the header's own position — landing untransformed
  and pixel-identical to the header's copy, which is what makes it a handover
  rather than a cross-fade. Under `prefers-reduced-motion` the orbits hold
  still at a fixed angle each (one per quadrant, rather than all four resting
  at 0° and forming a spoke), the bar's gleam is removed outright, and the
  flight is skipped.

- **Two traps in the headless-Chrome verification setup, now written down in
  CLAUDE.md.** Headless Chrome reports `prefers-reduced-motion: reduce` by
  default, which this app honours — so every screenshot of an animation shows
  it already finished, plausibly and wrongly. And capture timing has to be
  driven off the page's own `performance.now()`, not the driving script's
  clock: `Page.navigate` returning and `captureScreenshot` on a live 3D scene
  drift the two by most of a second, which is enough to miss a 950ms
  animation completely. Both cost real time here before being spotted.

---

## 5.7.0

- **A design system, and one column for the whole interface to stand on.**
  The parts of this site were each well made and none of them agreed with any
  other. The header sat on the window's own 32px gutter; the catalog below it
  sat on a centred 1280px column, 160px further in; the telemetry ticker ran
  edge to edge from zero. Three left edges on one page, which on a wide screen
  is the whole width of a card. The scene's floating chrome had a fourth,
  20px, and the focused-object annotations a fifth. Nothing was wrong enough
  to point at, and the sum of it was a page that never settled.

  Everything now lands on one spine — a `.spine` container dimensionally
  identical to the `max-w-7xl` `<main>` it has to agree with, plus a
  `--scene-inset` for the chrome that floats over the full-bleed 3D scene and
  sits outside that `<main>`. The wordmark, the catalog heading, the leading
  edge of the first card, each standalone page's title, the time transport and
  the focused body's name are all on the same vertical line, and the header's
  actions and the catalog's trailing edge on the same one opposite. On a
  1920px window that is a 352px inset on both sides; below 1280px it collapses
  to a plain gutter.

- **One scale per dimension, instead of a value per call site.** Type ran to
  something like twenty ad-hoc sizes (9, 9.5, 10, 10.5, 11, 0.55rem, 0.58rem,
  0.6rem, 0.62rem, 0.72rem, 0.74rem, 0.82rem, 0.85rem, 0.87rem, 0.9rem,
  0.92rem, 0.95rem, 1.05rem, 1.1rem, 17px…) with five different tracking
  values for what was the same uppercase micro-label each time; radii ran to
  eight; motion to nine durations across three easing curves, so no two things
  on screen moved alike. `src/index.css` now opens with the whole list —
  space, spine, radius, type, motion, surfaces, elevation, colour — and the
  components draw from it.

  The surfaces are the part that mattered most. There were two families
  pretending to be one: chrome floating over the 3D scene, which has to stay
  readable over the Sun and so is a dark scrim first, and panels sitting on
  the page's own black, which are a light tint that lifts off it. Each had
  been written out by hand four or five times with slightly different numbers
  — `rgba(0,0,0,0.42)` here, `0.45` there, `blur(14px)` beside `blur(16px)`
  beside `blur(18px)` — which is precisely what made a carefully built
  interface read as a careless one. Both are now single recipes
  (`--chrome-*`, `--panel-*`), shared by `.chrome-btn`, `.chip`, `.panel`,
  `.edge-tab`, the time transport, the scene drawer and the header's buttons.

- **The bottom of the scene is a bar now, with an anchor at each end.** It was
  three things at three different offsets: the transport at 20px from the
  window, the catalog pill centred at 18px, the scale footnote at 14px in the
  corner. They now share one baseline and the spine — transport at the
  leading edge, catalog chip at the trailing edge, the "not to scale" caption
  centred between them as the caption for the picture it describes. Putting
  the catalog chip opposite the transport rather than centred was forced as
  well as tidier: the transport is about 510px wide, and half a 1280px window
  less the spine gutter is exactly that much room, so a centred chip collided
  with it at every window width the site supports. The caption steps aside
  entirely while a body is focused, where the centre belongs to the chevron
  back up to the scene.

- **The focused-object annotations line up.** The name and three figures
  flanking a focused body were two independent flex columns, each stacking
  from its own top edge — and because the leading column opens with a
  display-size name and the trailing one with a single stat, the two figures
  meant to read as a pair sat about fifteen pixels apart vertically. They are
  one grid now, sharing row tracks, aligned on the baseline: the body's name
  and the first figure sit on the same line, and the pair below them on the
  next.

- **The telemetry ticker is a band rather than a card that has been cut off.**
  It ran the full width of the window while carrying a 20px radius and a
  border all the way round, so only two of its corners were ever on screen. It
  now has hairlines top and bottom, a masked fade at both ends so the readings
  dissolve into the page instead of being guillotined at the edge, and short
  centred rules between cells in place of full-height dividers that made seven
  live readings look like a spreadsheet.

- **The compare table uses its width.** Rows were `1fr auto 1fr`, which puts
  the only fixed-width thing — the label — in the middle and lets the two
  flexible columns grow outwards, so both values ended up stacked against the
  centre with a third of the card empty at either flank. Fixing the label
  column instead gives each value a column of its own, centred under a new
  sticky header naming which body it belongs to.

- **The satellite tracker's telemetry no longer orphans a reading.** Eight
  figures in a `repeat(auto-fit, minmax(130px, 1fr))` grid resolved to seven
  columns at the width that panel actually gets, so the eighth wrapped onto a
  row by itself. Four columns divide eight exactly, at every width.

- **Removed "What's up tonight" (`/tonight`).** The page, its route, its nav
  entry and its strings in all three locales are gone; the flat-panorama
  readout it offered overlapped the `/sky` dome, which answers the same
  question by letting you look around inside it. Old links fall through to the
  catch-all route and land on the solar system rather than breaking. This
  takes 37 kB off the main bundle. `utils/skyEvents.js` — the year-ahead
  calendar of oppositions, eclipses and elongations that drove its "coming up"
  list — is deliberately left in place and still tested, unused, since nothing
  about it was specific to that page's presentation.

- **Fixed: the tracker's and the "tonight" page's back buttons announced
  themselves as `"tonight.back"`.** That key exists in no locale, and `t()`
  returns the key itself when a lookup falls through both the active locale
  and the English fallback — so a screen reader read out the dotted
  identifier. Caught because the shared `PageHeader`'s back control became
  visible text in this release rather than an icon's accessible name, which is
  the only reason anyone would have seen it.

- **Smaller things.** Cards hold a 4:3 frame so a row is a row of equal
  rectangles whatever each object's stats run to, and their photograph pushes
  in a little further than the card lifts, with the legibility scrim thinning
  as it comes forward. The scene drawer's tab is a pull handle flush to the
  window edge instead of two transparent chevrons floating in the starfield
  with nothing to say they were a control. `PageHeader` puts its back control
  on its own row, so the title, the subtitle and the panels below them share
  one edge rather than three. The focus ring no longer forces a 10px radius
  onto controls whose own corners are rounder than that. The scrollbar thumb
  is a slim capsule drawn inside a transparent border. Category tabs carry
  their object count in a chip, so "Moons 23" cannot be misread as one label.

---

## 5.6.1

- **A diagnostic readout for the AR compass, behind `?debug=ar`.** Testing AR
  against the real Moon showed the rendered Moon sitting one to three degrees
  to its left — a constant gap, the same size wherever the Moon sat on screen.
  That shape of error rules out a field-of-view mismatch on its own, since a
  wrong FOV stretches the overlay about the centre and would have grown toward
  the edges. It also, less obviously, exonerates magnetic declination: the
  observation was made in North America, where declination runs ten to fifteen
  degrees, so a correction applied twice, backwards, or not at all would have
  been off by ten to thirty degrees rather than by one or two. Both of the
  obvious suspects were therefore already ruled out by the measurement itself.

  What remains is harder to see from the code, because it may not be a code
  fault at all: one to three degrees is ordinary phone magnetometer error.
  iOS's own stated accuracy for the reading, which the app had never looked
  at, is typically ten to fifteen degrees, and local magnetic anomalies —
  reinforced concrete, a car, a magnetic case — add degrees more on top.
  Rather than guess at another fix, this release adds the instrument needed to
  tell the two apart. Opening the sky view with `?debug=ar` overlays every
  stage of the heading pipeline at once: what iOS reported, the bearing
  derived from the rotation alone, the anchor reconciling them, declination,
  manual calibration, and the final true heading — alongside the Moon's true
  azimuth computed from the ephemeris, and the signed difference between the
  two.

  That last number is the whole point. Centre the real Moon in the camera and
  the difference says where the error entered: already present there, and it
  arrived before the renderer ever saw it, which means the sensor; near zero
  while the drawn Moon still sits visibly off, and it arrived after, which
  means the projection. `webkitCompassAccuracy` is now captured too, both for
  the readout and as the signal a future "wave the phone in a figure-of-eight"
  prompt would key off. Nothing about normal use changes — the readout only
  exists when the query parameter is present, and its labels are deliberately
  untranslated, being developer instrumentation rather than part of the site.

---

## 5.6.0

- **Time can run backward now, not just fast-forward.** The rewind button
  used to bottom out at real time and clamp there. It now keeps going past
  that stop, into reverse, up through the same ladder the fast-forward side
  already had — a week a second, a month, a year — so holding it down long
  enough runs the whole system backward at up to a year a second, the mirror
  of running it forward. `simTime.js` already fully supported negative rates
  (it's covered by its own tests), the transport just never had a way to
  reach them; the two step buttons now walk one shared signed ladder instead
  of a forward-only one. The aria-labels changed from "Slower"/"Faster" to
  "Rewind"/"Fast-forward" to match — "slower" stopped being an honest
  description of a button that can now put the clock in reverse at full
  speed.
- **Focusing an object now resets the clock to real time.** Flying to a
  planet at whatever speed the overview happened to be left at meant
  watching it arrive as a streak, or a moon system as a blur. The rate
  resets to 1×real-time the moment you focus anything — you can still speed
  up or slow down from there while focused, that part's untouched — and
  whatever rate you had before is restored the moment you leave. Switching
  between two focused bodies without passing back through the overview (a
  planet's moon, say) doesn't reset again — only the overview ⇄ focused
  transition does, so it stays one clean pair of resets rather than firing
  on every click while you're already in a focused session.
- **The timeline pill now collapses and expands on its own.** Focusing an
  object folds it down to the small date/Live chip it already had for manual
  collapsing, so it doesn't compete with the thing you flew to; leaving
  unfolds it back open. It's still just as manually collapsible/expandable
  as before at any point, including while focused. The collapse/expand
  itself is a real width animation now too, not the instant swap the manual
  toggle always did — a small FLIP (lock the pill to its old pixel width,
  then animate to the new content's natural width) rather than a CSS-only
  trick, since the compact and open pills are two unrelated DOM trees with
  nothing to cross-fade between. Took two wrong turns to get the timing
  right: a version using `requestAnimationFrame` to space the "old width"
  and "new width" steps a frame apart looked fine in reasoning but collapsed
  both into one paint in headless Chrome (no guaranteed paint boundary
  between two rAFs, it turns out); the fix after that measured the *target*
  width while the pill was still pinned to its old, larger size, which
  silently failed on every collapse specifically — `scrollWidth` reports the
  larger of "the content's own size" and "the box's current size," so a box
  forced wide can never measure back smaller than itself. The working
  version measures the target width first, before pinning anything, then
  locks old → forces a reflow → releases to the real target.

---

## 5.5.3

- **Planet trails go back to a hairline.** The extra width from 5.5.2 is
  reverted on request — "I no longer want fatter lines" — and the length it
  came with stays: the arc is still about 15% of the orbit against the 9%
  it shipped with. Back to a one-pixel `THREE.Line`, with the taper in
  colour rather than width.

  The sample stride goes with it. It existed only because overlapping
  fat-line quads blend twice and bead, which a one-pixel line cannot do, so
  the trail is one point per baseline orbit sample again — 38 of them,
  which is the smoother curve. `Line2`, `LineGeometry` and `LineMaterial`
  come back out of the bundle entirely (the main chunk drops from 691 kB to
  674 kB), along with the `resolution` plumbing in the `ResizeObserver` and
  the in-place interleaved-buffer writes that only LineGeometry needed.

  That makes three attempts at fat lines in this codebase and three
  reversions: the gravity field lines (4.3.0 → 4.3.1), the orbit rings
  (which are rebuilt tubes instead), and now these. Recorded in the README
  rather than left for a fourth.

- **One line from 5.5.2 is deliberately kept:** the trails still skip
  frustum culling. It is not a fat-line concern — three computes a bounding
  sphere once, lazily, from whatever the buffer holds at the time and never
  again, so a geometry the render loop keeps rewriting ends up tested
  against a stale bound as its planet moves away from it. The belts and the
  probe tracks already opt out for the same reason; the trails should have
  from the start.

---

## 5.5.2

- **Planet trails are thicker and longer.** Straightforward request; the
  length half was a constant, the thickness half was not.

  A `THREE.Line` is a one-pixel hairline on every platform no matter what
  `linewidth` says, so there was no width to turn up — the trails are drawn
  with three's `Line2` now, at 2.4 CSS pixels. That is the same fat-line
  machinery this codebase has twice tried and given back: once for the
  gravity field lines (4.3.0, reverted in 4.3.1) and once for the orbit
  rings, which are `TubeGeometry` rebuilt against camera distance for
  exactly this reason. Worth revisiting here because what ruled it out
  there does not apply. The rings' objection was that a thin translucent
  fat line is either hard-edged or, with `alphaToCoverage` on, dithered
  into beads — `alphaToCoverage` is off here, so there is nothing to
  dither, and a short arc gives hard edges far less to read against than a
  ring spanning the screen. And the rings' own answer, a rebuilt tube, is
  not available to a trail: a ring's geometry is rebuilt a handful of times
  across an entire zoom, while a trail's is rewritten every time its planet
  moves, which during a scrub is every other frame.

  The arc is about 15% of the orbit now, against 9%. It is drawn on 19
  points rather than 38, taking every *second* baseline orbit sample — and
  that stride is the fix for the one artifact `Line2` does bring here. A
  fat line is one screen-space quad per segment, and consecutive quads that
  overlap blend twice and come out brighter, so packing more points into an
  arc than it has pixels for beads it: one sample per point put 38 of them
  into roughly 50 pixels of Mars' arc at the default zoom, well under the
  line width. Every other sample is the same curve — 15% of an ellipse does
  not need 38 points — with segments long enough to sit end to end. Visible
  at 4x magnification before the change and not after; not visible at 1:1
  either way, which is the honest way to describe it.

  Two supporting details: the trail geometries are written **in place**
  rather than through `setPositions()`/`setColors()`, which rebuild and
  re-upload the whole interleaved buffer on every call and would do so
  eight times per scrub frame; and the trail lines skip frustum culling,
  the same way the belts and probe tracks already do, because a bounding
  sphere computed once from a still-empty buffer would cull an outer
  planet's trail whenever the origin left the frame.

- **README fix:** the "Orbit paths" section claimed the rings are `Line2`.
  They have been tubes since the rebuild machinery landed — the section
  described a decision that was later reversed, with the reversal's own
  reasoning sitting in the code the whole time. Rewritten to match, with
  the trail's opposite conclusion and why the two differ.

---

## 5.5.1

- **The Sun's glare now scales with the Sun.** Reported straight after
  5.5.0: the glare held the same size while zooming out, which reads as
  something pasted over the scene rather than light coming out of it.

  It was a constant because three.js's `LensflareElement` takes its `size`
  in screen pixels, and because a real lens flare genuinely does behave that
  way — the flare is thrown by the glass, not by the subject, so a bright
  enough point source throws the same one however far off it is. That
  argument holds for a camera and not for a solar-system map, where pulling
  back until the Sun is a dot and leaving a full-size starburst on top of it
  just looks wrong.

  The size is re-read every frame by `Lensflare.onBeforeRender`, which is
  the hook that makes this drivable at all: the elements array itself is
  private to the constructor's closure, but `addElement` stores the very
  object it is handed, so keeping our own references is enough.
  `sunFlareScale()` turns the Sun's current world radius and distance into a
  multiplier against the angular radius it subtends from the scene's opening
  camera — 1x there, by construction, so the default view is untouched —
  and every element is scaled from its authored size rather than compounded
  frame on frame.

  Working in *angle* rather than pixels is what keeps this
  viewport-independent: the flare stays the same fraction of the frame for a
  given zoom on a phone as on a desktop, exactly as the constant version
  did. Both ends are clamped, and the lower clamp is load-bearing rather
  than cosmetic: at true sizes the Sun is a quarter of a scene unit and the
  honest multiplier lands near 0.11, small enough to read as nothing — and
  the flare is the only thing marking where the Sun is in that view, which
  the fly-in framing added in 5.5.0 depends on. The floor holds it at a
  small, distinct glint instead. The upper clamp stops the flare running
  several screens wide when the disc already fills the frame.

---

## 5.5.0

- **The camera really does pan away on its own if you leave it alone, and
  the reason is the roll slider.** Reported as "left idle for long enough,
  the entire screen starts panning uncontrollably" — accurate, and it had a
  specific cause rather than being general drift wander.

  Idle pitch ran without limits, by design: "pitch somersaults right over
  the poles" is what `utils/driftControl.js` said, on the reasoning that up
  and right are re-derived from the live camera every frame so nothing can
  break. Nothing does break in the rotation. What breaks is the other half
  of that same block — the correction that quietly rolls the camera back
  toward level whenever the roll slider sits centred, which is where it sat
  for everyone who never touched it. A camera that has just been carried
  over a pole is upside down relative to world up, so that corrector, built
  for errors of a fraction of a degree, is suddenly handed one near 180° and
  drives at it. Past the pole the yaw axis has flipped too, so the tumble
  feeds itself instead of settling.

  The timing matches the report exactly: at the default pitch of 0.143 the
  camera covers the 90° from the ecliptic to the pole in about three and a
  half minutes. A 30-minute simulation of the old block reaches 89.8° of
  elevation and hands the level corrector a 61° error; the same simulation
  of the new one peaks at 69.3° and never gives it more than 0.2°.

  Pitch is a pendulum now (`pitchPendulum`, extracted to
  `utils/driftControl.js` so the rule is pinned by tests rather than living
  only inside a render loop nothing can call): it eases to nothing as it
  approaches about 70° of elevation and turns around there. The reversal
  happens at the one point where the rate is already zero, so there is no
  corner to it, and yaw keeps running straight through, so the view still
  explores the whole system rather than rocking along one line. The
  roll-to-level correction is now unconditional, since there is nothing left
  that could be driving roll instead.

- **The Roll slider is gone**, on request. Two axes remain, yaw and pitch.
  A roll value left in `localStorage` by an older version is ignored rather
  than treated as corrupt, so a reader's yaw and pitch survive the upgrade.
  Removing the slider and adding the pitch band are both necessary: either
  one alone leaves the other failure reachable.

- **The fly-in now frames the Sun at true distances too, and much further
  round to the left — on a desktop.** True distances is the stage where a
  body is already a long way down its own radial line with nothing else in
  the shot, so it earns the same over-the-shoulder-of-the-Sun framing true
  sizes has had since 5.2.0. The angle is the change: 28° off axis at 61°
  round from vertical, against the old 12°/35°, which puts the Sun about
  0.62 of the way up the frame and 0.70 of the way to the left edge at 16:9
  rather than tucked just above the body.

  The old pair was cautious for a reason — 30° off axis dropped the Sun off
  the top of a 45° field, whose vertical half-angle is only 22.5°. The room
  that makes the wide framing possible is sideways: at 16:9 the horizontal
  half-angle is 36°. That is also why this is desktop-only, and gated on a
  5:4-or-better aspect as well as the usual phone breakpoints — a portrait
  phone would simply crop the Sun off, which is worse than not reaching for
  it. Below the gate, true sizes keeps the framing it has always had.

- **Focusing a planet on a phone no longer jolts.** Reported as the body
  landing centred and then jumping upward to make room for the detail sheet.
  Two separate causes, both fixed:

  The sheet's own timing. It opened 1.5s after the tap, which lands inside
  the fly-in — the longest of which, at true sizes, runs 2.4s. So the
  arrival and the panel were competing for the same second. On a phone it
  now waits 4s, which clears every flight the scene has with room to spare
  and lets the arrival be its own moment. Desktop is unchanged at 1.5s,
  where the description slides in from the top and moves nothing.

  And the lift itself. Opening the sheet sets the focus offset that raises
  the body up the frame, and that offset was read straight off a ref and
  applied in full on the next frame — a single-frame jump while the panel
  was still sliding. It is eased now, over about the same second the panel
  takes, so the body rises *with* it and the two read as one movement. The
  automatic reveal also runs slower than it did (1.05s against 0.45s), while
  a tap on the handle stays at the old snappy 0.45s: an arrival wants to be
  unhurried, a direct manipulation does not.

- **The Sun's lens-flare throws rays now.** It had a halo, one horizontal
  streak and four ghosts, and the thing it was most obviously missing was
  any spray of light out of the core at all. `burstTexture` adds eleven
  spikes at varied angles, lengths and tints, drawn with the same
  squashed-gradient primitive the streak already used (a filled shape would
  have hard edges that read as grey bars rather than light), composited
  additively so they pile into a hot core where they cross. The angles are
  deliberately uneven: a real iris does throw evenly spaced spikes, but an
  evenly spaced *and* evenly bright set reads as a drawn asterisk, because
  the eye finds the pattern immediately. The ghost chain is spread wider
  too — out to 1.55 from 1.15 — with two large, dim discs added at either
  end, which is what reads as a lens rather than as confetti. All still
  procedural canvas work built once at scene setup, with no new assets and
  nothing per frame.

---

## 5.4.0

- **Rebuilt AR mode's orientation on the one rotation the sensors
  actually describe, instead of three angles pulled out of it
  separately.** The reported problem was blunt — "the constellations and
  objects do not appear at the right spots at all" — and so was the cause.

  `DeviceOrientationEvent`'s alpha/beta/gamma are a decomposition of a
  single physical rotation. Every previous version of
  `utils/deviceOrientation.js` took them apart and answered three
  questions independently: heading from one hand-derived trig expression,
  altitude from a second (and later from the accelerometer instead), and
  roll from nothing at all, because roll was declared out of scope. The
  three answers were separately plausible and jointly described no
  orientation any phone could be in.

  **Heading was mirrored.** Alpha is a *counter*-clockwise rotation about
  the up axis — the spec's Earth frame is right-handed with z up — and
  compass bearings run clockwise, so a phone reads `heading = 360 -
  alpha`, not `heading = alpha`. The old formula un-negated the east
  component of the device→Earth matrix and got the latter, which reflects
  the entire sky across the north-south line: Orion sits where it would if
  you were facing the opposite way, and every attempt to chase it by
  flipping some other sign moved the error somewhere else. Its own unit
  tests asserted the mirror (`alpha=90` "should" read 90; it reads 270),
  and a comment in the file recorded four cardinal directions agreeing as
  corroboration — which is exactly what a mirror looks like, since a
  reflection maps all four onto each other.

  **Altitude was inverted and then patched.** The formula read flat-on-a-
  table as +90° — the back camera is on the underside, so it faces the
  floor, which is -90° — and a literal `ALTITUDE_OFFSET = -180` sat on top
  cancelling it. In the app's own default AR pose, phone upright and level,
  the two composed to a reported altitude of **-180°**, which as a camera
  pitch means "looking at the horizon behind you, upside down." That single
  number accounts for most of what a real device was showing.

  **Roll was missing.** A phone is never held perfectly upright, and
  without a roll term the overlay only lines up with the camera image while
  it is. Tilt the phone twenty degrees and the stars stay level while the
  world behind them does not.

  The rewrite composes the spec's own device→ENU rotation —
  `Rz(alpha) · Rx(beta) · Ry(gamma)`, the same construction three.js's
  own (now removed) `DeviceOrientationControls` used — and reads
  everything off it: the back camera's direction gives heading and
  altitude, the screen's up direction gives roll, and
  `screen.orientation.angle` rotates that up direction when the layout
  does. `NightSky3D.jsx` applies all three as
  `camera.rotation.set(altitude, -azimuth, roll, 'YXZ')`, where the Z term
  is AR's alone; the dragged dome keeps its never-any-roll invariant.

  This also removes, rather than treats, the instability the 5.3.x
  releases kept circling. Near beta = ±90° — which is the AR holding pose,
  not an edge case — the browser can report wildly different
  (alpha, gamma) pairs for two physically identical attitudes, so any
  formula reading either angle alone inherits that noise. The pairs are
  correlated: the rotation composed from them is the same rotation either
  way. Reassembling it first is what makes the singularity stop mattering,
  which is why no confidence gate, pole freeze or heading-candidate flip
  survives in the file — they were all treatments for a symptom this
  formulation does not produce. Smoothing moved onto the quaternion
  (slerp) for the same reason: three angles averaged separately wobble
  precisely where they disagree most, near the zenith, where heading and
  roll each swing hard while the rotation they jointly describe barely
  moves.

  The `devicemotion` accelerometer path introduced in 5.3.1 is gone with
  it. It was there to escape the beta/gamma instability, which no longer
  exists, and `accelerationIncludingGravity` disagrees on sign between iOS
  and everything else — 5.3.2 "fixed" it against one real iPhone, which
  silently inverted every Android device. One fewer sensor, one fewer
  permission prompt, one fewer convention to be wrong about.

  iOS's `webkitCompassHeading` is still used, but as an *anchor* rather
  than a substitute. It is a bearing for one device axis, not for wherever
  the camera points, so using it directly is only correct while the phone
  is upright; it now solves for the constant offset that makes the whole
  rotation north-referenced, smoothed over a much longer time constant
  than the motion itself. Which axis that bearing belongs to changes with
  tilt — iOS reports for whichever of the device's top edge or back camera
  is nearer horizontal, which is precisely why earlier releases saw it
  "switch reference at 45° and 135°": two orthogonal axes swap over
  exactly there. Picking the same way makes the switch a non-event instead
  of a 180° jump to be caught and undone.

- **AR now renders through the same lens the camera is looking through.**
  Pointing the phone in exactly the right direction still puts a
  constellation in the wrong place if the virtual camera and the physical
  one disagree about how much sky fits on the screen. AR was rendering at
  the same fixed 55° the drag-around dome uses, which on a typical phone
  is 15–20% narrower than what the camera actually shows — an error that
  cancels at the crosshair and grows toward the edges, so the middle of
  the screen looks right while something near the rim sits several degrees
  out. `utils/arCamera.js` derives the vertical field of view from the
  video frame's real dimensions and the viewport's, including the
  `object-fit: cover` crop. There is no web API for a camera's optics, so
  one assumption remains — a 78° diagonal, the middle of the range modern
  phone main cameras report — pinned on the *diagonal* specifically
  because that is the angle that survives a change of aspect ratio.
  Pinch/wheel zoom is disabled while AR is on for the same reason: the
  field of view is a measurement there, not a preference. Leaving AR hands
  the dome back whatever zoom it had.

- **Verified end to end in a browser, not just in unit tests.** Headless
  Chrome with a fake camera and CDP-driven `DeviceOrientation` overrides:
  an upright phone at alpha=0/90/270 now reads heading 1°/271°/91° (the 1°
  is London's magnetic declination, correctly applied — it read 0°/91°/271°
  before, mirrored), a phone tilted back 45° reads +45° altitude, flat on a
  table reads -90°, and turning the phone onto its side rotates the
  rendered sky with it. The measured on-screen scale change between AR and
  the dome matched the predicted field-of-view ratio to three decimal
  places. The test suite gained an end-to-end case that reconstructs the
  camera `NightSky3D.jsx` builds from the three reported numbers and
  compares it against where the device is independently known to be
  pointing — the one test that would have failed for every broken version
  of this module, including the ones whose own heading and altitude tests
  passed.

---

## 5.3.4 – 5.3.13

- **Ten releases chasing one sign error in AR mode, none of which fixed
  it.** Kept as a single entry because that is what they were: each one
  reported a different symptom of the same underlying bug (the sky
  mirrored east-west, and an altitude scale with a literal -180° offset
  bolted onto it), flipped one more sign somewhere in
  `utils/deviceOrientation.js` or in how `NightSky3D.jsx` applied the
  result, and moved the error rather than removing it. The individual
  entries claimed fixes that did not hold and contradicted each other —
  5.3.9 reversed the screen motion, 5.3.12 reversed it back — so they are
  not worth reading one by one. Two things are worth keeping from them:
  the real-device reports that drove them were all accurate (heading did
  flip near the zenith; up and down genuinely were backwards; iOS's
  compass reference does switch at 45° and 135° of tilt), and every one of
  those symptoms is explained by, and fixed in, 5.4.0. The version numbers
  are preserved here because `frontend/package.json` and the commit
  history carry them.

---

## 5.3.3

- **Chrome was noticeably darker than Safari, and not just in the main
  scene** — reported on this Mac specifically: "I want Chrome to be as
  bright as Safari." The main solar-system view (`SolarSystem3D.jsx`)
  already carries the fix for this, from 4.6.6/4.6.7: `renderer.
  outputColorSpace` assigned explicitly through its setter rather than left
  to whatever a fresh `WebGLRenderer` defaults to (the two browsers don't
  agree, especially on this machine's wide-gamut P3 display), plus
  `LinearToneMapping` with `toneMappingExposure = 1.3` so that assignment
  actually does something — exposure is a silent no-op under the default
  `NoToneMapping`. Auditing every other place this app creates a
  `WebGLRenderer` found three more, each missing some or all of the same
  fix: the satellite tracker's globe (`SatelliteGlobe.jsx`) had neither
  line; the night sky (`NightSky3D.jsx`) had the color-space line but not
  the tone-mapping pair; the spacecraft model viewer (`SpacecraftViewer.jsx`,
  currently unshipped behind a feature flag but fixed anyway for whenever
  it's re-enabled) had neither. All three now carry the exact same two
  lines already proven correct in the main scene. Also checked every
  `CanvasTexture` in the app for the untagged-color-space bug this same
  issue traced back to in 4.6.6 — found several more (the Sun's lens-flare
  elements, the outer planets' ring-glow gradients), but these are thin
  additive-blend overlays already living inside the one scene that's had
  the full fix the longest, not photographic surface maps, and tagging them
  to match would change how they're sampled by the GPU in a way that's not
  established to be correct here — left alone rather than guessed at.
  Verified in headless Chrome that all three views still render correctly
  after the change (the satellite globe, the night sky once past its
  location prompt); Safari itself isn't something this environment can
  check directly, so full confirmation is still on the user's own Mac.

---

## 5.3.2

- **Fixed AR mode's altitude reading straight up/down backwards** — reported
  directly, immediately after 5.3.1 shipped: "when I look down, the scene
  is as I have looked up instead." The 5.3.1 fix moved altitude onto the
  phone's raw gravity reading specifically to escape a real instability in
  the alternative (see 5.3.1's own entry), and every hand-worked case that
  reasoning was checked against still held — the actual bug was one level
  up: `accelerationIncludingGravity`'s sign convention (whether a phone
  lying flat, screen up, reports its z-axis reading as roughly +9.8 or
  roughly -9.8) is a genuinely, widely documented point of confusion across
  browsers and even reference docs, not something re-reading the same
  geometry again could have caught — only a real device actually saying
  which way it goes could, and this report is exactly that. One sign
  flipped, both directions re-verified against the same three hand-worked
  cases with the corrected convention, unit tests updated to match.
- **Trails are on by default now**, by request — every fresh visit shows
  them without needing to find the toggle first. Surfaced a real, if
  minor, gap while making the change: the orbit ring's trails-on dimming
  and the trail's own visibility were both only ever set from inside the
  same function a hover, a focus change, or the toggle itself already
  calls — never once at plain startup. Invisible while trails defaulted
  off (an undimmed ring and an invisible trail both looked identical to
  "not built yet"), but real now that the very first thing a visitor sees
  is trails already on — fixed by calling it once per planet right after
  creation too.

---

## 5.3.1

- **The Sun's lens-flare now shows on phones too.** It was specifically
  disabled on the `low` quality tier (any phone) as a performance
  precaution when it shipped in 5.1.x — but it's the same three.js
  `Lensflare` technique the `medium` tier already runs without issue, and
  `medium` already covers plenty of real phones (four cores or fewer, or a
  coarse pointer on a bigger screen), so there was never real evidence
  this tier specifically couldn't afford it.
- **AR mode no longer responds to drag at all.** It used to nudge a manual
  calibration offset — a second, touch-based way to move the view,
  fighting the sensor's own, on a phone held up to the sky. That read as
  the scene fighting itself rather than as two deliberate controls. AR is
  sensor-driven only now.
- **Fixed AR mode's altitude tracking losing its footing near the top of
  its range** — reported as "the scene tweaks out after pointing the phone
  all the way up" and "can't do one complete revolution without it
  misunderstanding directions." Root cause: `DeviceOrientationEvent`'s
  alpha/beta/gamma Euler decomposition is well documented to become
  unstable and can jump discontinuously exactly near beta = ±90° — which
  is this app's own default AR holding orientation ("magic window", phone
  upright, looking at the horizon), not a rare edge case. This is the real
  answer to "how does Google do it and we can't": native apps read a
  hardware-fused rotation vector as a quaternion, which has no such
  singularity, ever; the web's equivalent (the Generic Sensor API's
  `AbsoluteOrientationSensor`) exists on Chrome/Android but was never
  implemented by WebKit, so it isn't reachable from an iPhone regardless of
  which browser app wraps it. Altitude is now derived from the phone's raw
  gravity reading (`devicemotion`'s `accelerationIncludingGravity`)
  instead, whenever that's available — a signal that never passes through
  the unstable Euler decomposition at all, verified against the same three
  hand-worked geometric cases the old formula was checked against, with
  the old formula kept as an automatic fallback for devices or permission
  states where motion data isn't available. Heading is a separate problem
  (a fully gravity-and-magnetometer "tilt-compensated" heading needs a raw
  magnetometer reading the web doesn't expose) and is unchanged; iOS's own
  `webkitCompassHeading`, already in use there, is Apple's own internal
  computation and was not implicated by this specific report. Reasoned and
  unit-tested against hand-worked cases, same standing caveat as the rest
  of this module: not yet confirmed against the real device that reported
  the bug.
- **Trail-visibility tuning**, both from direct feedback on 5.3.0: the
  plain white orbit ring now dims to roughly a third of its usual
  brightness while trails are on, so the colour-tinted trail is what
  actually draws the eye instead of the two competing at similar
  brightness; and focusing a planet now hides only *that* planet's own
  trail (its recent path underfoot isn't the point when you're looking
  straight at it) while every other planet's trail stays visible, the
  opposite of the ring's own "hide all of them on any focus" rule.

---

## 5.3.0

- **Planets can leave a trail behind them on their orbit.** A new "Trails"
  toggle in the scene drawer (and the phone's own toggle column) puts a
  short, fading arc behind each planet — 9% of its orbit, tinted the same
  half-strength colour the orbit ring already turns on hover, tapering to
  nothing at the tail. Built from the same 256-point orbit sample the
  static ring already draws (a nearest-point search against the planet's
  live position, then a fixed run of samples immediately before it,
  rescaled for whichever distance mode is active) rather than a recorded
  position history, so the trail is instantly the right shape and length
  the moment the toggle turns on instead of growing in from nothing. The
  taper is colour only, not width — plain WebGL lines are always 1px, and
  this codebase already tried fat lines for the gravity-field overlay and
  reverted to a hairline; a fading hairline reads as tapering off well
  enough against the black background without repeating that experiment.
  Toggling fades in/out over the same ~1.2s the 5.2.5/5.2.6 orbit-fade
  work already established, not a hard cut. Verified past the "does the
  code look right" stage: a temporary debug hook confirmed the exact
  vertex count, an exact position match between the trail's head and the
  planet's own live position, and a proper colour ramp; then a pixel-level
  check — projecting real trail vertices through the live camera to
  screen coordinates and sampling those exact pixels in a screenshot —
  confirmed a genuine warm reddish tint fading smoothly to neutral dark
  along Mars's own trail, not just correct data sitting unrendered. Both
  removed before this commit.

---

## 5.2.7

- **The Sun now lands upper-left, not dead centre above the body, when
  focusing anything at true distances + sizes — and every focusable body
  gets this framing now, not just planets.** The 5.2.0 fix that put the
  Sun in the shot only offset the camera straight along a "lift" axis that
  reduces to almost exactly world-up for any near-ecliptic body, landing
  the Sun at screen "12 o'clock" every time — the body reading as
  eclipsing the Sun rather than sharing the frame with it. The offset now
  blends in a horizontal component too, moving it to "10 o'clock", and the
  exact ratio between the two is the same for every body (only the
  underlying 3-D directions change with where the body actually is) — the
  sign that lands on-screen *left* rather than right was checked against a
  real render, not assumed from the vector math. Also broadened from
  planets-only to every non-probe, non-Sun body, so a focused moon, dwarf
  planet, asteroid or comet gets the same treatment a planet already did.
  Confirmed in headless Chrome across five bodies (Mars, Europa, Ceres,
  Vesta, Pallas): the Sun lands upper-left for all of them, though small
  bodies — whose orbits sit at higher and more varied inclinations than a
  planet's — shift by a smaller margin than planets and moons do; a real
  consequence of the fixed reference axis this offset is built from, not
  a bug.

---

## 5.2.6

- **Fixed the ISS's selection ring dwarfing Earth (and the Moon) at true
  distances + sizes.** The billboard ring that highlights the ISS when
  Earth is focused (`RingGeometry(0.152, 0.216)`) was built once at a fixed
  size and never touched again — fine at compressed distances, where
  everything else on screen is also at a fixed compressed scale, but at
  true sizes every *body* shrinks toward its real proportion of the scene's
  unit scale while this ring stayed exactly as large as before, so it
  ended up dwarfing Earth, the Moon, everything. It's now scaled by the
  same factor the ISS's own model already uses to shrink for true sizes,
  so the ring stays sized *relative to what it's highlighting* instead of
  fixed in absolute scene units. The actual ISS orbit-path line had the
  same bug, less visibly (a thin line rather than a filled ring) — fixed
  the same way, scaled by the same factor its own orbital distance uses.
  Confirmed numerically, not just by eye: the ring's effective radius at
  true sizes drops from a fixed 0.216 scene units to about 2×10⁻⁷,
  matching the ISS's own true, minuscule share of the scene.
- **The orbit-path fade from 5.2.5 now takes about twice as long** (~1.2s
  instead of ~0.6s) to reach a body's usual resting opacity.

---

## 5.2.5

- **Orbit paths now fade out when you focus a body, instead of vanishing
  on the same frame.** `orbitAtRest()`/`orbitHovered()` used to write
  straight to each ring's `material.opacity`/`color` — fine for a single
  hovered ring, but the moment something is focused, every ring in the
  scene (planets, small bodies, the Voyagers' flight tracks — sixteen or
  more) snapped to invisible on the same frame, which read as the whole
  scene flickering rather than a deliberate "getting these out of your
  way". Both functions now only set a target; a per-frame step eases
  `material.opacity`/`color` toward it (a plain time-based ease, ~90% of
  the way there in a quarter second), so a focus transition and an
  ordinary hover both read as a fade rather than a snap. Confirmed via a
  temporary debug hook sampling every orbit's live opacity right after
  focusing Earth: a clean decay from 0.27 to under 0.001 over ~600ms,
  removed before shipping.
- **Stashed the "What's up tonight" nav icon**, on both the desktop header
  and the mobile burger menu — not deleted: the `/tonight` route, its
  page, and its own header entry all still work for a direct link, only
  the two navigational entry points into it are gone for now.

---

## 5.2.4

- **Fixed the night sky lurching mid-drag on a phone.** Reported from an
  iPhone 15 (Chrome/iOS): spinning around to find north would make the view
  jump unpredictably, as if the drag kept losing track of itself. It was —
  `/sky`'s look-around handler tracked "am I dragging" as a plain
  yes/no, not *which* touch started the drag, so a second, incidental touch
  landing mid-gesture (a palm edge, a second finger brushing the glass —
  exactly the kind of thing a fast spin invites) reset the drag's reference
  point to the new touch's position without ending the first touch's drag.
  The first finger's very next move was then measured against the wrong
  origin: one large, wrong step, which read as the sky lurching. Fixed by
  tracking the actual pointer ID the drag started with and ignoring any
  other pointer's events until it lifts — confirmed against a simulated
  mid-drag second touch in headless Chrome, which no longer perturbs the
  heading at all. Note this is the touch-drag control specifically, not
  the AR sensor-tracking path 5.2.3 already tuned separately — the two
  share no code.

---

## 5.2.3

- **Fixed: leaving the night sky flew back down onto a focused Earth
  instead of reversing the dive out.** The back button called
  `navigate(-1)`, which pops browser history — and the entry cinematic's
  own navigation left `/object/earth` sitting right underneath `/sky` on
  that stack (armed from wherever you started, it visits `/object/earth`
  first and only reaches `/sky` after the dive), so leaving landed back on
  a freshly re-focused Earth and replayed the *ordinary* focus fly-in from
  the wide solar-system view. It now navigates straight to `/`. The scene
  already had everything needed to reverse the dive instead: unmounting
  while a body is still focused snapshots the live camera position so a
  remount can play an exit animation from it — built for React Router
  remounting the scene unexpectedly, but it turns out to describe exactly
  this case too, since `/sky` living on its own route means the dive
  genuinely does unmount the solar-system scene mid-flight. Landing on `/`
  unfocused is what lets that existing mechanism fire, pulling back from
  Earth's surface to the wide view instead of flying in from it.
- **Reworked the night sky's compass pointer, and fixed why it read as
  lopsided.** It was a fixed triangle that happened to sit beside the "N"
  label only at a heading of exactly zero — turn at all and the ring (with
  its N/E/S/W letters) rotates on as it always has, while the triangle
  stays put, no longer next to anything, which is what read as broken
  rather than just plain. Redrawn as a lubber line — the term an actual
  ship's or aircraft's compass uses for exactly this: a mark fixed to the
  rim showing your own current heading, which the rotating card of
  direction letters turns past underneath it. Straddling the rim with a
  short stem toward the centre reads unambiguously as a fixed mark on the
  dial's edge, in a way a small floating triangle didn't.
- **AR mode: the sky tracking the phone should no longer feel jumpy in
  bursts and laggy in between.** Both turned out to be the same underlying
  bug. The heading/altitude smoothing was a flat 15%-per-*event* average,
  not a real time constant — fine on the assumption that sensor events
  arrive at a roughly steady rate, which in practice they don't: real
  devices batch and throttle them under exactly the load this feature
  itself creates (camera passthrough, WebGL and sensor processing all
  competing for the same main thread), so the gap between two events
  swings from a few milliseconds to several hundred. A flat per-event
  weight bakes in a *different* effective response time every time that
  gap changes size — a burst of closely-spaced events let raw sensor noise
  through nearly undamped (jumpy), while a gap left the average stuck
  until several more flat-weighted steps clawed it back to wherever the
  phone actually was (laggy). Smoothing is weighted by the real elapsed
  time between samples now, so a burst is correctly damped (barely any
  real time passed) and a gap is correctly caught up in one larger step
  (a lot did) — collapsing both symptoms into one fix. Also moved the
  camera update itself off the raw sensor-event callback and onto the
  render loop, reading whatever the current smoothed value is once a
  rendered frame rather than once a sensor sample — sensor events don't
  arrive in step with rendered frames, so applying every single one was,
  at best, work the display could never show and, at worst, several
  updates landing inside one visual frame whenever they happened to clump.
  Verified against a real browser (synthetic sensor events over CDP, with
  genuine timing gaps rather than a fixed dispatch interval) rather than
  only the unit tests — but, as this module's own header has said since
  the AR viewer first shipped, not yet against real hardware.

---

## 5.2.2

- **Fixed: focusing a distant body used to visibly centre on the Sun before
  swinging round to the actual target.** The camera's look-AT point was
  lerped through raw 3D space from wherever `controls.target` last was to
  the new body. Idle at the wide home view, that target eases toward the
  origin — which is exactly where the Sun sits — so a fresh focus from
  there started this lerp *at the Sun*, and for a real stretch of the
  flight the camera aimed at a point on the straight line between the Sun
  and the new body, which for the first chunk of that line *is* the Sun.
  Replaced with a quaternion slerp between two orientations that both
  already look at the target — one from the start camera position, one
  from the landing spot — so the body stays roughly in view for the whole
  flight and the Sun is never an accidental waypoint. Two positions that
  are genuinely far apart in parallax (planet to planet, mostly) still
  rotate smoothly rather than cutting; a home-view launch, which had no
  strongly-anchored gaze to preserve continuity with anyway, just starts
  already facing the destination.
- **True distances + sizes: focusing a planet now frames the Sun in shot,
  off to one side — the same treatment the Voyagers and New Horizons
  already had.** Once a planet's own true-sized disc is dwarfed by its
  true-distance orbit, "keep the user's approach azimuth" has exactly the
  probes' old problem — it can land the camera looking at empty sky — so
  planets get the probes' fix there too: sit beyond the body on the far
  side from the Sun, lifted 12° off that line so the Sun isn't dead centre.
  Only in that one mode; every other layout is unchanged.
- **The same true-sizes flight now takes 2.4s instead of 1.2.** However
  well the previous release eased its final stretch, doing a 20,000×-plus
  zoom (Earth's, roughly) in the same time it takes to cross a planet's own
  diameter still read as a flinch. Longer specifically at that stage, not
  generally.
- **Fixed: Saturn's ring shadow covered half the ring instead of the strip
  actually behind the planet, at true sizes.** The shadow shader compares
  each ring point's distance from the Sun-Saturn line against Saturn's own
  radius — and that radius uniform was set once, to the *drawn* 3.56 units,
  and never updated. At true sizes the ring itself (a child of the same
  scaled group as the planet) shrinks to a few hundredths of a unit, so
  every point on it fell inside the now wildly stale 3.56-unit test radius,
  and the shadow term was 1.0 across the entire Sun-facing half rather than
  the narrow ellipse actually behind the disc. The uniform now updates
  every frame alongside Saturn's already-live world position.

---

## 5.2.1

- **Fixed: flying to a true-size body felt like it slammed to a stop.** The
  fly-in interpolated raw camera *position* — start point to end point,
  cubic ease-in-out — which decelerates smoothly in absolute scene units.
  That was unnoticeable while every landing distance sat within an order
  of magnitude of where the flight began, but true sizes can land the
  camera thousands of times closer than its start (Earth's is ~23,000×).
  On a linear path, easing the raw distance smoothly to zero still leaves
  nearly all of the *relative* closing — the only part the eye actually
  tracks — compressed into the last handful of frames: measured against
  the old code, the frame-to-frame distance ratio sat around 0.7–0.9 for
  most of the flight and then collapsed to 0.17–0.5 in the final three or
  four frames.
- Distance from the target now eases in log space instead — the camera
  closes by the same *ratio* on every step of eased progress, not the same
  absolute amount. Direction is still a simple lerp between the start and
  end offsets (azimuth was already preserved, so the two rarely differ by
  much). Measured the same way, the new final-stretch ratios climb
  smoothly toward 1.0 (0.92 → 0.96 → 0.98 → 0.996 → 0.999) instead of
  collapsing, which is what actually reads as a landing rather than a
  lurch. Falls back to the old plain lerp if either endpoint sits on the
  target itself, which never happens in practice but would make log
  distance undefined.
- Applies to every fly-in, not just true-size ones — the improvement is
  only visible where the zoom ratio is large, so ordinary compressed-layout
  focusing looks unchanged.

---

## 5.2.0

- **True sizes, as a third setting on the distances toggle.** The layout
  control is no longer on/off but a three-stage cycle — compressed
  distances → true distances → true distances *and* sizes — mirroring the
  gravity pill beside it, which has carried its state in its own label
  since 4.0. Stage two is unchanged from what shipped in 2.0. Stage three
  puts the entire scene on one scale.
- **It is deliberately merciless.** One scale means a scene unit is 1.56
  million km, so Earth is four thousandths of a unit across while its orbit
  is ninety-six. Every body in the scene falls far below a pixel from the
  default view and what is left is orbit rings, labels and a great deal of
  nothing. There is no minimum dot size propping it up — that emptiness is
  the honest picture of the solar system, and the way to see anything in it
  is the way it has always been: fly to it. Focus a body and it grows into
  its real proportions, with its moons at their real separations. The ISS
  ends up skimming Earth's surface, which is where it actually is.
- The real radii come out of `objectCatalog.js` rather than being written
  down a second time (`utils/trueSize.js`) — the scene and the object page
  beside it now cannot disagree about how big Jupiter is. Diameters are
  halved on the way through; the handful the catalog states in a shape
  nothing can parse (Haumea's three axes, Halley's nucleus, the ISS) have
  named fallbacks. A test pins that every body the scene draws resolves to
  a real number, so a reworded stat row fails loudly instead of quietly
  dropping a body back to its drawn size.
- Two things do not shrink, for the same reason the labels don't. Hitboxes
  hold a constant angular size, so a planet that is now a speck is still
  the same click target it always was — the Sun gained one of its own,
  since it had been relying on being twelve units wide. And the probe
  markers stay markers: a spacecraft's true size is a rounding error
  against Phobos, and those are wayfinding rather than anything claiming to
  be to scale.
- Focus framing follows the stage. Every focus distance was tuned against
  the drawn radii, so it is taken down by the same factor the body was,
  and a body fills exactly the fraction of the frame it always did from
  proportionally closer in. Changing stage while focused brings the camera
  with it rather than leaving you parked three units off something four
  thousandths of a unit across.
  - The per-frame follow could not be the authority on that: a load
    arriving straight into a focused body spends most of the transition
    with the main thread decoding textures, and the whole 2.2 seconds can
    pass in four frames. The framing is settled from a stored distance once
    the stage stops moving *and* the fly-in has landed, which is what makes
    a shared link into stage three land correctly.
- Shared links carry the stage: `scale=sizes` alongside the `scale=true`
  that older links already use, which keeps its old meaning.

---

## 5.1.9

- **The focused-object overlay steps aside for the /sky dive.** The
  cinematic gets to Earth by focusing it, which brought this page's whole
  focus treatment along for the ride: the description card sliding in over
  the shot 1.5s in, the name and stats flanking it, the "click a moon"
  hint, the back button, and on a phone the detail sheet's peek card. All
  of it now fades or slides out for the length of a dive, on both layouts.
  `CategoryBrowser.jsx` mirrors the `skyEntry` phase into state the same
  way it already mirrors scale and viz mode; the panel-opening effect takes
  it as a dependency, which is also what closes a description that happened
  to be open already when the dive started (arming while focused on Earth
  doesn't change `id`, so nothing else would have).
  - The back button needed its `animate-fade-in` class dropped rather than
    just an inline `opacity: 0`: the keyframes are `both`-filled, so they
    pin opacity at 1 and win against the inline style.
- **Re-timed the dive so it reads as a descent.** The approach and the turn
  shared one progress value, so the view swung off the planet while the
  camera was still a long way out — Earth left the frame around a third of
  the way in, and the shot spent its last second and a half pointed at
  empty space with the planet behind the camera, UI still up, waiting for
  the curtain. The turn now holds off until the descent is under way and
  the camera finishes on the same look direction `/sky` itself opens at
  (due north, 55° up) instead of straight up the local normal, so the
  curtain is covering a cut between two frames that already match.
- **The curtain now starts while the camera is still moving.** It used to
  wait for the motion to finish, which is what put a dead beat on the end.
  It begins its fade at the point where the view comes level with the
  horizon and the ground still fills the bottom of the frame; the ground
  drops away behind the fade rather than in front of it.
- Hover height at the end of the dive is bounded by the camera's near
  plane — 1 scene unit against Earth's 1.31 radius — so it stops at 0.85
  radii above the surface. Closer would clip the ground out from under the
  camera mid-shot rather than filling the frame with it.

---

## 5.1.7 – 5.1.8

- **A camera lens-flare on the Sun, added and then brought under control.**
  5.1.7 gave the Sun a proper camera-glare — a bright core, a tapering
  horizontal streak, and a trail of small coloured "ghost" elements — built
  on three.js's own `Lensflare` object rather than a custom shader. It hangs
  off `mainLight` and needs no per-frame code of ours: three.js tracks its
  screen position and occludes it against nearer geometry entirely through
  `Object3D.onBeforeRender`. The textures — the halo, the streak, four
  polygonal ghosts — are drawn on `<canvas>` (`utils/lensFlareTextures.js`),
  the same way every planet and moon surface already is, rather than shipped
  as image assets. One bug was fixed on the way in: the Sun's own opaque
  sphere sat exactly at the flare's light position, so its near-facing
  surface failed the flare's built-in occlusion probe every frame — the
  flare rendered at ~3% visibility, in effect invisible — fixed with
  `depthWrite: false` on `sunMat`. Gated behind the quality tier: on for
  medium and high, off for the phone tier.

  It shipped far too hot. The halo element was 420px at full opacity,
  landing additively on a Sun already white-hot under five `GLOW_LAYERS`
  shells, blowing out the middle of the frame and hiding the Sun's own
  surface texture behind a featureless white ball. 5.1.8 brought it down —
  halo to 220px and roughly half as opaque, streak dimmer and shorter,
  ghosts pulled back to about a third of their old opacity — and fixed the
  streak itself rendering as a hard-edged grey rectangle (`fillRect` with a
  horizontal-only gradient; now a vertically squashed radial gradient with
  no edges to notice). It also replaced the `depthWrite: false` fix: dropping
  the Sun out of the depth buffer stopped it occluding its own flare, but
  also let the Milky Way sphere and background stars draw over its disc.
  Normal depth behaviour is back; the flare now hangs off its own
  `Object3D`, repositioned each frame onto the camera-to-Sun line just clear
  of the surface — same screen position, the Sun can no longer occlude it,
  and a planet crossing in front still snuffs it out correctly.

---

## 5.1.6

- **Fixed: a focused planet's description card was blocking clicks on
  whatever was behind it, across the full width of the screen.** On
  desktop, the description panel that slides down 1.5s after focusing any
  object (`CategoryBrowser.jsx`) was `position: absolute; left: 0; right:
  0` — full viewport width — with `max-w-2xl mx-auto` two levels further
  in centering only the *visible* glass card inside it. Neither that outer
  box nor its padding wrapper had a `pointer-events` override, so their
  invisible margins (everything outside the narrow card, on both sides)
  sat at z-index 6 over the scene canvas and silently absorbed clicks —
  hovering still worked (the scene's own hover-highlight isn't scoped to
  the canvas), so a planet at the edge of the screen looked perfectly
  clickable and simply wasn't, for as long as the description happened to
  be open, which is by default and indefinitely.

  `max-w-2xl mx-auto` moved onto the outermost box itself, so its own
  hit-testable footprint now matches the visible card (672px, centered)
  instead of the full viewport; `pointer-events: none` on that box and its
  padding wrapper, `auto` only on the `.glass` card, the same
  none-outside/auto-on-the-real-content pattern `AppShell.jsx`'s own
  header already uses. Verified in headless Chrome: a point well inside
  the old dead zone (outside the 672px card, inside the old full-width
  box) now resolves to the canvas via `elementFromPoint`, not the wrapper.

---

## 5.1.5

- **A first-visit hint for the new burger menu.** 5.1.4's mobile header
  collapse traded five always-visible icons for one that now has to be
  discovered — a coach mark ("Language, sharing and more", arrow pointing
  up at the button) fixes that, on mobile only, shown once. Same shape as
  `NightSkyPage.jsx`'s own single-target coach mark, including the "no
  timer, no nag" rule every coach mark in this codebase follows: a stored
  flag (`p4rsec.coachMenu`) means seen, but a plain 8-second fade doesn't
  set one, so a visitor who glanced away gets another chance next visit.
  Opening the menu yourself ends the hint immediately and does persist —
  `HeaderMenu.jsx` gained an `onOpen` prop firing only on the transition
  into open, mirroring `ScenePanel.jsx`/`NightSkyPanel.jsx`'s own
  onOpen-ends-the-hint convention exactly. Verified in headless Chrome
  end-to-end: appears on a fresh visit, disappears and persists the moment
  the burger is tapped, stays gone after a reload.

---

## 5.1.4

- **Fixed the mobile header overflowing, by collapsing its icon row into a
  burger menu.** At a ~390px viewport the six 36×36 header buttons
  (language, share, tonight, sky, compare, search) plus the wordmark
  genuinely overflowed the header's own width — confirmed with
  `getBoundingClientRect()`, not just eyeballed: the search button's right
  edge landed measurably past the viewport edge, on every route (the
  header is one component, `AppShell.jsx`, shared everywhere). Below the
  `(max-width: 767px)` breakpoint (`useIsMobile()`, already used elsewhere
  in the same file), the first five now collapse behind a `Menu` icon;
  search stays its own always-visible button next to it, since it's likely
  the most frequently reached-for of the six and already replaces the
  whole row with a full-width input when opened — nesting it too would
  cost every search an extra tap for no benefit. Desktop is byte-for-byte
  unchanged, gated on the same `isMobile` check.

  New `components/HeaderMenu.jsx` mirrors `LanguagePicker.jsx`'s own
  "36×36 glass button that opens a dropdown hanging off itself" shape —
  down to reusing its exact outside-pointerdown/Escape close handling —
  rather than the edge-anchored vertical drawers `ScenePanel.jsx`/
  `NightSkyPanel.jsx` use elsewhere, whose geometry is built around sitting
  flush with a scene's vertical edge and doesn't map onto a header row
  item. `LanguagePicker` itself gained a `variant="row"` prop so it can sit
  as one more full-width labelled row inside the burger panel instead of
  looking like a stray square icon among the other four — language-
  switching logic itself stays defined in exactly one place either way.

  Verified in headless Chrome: the overflow is gone (`maxRight: 391` at a
  411px viewport, down from `428`), every menu interaction works (open,
  outside-click close, Escape close, tapping a row both navigates and
  closes the menu), desktop shows the original six-icon row unchanged, and
  Arabic (RTL) mirrors correctly with zero RTL-specific code needed — the
  existing logical properties (`insetInlineEnd`, `text-align: start`) and
  ordinary flexbox already flip under `dir="rtl"` on their own.

---

## 5.1.3

- **Fixed AR's look-down "drag" — the view froze at -10° instead of
  following the phone down.** `skyRotation.js`'s altitude floor
  (`ALT_MIN`, -10°) was never meant for AR at all: it exists so dragging
  the *virtual* dome can't run past its rendered ground hemisphere into
  empty space below. AR mode's camera feed has no such floor — the real
  ground just keeps going — but `setLookDirection()` clamped to it anyway,
  since it's the same function both modes call. The result was exactly
  what got reported: tilt the phone down, the rendered view stops at -10°
  while the sensor keeps reading further down; tilt back up, and the view
  has to cross that whole gap before it starts moving again, reading as
  the sky "dragging" back into place rather than tracking the phone
  directly. `setLookDirection(az, alt, altMin, altMax)` now takes an
  optional range, defaulting to the existing -10°/90° for every caller
  except AR mode's own device-orientation subscription, which passes
  -90°/90° — the full look-straight-down-at-your-feet range a real camera
  feed can actually support. Verified in headless Chrome by sweeping
  synthetic tilt events from level down to -70° and back: altitude now
  tracks the input exactly at every step, no dead zone, no catch-up lag.

---

## 5.1.0 – 5.1.2

- **An AR constellation viewer for /sky, built in three milestones.** The
  goal: point a phone at the real sky and see constellation lines, names,
  and Sun/Moon/planet markers line up with it live, oriented by the
  device's own compass and tilt rather than a drag gesture — "compass AR,"
  not WebXR (no iOS Safari support for `immersive-ar` at all).

  **Milestone 1 (5.1.0)** shipped the capability gate, the permission flow
  and the camera compositing, deliberately not sensor-driven yet: a new
  icon button, shown only on a touchscreen device exposing both
  `DeviceOrientationEvent` and `getUserMedia`, opens an explainer card, then
  requests iOS's gesture-gated orientation permission before the camera's.
  Once granted, the already-transparent star/constellation renderer
  composites over the live feed with no shader changes.

  **Milestones 2 and 3 (5.1.1)** made it actually compass-driven:
  `utils/deviceOrientation.js` turns `DeviceOrientationEvent` into the same
  azimuth/altitude the drag control already accepted — nothing downstream
  needed to change, since none of it knows or cares that the numbers now
  come from a sensor. Heading prefers iOS's own `webkitCompassHeading`,
  falls back to Chrome/Android's `deviceorientationabsolute`, then to
  best-effort relative `alpha` absorbed by a manual calibration offset.
  Magnetic declination is corrected to true north via the `magvar` package.
  Two real bugs were caught by testing rather than shipped blind: a
  mirrored heading formula (the East component needed its sign dropped, a
  fix confirmed by four independent fixtures agreeing at once), and
  headless Chrome's own device-orientation emulation dispatching an empty,
  all-null event before real values arrive — which a naive handler
  processed as a real, wrong altitude and let corrupt the smoothed state
  for every real sample after it.

  **Milestone 4 (5.1.2)** closed it out: an additive halo behind each
  marker (sharing the core dot's own position/size/colour buffers, so the
  two can never drift apart) so it doesn't wash out against a bright real
  Moon or a streetlight in the feed; a 1.7× opacity boost on constellation
  lines, since a real camera image carries more visual texture than a flat
  black canvas; the star count capped to the low device tier's own budget
  regardless of what tier a device otherwise qualifies for, since decoding
  a live camera feed is real cost the scene's tiers never accounted for;
  and AR made portrait-only with an actual guard — a landscape hold shows a
  "rotate your phone" nudge rather than a silently misaligned sky, since
  `beta`/`gamma` are reported relative to the device's physical frame and
  getting that compensation right for both iOS and Android needs a real
  device.

  Built and shipped without a real-device round trip past milestone 1, at
  the user's own request — the entire `webkitCompassHeading`/
  `requestPermission()` path has no headless-Chrome equivalent at all, so
  whether it actually points at the real sky stayed an open question until
  it could be checked against one. Everything CDP-testable was tested at
  each stage; the `whatsNew.js` announcement was deliberately left
  unwritten until then.

---

## 5.0.13

- **The timeline pill's date is now a picker, not just a readout.** Click it
  and the browser's own calendar opens — via `showPicker()` on a real but
  invisible `<input type="date">` sitting behind the visible, locale-
  formatted text, rather than swapping the text itself for the date input's
  own browser-locale rendering. Picking a day keeps whatever hour the
  simulated clock already had (a date picker only knows about the calendar
  square, not the clock face, so it borrows the current time of day rather
  than zeroing it to midnight) and jumps straight there via `setSimTime()`,
  the same call the scrubber's drag ends up at. Bounded to the scrubber's
  own ±10-year reach (`RANGE_DAYS`) via the input's `min`/`max`, so the
  picker never offers a date the slider itself couldn't represent.

  The pill also now shows the clock face, not just the calendar date: an
  hours-and-minutes readout sits right next to the (now-clickable) date,
  in both the live and scrubbed states. Previously the hour only ever
  showed up while live (`"02:41 AM, live"`, folded into the second line);
  scrubbed away from live, the pill told you the date, the rate and how
  far you'd moved, but never the time of day you'd landed on. Promoting it
  to sit beside the date — true in both states — meant the second line no
  longer needed to carry it itself, so live there now just reads "Live"
  and the now-dead `time.liveAt` locale key is gone from all three
  languages.

---

## 5.0.12

- **The timeline pill is back on /sky.** 5.0.2 removed it outright on the
  reasoning that a view meant for looking didn't need a scrub control in
  the way — true as far as it went, but `utils/simTime.js` is a site-wide
  singleton, so a date left scrubbed on the solar-system page (or scrubbed
  on an earlier /sky visit — the clock doesn't reset on navigation) carried
  straight into the night sky with nothing on screen to explain it or wind
  it back. Restored the exact mount 5.0.2 deleted, `<TimeControl />` in
  `NightSkyPage.jsx`, so the sky you're looking at is never a mystery and
  "Live" is always one tap away.

---

## 5.0.11

- **The Milky Way skysphere was too small for true distances.** It has
  always been a fixed 8,000-unit sphere, sized for the compressed layout's
  own scale (Pluto's ring sits at 410 units there). True distances puts
  Voyager 1 and 2 out around 165-170 AU — 16,000+ scene units, at 96 units
  per AU — so focusing either probe put the camera well outside the sphere.
  A `BackSide` material only draws from inside, so the camera crossing that
  boundary made the whole backdrop vanish: a flat black void instead of the
  Milky Way. Now scaled up to 24,000 units over the same transition that
  already drives `controls.maxDistance` and the camera's far plane, which
  also had to move out from 30,000 to 50,000 so it does not clip the larger
  sphere. The geometry itself is untouched — this is a mesh scale, not a
  rebuild, so it costs nothing per frame.

---

## 5.0.7 – 5.0.10

- **Four releases finding the real shape of the /sky compass HUD.** 5.0.7
  dropped the "Roll" line from the readout (this scene never introduces
  roll, so it was always a static, uninformative 0°) and stopped the
  N/E/S/W letters tipping over as the dial turned, by counter-rotating each
  glyph in its own inner span. That inner span broke the layout in 5.0.8:
  `.sky-compass-ring span` was a descendant selector rather than a
  direct-child one, so it also matched the new letter span and handed it
  `position: absolute` with no offsets of its own — an absolutely
  positioned element with nothing telling it where to sit escapes its
  parent's centring rather than inheriting it, exactly what the screenshot
  showed. Narrowed to `.sky-compass-ring > span` and the dial was centred
  again.

  5.0.9 then read the compass's remaining motion as the problem and
  redesigned it — fixed N/E/S/W, a needle sweeping to the current heading
  instead, the aircraft-heading-indicator convention — but that solved the
  wrong problem: measuring the dial's own bounding box across headings
  (the actual verification for that release) held heading steady enough via
  drag that the real bug never showed up. It was `.sky-compass-stats`, the
  heading/altitude text box, never reserving its own width: a change like
  `9°` → `10°` grew the box, and since `.sky-compass` sizes itself to its
  widest child and only pins its right edge, growth pushed the whole
  column — dial included — further left. That reads exactly like "the
  compass moving," rotating or not. 5.0.10 reverted the needle redesign
  back to the rotating-ring-with-upright-letters dial and fixed the actual
  bug: `.sky-compass-stats b` now reserves `4ch` with `text-align: end` and
  `tabular-nums`, wide enough for the longest values either field produces,
  so the box's own width — and everything centred above it — never moves
  again regardless of digit count.

---

## 5.0.6

- **The exit animation ended clean, then twitched — a sudden roll, on
  every single return home.** Two separate bugs, both born the same way:
  something kept quietly changing during the multi-second focus+exit round
  trip that idle drift's own logic assumed only ever changed *while idle
  drift itself was visibly running*.

  The camera's `up` vector is only ever touched by idle drift's own roll
  rotation and its "relax back to level" correction — both suspended the
  entire time anything is focused or exiting, by design, so a drag or a
  fly-in never fights the drift math for the camera. But suspended isn't
  reset: `camera.up` stays frozen at whatever small residual roll idle
  drift happened to leave it at the instant the reader clicked a planet,
  then sits untouched through however long they spend there. The exit
  measures roll error against the scene's *current* viewing direction, not
  the one that residual was measured against — and that direction has
  usually changed completely by the time you're heading back. A stale
  half-degree of "roll" no camera correction ever introduced suddenly read
  as real error the instant idle drift resumed, and got yanked toward
  level over a handful of frames. `camera.up` is reset to dead level at
  the moment the exit begins now, so idling never has anything stale left
  to correct once it resumes.

  Separately, `driftEase` — the ramp idle drift's on/off toggle eases
  through, so flipping it doesn't cut motion instantly — kept lerping
  toward its target on every single frame regardless of whether idle
  drift was actually allowed to show, the same "kept changing while
  nobody could see it" shape as the roll bug. A focus+exit round trip
  easily outlasts the ~1s the ramp needs to finish, so by the time idle
  drift resumed, the toggle's ramp had already quietly completed in the
  background — drift came back at full strength in one frame instead of
  the fade-in the ramp exists to provide, adding a sudden pan onto the
  same moment as the stale-roll correction. `driftEase` now only advances
  while idle drift can actually apply, so the ramp is still mid-flight,
  not silently finished, whenever idling actually resumes.

  Confirmed by instrumenting the roll error directly rather than by eye —
  it read 0.24° at the first idle-drift frame after a Neptune round trip
  before this fix, and exactly 0.000° after, with drift on and with it off
  alike.

---

## 5.0.5

- **The 5.0.3 exit animation snapped at the very start; now it doesn't.**
  `exitPhase === 1` set `controls.minDistance = 30` unconditionally, every
  frame, the moment the pull-back began — but the cubic ease-in-out that
  drives the eased distance starts slow by design, so for the opening
  stretch the animation's own intended distance was *below* 30.
  `controls.update()`, called right after, clamps `camera.position` to
  `minDistance` unconditionally as part of its normal spherical-coordinate
  bookkeeping — not only in response to a drag — so it silently overrode
  the eased value with a hard floor of 30 for as long as the ease curve
  stayed under it, then let the real animation take over once it caught up.
  The old two-stage version had the same unconditional `minDistance = 30`,
  but its linear pull-back cleared 30 in about three frames — under 50ms,
  short enough to read as nothing. Sharing one slow-starting ease curve for
  the whole motion is what stretched that into a visible snap.

  `minDistance` now tracks the animation's own in-flight distance each
  frame (`Math.min(30, nextDistance)`) rather than jumping to its final
  value up front, so the clamp can never sit ahead of where the ease curve
  actually is. Confirmed frame-by-frame (not by eye) that the distance
  `controls.update()` renders now matches the eased value exactly from the
  first frame — no gap for a clamp to open up in.

---

## 5.0.4

- **The night sky's star density now starts at 50%, not 100%.** A first
  visit to /sky used to show the full tier budget of stars right away —
  `utils/nightSkySettings.js`'s own `density` default was `1`. A visitor
  who wants the full sky still gets it, one drag of the settings drawer's
  slider away; the starting point is just less overwhelming.

---

## 5.0.3

- **The zoom-out back to the solar system, from a focused planet, is one
  motion now instead of two.** It used to be a fixed-speed 0.8s pull-back
  — camera backing straight off the planet, still looking at it, target
  frozen — handing off to a separately-eased "fly to the sun" stage that
  re-eased distance from scratch while the target slid to the origin. The
  handoff between them was the seam this was reported against, on top of
  the sky-entry approach fixed the same way in 5.0.2.

  The two stages don't merge as cleanly as the sky-entry dive did, though —
  a first attempt reused the sky-entry's own trick (freeze a direction once
  at the start, lerp everything toward it) and broke on the very case it
  needed to handle: a direction taken from the camera's position relative
  to the planet is, for any planet that isn't near the observer's own
  vantage point, *also* very nearly the direction from the sun through that
  planet — so a fixed end position sent the camera out along that same
  line and landed with the just-abandoned planet sitting directly between
  the camera and the sun on arrival, for every planet, not some skewed
  edge case. (Caught by comparing against the plain default home framing
  at the same simulated date, not by eye — the two didn't match.) The old
  fly-to-sun stage never had this problem because it recomputed its own
  direction fresh every frame from the live camera position as the target
  slid, rather than committing to one fixed at the start; that self-
  correcting recompute is what carried over, now driving a clean
  fixed-duration cubic ease (distance, direction and the recentring target
  together) instead of the asymptotic one it used to run on its own.

---

## 5.0.2

- **Three more /sky requests.** The timeline pill — the date/scrub control
  every other 3D view shares — no longer shows there; it stayed mounted
  since 4.7.0 on the reasoning that a date set on /sky should still be set
  back on the solar-system page (`utils/simTime.js` is a site-wide
  singleton either way, so that's still true), but the control itself was
  in the way of a page that's meant to be looked at, not scrubbed. Removed
  outright rather than passed `hidden`, since nothing on /sky ever needs it
  shown.

  Constellations are searchable from the header's search bar now, matched
  by Latin name or IAU code (`ori`, `uma`) alongside the catalog objects
  that search already covered, each localized the same way the info card's
  own name is. A new small always-bundled `data/constellationNames.js` — 88
  `[iau, name]` pairs, hand-extracted from `constellationLines.json` and
  parity-tested against it — carries just the names global search needs
  without pulling /sky's full line geometry into every other route's
  bundle, the same reasoning that keeps that file itself lazy-loaded in the
  first place. Picking a result lands on `/sky?con=<iau>`, a query param
  rather than a route param since a constellation has no page of its own —
  `NightSky3D.jsx` picks it up once the catalog resolves (or immediately,
  for a second search while already there) and pans to it, the same as a
  click on the figure itself would.

  And 5.0.0/5.0.1's dive-and-turn is one motion now instead of two stitched
  ones: the camera closing in on the observer's spot and swinging to face
  outward run across the same single eased span (`utils/skyEntry.js`
  simplified from four phases to three — `armed → approaching → curtain` —
  to match), rather than a full approach finishing before a separate turn
  animation started from a fresh standing start. The seam between the two
  old stages was the "not smooth" part being reported; sharing one
  `skyApproachProgress` removes it by construction rather than papering
  over the handoff.

---

## 5.0.1

- **Four fixes and one addition, reported directly from using both /sky
  features.** The constellation hover highlight from 4.10.0 never actually drew: hovering
  correctly detected the constellation (the cursor turned to a pointer) but
  the highlight line mesh started life with an empty position buffer, and
  the frustum-cull check auto-computes a bounding sphere the first time it
  runs a frame — against that still-empty buffer, before any hover has ever
  happened — then never recomputes it once real segments are written in on
  each hover. Every highlight after the first was being silently culled
  against a stale, degenerate sphere. Fixed the same way this codebase
  already fixes it elsewhere (`gravityLines.js`, the probe tracks): skip the
  cull test rather than chase a recompute after every rewrite.

  The constellation info card now lists its named stars (locale-aware "A, B
  and C" via `Intl.ListFormat`, capped at eight — Ursa Major alone names
  fourteen) instead of just the single brightest one, answering "tell me
  more about this constellation" with more than a star count.

  And the 5.0.0 dive-and-turn had a snap: once the turn finished, nothing
  was overriding the camera for the ~460ms the curtain takes to fade
  opaque, so OrbitControls' own `update()` reclaimed it — its minDistance is
  still the ordinary "planet in frame" one, and the camera was sitting far
  closer to the surface than that, so it snapped straight back out to a
  wide Earth view for that whole gap before the curtain was dark enough to
  hide it. `SolarSystem3D.jsx` now holds the camera at the exact frame the
  turn (or an interrupted dive/turn) ended on until the component actually
  unmounts, rather than releasing control the moment the animation itself
  is done.

  Last, an actual addition rather than a fix: a constellation's own stars —
  the ones a strip in `constellationLines.json` actually connects, not the
  ~150 other background stars this catalog happens to file under the same
  IAU region — now render 50% larger than their magnitude alone would give
  them. Line-strip endpoints only ship `[ra, dec]` pairs, not HIP ids, but
  those are rounded from the exact same source float as each star's own
  catalog row (see `build-sky-catalog.mjs`), so matching a star against a
  `Set` of every strip's endpoints is an exact key lookup, not a fuzzed
  nearest-point search — done once when the catalog loads, not per frame.

---

## 5.0.0

- **A cinematic way into /sky.** Clicking the star icon, or "See it in 3D" on
  the Tonight page, used to be a plain route change — a cut straight from
  whatever you were looking at to the night-sky dome. It now plays as one
  continuous arrival: the solar-system scene focuses Earth (reusing the same
  fly-in every other planet already gets), dives the camera down to your
  actual saved location on the globe, turns it ~180° away from the ground —
  the way turning around after you've landed would — and only then hands off
  to /sky behind a curtain-fade, which is the one piece of the sequence built
  to survive the route change itself: mounted as a sibling of `<Routes>` in
  `App.jsx`, not inside any one route's element, so `navigate('/sky')`
  doesn't unmount the thing driving it. /sky itself opens already looking
  up, not at its usual near-horizon default, so the turn actually lands
  somewhere.

  The reason this earns the major version: it's the first time this app
  hands a camera off between two completely separate Three.js scenes — the
  solar-system canvas and the night-sky dome don't share a renderer, a
  camera, or even a coordinate frame (one is heliocentric, the other sits at
  the observer and never translates), and /sky is its own lazy-loaded route
  that unmounts the solar system outright. The curtain is what makes that
  gap invisible rather than something to solve exactly — a phase machine in
  the new `utils/skyEntry.js` singleton is the only state that has to
  survive the cut, and `SolarSystem3D.jsx` is left driving a camera only it
  has the means to move: the dive/turn targets are read off Earth's own live
  `matrixWorld` every frame (its rotation is briefly held still for the
  dive, for the same reason the chase camera already exists — a moving
  target makes a plain lerp toward it jitter), converted from the visitor's
  saved lat/lon with the same convention `SatelliteGlobe.jsx` already uses
  for the ISS ground track.

  Reachable from anywhere: with a location already granted, the icon works
  the same from the tracker, compare view or Tonight page as it does from
  the solar system itself — it arms the sequence and lands on
  `/object/earth`, which either continues an already-mounted scene or, from
  a route that doesn't have one, mounts a fresh one the ordinary way a deep
  link to any planet already does. Grabbing the camera mid-flight, refocusing
  onto a different body, or navigating away all fall back cleanly rather than
  fighting the interruption for control of the view, and a visitor who
  hasn't granted a location yet still gets the plain, instant navigation
  this used to be — there's nowhere real to dive to yet.
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
