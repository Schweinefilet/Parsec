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

## 4.1.2

- **Drift, reworked.** Three fixes to yesterday's sliders at once:
  - **The labels follow a rolled view now.** They project against the camera,
    and the roll was applied after that projection had already run for the
    frame — so the scene tipped and the names stayed put. The camera's world
    matrix is refreshed before the labels are placed.
  - **No more limits, no more bouncing off them.** Pitch and roll ran between
    soft stops and reversed. They are now applied as free rotations of the
    camera about its own axes — pitch somersaults right over the poles, roll
    spins all the way round — and `controls.update` reads the drifted position
    back as its orbit, so a drag still picks up cleanly from wherever it left.
  - **Half speed.** The top of each slider's range is halved; a fully cranked
    drift is a slow tumble, not a fairground ride.

---

## 4.1.1

- **The drift sliders were dead to the touch.** The toolbar they sit in is
  `pointer-events: none` — so a drag that misses a pill still orbits the scene
  — and each pill opts back in for itself. The drift popover opened (its
  trigger opts in) but never re-enabled events for its own body, so the
  sliders took the click and did nothing with it. Fixed.

---

## 4.1.0

- **The idle drift is yours to set.** The view has always turned slowly on its
  own; a panel next to the Drifting pill now opens three sliders — yaw, pitch,
  roll — that shape it. Yaw is the turntable spin. Pitch swings the elevation
  between soft limits. Roll leans the whole scene and swings back, something
  OrbitControls will not do on its own (it keeps the horizon level by design),
  so it is an angle accumulated per frame and rotated onto the camera after
  the controls have had their say — and unwound to level whenever it is set
  back to centre, the drift is held still, or the pointer is on a body.

  Each slider is a signed rate; the settings persist. The old fixed drift is
  just the default slider positions, and "Held still" still stops everything
  in one click.

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
