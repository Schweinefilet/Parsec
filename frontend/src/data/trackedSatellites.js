// Everything the live tracker follows.
//
// One list, one shape, no special cases: the ISS is an entry here like any
// other, and adding a fourth spacecraft is adding a line. It used to be the
// exception — its own feed, its own hook, its own half of the page — which is
// why the tracker only ever really worked for the ISS.
//
// `catalogId` ties each one to its page in the object catalog, so the tracker
// can link through to what the thing actually is.
//
// `live` is a public video feed, or null. Every entry answers it, including
// the three that answer no — the shape stays uniform, which is the whole point
// of this file, and "no feed" is a fact about a satellite rather than a missing
// field. Exactly one has one. The ISS
// carries external cameras that NASA streams continuously; nothing else here
// has a camera pointed at anything, let alone a public downlink. Hubble and
// Chandra are telescopes looking away from Earth, and neither returns video at
// all — Chandra counts individual X-ray photons, sometimes for days, and an
// image is assembled from them afterwards. Tiangong's footage is broadcast by
// CCTV in segments rather than streamed.
//
// `group` is the CelesTrak group file the object appears in. Elements are
// fetched a group at a time rather than an object at a time — asking per
// object is what got the site blocked — so satellites sharing a group cost one
// request between them. If one ever moves out of its group the loader falls
// back to asking for it directly.
export const SATELLITES = [
    {
        id: 'iss',
        norad: 25544,
        name: 'International Space Station',
        shortName: 'ISS',
        catalogId: 'iss',
        group: 'stations',
        color: '#7fe3a0',
        // NASA's continuous stream from the external cameras on the Harmony
        // module. Verified live and embeddable at the time of writing; if it
        // ever goes dark the panel says so and offers the channel instead,
        // and the fix is this one id.
        live: {
            provider: 'youtube',
            id: 'awQzjn72bI0',
            title: 'Live high-definition views from the Space Station',
            source: 'NASA',
            // Where to send people when the id above stops being the stream.
            channelUrl: 'https://www.youtube.com/@NASA/streams',
        },
    },
    {
        id: 'tiangong',
        norad: 48274,               // CSS (Tianhe core module)
        name: 'Tiangong Space Station',
        shortName: 'Tiangong',
        catalogId: 'tiangong',
        group: 'stations',
        color: '#ff8f6b',
        live: null,      // CCTV broadcasts segments; there is no public stream
    },
    {
        id: 'chandra',
        norad: 25867,              // CXO
        name: 'Chandra X-ray Observatory',
        shortName: 'Chandra',
        catalogId: 'chandra',
        group: 'science',
        color: '#8fd8ff',
        live: null,      // an X-ray telescope: photon counts, not pictures
    },
    {
        id: 'hubble',
        norad: 20580,
        name: 'Hubble Space Telescope',
        shortName: 'Hubble',
        catalogId: 'hubble',
        group: 'science',
        color: '#c9a7ff',
        live: null,      // long exposures, assembled into images afterwards
    },
];

export const DEFAULT_SATELLITE = 'iss';

export const satelliteById = (id) => SATELLITES.find(s => s.id === id);
