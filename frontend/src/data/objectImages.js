// Curated NASA imagery — one verified photograph or mission illustration per
// object. Every URL here was checked to load and to actually depict its subject;
// the live search API this replaced returned things like people celebrating at
// NASA HQ for "Mars". Objects with no suitable NASA image are absent on purpose
// and render the designed fallback in ObjectCard instead.
//
// The absences are not a backlog. NASA's image library was searched again for
// every object still on fallback art, and for most of them it simply has
// nothing: no hits at all for Haumea, Makemake, Pallas, Tiangong, 51 Pegasi b,
// K2-18b, HD 209458 b, GJ 1214 b, 3122 Florence or 1994 PC1. Searching for
// "Proteus" returns an experimental aircraft, "2023 BU" returns a satellite
// programme, and "Sputnik" returns Pluto's Sputnik Planum.
//
// What it does have is generic concept art — a "hot Jupiter artist concept", a
// "super-Earth artist concept" — and those are deliberately not used. They are
// pictures of other planets, and putting one on GJ 1214 b's card would be the
// same failure as the celebrating scientists: an image that loads, looks
// plausible, and is not the thing.
//
// Paths are relative to the NASA image CDN root below.

const CDN = 'https://images-assets.nasa.gov/image/';

const PATHS = {
    '55-cnc-e': 'PIA22069/PIA22069~medium.jpg',
    'amalthea': 'PIA25728/PIA25728~medium.jpg',
    'andromeda': 'PIA15416/PIA15416~medium.jpg',
    // Apophis (PIA24168, a Goldstone/Green Bank radar strip with date labels)
    // and Bennu (PIA24101, an annotated particle-ejection figure) were both
    // science plots rather than a view of the rock — the designed fallback art
    // reads better on a card than either did.
    'ariel': 'PIA00037/PIA00037~small.jpg',
    'callisto': 'PIA13896/PIA13896~small.jpg',
    'ceres': 'PIA19619/PIA19619~small.jpg',
    'chandra': '9501245/9501245~medium.jpg',
    'crab-nebula': 'PIA17563/PIA17563~medium.jpg',
    // MRO HiRISE colour view, two angles. The earlier PIA22250 was a THEMIS
    // thermal-analysis figure — a VIS thumbnail beside a false-colour
    // temperature grid and a "110–200K" scale bar — which read as a broken
    // image on a card rather than as Deimos.
    'deimos': 'PIA11826/PIA11826~small.jpg',
    'didymos': 'PIA25329/PIA25329~medium.jpg',
    'dione': 'PIA14914/PIA14914~medium.jpg',
    'earth': 'PIA18033/PIA18033~medium.jpg',
    'enceladus': 'PIA23175/PIA23175~medium.jpg',
    'eris': 'PIA17307/PIA17307~medium.jpg',
    'europa': 'PIA19048/PIA19048~medium.jpg',
    'ganymede': 'PIA26075/PIA26075~medium.jpg',
    'halley': 'PIA17485/PIA17485~small.jpg',
    'helix-nebula': 'PIA15658/PIA15658~medium.jpg',
    'hubble': 's125e012036/s125e012036~medium.jpg',
    'iapetus': 'PIA12556/PIA12556~thumb.jpg',
    'io': 'PIA00282/PIA00282~small.jpg',
    'iss': 's132e013215/s132e013215~medium.jpg',
    'jupiter': 'PIA21395/PIA21395~medium.jpg',
    // The segmented primary mirror during assembly at Goddard. The earlier
    // PIA11195 was a close-up of a NIRCam detector in someone's gloved hands —
    // real Webb hardware, but unrecognisable as the telescope.
    'jwst': 'GSFC_20171208_Archive_e000422/GSFC_20171208_Archive_e000422~medium.jpg',
    // The Kepler mission's own artist concept of this planet, not of a
    // similar one — the description names Kepler-22b explicitly.
    'kepler-22b': 'PIA14883/PIA14883~medium.jpg',
    'luna': 'GSFC_20171208_Archive_e001861/GSFC_20171208_Archive_e001861~medium.jpg',
    'mars': 'PIA00003/PIA00003~medium.jpg',
    'mercury': 'PIA10173/PIA10173~small.jpg',
    'mimas': 'PIA12761/PIA12761~small.jpg',
    'mir': 'sts071-744-017/sts071-744-017~medium.jpg',
    'miranda': 'PIA00044/PIA00044~small.jpg',
    'neptune': 'PIA00064/PIA00064~small.jpg',
    'nereid': 'PIA00054/PIA00054~thumb.jpg',
    // Artist's concept of the spacecraft at Pluto. The earlier PIA21589 ("Nap
    // Time for New Horizons") was a solar-system map showing where it had
    // drifted to, not a picture of the probe.
    'new-horizons': 'PIA10075/PIA10075~medium.jpg',
    'oberon': 'PIA00034/PIA00034~thumb.jpg',
    'orion-nebula': 'PIA04227/PIA04227~small.jpg',
    'phobos': 'PIA06335/PIA06335~thumb.jpg',
    'pillars-of-creation': 'GSFC_20171208_Archive_e000842/GSFC_20171208_Archive_e000842~medium.jpg',
    'pluto': 'PIA20658/PIA20658~small.jpg',
    'rhea': 'PIA14574/PIA14574~small.jpg',
    'saturn': 'PIA18276/PIA18276~small.jpg',
    // A full-scale Sputnik 1 mockup at the 1975 Paris Air Show. The flight
    // article re-entered in January 1958, so a mockup is what a photograph of
    // Sputnik 1 can be.
    'sputnik1': 'S76-22361/S76-22361~medium.jpg',
    'sun': 'PIA19821/PIA19821~medium.jpg',
    'tethys': 'PIA12709/PIA12709~small.jpg',
    'titan': 'PIA14910/PIA14910~small.jpg',
    'titania': 'PIA01979/PIA01979~thumb.jpg',
    // The seven TRAPPIST-1 planets rendered as spheres against the dwarf star.
    // PIA24371 was a "planet density vs. illumination" scatter plot.
    'trappist-1e': 'PIA22093/PIA22093~medium.jpg',
    'triton': 'PIA18668/PIA18668~medium.jpg',
    'umbriel': 'PIA00040/PIA00040~thumb.jpg',
    'uranus': 'PIA18182/PIA18182~medium.jpg',
    'venus': 'PIA00257/PIA00257~medium.jpg',
    'vesta': 'PIA15351/PIA15351~small.jpg',
    'voyager1': 'PIA17462/PIA17462~medium.jpg',
    // Same spacecraft render as Voyager 1 — they are identical craft, and the
    // earlier PIA22921 was a heliosphere cross-section diagram.
    'voyager2': 'PIA17462/PIA17462~medium.jpg',
    'whirlpool-galaxy': 'PIA23005/PIA23005~medium.jpg',
};

/** Full image URL for an object id, or null when it should use the fallback. */
export function objectImage(id) {
    const path = PATHS[id];
    return path ? CDN + path : null;
}

export function hasImage(id) {
    return Object.prototype.hasOwnProperty.call(PATHS, id);
}
