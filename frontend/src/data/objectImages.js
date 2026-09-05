// Curated NASA imagery — one verified photograph or mission illustration per
// object. Every URL here was checked to load and to actually depict its subject;
// the live search API this replaced returned things like people celebrating at
// NASA HQ for "Mars". Objects with no suitable NASA image are absent on purpose
// and render the designed fallback in ObjectCard instead.
//
// Paths are relative to the NASA image CDN root below.

const CDN = 'https://images-assets.nasa.gov/image/';

const PATHS = {
    '55-cnc-e': 'PIA22069/PIA22069~medium.jpg',
    'amalthea': 'PIA25728/PIA25728~medium.jpg',
    'andromeda': 'PIA15416/PIA15416~medium.jpg',
    'apophis': 'PIA24168/PIA24168~medium.jpg',
    'ariel': 'PIA00037/PIA00037~small.jpg',
    'bennu': 'PIA24101/PIA24101~small.jpg',
    'callisto': 'PIA13896/PIA13896~small.jpg',
    'ceres': 'PIA19619/PIA19619~small.jpg',
    'chandra': '9501245/9501245~medium.jpg',
    'crab-nebula': 'PIA17563/PIA17563~medium.jpg',
    'deimos': 'PIA22250/PIA22250~medium.jpg',
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
    'jwst': 'PIA11195/PIA11195~thumb.jpg',
    'luna': 'GSFC_20171208_Archive_e001861/GSFC_20171208_Archive_e001861~medium.jpg',
    'mars': 'PIA00003/PIA00003~medium.jpg',
    'mercury': 'PIA10173/PIA10173~small.jpg',
    'mimas': 'PIA12761/PIA12761~small.jpg',
    'mir': 'sts071-744-017/sts071-744-017~medium.jpg',
    'miranda': 'PIA00044/PIA00044~small.jpg',
    'neptune': 'PIA00064/PIA00064~small.jpg',
    'nereid': 'PIA00054/PIA00054~thumb.jpg',
    'new-horizons': 'PIA21589/PIA21589~medium.jpg',
    'oberon': 'PIA00034/PIA00034~thumb.jpg',
    'orion-nebula': 'PIA04227/PIA04227~small.jpg',
    'phobos': 'PIA06335/PIA06335~thumb.jpg',
    'pillars-of-creation': 'GSFC_20171208_Archive_e000842/GSFC_20171208_Archive_e000842~medium.jpg',
    'pluto': 'PIA20658/PIA20658~small.jpg',
    'rhea': 'PIA14574/PIA14574~small.jpg',
    'saturn': 'PIA18276/PIA18276~small.jpg',
    'sun': 'PIA19821/PIA19821~medium.jpg',
    'tethys': 'PIA12709/PIA12709~small.jpg',
    'titan': 'PIA14910/PIA14910~small.jpg',
    'titania': 'PIA01979/PIA01979~thumb.jpg',
    'trappist-1e': 'PIA24371/PIA24371~medium.jpg',
    'triton': 'PIA18668/PIA18668~medium.jpg',
    'umbriel': 'PIA00040/PIA00040~thumb.jpg',
    'uranus': 'PIA18182/PIA18182~medium.jpg',
    'venus': 'PIA00257/PIA00257~medium.jpg',
    'vesta': 'PIA15351/PIA15351~small.jpg',
    'voyager1': 'PIA17462/PIA17462~medium.jpg',
    'voyager2': 'PIA22921/PIA22921~small.jpg',
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
