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
