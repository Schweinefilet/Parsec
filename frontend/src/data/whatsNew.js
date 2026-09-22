// Plain-language release notes — what shows in the panel behind the version
// number in the header. Newest first.
//
// Deliberately NOT run through the i18n key system: the entries are short,
// there are a lot of them, and forking them three ways would leave them
// drifting out of sync. The panel's own chrome (heading, close button) is
// translated; the entries stay in English.
//
// This is a curated view for a visitor — the full engineering changelog is
// CHANGELOG.md at the repo root. Add a line here only for something someone
// looking at the site would actually notice.

export const WHATS_NEW = [
    {
        version: '5.10',
        changes: [
            'A small GitHub icon next to the version number now links to the project’s source code.',
            'On a phone, "Go back" from a focused object now sits a bit further from the P4RSEC logo above it.',
            'On a phone, the language menu is now solid instead of see-through, so bright sky behind it no longer washes it out.',
            'Clicking away from the open language menu without choosing a language no longer leaves its button stuck in the enlarged, hovered look.',
            'The powers of ten in a focused object’s headline figures (the 10²⁴ in a planet’s mass) now count up along with the rest of the number instead of sitting still.',
            'Opening the language menu no longer makes the header’s row of icons swell and shrink, dragging the menu sideways, as you move down the list of languages.',
            'On a phone, Language now sits at the bottom of the burger menu, so its own dropdown no longer opens over the other rows.',
            'The Compare page has been taken down for now while it gets a visual rework.',
            'The site now always plays its full animations, even if your computer is set to reduce motion. That setting made the opening, starfield and panels look frozen on some PCs.',
            'The opening wordmark scrambles from the moment the page opens and resolves into P4RSEC once the solar system has finished loading — on a phone as well now. Building the solar system used to lock the phone up for the first couple of seconds, which stopped the scramble being drawn at all; that work is now spread across frames instead, so the opening plays properly and the first moments of the page are no longer frozen.',
            'The opening no longer briefly shows a second copy of the wordmark hanging off the left edge of the screen, and the lettering no longer drifts sideways as it decodes.',
            'Coming back from a focused object to the whole solar system is now a slower, calmer flight — it used to snap back to the Sun.',
            'Halley’s Comet is now framed side-on and far enough back to see the whole of its tails. At true sizes the camera used to fly to the nucleus itself, which left you inside the tail looking at a speck.',
            'The telescope in the opening logo no longer flashes on for an instant before the ciphertext starts decoding.',
            'The opening ciphertext now appears as soon as the loading screen does, instead of turning up a few seconds in and being over at once.',
            'The two bodies on the Compare page no longer have a coloured halo around them.',
            'The opening screen now arrives as a line of ciphertext that decodes, letter by letter, into P4RSEC — with the telescope resolving alongside the last of it.',
            'The opening screen’s orbits have lost their drawn rings: four lights moving on paths you infer, rather than four circles with dots on them. They also run a fifth faster.',
        ],
    },
    {
        version: '5.9',
        changes: [
            'The month in the timeline control now rolls to the next one the way the digits beside it do, instead of swapping.',
            'On a phone, a card in a focused object’s detail panel now shrinks noticeably as the next one rides up over it, so it reads as having gone behind rather than as having been cut off. On the longer spacecraft panels the cards stack in depth, each one a step further back than the one in front.',
            'The buttons in the top right now sit in a dock: bare round icons on one dark bar, swelling toward your cursor as you move along them, with the name of whichever one you are pointing at shown beside it. Only the page you are currently on stays lit. On a computer only — nothing changes on a phone.',
            'The date and clock in the timeline control now roll digit by digit as time passes, instead of snapping.',
            'A focused planet’s figures — its mass, its radius, its orbital period — now wind up from zero to their real value as you arrive. The exponent on a number like 10²⁷ stays put while the rest counts.',
            'The timeline control no longer changes width as the date and time change — most noticeable in Arabic, where the wider numerals used to make it swell and shrink as you scrubbed.',
            'Fixed the globe being drawn into the bottom of its card, under a band of empty black, after flying into the Satellite Tracker on a phone. It only happened on the flight in, never on opening the tracker directly, and nothing but reloading the page cleared it.',
            'On a phone, the cards in a focused object’s detail panel now slide behind one another as you scroll instead of being cut in half at the panel’s top edge. Each card stays put and shrinks a little as the next one rides up over it, and lifts back off as you scroll up again.',
            'Opening the Satellite Tracker is now a flight rather than a page change. The camera flies to Earth in one movement and comes to rest with the planet filling the screen, daylit side toward you — and the tracker\u2019s own globe fades up out of that exact frame, same size, same continents, same daylight, before settling into its panel as the page appears around it. There is no black moment anywhere in it.',
            'Coming back from the tracker now pulls the camera back out of Earth into the wide solar system, instead of cutting to it.',
            'Fixed the Satellite Tracker only opening once. Every attempt after the first flew to Earth and then stopped there, with the page never arriving, until you reloaded the site.',
            'The back control on a focused planet and on the night sky is now the same plain \u201cGo back\u201d the tracker uses, instead of a round button with only an arrow in it \u2014 and on the night sky it now lines up with the wordmark above it.',
            'Earth on the tracker page is much brighter and truer in colour — it had been rendering about a third as bright as the same planet in the solar system view — and it now has clouds, which it was missing.',
            'Moons leave a trail behind them along their orbit while you are focused on their planet, in the moon\u2019s own colour, the same way the planets do around the Sun.',
            'The loading screen no longer has a soft yellow glow behind the wordmark.',
            'On a phone, the description panel for a focused object now opens sooner after you arrive — about 2.5 seconds instead of 4.',
            'On the night sky page, the "what am I looking at" readout no longer runs into the wordmark and version number at the top of a phone screen.',
            'The night sky’s AR toggle no longer sits on top of the "Go back" text next to it.',
            'The night sky’s compass dial keeps its arrow, but drops the little stem it used to grow beneath it.',
            'The AR permission prompt now warns that AR mode is an early feature and can be glitchy.',
        ],
    },
    {
        version: '5.8',
        changes: [
            'The solar system now opens already at true distances and true sizes — the honest, mostly-empty view of how far apart everything really is — rather than the compressed layout. Fly to any body to see it fill the frame.',
            'Fixed focused planets, moons, dwarf planets and asteroids sometimes not appearing at all under that new default, or the camera stopping well short of them instead of flying in close — a direct link straight to Mars, the Moon, Ceres and others could open onto empty space, or onto a body left tiny and distant. All now fly in and land close, the way they always used to.',
            'A Satellite Tracker button in the header, beside the night-sky and compare icons.',
            'The little tab that opens the scene’s view-options drawer is bare arrows again, without the box around it from last release.',
            'The frosted-glass look on cards and panels — most noticeably the description card over a focused planet — is stronger again: more visible, more like glass, less like a faint grey wash.',
            'On a desktop, the small "not to scale" note moved from the bottom-right corner up to the top, under the header icons.',
            'The interface now reads in Montserrat everywhere it is written left-to-right, instead of the operating system’s own default typeface.',
            'Earth and Venus no longer have a soft glowing halo around their edge.',
            'Numbers throughout the Arabic interface — distances, dates, the ISS tracker’s coordinates, a planet’s mass — now display in Arabic-Indic digits (٠١٢٣) instead of Western ones. Catalog names and scientific exponents are unaffected.',
        ],
    },
    {
        version: '5.7',
        changes: [
            'The loading screen is an orrery: four orbits turning around the wordmark, each with a planet on it, and the four light up one by one as the scene loads. It used to be a bar and a list of filenames.',
            'Something appears now before the app itself has finished loading — a single faint ring, drawn straight from the page, so the first moment of the site is no longer a blank black window while the code arrives.',
            'The handover into the solar system is one movement: the orbits swell and dissolve as though you were moving forward through them, and the wordmark flies up into the header as the scene comes through underneath.',
            'The interface has been rebuilt on a single column. The wordmark, the catalog heading, the first card’s edge, each page’s title, the timeline and a focused planet’s name now all line up on one vertical spine — previously they sat on as many as five different left edges, which is most of why the page never quite settled.',
            'Every surface, size and animation now comes from one shared set of values, so the header, the scene controls and the panels are drawn from the same material instead of five near-identical guesses at it.',
            'The bottom of the solar system view reads as one bar: the timeline at one end, “Explore the catalog” at the other, the scale note centred between them.',
            'A focused planet’s name and its figures now sit on shared baselines rather than a dozen pixels out from each other.',
            'The live telemetry ticker is a proper band across the page now, fading out at both ends instead of being cut off at the window edge.',
            'The compare table finally uses its full width — each body’s numbers sit in a column of their own, under a heading that follows you down the page.',
            'Catalog cards are a consistent shape whatever the object, and the photograph now brightens and pushes in as you hover.',
            'The satellite tracker’s readings sit in two even rows of four, instead of seven with a lonely eighth underneath.',
            'The “What’s up tonight” page has been retired. The night sky view at the star icon answers the same question, and lets you look around the real sky instead of reading a chart. Old links land on the solar system.',
        ],
    },
    {
        version: '5.6',
        changes: [
            'The rewind button now actually rewinds. It used to stop at real time; holding it now keeps going into reverse, up to a full year per second backward, mirroring fast-forward.',
            'Focusing a planet, moon or anything else now resets the clock to real time first, so the flight in reads at its natural pace instead of whatever speed you left the overview at. You can still speed up or slow down once you’re there — leaving puts the clock back to whatever pace it had before.',
            'The timeline pill now tucks itself away the moment you focus something, and comes back out the moment you return — with an actual sliding animation now, not an instant swap.',
        ],
    },
    {
        version: '5.5',
        changes: [
            'Planet trails are about two-thirds longer.',
            'The Sun\u2019s glare now grows and shrinks with the Sun as you zoom, instead of staying one fixed size on screen while the Sun itself shrank away to a dot underneath it.',
            'Fixed the view slowly panning away on its own if you left the page alone for a few minutes. The idle drift was tipping the camera right over the pole, at which point the scene\u2019s own \u201ckeep the horizon level\u201d correction found itself upside down and spun to fix it. The drift now swings back before it gets there.',
            'The \u201cRoll\u201d drift slider is gone \u2014 yaw and pitch remain. Your existing settings for those two are kept.',
            'On a desktop, flying to a planet at true distances now frames the Sun over its shoulder the way true sizes already did \u2014 and both stages now put it further out and well round to the left, rather than tucked just above the planet.',
            'On a phone, focusing a planet no longer jolts. The detail sheet waits until the flight has actually landed before it slides up, and the planet now glides into its new position along with it instead of jumping there in one frame.',
            'The Sun\u2019s lens-flare throws proper rays now \u2014 a spray of light out of the core at a dozen angles, plus a longer trail of soft ghosts across the frame.',
        ],
    },
    {
        version: '5.4',
        changes: [
            'AR mode actually lines up with the sky now. The whole compass side of it was mirrored east to west — point the phone at Orion and you got whatever sits on the opposite side of the sky — and the up/down reading was inverted on top of that, which is what the ten fixes before this one kept chasing around without catching. Rebuilt from the phone\u2019s orientation as one measurement instead of three separate ones.',
            'AR follows the phone when you tilt it sideways. The stars used to stay stubbornly level while the world behind them rolled, so anything but a perfectly upright hold pulled the two apart.',
            'AR now renders at the same field of view your camera is actually showing, instead of a fixed one that was 15\u201320% too narrow \u2014 things near the middle of the screen looked right while anything near the edge sat several degrees off.',
            'AR mode asks for one permission instead of two: the motion-sensor grant went away with the sensor it was for.',
        ],
    },
    {
        version: '5.3',
        changes: [
            'Ten releases in a row tried and failed to fix AR mode pointing at the wrong part of the sky. Those attempts are collapsed into this one line; the actual fix is in 5.4.',
            'Planets can leave a trail behind them now \u2014 a "Trails" toggle in the scene drawer puts a short, fading, colour-tinted arc behind each one as it moves along its orbit.',
            'The orbit ring dims while trails are on, so the trail itself stands out more, and focusing a planet now hides only that planet\u2019s own trail \u2014 every other one stays visible.',
            'The Sun\u2019s lens-flare now shows on phones too.',
            'AR mode no longer responds to dragging the screen \u2014 it\u2019s sensor-driven only now.',
            'Trails are on by default now.',
            'Fixed the satellite tracker and night sky looking noticeably darker in Chrome than Safari on a Mac \u2014 the same brightness fix the main view already had.',
        ],
    },
    {
        version: '5.2',
        changes: [
            'True sizes. The distances toggle has a third setting now — compressed distances, true distances, then true distances *and* sizes. That last one puts the whole scene on one scale, and it is unforgiving: a scene unit becomes 1.56 million km, so every planet drops far below a pixel and the view is orbit rings, names and a lot of nothing. That is what the solar system actually looks like. Fly to a body and it grows into its real proportions, with its moons at their real distances — the ISS turns out to skim Earth’s surface, because it does.',
            'At true sizes, focusing a planet now frames the Sun in the shot, off to one side — the same treatment the Voyagers and New Horizons already got. The flight out there is smoother and a little slower, too, and no longer swings past the Sun on its way to the planet.',
            'Fixed: Saturn’s ring shadow covered half the ring at true sizes, instead of just the part actually behind the planet.',
            'Fixed: leaving the night sky flew back down onto a focused Earth instead of reversing the dive out. It now pulls back to the wide solar-system view, undoing the trip in rather than replaying it.',
            'Reworked the night sky’s compass into a proper pointer fixed to the rim, the way an actual ship’s or aircraft’s compass shows your own heading against a rotating dial — the old one only lined up with “N” by coincidence, and drifted from it the moment you turned.',
            'AR mode’s sky tracking should feel steadier now — less jumpy when the phone moves quickly, less laggy when it doesn’t.',
            'Fixed the night sky view sometimes jumping around while dragging to look around on a phone — a second, incidental touch (a palm edge, a stray finger) could throw off the drag.',
            'Orbit paths now fade out when you focus a planet or moon instead of vanishing all at once.',
            'Removed the "What’s up tonight" icon from the header for now.',
            'Fixed the ISS’s selection ring dwarfing Earth and the Moon at true distances + sizes — it now shrinks along with everything else.',
            'At true distances + sizes, focusing any body now frames the Sun to the upper left, the same way for every planet, moon, dwarf planet, asteroid or comet — it used to land dead-centre above the body, and only for planets.',
        ],
    },
    {
        version: '5.1',
        changes: [
            'On a phone, the header’s row of icon buttons (language, share, tonight, sky, compare) is now one menu button — the row had quietly grown wide enough to run off the edge of the screen. Search stays put next to it, since it’s the one you reach for most.',
            'Fixed: a focused planet’s description card was invisibly blocking clicks on whatever else was near the top of the screen, not just the card itself.',
            'The Sun now throws a camera lens-flare — a bright core, a streak, and a trail of small coloured ghosts, the way a real camera glares when it catches a bright light.',
            'The flight into the night sky is a clean shot now: Earth’s description card, stats and buttons step aside for it instead of sliding in over the top, the descent holds the planet in frame the whole way down, and the fade to the night sky starts while the camera is still moving.',
        ],
    },
    {
        version: '5.0',
        changes: [
            'Opening the night sky is now a journey, not a jump cut: the camera flies to Earth, dives down to your actual location on the globe, and turns to face upward before the sky fades in — from the star icon, or the Tonight page.',
            'Fixed: hovering a constellation now actually highlights it — it silently never had, since 4.10.',
            'The constellation info card now lists its named stars, not just the brightest one.',
            'Fixed a flash back to a wide Earth view partway through the new dive-and-turn transition into the night sky.',
            'A constellation’s own stars now shine 50% brighter than the background stars around them.',
            'Search now finds constellations too, by name or code (try "orion" or "uma") — picking one takes you straight there.',
            'Smoothed the dive-and-turn into the night sky: it’s one continuous motion now instead of two separate steps.',
            'Zooming back out to the solar system from a focused planet is one smooth motion now too, instead of a pull-back followed by a separate swing to the sun.',
            'The night sky now starts at half star density instead of full — turn it up from the settings drawer if you want every star the sky has.',
            'Dropped the always-0° "Roll" line from the night sky’s compass.',
            'Fixed the night sky’s heading/altitude readout occasionally nudging the compass sideways when a number gained or lost a digit.',
            'Fixed the Milky Way backdrop disappearing behind a black void when you focused Voyager 1 or 2 with true distances on — the camera was flying straight out past the edge of it.',
            'The date/time control is back in the night sky view, so a date scrubbed elsewhere doesn’t leave you looking at a mystery sky with no way back to live.',
            'The date in the time control is clickable now — pick any day straight from a calendar instead of only dragging the scrubber to it.',
            'The time control now always shows the hour and minute next to the date, not just while live.',
        ],
    },
    {
        version: '4.10',
        changes: [
            'The ground in the night sky view no longer looks blue in daylight — it now has its own natural, neutral colour.',
            'A compass with a heading/altitude readout, so it is easier to tell which way you are facing.',
            'Constellations can now be clicked: it pans to face them and shows their name, star count and brightest star.',
        ],
    },
    {
        version: '4.9',
        changes: [
            'The night sky view has a settings drawer now: turn constellation lines or twinkle on and off, and dial the star density up or down.',
            'A "Look north" button snaps the view back to where it started.',
            'A "See the sky in 3D" link on the Tonight page takes you straight into the night-sky view.',
        ],
    },
    {
        version: '4.8',
        changes: [
            'The night sky now shows the Sun, Moon and planets too, and moves with the same clock you scrub the solar system with.',
            'A small readout names whichever constellation you’re facing.',
            'The 88 constellation names are translated into Arabic and Vietnamese.',
        ],
    },
    {
        version: '4.7',
        changes: [
            'A new night-sky view: real stars and the traditional constellation figures, oriented to your own location, right now. Find it behind the star icon in the header. Drag to look around, scroll to zoom.',
        ],
    },
    {
        version: '4.6',
        changes: [
            'This panel. Click the version number any time to see what has changed.',
            'The browser-tab icon is the wordmark’s telescope now.',
            'In Arabic, the rewind and fast-forward buttons swap sides and mirror, so the past is to the right the way it reads.',
            'When you are focused on a planet and wind time forward or back, the camera now travels with it instead of being left behind watching it shrink away.',
            'The Sun, the planets and the moons look brighter and richer now, and consistently so between Chrome and Safari.',
        ],
    },
    {
        version: '4.5',
        changes: [
            'A couple of first-time pointers to the time controls and the scene settings, so a new visitor can find them.',
        ],
    },
    {
        version: '4.4',
        changes: [
            'The warped-space grid is drawn as a soft window around each body now, instead of one endless sheet — you can see each dimple properly.',
            'The Sun’s gravity well is deeper and tighter, and gentler when you switch to true distances.',
            'The Milky Way backdrop looks the same brightness in every browser.',
        ],
    },
    {
        version: '4.3',
        changes: [
            'Every gravity field line is tinted the colour of the planet it flows into, with a small arrow at its tip showing the direction.',
            'Object names keep up with the view while you drag it around, instead of trailing a step behind.',
        ],
    },
    {
        version: '4.2',
        changes: [
            'The scene toggles — drift, distances, gravity — tuck into a slim drawer on the left edge, keeping the view uncluttered.',
            'On a phone the timeline opens ready to scrub.',
        ],
    },
    {
        version: '4.1',
        changes: [
            'Sliders for the idle camera drift: set how the view slowly turns, tips and rolls on its own when you leave it alone.',
        ],
    },
    {
        version: '4.0',
        changes: [
            'See the gravity. A new control lays a picture of the solar system’s gravity over the scene — first the warped “rubber sheet” grid, then flowing field lines. It keeps pace with the planets even at a year a second.',
        ],
    },
    {
        version: '3.9',
        changes: [
            '“Back to now” winds the planets, moons and probes home over a few seconds, instead of leaving them parked at the date you scrubbed to.',
        ],
    },
    {
        version: '3.8',
        changes: [
            'The whole atlas now speaks Arabic and Vietnamese — every name, label and description — with the page laid out right-to-left for Arabic.',
            'The satellite tracker names the country it is passing over in your language, all 240 of them.',
        ],
    },
    {
        version: '2.1',
        changes: [
            'A share button that folds the current camera, date and layout into a link — send someone the exact view you are looking at, right down to how the planets will stand during an eclipse.',
        ],
    },
    {
        version: '2.0',
        changes: [
            'True distances. A toggle spreads the solar system out to its real proportions and eases the camera back to watch it happen.',
            'The time control folds down to a small date pill when you would rather just look at the scene.',
        ],
    },
    {
        version: '1.8',
        changes: [
            'What’s up tonight: tell it where you are and it shows which planets are above your horizon right now, how high, and which way to face. Your location is remembered on your device and sent nowhere.',
        ],
    },
    {
        version: '1.7',
        changes: [
            'Compare any two bodies side by side at true relative size, with every statistic they share lined up label by label.',
        ],
    },
    {
        version: '1.6',
        changes: [
            'The ISS page became a proper satellite tracker: pick any spacecraft to follow it, draw a full orbit, and read its telemetry.',
        ],
    },
    {
        version: '1.5',
        changes: [
            'Objects the 3D scene cannot place — exoplanets, deep-sky targets, some spacecraft — show a photograph in their place instead of floating panels over nothing.',
        ],
    },
    {
        version: '1.4',
        changes: [
            'A time control: scrub the whole system through time at six speeds, forward or back, up to a year a second.',
            'Voyager 1 and 2 added to the scene at their real positions from mission tracking data, with their outbound tracks.',
            'The rocky planets and moons had their surfaces rebuilt — real relief that catches the light.',
        ],
    },
    {
        version: '1.0',
        changes: [
            'The first full release: the interactive 3D solar system, the object catalog, search, and the detail pages.',
        ],
    },
];
