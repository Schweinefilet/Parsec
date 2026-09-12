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
